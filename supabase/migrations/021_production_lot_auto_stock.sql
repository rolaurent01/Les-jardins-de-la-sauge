-- 021_production_lot_auto_stock.sql
-- Entree automatique dans product_stock_movements quand un lot est cree
-- avec nb_unites (mode produit) ou quand un lot melange est conditionne.
-- Gere aussi le soft-delete/restore symetrique des mouvements produit fini.
--
-- ⚠️ A executer manuellement dans Supabase SQL Editor.

-- =============================================================================
-- 0. SCHEMA — ajout deleted_at sur product_stock_movements (soft delete)
-- =============================================================================

ALTER TABLE product_stock_movements
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- =============================================================================
-- 1. RPC — create_production_lot_with_stock (ajout entree produit fini)
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

      INSERT INTO stock_movements (
        farm_id, variety_id, partie_plante, date, type_mouvement,
        etat_plante, poids_g, source_type, source_id, created_by
      ) VALUES (
        p_farm_id, v_variety_id, v_partie_plante, p_date_production, 'sortie',
        v_etat_plante, v_poids_g, 'production', v_lot_id, p_created_by
      );
    END IF;
  END LOOP;

  -- 4. Si nb_unites est renseigne (mode produit), creer un mouvement d'entree produit fini
  IF p_nb_unites IS NOT NULL AND p_nb_unites > 0 THEN
    INSERT INTO product_stock_movements (
      farm_id, production_lot_id, date, type_mouvement, quantite,
      commentaire, created_by
    ) VALUES (
      p_farm_id, v_lot_id, p_date_production, 'entree', p_nb_unites,
      'Entree automatique a la production', p_created_by
    );
  END IF;

  RETURN v_lot_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- =============================================================================
-- 2. RPC — update_production_lot_conditionner (ajout entree produit fini)
-- =============================================================================

CREATE OR REPLACE FUNCTION update_production_lot_conditionner(
  p_lot_id     UUID,
  p_farm_id    UUID,
  p_nb_unites  INTEGER,
  p_updated_by UUID
) RETURNS VOID AS $$
DECLARE
  v_lot production_lots%ROWTYPE;
BEGIN
  IF p_nb_unites IS NULL OR p_nb_unites <= 0 THEN
    RAISE EXCEPTION 'nb_unites invalide: %. Doit etre > 0', p_nb_unites;
  END IF;

  SELECT * INTO v_lot FROM production_lots
  WHERE id = p_lot_id AND farm_id = p_farm_id AND deleted_at IS NULL AND mode = 'melange';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'production_lot not found, deleted, does not belong to farm, or not in mode melange: %', p_lot_id;
  END IF;

  UPDATE production_lots
  SET nb_unites = p_nb_unites, updated_by = p_updated_by
  WHERE id = p_lot_id AND farm_id = p_farm_id;

  -- Creer un mouvement d'entree produit fini au conditionnement
  INSERT INTO product_stock_movements (
    farm_id, production_lot_id, date, type_mouvement, quantite,
    commentaire, created_by
  ) VALUES (
    p_farm_id, p_lot_id, v_lot.date_production, 'entree', p_nb_unites,
    'Entree automatique au conditionnement', p_updated_by
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- =============================================================================
-- 3. RPC — delete_production_lot_with_stock (soft-delete aussi product_stock_movements)
-- =============================================================================

CREATE OR REPLACE FUNCTION delete_production_lot_with_stock(
  p_lot_id     UUID,
  p_farm_id    UUID,
  p_updated_by UUID
) RETURNS VOID AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM production_lots WHERE id = p_lot_id AND farm_id = p_farm_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'production_lot not found, already deleted, or does not belong to farm: %', p_lot_id;
  END IF;

  -- 1. Soft delete du lot
  UPDATE production_lots
  SET deleted_at = NOW(), updated_by = p_updated_by
  WHERE id = p_lot_id AND farm_id = p_farm_id;

  -- 2. Soft delete des stock_movements associes (restaure le stock plantes)
  UPDATE stock_movements
  SET deleted_at = NOW()
  WHERE source_type = 'production' AND source_id = p_lot_id AND farm_id = p_farm_id AND deleted_at IS NULL;

  -- 3. Soft delete des product_stock_movements automatiques (entree auto)
  UPDATE product_stock_movements
  SET deleted_at = NOW()
  WHERE production_lot_id = p_lot_id AND farm_id = p_farm_id AND deleted_at IS NULL;

  -- NOTE : les production_lot_ingredients ne sont PAS supprimes.
  -- Ils restent en base, lies au lot par FK — necessaires pour la restauration.
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- =============================================================================
-- 4. RPC — restore_production_lot_with_stock (restaure aussi product_stock_movements)
-- =============================================================================

CREATE OR REPLACE FUNCTION restore_production_lot_with_stock(
  p_lot_id     UUID,
  p_farm_id    UUID,
  p_updated_by UUID
) RETURNS VOID AS $$
DECLARE
  v_lot         production_lots%ROWTYPE;
  v_ing         RECORD;
  v_stock_dispo NUMERIC;
BEGIN
  SELECT * INTO v_lot FROM production_lots WHERE id = p_lot_id AND farm_id = p_farm_id AND deleted_at IS NOT NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'production_lot not found or not deleted: %', p_lot_id;
  END IF;

  -- 1. Restaurer le lot
  UPDATE production_lots
  SET deleted_at = NULL, updated_by = p_updated_by
  WHERE id = p_lot_id AND farm_id = p_farm_id;

  -- 2. Restaurer les stock_movements existants
  UPDATE stock_movements
  SET deleted_at = NULL
  WHERE source_type = 'production' AND source_id = p_lot_id AND farm_id = p_farm_id AND deleted_at IS NOT NULL;

  -- 3. Restaurer les product_stock_movements
  UPDATE product_stock_movements
  SET deleted_at = NULL
  WHERE production_lot_id = p_lot_id AND farm_id = p_farm_id AND deleted_at IS NOT NULL;

  -- 4. Re-verifier le stock pour chaque ingredient plante
  FOR v_ing IN
    SELECT * FROM production_lot_ingredients WHERE production_lot_id = p_lot_id
  LOOP
    IF v_ing.variety_id IS NOT NULL THEN
      SELECT COALESCE(stock_g, 0) INTO v_stock_dispo
      FROM v_stock
      WHERE farm_id = v_lot.farm_id
        AND variety_id = v_ing.variety_id
        AND partie_plante = v_ing.partie_plante
        AND etat_plante = v_ing.etat_plante;

      IF v_stock_dispo IS NULL OR v_stock_dispo < v_ing.poids_g THEN
        -- Annuler la restauration en cas de stock insuffisant
        UPDATE production_lots
        SET deleted_at = NOW(), updated_by = p_updated_by
        WHERE id = p_lot_id AND farm_id = p_farm_id;

        UPDATE stock_movements
        SET deleted_at = NOW()
        WHERE source_type = 'production' AND source_id = p_lot_id AND farm_id = p_farm_id;

        UPDATE product_stock_movements
        SET deleted_at = NOW()
        WHERE production_lot_id = p_lot_id AND farm_id = p_farm_id;

        RAISE EXCEPTION 'Stock insuffisant pour restauration — % (partie: %, etat: %) : % g disponible, % g requis',
          (SELECT nom_vernaculaire FROM varieties WHERE id = v_ing.variety_id),
          v_ing.partie_plante, v_ing.etat_plante,
          COALESCE(v_stock_dispo, 0), v_ing.poids_g;
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
