-- 019_production_module.sql
-- Module Produits (A4) : ajustements schema + RPCs transactionnelles.
-- Ajoute le mode produit/melange sur production_lots, rend nb_unites/poids_total_g nullable,
-- ajoute fournisseur sur production_lot_ingredients.
-- Cree 4 RPCs : create, delete (soft), restore, conditionner.
--
-- SECURITY DEFINER : les RLS ne s'appliquent pas a l'interieur — la verification d'acces
-- est faite AVANT l'appel cote Server Action (via getContext()).
--
-- ⚠️ A executer manuellement dans Supabase SQL Editor.

-- =============================================================================
-- 1. MODIFICATIONS DE SCHEMA
-- =============================================================================

-- 1.1 production_lots : ajout colonne mode
ALTER TABLE production_lots
  ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'produit'
    CHECK (mode IN ('produit', 'melange'));

-- 1.2 production_lots : rendre nb_unites nullable (NULL en mode melange tant que pas conditionne)
ALTER TABLE production_lots ALTER COLUMN nb_unites DROP NOT NULL;
ALTER TABLE production_lots DROP CONSTRAINT IF EXISTS production_lots_nb_unites_check;
ALTER TABLE production_lots ADD CONSTRAINT production_lots_nb_unites_check CHECK (nb_unites IS NULL OR nb_unites > 0);

-- 1.3 production_lots : rendre poids_total_g nullable (calcule differemment selon le mode)
ALTER TABLE production_lots ALTER COLUMN poids_total_g DROP NOT NULL;
ALTER TABLE production_lots DROP CONSTRAINT IF EXISTS production_lots_poids_total_g_check;
ALTER TABLE production_lots ADD CONSTRAINT production_lots_poids_total_g_check CHECK (poids_total_g IS NULL OR poids_total_g > 0);

-- 1.4 production_lot_ingredients : ajout colonne fournisseur (obligatoire si external_material_id IS NOT NULL — validation applicative)
ALTER TABLE production_lot_ingredients
  ADD COLUMN IF NOT EXISTS fournisseur TEXT;


-- =============================================================================
-- 2. RPC — create_production_lot_with_stock
-- =============================================================================

CREATE OR REPLACE FUNCTION create_production_lot_with_stock(
  p_farm_id         UUID,
  p_recipe_id       UUID,
  p_mode            TEXT,
  p_numero_lot      TEXT,
  p_date_production DATE,
  p_ddm             DATE,
  p_nb_unites       INTEGER,
  p_poids_total_g   NUMERIC,
  p_temps_min       INTEGER,
  p_commentaire     TEXT,
  p_created_by      UUID,
  p_ingredients     JSONB
) RETURNS UUID AS $$
DECLARE
  v_lot_id       UUID;
  v_ingredient   JSONB;
  v_variety_id   UUID;
  v_ext_mat_id   UUID;
  v_etat_plante  TEXT;
  v_partie_plante TEXT;
  v_pourcentage  NUMERIC;
  v_poids_g      NUMERIC;
  v_annee_recolte INTEGER;
  v_fournisseur  TEXT;
  v_stock_dispo  NUMERIC;
BEGIN
  -- Validation du mode
  IF p_mode NOT IN ('produit', 'melange') THEN
    RAISE EXCEPTION 'mode invalide: %. Valeurs attendues: produit, melange', p_mode;
  END IF;

  -- Validation multi-tenant : la recette appartient a la ferme
  IF p_recipe_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM recipes WHERE id = p_recipe_id AND farm_id = p_farm_id AND deleted_at IS NULL) THEN
      RAISE EXCEPTION 'recipe not found or does not belong to farm: %', p_recipe_id;
    END IF;
  END IF;

  -- 1. Creer le production_lot
  INSERT INTO production_lots (
    farm_id, recipe_id, mode, numero_lot, date_production, ddm,
    nb_unites, poids_total_g, temps_min, commentaire, created_by
  ) VALUES (
    p_farm_id, p_recipe_id, p_mode, p_numero_lot, p_date_production, p_ddm,
    p_nb_unites, p_poids_total_g, p_temps_min, p_commentaire, p_created_by
  ) RETURNING id INTO v_lot_id;

  -- 2. Inserer les ingredients + mouvements de stock
  FOR v_ingredient IN SELECT * FROM jsonb_array_elements(p_ingredients)
  LOOP
    v_variety_id    := (v_ingredient ->> 'variety_id')::UUID;
    v_ext_mat_id    := (v_ingredient ->> 'external_material_id')::UUID;
    v_etat_plante   := v_ingredient ->> 'etat_plante';
    v_partie_plante := v_ingredient ->> 'partie_plante';
    v_pourcentage   := (v_ingredient ->> 'pourcentage')::NUMERIC;
    v_poids_g       := (v_ingredient ->> 'poids_g')::NUMERIC;
    v_annee_recolte := (v_ingredient ->> 'annee_recolte')::INTEGER;
    v_fournisseur   := v_ingredient ->> 'fournisseur';

    -- Inserer l'ingredient
    INSERT INTO production_lot_ingredients (
      production_lot_id, variety_id, external_material_id,
      etat_plante, partie_plante, pourcentage, poids_g,
      annee_recolte, fournisseur
    ) VALUES (
      v_lot_id, v_variety_id, v_ext_mat_id,
      v_etat_plante, v_partie_plante, v_pourcentage, v_poids_g,
      v_annee_recolte, v_fournisseur
    );

    -- 3. Pour chaque ingredient PLANTE : verifier stock + creer mouvement de SORTIE
    IF v_variety_id IS NOT NULL THEN
      -- Verifier le stock disponible (3 dimensions : variete x partie x etat)
      SELECT COALESCE(stock_g, 0) INTO v_stock_dispo
      FROM v_stock
      WHERE farm_id = p_farm_id
        AND variety_id = v_variety_id
        AND partie_plante = v_partie_plante
        AND etat_plante = v_etat_plante;

      IF v_stock_dispo IS NULL OR v_stock_dispo < v_poids_g THEN
        RAISE EXCEPTION 'Stock insuffisant pour % (partie: %, etat: %) : % g disponible, % g requis',
          (SELECT nom_vernaculaire FROM varieties WHERE id = v_variety_id),
          v_partie_plante, v_etat_plante,
          COALESCE(v_stock_dispo, 0), v_poids_g;
      END IF;

      -- Creer le mouvement de SORTIE
      INSERT INTO stock_movements (
        farm_id, variety_id, partie_plante, date, type_mouvement,
        etat_plante, poids_g, source_type, source_id, created_by
      ) VALUES (
        p_farm_id, v_variety_id, v_partie_plante, p_date_production, 'sortie',
        v_etat_plante, v_poids_g, 'production', v_lot_id, p_created_by
      );
    END IF;
  END LOOP;

  RETURN v_lot_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- =============================================================================
-- 3. RPC — delete_production_lot_with_stock (soft delete)
-- =============================================================================

CREATE OR REPLACE FUNCTION delete_production_lot_with_stock(
  p_lot_id     UUID,
  p_farm_id    UUID,
  p_updated_by UUID
) RETURNS VOID AS $$
BEGIN
  -- Verifier que le lot existe, n'est pas deja supprime, et appartient a la ferme
  IF NOT EXISTS (SELECT 1 FROM production_lots WHERE id = p_lot_id AND farm_id = p_farm_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'production_lot not found, already deleted, or does not belong to farm: %', p_lot_id;
  END IF;

  -- 1. Soft delete du lot
  UPDATE production_lots
  SET deleted_at = NOW(), updated_by = p_updated_by
  WHERE id = p_lot_id AND farm_id = p_farm_id;

  -- 2. Soft delete des stock_movements associes (restaure le stock)
  UPDATE stock_movements
  SET deleted_at = NOW()
  WHERE source_type = 'production' AND source_id = p_lot_id AND farm_id = p_farm_id AND deleted_at IS NULL;

  -- 3. Hard delete des production_lot_ingredients
  -- (seront recrees si le lot est restaure via les donnees de la recette)
  DELETE FROM production_lot_ingredients
  WHERE production_lot_id = p_lot_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- =============================================================================
-- 4. RPC — restore_production_lot_with_stock
-- =============================================================================

CREATE OR REPLACE FUNCTION restore_production_lot_with_stock(
  p_lot_id     UUID,
  p_farm_id    UUID,
  p_updated_by UUID,
  p_ingredients JSONB
) RETURNS VOID AS $$
DECLARE
  v_lot         production_lots%ROWTYPE;
  v_ingredient  JSONB;
  v_variety_id  UUID;
  v_ext_mat_id  UUID;
  v_etat_plante TEXT;
  v_partie_plante TEXT;
  v_pourcentage NUMERIC;
  v_poids_g     NUMERIC;
  v_annee_recolte INTEGER;
  v_fournisseur TEXT;
  v_stock_dispo NUMERIC;
BEGIN
  -- Verifier que le lot existe, est bien supprime, et appartient a la ferme
  SELECT * INTO v_lot FROM production_lots WHERE id = p_lot_id AND farm_id = p_farm_id AND deleted_at IS NOT NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'production_lot not found or not deleted: %', p_lot_id;
  END IF;

  -- 1. Restaurer le lot
  UPDATE production_lots
  SET deleted_at = NULL, updated_by = p_updated_by
  WHERE id = p_lot_id AND farm_id = p_farm_id;

  -- 2. Recreer les ingredients + verifier stock + recreer les mouvements de sortie
  FOR v_ingredient IN SELECT * FROM jsonb_array_elements(p_ingredients)
  LOOP
    v_variety_id    := (v_ingredient ->> 'variety_id')::UUID;
    v_ext_mat_id    := (v_ingredient ->> 'external_material_id')::UUID;
    v_etat_plante   := v_ingredient ->> 'etat_plante';
    v_partie_plante := v_ingredient ->> 'partie_plante';
    v_pourcentage   := (v_ingredient ->> 'pourcentage')::NUMERIC;
    v_poids_g       := (v_ingredient ->> 'poids_g')::NUMERIC;
    v_annee_recolte := (v_ingredient ->> 'annee_recolte')::INTEGER;
    v_fournisseur   := v_ingredient ->> 'fournisseur';

    -- Inserer l'ingredient
    INSERT INTO production_lot_ingredients (
      production_lot_id, variety_id, external_material_id,
      etat_plante, partie_plante, pourcentage, poids_g,
      annee_recolte, fournisseur
    ) VALUES (
      p_lot_id, v_variety_id, v_ext_mat_id,
      v_etat_plante, v_partie_plante, v_pourcentage, v_poids_g,
      v_annee_recolte, v_fournisseur
    );

    -- Pour chaque ingredient PLANTE : re-verifier stock + recreer mouvement de SORTIE
    IF v_variety_id IS NOT NULL THEN
      SELECT COALESCE(stock_g, 0) INTO v_stock_dispo
      FROM v_stock
      WHERE farm_id = v_lot.farm_id
        AND variety_id = v_variety_id
        AND partie_plante = v_partie_plante
        AND etat_plante = v_etat_plante;

      IF v_stock_dispo IS NULL OR v_stock_dispo < v_poids_g THEN
        RAISE EXCEPTION 'Stock insuffisant pour restauration — % (partie: %, etat: %) : % g disponible, % g requis',
          (SELECT nom_vernaculaire FROM varieties WHERE id = v_variety_id),
          v_partie_plante, v_etat_plante,
          COALESCE(v_stock_dispo, 0), v_poids_g;
      END IF;

      INSERT INTO stock_movements (
        farm_id, variety_id, partie_plante, date, type_mouvement,
        etat_plante, poids_g, source_type, source_id, created_by
      ) VALUES (
        v_lot.farm_id, v_variety_id, v_partie_plante, v_lot.date_production, 'sortie',
        v_etat_plante, v_poids_g, 'production', p_lot_id, p_updated_by
      );
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- =============================================================================
-- 5. RPC — update_production_lot_conditionner (mode melange → ajout nb_unites)
-- =============================================================================

CREATE OR REPLACE FUNCTION update_production_lot_conditionner(
  p_lot_id     UUID,
  p_farm_id    UUID,
  p_nb_unites  INTEGER,
  p_updated_by UUID
) RETURNS VOID AS $$
BEGIN
  IF p_nb_unites IS NULL OR p_nb_unites <= 0 THEN
    RAISE EXCEPTION 'nb_unites invalide: %. Doit etre > 0', p_nb_unites;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM production_lots
    WHERE id = p_lot_id AND farm_id = p_farm_id AND deleted_at IS NULL AND mode = 'melange'
  ) THEN
    RAISE EXCEPTION 'production_lot not found, deleted, does not belong to farm, or not in mode melange: %', p_lot_id;
  END IF;

  UPDATE production_lots
  SET nb_unites = p_nb_unites, updated_by = p_updated_by
  WHERE id = p_lot_id AND farm_id = p_farm_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
