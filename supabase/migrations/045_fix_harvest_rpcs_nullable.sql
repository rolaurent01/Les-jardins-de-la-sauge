-- 045 : Rend les paramètres optionnels des RPCs harvest nullables
--
-- Contexte : après régénération des types Supabase (commit ad7dc76), les params
-- typés `UUID` sans DEFAULT étaient générés `string` non-nullable côté TS.
-- Pour satisfaire le compilateur, on envoyait `''` au lieu de `null` → Postgres
-- renvoyait "invalid input syntax for type uuid: ''" à chaque création de cueillette.
--
-- Correctif :
--   • p_uuid_client / p_row_id / p_lieu_sauvage / p_temps_min / p_commentaire
--     deviennent optionnels (DEFAULT NULL) → Supabase les type avec `?: string`.
--   • Ajout de la logique d'idempotence ON CONFLICT (uuid_client) DO NOTHING
--     pour s'aligner sur les autres RPCs transformation/stock (cf. migration 017).
--
-- À exécuter manuellement dans Supabase SQL Editor.
-- Le NOTIFY pgrst en fin de script recharge le schema cache.

-- =============================================================================
-- 1. create_harvest_with_stock
-- =============================================================================

CREATE OR REPLACE FUNCTION create_harvest_with_stock(
  p_farm_id         UUID,
  p_type_cueillette TEXT,
  p_variety_id      UUID,
  p_partie_plante   TEXT,
  p_date            DATE,
  p_poids_g         DECIMAL,
  p_created_by      UUID,
  p_uuid_client     UUID    DEFAULT NULL,
  p_row_id          UUID    DEFAULT NULL,
  p_lieu_sauvage    TEXT    DEFAULT NULL,
  p_temps_min       INTEGER DEFAULT NULL,
  p_commentaire     TEXT    DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_harvest_id UUID;
BEGIN
  -- 1. Creer le harvest (idempotent via uuid_client pour sync offline)
  INSERT INTO harvests (
    farm_id, uuid_client, type_cueillette, row_id, lieu_sauvage,
    variety_id, partie_plante, date, poids_g, temps_min, commentaire, created_by
  ) VALUES (
    p_farm_id, p_uuid_client, p_type_cueillette, p_row_id, p_lieu_sauvage,
    p_variety_id, p_partie_plante, p_date, p_poids_g, p_temps_min, p_commentaire, p_created_by
  )
  ON CONFLICT (uuid_client) DO NOTHING
  RETURNING id INTO v_harvest_id;

  -- Collision uuid_client → recuperer l'id existant sans creer de doublon stock
  IF v_harvest_id IS NULL AND p_uuid_client IS NOT NULL THEN
    SELECT id INTO v_harvest_id FROM harvests WHERE uuid_client = p_uuid_client;
    RETURN v_harvest_id;
  END IF;

  -- 2. Creer le stock_movement ENTREE frais (meme transaction)
  INSERT INTO stock_movements (
    farm_id, variety_id, partie_plante, date, type_mouvement,
    etat_plante, poids_g, source_type, source_id, created_by
  ) VALUES (
    p_farm_id, p_variety_id, p_partie_plante, p_date, 'entree',
    'frais', p_poids_g, 'cueillette', v_harvest_id, p_created_by
  );

  RETURN v_harvest_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- =============================================================================
-- 2. update_harvest_with_stock
-- =============================================================================

CREATE OR REPLACE FUNCTION update_harvest_with_stock(
  p_harvest_id      UUID,
  p_type_cueillette TEXT,
  p_variety_id      UUID,
  p_partie_plante   TEXT,
  p_date            DATE,
  p_poids_g         DECIMAL,
  p_updated_by      UUID,
  p_row_id          UUID    DEFAULT NULL,
  p_lieu_sauvage    TEXT    DEFAULT NULL,
  p_temps_min       INTEGER DEFAULT NULL,
  p_commentaire     TEXT    DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  -- 1. Mettre a jour le harvest
  UPDATE harvests SET
    type_cueillette = p_type_cueillette,
    row_id          = p_row_id,
    lieu_sauvage    = p_lieu_sauvage,
    variety_id      = p_variety_id,
    partie_plante   = p_partie_plante,
    date            = p_date,
    poids_g         = p_poids_g,
    temps_min       = p_temps_min,
    commentaire     = p_commentaire,
    updated_by      = p_updated_by
  WHERE id = p_harvest_id;

  -- 2. Mettre a jour le stock_movement correspondant (meme transaction)
  UPDATE stock_movements SET
    variety_id    = p_variety_id,
    partie_plante = p_partie_plante,
    date          = p_date,
    poids_g       = p_poids_g
  WHERE source_type = 'cueillette' AND source_id = p_harvest_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- =============================================================================
-- 3. Recharger le schema cache PostgREST
-- =============================================================================

NOTIFY pgrst, 'reload schema';
