-- 020_fix_production_lot_delete.sql
-- Option B : ne PAS hard-delete les production_lot_ingredients au soft-delete du lot.
-- La restauration relit les ingredients depuis la table au lieu de les recevoir en parametre.
--
-- ⚠️ A executer manuellement dans Supabase SQL Editor.

-- =============================================================================
-- 1. RPC — delete_production_lot_with_stock (corrigee : garde les ingredients)
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

  -- NOTE : les production_lot_ingredients ne sont PAS supprimes.
  -- Ils restent en base, lies au lot par FK — necessaires pour la restauration.
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- =============================================================================
-- 2. RPC — restore_production_lot_with_stock (corrigee : relit les ingredients)
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
  -- Verifier que le lot existe, est bien supprime, et appartient a la ferme
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

  -- 3. Re-verifier le stock pour chaque ingredient plante
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

        RAISE EXCEPTION 'Stock insuffisant pour restauration — % (partie: %, etat: %) : % g disponible, % g requis',
          (SELECT nom_vernaculaire FROM varieties WHERE id = v_ing.variety_id),
          v_ing.partie_plante, v_ing.etat_plante,
          COALESCE(v_stock_dispo, 0), v_ing.poids_g;
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
