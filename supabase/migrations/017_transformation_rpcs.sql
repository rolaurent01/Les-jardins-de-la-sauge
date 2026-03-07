-- 017_transformation_rpcs.sql
-- RPCs transactionnelles pour les 3 modules de transformation (tronconnage, sechage, triage).
-- Chaque operation cree/modifie/supprime l'enregistrement + son stock_movement atomiquement.
-- SECURITY DEFINER : les RLS ne s'appliquent pas a l'interieur — la verification d'acces
-- est faite AVANT l'appel cote Server Action (via getContext()).
--
-- ⚠️ A executer manuellement dans Supabase SQL Editor.

-- =============================================================================
-- 1. CREATE — Tronconnage
-- =============================================================================

CREATE OR REPLACE FUNCTION create_cutting_with_stock(
  p_farm_id       UUID,
  p_variety_id    UUID,
  p_partie_plante TEXT,
  p_type          TEXT,
  p_date          DATE,
  p_poids_g       DECIMAL,
  p_temps_min     INTEGER,
  p_commentaire   TEXT,
  p_created_by    UUID,
  p_uuid_client   UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_cutting_id  UUID;
  v_sm_type     TEXT;
  v_sm_etat     TEXT;
  v_source_type TEXT;
BEGIN
  IF p_type = 'entree' THEN
    v_sm_type := 'sortie';
    v_sm_etat := 'frais';
    v_source_type := 'tronconnage_entree';
  ELSIF p_type = 'sortie' THEN
    v_sm_type := 'entree';
    v_sm_etat := 'tronconnee';
    v_source_type := 'tronconnage_sortie';
  ELSE
    RAISE EXCEPTION 'type invalide: %', p_type;
  END IF;

  INSERT INTO cuttings (farm_id, uuid_client, variety_id, partie_plante, type, date, poids_g, temps_min, commentaire, created_by)
  VALUES (p_farm_id, p_uuid_client, p_variety_id, p_partie_plante, p_type, p_date, p_poids_g, p_temps_min, p_commentaire, p_created_by)
  ON CONFLICT (uuid_client) DO NOTHING
  RETURNING id INTO v_cutting_id;

  IF v_cutting_id IS NULL AND p_uuid_client IS NOT NULL THEN
    SELECT id INTO v_cutting_id FROM cuttings WHERE uuid_client = p_uuid_client;
    RETURN v_cutting_id;
  END IF;

  INSERT INTO stock_movements (farm_id, variety_id, partie_plante, date, type_mouvement, etat_plante, poids_g, source_type, source_id, created_by)
  VALUES (p_farm_id, p_variety_id, p_partie_plante, p_date, v_sm_type, v_sm_etat, p_poids_g, v_source_type, v_cutting_id, p_created_by);

  RETURN v_cutting_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =============================================================================
-- 2. CREATE — Sechage
-- =============================================================================

CREATE OR REPLACE FUNCTION create_drying_with_stock(
  p_farm_id       UUID,
  p_variety_id    UUID,
  p_partie_plante TEXT,
  p_type          TEXT,
  p_etat_plante   TEXT,
  p_date          DATE,
  p_poids_g       DECIMAL,
  p_temps_min     INTEGER,
  p_commentaire   TEXT,
  p_created_by    UUID,
  p_uuid_client   UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_drying_id   UUID;
  v_sm_type     TEXT;
  v_source_type TEXT;
BEGIN
  IF p_type = 'entree' THEN
    IF p_etat_plante NOT IN ('frais', 'tronconnee') THEN
      RAISE EXCEPTION 'etat_plante invalide pour sechage entree: %', p_etat_plante;
    END IF;
    v_sm_type := 'sortie';
    v_source_type := 'sechage_entree';
  ELSIF p_type = 'sortie' THEN
    IF p_etat_plante NOT IN ('sechee', 'tronconnee_sechee') THEN
      RAISE EXCEPTION 'etat_plante invalide pour sechage sortie: %', p_etat_plante;
    END IF;
    v_sm_type := 'entree';
    v_source_type := 'sechage_sortie';
  ELSE
    RAISE EXCEPTION 'type invalide: %', p_type;
  END IF;

  INSERT INTO dryings (farm_id, uuid_client, variety_id, partie_plante, type, etat_plante, date, poids_g, temps_min, commentaire, created_by)
  VALUES (p_farm_id, p_uuid_client, p_variety_id, p_partie_plante, p_type, p_etat_plante, p_date, p_poids_g, p_temps_min, p_commentaire, p_created_by)
  ON CONFLICT (uuid_client) DO NOTHING
  RETURNING id INTO v_drying_id;

  IF v_drying_id IS NULL AND p_uuid_client IS NOT NULL THEN
    SELECT id INTO v_drying_id FROM dryings WHERE uuid_client = p_uuid_client;
    RETURN v_drying_id;
  END IF;

  INSERT INTO stock_movements (farm_id, variety_id, partie_plante, date, type_mouvement, etat_plante, poids_g, source_type, source_id, created_by)
  VALUES (p_farm_id, p_variety_id, p_partie_plante, p_date, v_sm_type, p_etat_plante, p_poids_g, v_source_type, v_drying_id, p_created_by);

  RETURN v_drying_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =============================================================================
-- 3. CREATE — Triage
-- =============================================================================

CREATE OR REPLACE FUNCTION create_sorting_with_stock(
  p_farm_id       UUID,
  p_variety_id    UUID,
  p_partie_plante TEXT,
  p_type          TEXT,
  p_etat_plante   TEXT,
  p_date          DATE,
  p_poids_g       DECIMAL,
  p_temps_min     INTEGER,
  p_commentaire   TEXT,
  p_created_by    UUID,
  p_uuid_client   UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_sorting_id  UUID;
  v_sm_type     TEXT;
  v_source_type TEXT;
BEGIN
  IF p_type = 'entree' THEN
    IF p_etat_plante NOT IN ('sechee', 'tronconnee_sechee') THEN
      RAISE EXCEPTION 'etat_plante invalide pour triage entree: %', p_etat_plante;
    END IF;
    v_sm_type := 'sortie';
    v_source_type := 'triage_entree';
  ELSIF p_type = 'sortie' THEN
    IF p_etat_plante NOT IN ('sechee_triee', 'tronconnee_sechee_triee') THEN
      RAISE EXCEPTION 'etat_plante invalide pour triage sortie: %', p_etat_plante;
    END IF;
    v_sm_type := 'entree';
    v_source_type := 'triage_sortie';
  ELSE
    RAISE EXCEPTION 'type invalide: %', p_type;
  END IF;

  INSERT INTO sortings (farm_id, uuid_client, variety_id, partie_plante, type, etat_plante, date, poids_g, temps_min, commentaire, created_by)
  VALUES (p_farm_id, p_uuid_client, p_variety_id, p_partie_plante, p_type, p_etat_plante, p_date, p_poids_g, p_temps_min, p_commentaire, p_created_by)
  ON CONFLICT (uuid_client) DO NOTHING
  RETURNING id INTO v_sorting_id;

  IF v_sorting_id IS NULL AND p_uuid_client IS NOT NULL THEN
    SELECT id INTO v_sorting_id FROM sortings WHERE uuid_client = p_uuid_client;
    RETURN v_sorting_id;
  END IF;

  INSERT INTO stock_movements (farm_id, variety_id, partie_plante, date, type_mouvement, etat_plante, poids_g, source_type, source_id, created_by)
  VALUES (p_farm_id, p_variety_id, p_partie_plante, p_date, v_sm_type, p_etat_plante, p_poids_g, v_source_type, v_sorting_id, p_created_by);

  RETURN v_sorting_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =============================================================================
-- 4. UPDATE — Tronconnage
-- =============================================================================

CREATE OR REPLACE FUNCTION update_cutting_with_stock(
  p_cutting_id    UUID,
  p_variety_id    UUID,
  p_partie_plante TEXT,
  p_date          DATE,
  p_poids_g       DECIMAL,
  p_temps_min     INTEGER,
  p_commentaire   TEXT,
  p_updated_by    UUID
) RETURNS VOID AS $$
DECLARE
  v_old RECORD;
  v_sm_etat TEXT;
BEGIN
  SELECT type INTO v_old FROM cuttings WHERE id = p_cutting_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'cutting not found: %', p_cutting_id;
  END IF;

  IF v_old.type = 'entree' THEN v_sm_etat := 'frais';
  ELSE v_sm_etat := 'tronconnee';
  END IF;

  UPDATE cuttings SET
    variety_id    = p_variety_id,
    partie_plante = p_partie_plante,
    date          = p_date,
    poids_g       = p_poids_g,
    temps_min     = p_temps_min,
    commentaire   = p_commentaire,
    updated_by    = p_updated_by
  WHERE id = p_cutting_id;

  UPDATE stock_movements SET
    variety_id    = p_variety_id,
    partie_plante = p_partie_plante,
    date          = p_date,
    etat_plante   = v_sm_etat,
    poids_g       = p_poids_g
  WHERE source_id = p_cutting_id
    AND source_type IN ('tronconnage_entree', 'tronconnage_sortie');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =============================================================================
-- 5. UPDATE — Sechage
-- =============================================================================

CREATE OR REPLACE FUNCTION update_drying_with_stock(
  p_drying_id     UUID,
  p_variety_id    UUID,
  p_partie_plante TEXT,
  p_etat_plante   TEXT,
  p_date          DATE,
  p_poids_g       DECIMAL,
  p_temps_min     INTEGER,
  p_commentaire   TEXT,
  p_updated_by    UUID
) RETURNS VOID AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM dryings WHERE id = p_drying_id) THEN
    RAISE EXCEPTION 'drying not found: %', p_drying_id;
  END IF;

  UPDATE dryings SET
    variety_id    = p_variety_id,
    partie_plante = p_partie_plante,
    etat_plante   = p_etat_plante,
    date          = p_date,
    poids_g       = p_poids_g,
    temps_min     = p_temps_min,
    commentaire   = p_commentaire,
    updated_by    = p_updated_by
  WHERE id = p_drying_id;

  UPDATE stock_movements SET
    variety_id    = p_variety_id,
    partie_plante = p_partie_plante,
    date          = p_date,
    etat_plante   = p_etat_plante,
    poids_g       = p_poids_g
  WHERE source_id = p_drying_id
    AND source_type IN ('sechage_entree', 'sechage_sortie');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =============================================================================
-- 6. UPDATE — Triage
-- =============================================================================

CREATE OR REPLACE FUNCTION update_sorting_with_stock(
  p_sorting_id    UUID,
  p_variety_id    UUID,
  p_partie_plante TEXT,
  p_etat_plante   TEXT,
  p_date          DATE,
  p_poids_g       DECIMAL,
  p_temps_min     INTEGER,
  p_commentaire   TEXT,
  p_updated_by    UUID
) RETURNS VOID AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sortings WHERE id = p_sorting_id) THEN
    RAISE EXCEPTION 'sorting not found: %', p_sorting_id;
  END IF;

  UPDATE sortings SET
    variety_id    = p_variety_id,
    partie_plante = p_partie_plante,
    etat_plante   = p_etat_plante,
    date          = p_date,
    poids_g       = p_poids_g,
    temps_min     = p_temps_min,
    commentaire   = p_commentaire,
    updated_by    = p_updated_by
  WHERE id = p_sorting_id;

  UPDATE stock_movements SET
    variety_id    = p_variety_id,
    partie_plante = p_partie_plante,
    date          = p_date,
    etat_plante   = p_etat_plante,
    poids_g       = p_poids_g
  WHERE source_id = p_sorting_id
    AND source_type IN ('triage_entree', 'triage_sortie');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =============================================================================
-- 7. DELETE — Tronconnage
-- =============================================================================

CREATE OR REPLACE FUNCTION delete_cutting_with_stock(
  p_cutting_id UUID
) RETURNS VOID AS $$
BEGIN
  DELETE FROM stock_movements
  WHERE source_id = p_cutting_id
    AND source_type IN ('tronconnage_entree', 'tronconnage_sortie');

  DELETE FROM cuttings WHERE id = p_cutting_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =============================================================================
-- 8. DELETE — Sechage
-- =============================================================================

CREATE OR REPLACE FUNCTION delete_drying_with_stock(
  p_drying_id UUID
) RETURNS VOID AS $$
BEGIN
  DELETE FROM stock_movements
  WHERE source_id = p_drying_id
    AND source_type IN ('sechage_entree', 'sechage_sortie');

  DELETE FROM dryings WHERE id = p_drying_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =============================================================================
-- 9. DELETE — Triage
-- =============================================================================

CREATE OR REPLACE FUNCTION delete_sorting_with_stock(
  p_sorting_id UUID
) RETURNS VOID AS $$
BEGIN
  DELETE FROM stock_movements
  WHERE source_id = p_sorting_id
    AND source_type IN ('triage_entree', 'triage_sortie');

  DELETE FROM sortings WHERE id = p_sorting_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
