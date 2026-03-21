-- 032_combined_transformation.sql
-- Tronconnage et Triage : creation combinee (entree + sortie en une seule operation).
-- Ajoute paired_id pour lier les 2 records et permettre la suppression groupee.
-- Sechage reste inchange (entree/sortie separees).
--
-- ⚠️ A executer manuellement dans Supabase SQL Editor.

-- =============================================================================
-- 0. SCHEMA — ajout paired_id sur cuttings et sortings
-- =============================================================================

ALTER TABLE cuttings ADD COLUMN IF NOT EXISTS paired_id UUID REFERENCES cuttings(id) ON DELETE SET NULL;
ALTER TABLE sortings ADD COLUMN IF NOT EXISTS paired_id UUID REFERENCES sortings(id) ON DELETE SET NULL;

-- =============================================================================
-- 1. RPC — create_cutting_combined
-- Cree 2 records cuttings (entree + sortie) + 2 stock_movements atomiquement.
-- Le temps est stocke sur l'entree uniquement. La sortie a temps_min = NULL.
-- =============================================================================

CREATE OR REPLACE FUNCTION create_cutting_combined(
  p_farm_id           UUID,
  p_variety_id        UUID,
  p_partie_plante     TEXT,
  p_date              DATE,
  p_poids_entree_g    DECIMAL,
  p_poids_sortie_g    DECIMAL,
  p_temps_min         INTEGER,
  p_commentaire       TEXT,
  p_created_by        UUID,
  p_uuid_client_entree UUID DEFAULT NULL,
  p_uuid_client_sortie UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_entree_id UUID;
  v_sortie_id UUID;
BEGIN
  -- Idempotence : si l'entree existe deja, retourner son id
  IF p_uuid_client_entree IS NOT NULL THEN
    SELECT id INTO v_entree_id FROM cuttings WHERE uuid_client = p_uuid_client_entree;
    IF v_entree_id IS NOT NULL THEN
      RETURN v_entree_id;
    END IF;
  END IF;

  -- 1. Creer le record entree (retire du stock frais)
  INSERT INTO cuttings (farm_id, uuid_client, variety_id, partie_plante, type, date, poids_g, temps_min, commentaire, created_by)
  VALUES (p_farm_id, p_uuid_client_entree, p_variety_id, p_partie_plante, 'entree', p_date, p_poids_entree_g, p_temps_min, p_commentaire, p_created_by)
  RETURNING id INTO v_entree_id;

  -- 2. Creer le record sortie (ajoute au stock tronconnee)
  INSERT INTO cuttings (farm_id, uuid_client, variety_id, partie_plante, type, date, poids_g, temps_min, commentaire, created_by)
  VALUES (p_farm_id, p_uuid_client_sortie, p_variety_id, p_partie_plante, 'sortie', p_date, p_poids_sortie_g, NULL, p_commentaire, p_created_by)
  RETURNING id INTO v_sortie_id;

  -- 3. Lier les 2 records via paired_id
  UPDATE cuttings SET paired_id = v_sortie_id WHERE id = v_entree_id;
  UPDATE cuttings SET paired_id = v_entree_id WHERE id = v_sortie_id;

  -- 4. Mouvement de stock : SORTIE frais (retire la matiere brute)
  INSERT INTO stock_movements (farm_id, variety_id, partie_plante, date, type_mouvement, etat_plante, poids_g, source_type, source_id, created_by)
  VALUES (p_farm_id, p_variety_id, p_partie_plante, p_date, 'sortie', 'frais', p_poids_entree_g, 'tronconnage_entree', v_entree_id, p_created_by);

  -- 5. Mouvement de stock : ENTREE tronconnee (ajoute la matiere tronconnee)
  INSERT INTO stock_movements (farm_id, variety_id, partie_plante, date, type_mouvement, etat_plante, poids_g, source_type, source_id, created_by)
  VALUES (p_farm_id, p_variety_id, p_partie_plante, p_date, 'entree', 'tronconnee', p_poids_sortie_g, 'tronconnage_sortie', v_sortie_id, p_created_by);

  RETURN v_entree_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- =============================================================================
-- 2. RPC — create_sorting_combined
-- Cree 2 records sortings (entree + sortie) + 2 stock_movements atomiquement.
-- L'etat de sortie est deduit automatiquement de l'etat d'entree.
-- =============================================================================

CREATE OR REPLACE FUNCTION create_sorting_combined(
  p_farm_id              UUID,
  p_variety_id           UUID,
  p_partie_plante        TEXT,
  p_etat_plante_entree   TEXT,
  p_date                 DATE,
  p_poids_entree_g       DECIMAL,
  p_poids_sortie_g       DECIMAL,
  p_temps_min            INTEGER,
  p_commentaire          TEXT,
  p_created_by           UUID,
  p_uuid_client_entree   UUID DEFAULT NULL,
  p_uuid_client_sortie   UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_entree_id       UUID;
  v_sortie_id       UUID;
  v_etat_sortie     TEXT;
BEGIN
  -- Deduire l'etat de sortie
  IF p_etat_plante_entree = 'sechee' THEN
    v_etat_sortie := 'sechee_triee';
  ELSIF p_etat_plante_entree = 'tronconnee_sechee' THEN
    v_etat_sortie := 'tronconnee_sechee_triee';
  ELSE
    RAISE EXCEPTION 'etat_plante_entree invalide pour triage: %. Valeurs attendues: sechee, tronconnee_sechee', p_etat_plante_entree;
  END IF;

  -- Validation : poids sortie <= poids entree
  IF p_poids_sortie_g > p_poids_entree_g THEN
    RAISE EXCEPTION 'Le poids de sortie (% g) ne peut pas depasser le poids d''entree (% g)', p_poids_sortie_g, p_poids_entree_g;
  END IF;

  -- Idempotence
  IF p_uuid_client_entree IS NOT NULL THEN
    SELECT id INTO v_entree_id FROM sortings WHERE uuid_client = p_uuid_client_entree;
    IF v_entree_id IS NOT NULL THEN
      RETURN v_entree_id;
    END IF;
  END IF;

  -- 1. Creer le record entree
  INSERT INTO sortings (farm_id, uuid_client, variety_id, partie_plante, type, etat_plante, date, poids_g, temps_min, commentaire, created_by)
  VALUES (p_farm_id, p_uuid_client_entree, p_variety_id, p_partie_plante, 'entree', p_etat_plante_entree, p_date, p_poids_entree_g, p_temps_min, p_commentaire, p_created_by)
  RETURNING id INTO v_entree_id;

  -- 2. Creer le record sortie
  INSERT INTO sortings (farm_id, uuid_client, variety_id, partie_plante, type, etat_plante, date, poids_g, temps_min, commentaire, created_by)
  VALUES (p_farm_id, p_uuid_client_sortie, p_variety_id, p_partie_plante, 'sortie', v_etat_sortie, p_date, p_poids_sortie_g, NULL, p_commentaire, p_created_by)
  RETURNING id INTO v_sortie_id;

  -- 3. Lier les 2 records
  UPDATE sortings SET paired_id = v_sortie_id WHERE id = v_entree_id;
  UPDATE sortings SET paired_id = v_entree_id WHERE id = v_sortie_id;

  -- 4. Mouvement de stock : SORTIE (retire du stock seche/tronconnee_sechee)
  INSERT INTO stock_movements (farm_id, variety_id, partie_plante, date, type_mouvement, etat_plante, poids_g, source_type, source_id, created_by)
  VALUES (p_farm_id, p_variety_id, p_partie_plante, p_date, 'sortie', p_etat_plante_entree, p_poids_entree_g, 'triage_entree', v_entree_id, p_created_by);

  -- 5. Mouvement de stock : ENTREE (ajoute au stock trie)
  INSERT INTO stock_movements (farm_id, variety_id, partie_plante, date, type_mouvement, etat_plante, poids_g, source_type, source_id, created_by)
  VALUES (p_farm_id, p_variety_id, p_partie_plante, p_date, 'entree', v_etat_sortie, p_poids_sortie_g, 'triage_sortie', v_sortie_id, p_created_by);

  RETURN v_entree_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- =============================================================================
-- 3. RPC — delete_cutting_paired
-- Supprime un cutting + son paired (si existe) + tous les stock_movements associes.
-- Retro-compatible : si paired_id est NULL, supprime uniquement le record seul.
-- =============================================================================

CREATE OR REPLACE FUNCTION delete_cutting_paired(
  p_cutting_id UUID
) RETURNS VOID AS $$
DECLARE
  v_paired_id UUID;
BEGIN
  SELECT paired_id INTO v_paired_id FROM cuttings WHERE id = p_cutting_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'cutting not found: %', p_cutting_id;
  END IF;

  -- Supprimer les stock_movements des 2 records
  DELETE FROM stock_movements
  WHERE source_id IN (p_cutting_id, v_paired_id)
    AND source_type IN ('tronconnage_entree', 'tronconnage_sortie');

  -- Casser la reference circulaire avant suppression
  UPDATE cuttings SET paired_id = NULL WHERE id IN (p_cutting_id, v_paired_id) AND paired_id IS NOT NULL;

  -- Supprimer les 2 records
  DELETE FROM cuttings WHERE id IN (p_cutting_id, v_paired_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- =============================================================================
-- 4. RPC — delete_sorting_paired
-- Supprime un sorting + son paired (si existe) + tous les stock_movements associes.
-- =============================================================================

CREATE OR REPLACE FUNCTION delete_sorting_paired(
  p_sorting_id UUID
) RETURNS VOID AS $$
DECLARE
  v_paired_id UUID;
BEGIN
  SELECT paired_id INTO v_paired_id FROM sortings WHERE id = p_sorting_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'sorting not found: %', p_sorting_id;
  END IF;

  -- Supprimer les stock_movements des 2 records
  DELETE FROM stock_movements
  WHERE source_id IN (p_sorting_id, v_paired_id)
    AND source_type IN ('triage_entree', 'triage_sortie');

  -- Casser la reference circulaire avant suppression
  UPDATE sortings SET paired_id = NULL WHERE id IN (p_sorting_id, v_paired_id) AND paired_id IS NOT NULL;

  -- Supprimer les 2 records
  DELETE FROM sortings WHERE id IN (p_sorting_id, v_paired_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
