-- 031_stock_external_materials.sql
-- Stock et tracabilite des materiaux externes (sucre, vinaigre, sel, etc.)
--
-- Fonctionnalites :
--   1. Les materiaux externes ont desormais un stock par ferme (entree/sortie)
--   2. Tracabilite achat → lot de production via table de liaison production_ingredient_sources
--   3. Numero de facture sur les achats
--   4. Vue v_stock_external pour le stock en temps reel
--   5. RPCs mises a jour pour gerer les mouvements de stock des materiaux externes
--
-- SECURITY DEFINER : les RLS ne s'appliquent pas a l'interieur des RPCs.
-- ⚠️ A executer manuellement dans Supabase SQL Editor.


-- =============================================================================
-- 1. MODIFICATIONS DE SCHEMA
-- =============================================================================

-- 1.1 stock_movements : rendre variety_id nullable + ajouter external_material_id
--     Les mouvements de stock peuvent concerner une variete OU un materiau externe.
ALTER TABLE stock_movements ALTER COLUMN variety_id DROP NOT NULL;

ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS external_material_id UUID REFERENCES external_materials(id);

-- Rendre partie_plante nullable (NULL pour les materiaux externes)
ALTER TABLE stock_movements ALTER COLUMN partie_plante DROP NOT NULL;

-- Rendre etat_plante nullable (NULL pour les materiaux externes)
ALTER TABLE stock_movements ALTER COLUMN etat_plante DROP NOT NULL;

-- Contrainte : exactement l'un des deux doit etre rempli
ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_source_material_check;
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_source_material_check CHECK (
  (variety_id IS NOT NULL AND external_material_id IS NULL)
  OR
  (variety_id IS NULL AND external_material_id IS NOT NULL)
);

-- 1.2 stock_purchases : rendre variety_id nullable + ajouter external_material_id + numero_facture
ALTER TABLE stock_purchases ALTER COLUMN variety_id DROP NOT NULL;

ALTER TABLE stock_purchases
  ADD COLUMN IF NOT EXISTS external_material_id UUID REFERENCES external_materials(id);

-- Rendre partie_plante nullable (NULL pour les materiaux externes)
-- partie_plante a un CHECK constraint ajoute par migration 004/022, on ne touche pas au CHECK, juste au NOT NULL
-- (elle n'est deja pas NOT NULL sur stock_purchases — ajoutee avec DEFAULT, mais pas NOT NULL dans 004)

-- Rendre etat_plante nullable (les materiaux externes n'ont pas d'etat_plante)
ALTER TABLE stock_purchases ALTER COLUMN etat_plante DROP NOT NULL;

-- Contrainte : exactement l'un des deux doit etre rempli
ALTER TABLE stock_purchases DROP CONSTRAINT IF EXISTS stock_purchases_source_material_check;
ALTER TABLE stock_purchases ADD CONSTRAINT stock_purchases_source_material_check CHECK (
  (variety_id IS NOT NULL AND external_material_id IS NULL)
  OR
  (variety_id IS NULL AND external_material_id IS NOT NULL)
);

-- Numero de facture fournisseur
ALTER TABLE stock_purchases
  ADD COLUMN IF NOT EXISTS numero_facture TEXT;

-- Rendre fournisseur nullable (obligatoire cote applicatif, mais pas en SQL pour ne pas casser les achats plantes existants)
ALTER TABLE stock_purchases ALTER COLUMN fournisseur DROP NOT NULL;


-- 1.3 production_ingredient_sources : table de liaison ingredient → achat(s)
--     Permet de tracer quel achat (et quelle quantite) alimente chaque ingredient externe
--     d'un lot de production. Un ingredient peut etre approvisionne par plusieurs achats.
CREATE TABLE IF NOT EXISTS production_ingredient_sources (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id                       UUID NOT NULL REFERENCES farms(id),
  production_lot_ingredient_id  UUID NOT NULL REFERENCES production_lot_ingredients(id) ON DELETE CASCADE,
  stock_purchase_id             UUID NOT NULL REFERENCES stock_purchases(id),
  poids_g                       DECIMAL NOT NULL CHECK (poids_g > 0),
  created_at                    TIMESTAMPTZ DEFAULT now()
);

-- Index pour perfs
CREATE INDEX IF NOT EXISTS idx_pis_ingredient ON production_ingredient_sources(production_lot_ingredient_id);
CREATE INDEX IF NOT EXISTS idx_pis_purchase   ON production_ingredient_sources(stock_purchase_id);
CREATE INDEX IF NOT EXISTS idx_pis_farm       ON production_ingredient_sources(farm_id);

-- RLS multi-tenant
ALTER TABLE production_ingredient_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON production_ingredient_sources
  FOR ALL USING (farm_id IN (SELECT user_farm_ids()));


-- =============================================================================
-- 2. VUE v_stock_external — Stock materiaux externes en temps reel
-- =============================================================================

CREATE OR REPLACE VIEW v_stock_external
  WITH (security_invoker = true)
AS
SELECT
  sm.farm_id,
  sm.external_material_id,
  em.nom,
  em.unite,
  SUM(
    CASE WHEN sm.type_mouvement = 'entree' THEN sm.poids_g
         ELSE -sm.poids_g
    END
  ) AS stock_g
FROM stock_movements sm
JOIN external_materials em ON em.id = sm.external_material_id
WHERE sm.deleted_at IS NULL
  AND em.deleted_at IS NULL
  AND sm.external_material_id IS NOT NULL
GROUP BY sm.farm_id, sm.external_material_id, em.nom, em.unite;


-- =============================================================================
-- 3. INDEX supplementaire pour stock_movements sur external_material_id
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_stock_movements_external_material
  ON stock_movements(external_material_id)
  WHERE external_material_id IS NOT NULL AND deleted_at IS NULL;


-- =============================================================================
-- 4. RPC — create_purchase_with_stock (mise a jour pour materiaux externes)
-- =============================================================================

CREATE OR REPLACE FUNCTION create_purchase_with_stock(
  p_farm_id                UUID,
  p_variety_id             UUID,
  p_partie_plante          TEXT,
  p_date                   DATE,
  p_etat_plante            TEXT,
  p_poids_g                NUMERIC,
  p_fournisseur            TEXT,
  p_numero_lot_fournisseur TEXT,
  p_certif_ab              BOOLEAN,
  p_prix                   NUMERIC,
  p_commentaire            TEXT,
  p_created_by             UUID,
  p_uuid_client            UUID,
  p_external_material_id   UUID DEFAULT NULL,
  p_numero_facture         TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_purchase_id UUID;
BEGIN
  -- Validation : exactement l'un des deux doit etre fourni
  IF (p_variety_id IS NOT NULL AND p_external_material_id IS NOT NULL)
    OR (p_variety_id IS NULL AND p_external_material_id IS NULL) THEN
    RAISE EXCEPTION 'Exactement un de variety_id ou external_material_id doit etre fourni';
  END IF;

  -- 1. Inserer l'achat
  INSERT INTO stock_purchases (
    farm_id, uuid_client, variety_id, external_material_id,
    partie_plante, date, etat_plante,
    poids_g, fournisseur, numero_lot_fournisseur, numero_facture,
    certif_ab, prix, commentaire, created_by
  ) VALUES (
    p_farm_id, p_uuid_client, p_variety_id, p_external_material_id,
    p_partie_plante, p_date, p_etat_plante,
    p_poids_g, p_fournisseur, p_numero_lot_fournisseur, p_numero_facture,
    p_certif_ab, p_prix, p_commentaire, p_created_by
  )
  ON CONFLICT (uuid_client) DO NOTHING
  RETURNING id INTO v_purchase_id;

  -- Idempotence : si uuid_client deja present, retourner l'id existant
  IF v_purchase_id IS NULL AND p_uuid_client IS NOT NULL THEN
    SELECT id INTO v_purchase_id FROM stock_purchases WHERE uuid_client = p_uuid_client;
    RETURN v_purchase_id;
  END IF;

  -- 2. Creer le mouvement de stock ENTREE
  INSERT INTO stock_movements (
    farm_id, variety_id, external_material_id,
    partie_plante, date, type_mouvement,
    etat_plante, poids_g, source_type, source_id, created_by
  ) VALUES (
    p_farm_id, p_variety_id, p_external_material_id,
    p_partie_plante, p_date, 'entree',
    p_etat_plante, p_poids_g, 'achat', v_purchase_id, p_created_by
  );

  RETURN v_purchase_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- =============================================================================
-- 5. RPC — update_purchase_with_stock (mise a jour pour materiaux externes)
-- =============================================================================

CREATE OR REPLACE FUNCTION update_purchase_with_stock(
  p_purchase_id            UUID,
  p_variety_id             UUID,
  p_partie_plante          TEXT,
  p_date                   DATE,
  p_etat_plante            TEXT,
  p_poids_g                NUMERIC,
  p_fournisseur            TEXT,
  p_numero_lot_fournisseur TEXT,
  p_certif_ab              BOOLEAN,
  p_prix                   NUMERIC,
  p_commentaire            TEXT,
  p_updated_by             UUID,
  p_external_material_id   UUID DEFAULT NULL,
  p_numero_facture         TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_farm_id UUID;
BEGIN
  -- Recuperer le farm_id pour filtrage multi-tenant
  SELECT farm_id INTO v_farm_id FROM stock_purchases WHERE id = p_purchase_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'purchase not found: %', p_purchase_id;
  END IF;

  -- 1. Mettre a jour l'achat
  UPDATE stock_purchases SET
    variety_id             = p_variety_id,
    external_material_id   = p_external_material_id,
    partie_plante          = p_partie_plante,
    date                   = p_date,
    etat_plante            = p_etat_plante,
    poids_g                = p_poids_g,
    fournisseur            = p_fournisseur,
    numero_lot_fournisseur = p_numero_lot_fournisseur,
    numero_facture         = p_numero_facture,
    certif_ab              = p_certif_ab,
    prix                   = p_prix,
    commentaire            = p_commentaire,
    updated_by             = p_updated_by
  WHERE id = p_purchase_id AND farm_id = v_farm_id;

  -- 2. Mettre a jour le stock_movement associe
  UPDATE stock_movements SET
    variety_id             = p_variety_id,
    external_material_id   = p_external_material_id,
    partie_plante          = p_partie_plante,
    date                   = p_date,
    etat_plante            = p_etat_plante,
    poids_g                = p_poids_g
  WHERE source_type = 'achat' AND source_id = p_purchase_id AND farm_id = v_farm_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- =============================================================================
-- 6. RPC — create_production_lot_with_stock (mise a jour pour materiaux externes)
--    Chaque ingredient externe recoit un tableau "sources" dans le JSONB :
--    [{"stock_purchase_id": "...", "poids_g": 150}, ...]
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
  v_lot_id        UUID;
  v_ingredient    JSONB;
  v_ingredient_id UUID;
  v_variety_id    UUID;
  v_ext_mat_id    UUID;
  v_etat_plante   TEXT;
  v_partie_plante TEXT;
  v_pourcentage   NUMERIC;
  v_poids_g       NUMERIC;
  v_annee_recolte INTEGER;
  v_fournisseur   TEXT;
  v_stock_dispo   NUMERIC;
  v_source        JSONB;
  v_source_purchase_id UUID;
  v_source_poids  NUMERIC;
  v_total_sources NUMERIC;
  v_stock_achat   NUMERIC;
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
    ) RETURNING id INTO v_ingredient_id;

    -- 3a. Ingredient PLANTE : verifier stock + creer mouvement de SORTIE
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

    -- 3b. Ingredient MATERIAU EXTERNE : verifier stock global + creer mouvements par source
    IF v_ext_mat_id IS NOT NULL AND v_ingredient ? 'sources' THEN
      -- Verifier le stock global disponible
      SELECT COALESCE(stock_g, 0) INTO v_stock_dispo
      FROM v_stock_external
      WHERE farm_id = p_farm_id
        AND external_material_id = v_ext_mat_id;

      IF v_stock_dispo IS NULL OR v_stock_dispo < v_poids_g THEN
        RAISE EXCEPTION 'Stock insuffisant pour materiau externe % : % g disponible, % g requis',
          (SELECT nom FROM external_materials WHERE id = v_ext_mat_id),
          COALESCE(v_stock_dispo, 0), v_poids_g;
      END IF;

      -- Parcourir les sources (achats)
      v_total_sources := 0;
      FOR v_source IN SELECT * FROM jsonb_array_elements(v_ingredient -> 'sources')
      LOOP
        v_source_purchase_id := (v_source ->> 'stock_purchase_id')::UUID;
        v_source_poids       := (v_source ->> 'poids_g')::NUMERIC;

        -- Verifier que l'achat appartient a la ferme et concerne le bon materiau
        IF NOT EXISTS (
          SELECT 1 FROM stock_purchases
          WHERE id = v_source_purchase_id
            AND farm_id = p_farm_id
            AND external_material_id = v_ext_mat_id
        ) THEN
          RAISE EXCEPTION 'Achat % introuvable, n''appartient pas a la ferme, ou ne concerne pas le materiau %',
            v_source_purchase_id, v_ext_mat_id;
        END IF;

        -- Creer le mouvement de SORTIE pour cette source
        INSERT INTO stock_movements (
          farm_id, external_material_id, date, type_mouvement,
          poids_g, source_type, source_id, created_by
        ) VALUES (
          p_farm_id, v_ext_mat_id, p_date_production, 'sortie',
          v_source_poids, 'production', v_lot_id, p_created_by
        );

        -- Creer le lien ingredient → achat
        INSERT INTO production_ingredient_sources (
          farm_id, production_lot_ingredient_id, stock_purchase_id, poids_g
        ) VALUES (
          p_farm_id, v_ingredient_id, v_source_purchase_id, v_source_poids
        );

        v_total_sources := v_total_sources + v_source_poids;
      END LOOP;

      -- Verifier coherence : la somme des sources doit egaliser le poids de l'ingredient
      IF v_total_sources <> v_poids_g THEN
        RAISE EXCEPTION 'Incoherence pour materiau % : poids ingredient = % g, somme des sources = % g',
          (SELECT nom FROM external_materials WHERE id = v_ext_mat_id),
          v_poids_g, v_total_sources;
      END IF;
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
-- 7. RPC — delete_production_lot_with_stock (mise a jour)
--    Gere aussi les mouvements de stock des materiaux externes
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

  -- 2. Soft delete des stock_movements associes (plantes ET materiaux externes)
  UPDATE stock_movements
  SET deleted_at = NOW()
  WHERE source_type = 'production' AND source_id = p_lot_id AND farm_id = p_farm_id AND deleted_at IS NULL;

  -- 3. Soft delete des product_stock_movements associes
  UPDATE product_stock_movements
  SET deleted_at = NOW()
  WHERE production_lot_id = p_lot_id AND farm_id = p_farm_id AND deleted_at IS NULL;

  -- 4. Les production_ingredient_sources sont supprimees en CASCADE
  --    via production_lot_ingredients ON DELETE CASCADE
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- =============================================================================
-- 8. RPC — restore_production_lot_with_stock (mise a jour)
--    Verifie aussi le stock des materiaux externes
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

  -- Restaurer le lot
  UPDATE production_lots
  SET deleted_at = NULL, updated_by = p_updated_by
  WHERE id = p_lot_id AND farm_id = p_farm_id;

  -- Restaurer les stock_movements (plantes ET materiaux externes)
  UPDATE stock_movements
  SET deleted_at = NULL
  WHERE source_type = 'production' AND source_id = p_lot_id AND farm_id = p_farm_id AND deleted_at IS NOT NULL;

  -- Restaurer les product_stock_movements
  UPDATE product_stock_movements
  SET deleted_at = NULL
  WHERE production_lot_id = p_lot_id AND farm_id = p_farm_id AND deleted_at IS NOT NULL;

  -- Verifier le stock pour chaque ingredient apres restauration
  FOR v_ing IN
    SELECT * FROM production_lot_ingredients WHERE production_lot_id = p_lot_id
  LOOP
    -- Verification stock plantes
    IF v_ing.variety_id IS NOT NULL THEN
      SELECT COALESCE(stock_g, 0) INTO v_stock_dispo
      FROM v_stock
      WHERE farm_id = v_lot.farm_id
        AND variety_id = v_ing.variety_id
        AND partie_plante = v_ing.partie_plante
        AND etat_plante = v_ing.etat_plante;

      IF v_stock_dispo IS NULL OR v_stock_dispo < 0 THEN
        RAISE EXCEPTION 'Stock insuffisant pour restauration — % (partie: %, etat: %) : stock negatif (% g)',
          (SELECT nom_vernaculaire FROM varieties WHERE id = v_ing.variety_id),
          v_ing.partie_plante, v_ing.etat_plante,
          COALESCE(v_stock_dispo, 0);
      END IF;
    END IF;

    -- Verification stock materiaux externes
    IF v_ing.external_material_id IS NOT NULL THEN
      SELECT COALESCE(stock_g, 0) INTO v_stock_dispo
      FROM v_stock_external
      WHERE farm_id = v_lot.farm_id
        AND external_material_id = v_ing.external_material_id;

      IF v_stock_dispo IS NULL OR v_stock_dispo < 0 THEN
        RAISE EXCEPTION 'Stock insuffisant pour restauration — materiau externe % : stock negatif (% g)',
          (SELECT nom FROM external_materials WHERE id = v_ing.external_material_id),
          COALESCE(v_stock_dispo, 0);
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- =============================================================================
-- 9. Recharger le schema cache PostgREST
-- =============================================================================

NOTIFY pgrst, 'reload schema';
