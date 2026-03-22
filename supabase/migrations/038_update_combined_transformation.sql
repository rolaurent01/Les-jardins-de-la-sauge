-- 038_update_combined_transformation.sql
-- RPCs pour mettre a jour un tronconnage/triage combine (entree + sortie).
-- Met a jour les 2 records + les 2 stock_movements atomiquement.
--
-- A executer manuellement dans Supabase SQL Editor.

-- =============================================================================
-- 1. RPC — update_cutting_combined
-- =============================================================================

CREATE OR REPLACE FUNCTION update_cutting_combined(
  p_entree_id         UUID,
  p_variety_id        UUID,
  p_partie_plante     TEXT,
  p_date              DATE,
  p_poids_entree_g    DECIMAL,
  p_poids_sortie_g    DECIMAL,
  p_temps_min         INTEGER,
  p_commentaire       TEXT,
  p_updated_by        UUID
) RETURNS VOID AS $$
DECLARE
  v_sortie_id  UUID;
  v_farm_id    UUID;
BEGIN
  -- Recuperer le paired_id et farm_id
  SELECT paired_id, farm_id INTO v_sortie_id, v_farm_id
  FROM cuttings WHERE id = p_entree_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'cutting not found: %', p_entree_id;
  END IF;

  -- 1. Mettre a jour le record entree
  UPDATE cuttings SET
    variety_id = p_variety_id,
    partie_plante = p_partie_plante,
    date = p_date,
    poids_g = p_poids_entree_g,
    temps_min = p_temps_min,
    commentaire = p_commentaire,
    updated_by = p_updated_by
  WHERE id = p_entree_id;

  -- 2. Mettre a jour le record sortie (si existe)
  IF v_sortie_id IS NOT NULL THEN
    UPDATE cuttings SET
      variety_id = p_variety_id,
      partie_plante = p_partie_plante,
      date = p_date,
      poids_g = p_poids_sortie_g,
      temps_min = NULL,
      commentaire = p_commentaire,
      updated_by = p_updated_by
    WHERE id = v_sortie_id;
  END IF;

  -- 3. Mettre a jour le stock_movement de l'entree (sortie frais)
  UPDATE stock_movements SET
    variety_id = p_variety_id,
    partie_plante = p_partie_plante,
    date = p_date,
    poids_g = p_poids_entree_g
  WHERE source_type = 'tronconnage_entree' AND source_id = p_entree_id;

  -- 4. Mettre a jour le stock_movement de la sortie (entree tronconnee)
  IF v_sortie_id IS NOT NULL THEN
    UPDATE stock_movements SET
      variety_id = p_variety_id,
      partie_plante = p_partie_plante,
      date = p_date,
      poids_g = p_poids_sortie_g
    WHERE source_type = 'tronconnage_sortie' AND source_id = v_sortie_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- =============================================================================
-- 2. RPC — update_sorting_combined
-- =============================================================================

CREATE OR REPLACE FUNCTION update_sorting_combined(
  p_entree_id            UUID,
  p_variety_id           UUID,
  p_partie_plante        TEXT,
  p_etat_plante_entree   TEXT,
  p_date                 DATE,
  p_poids_entree_g       DECIMAL,
  p_poids_sortie_g       DECIMAL,
  p_temps_min            INTEGER,
  p_commentaire          TEXT,
  p_updated_by           UUID
) RETURNS VOID AS $$
DECLARE
  v_sortie_id    UUID;
  v_farm_id      UUID;
  v_etat_sortie  TEXT;
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

  -- Recuperer le paired_id et farm_id
  SELECT paired_id, farm_id INTO v_sortie_id, v_farm_id
  FROM sortings WHERE id = p_entree_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'sorting not found: %', p_entree_id;
  END IF;

  -- 1. Mettre a jour le record entree
  UPDATE sortings SET
    variety_id = p_variety_id,
    partie_plante = p_partie_plante,
    etat_plante = p_etat_plante_entree,
    date = p_date,
    poids_g = p_poids_entree_g,
    temps_min = p_temps_min,
    commentaire = p_commentaire,
    updated_by = p_updated_by
  WHERE id = p_entree_id;

  -- 2. Mettre a jour le record sortie (si existe)
  IF v_sortie_id IS NOT NULL THEN
    UPDATE sortings SET
      variety_id = p_variety_id,
      partie_plante = p_partie_plante,
      etat_plante = v_etat_sortie,
      date = p_date,
      poids_g = p_poids_sortie_g,
      temps_min = NULL,
      commentaire = p_commentaire,
      updated_by = p_updated_by
    WHERE id = v_sortie_id;
  END IF;

  -- 3. Mettre a jour le stock_movement de l'entree
  UPDATE stock_movements SET
    variety_id = p_variety_id,
    partie_plante = p_partie_plante,
    etat_plante = p_etat_plante_entree,
    date = p_date,
    poids_g = p_poids_entree_g
  WHERE source_type = 'triage_entree' AND source_id = p_entree_id;

  -- 4. Mettre a jour le stock_movement de la sortie
  IF v_sortie_id IS NOT NULL THEN
    UPDATE stock_movements SET
      variety_id = p_variety_id,
      partie_plante = p_partie_plante,
      etat_plante = v_etat_sortie,
      date = p_date,
      poids_g = p_poids_sortie_g
    WHERE source_type = 'triage_sortie' AND source_id = v_sortie_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
