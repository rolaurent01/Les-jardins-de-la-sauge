-- 012_harvest_rpc.sql
-- Fonction transactionnelle : creer un harvest + son mouvement de stock d'entree (frais) atomiquement.
-- SECURITY DEFINER : les RLS ne s'appliquent pas a l'interieur — la verification d'acces
-- est faite AVANT l'appel cote Server Action (via getContext()).

CREATE OR REPLACE FUNCTION create_harvest_with_stock(
  p_farm_id UUID,
  p_uuid_client UUID,
  p_type_cueillette TEXT,
  p_row_id UUID,
  p_lieu_sauvage TEXT,
  p_variety_id UUID,
  p_partie_plante TEXT,
  p_date DATE,
  p_poids_g DECIMAL,
  p_temps_min INTEGER,
  p_commentaire TEXT,
  p_created_by UUID
) RETURNS UUID AS $$
DECLARE
  v_harvest_id UUID;
BEGIN
  -- 1. Creer le harvest
  INSERT INTO harvests (
    farm_id, uuid_client, type_cueillette, row_id, lieu_sauvage,
    variety_id, partie_plante, date, poids_g, temps_min, commentaire, created_by
  ) VALUES (
    p_farm_id, p_uuid_client, p_type_cueillette, p_row_id, p_lieu_sauvage,
    p_variety_id, p_partie_plante, p_date, p_poids_g, p_temps_min, p_commentaire, p_created_by
  ) RETURNING id INTO v_harvest_id;

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
