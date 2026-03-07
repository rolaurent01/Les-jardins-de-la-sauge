-- Migration 014 : RPC transactionnelle pour mise a jour harvest + stock_movement
-- Corrige P7 (review A0-A2) : updateHarvest non transactionnel

CREATE OR REPLACE FUNCTION update_harvest_with_stock(
  p_harvest_id     UUID,
  p_type_cueillette TEXT,
  p_row_id         UUID,
  p_lieu_sauvage   TEXT,
  p_variety_id     UUID,
  p_partie_plante  TEXT,
  p_date           DATE,
  p_poids_g        DECIMAL,
  p_temps_min      INTEGER,
  p_commentaire    TEXT,
  p_updated_by     UUID
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
    poids_g       = p_poids_g,
    updated_by    = p_updated_by
  WHERE source_type = 'cueillette' AND source_id = p_harvest_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
