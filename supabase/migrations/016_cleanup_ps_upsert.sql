-- Migration 016 : Suppression de l'ancienne surcharge _ps_upsert (15 params, sans farm_id)
-- Corrige P9 (review A0-A2) : l'ancienne version coexiste avec la nouvelle (16 params)
-- Signature originale dans 001_initial_schema.sql lignes 729-744

DROP FUNCTION IF EXISTS _ps_upsert(
  UUID,      -- p_variety_id
  INTEGER,   -- p_annee
  INTEGER,   -- p_mois
  DECIMAL,   -- p_delta_cueilli
  DECIMAL,   -- p_delta_tronconnee
  DECIMAL,   -- p_delta_sechee
  DECIMAL,   -- p_delta_triee
  DECIMAL,   -- p_delta_utilise_prod
  DECIMAL,   -- p_delta_vendu_direct
  DECIMAL,   -- p_delta_achete
  INTEGER,   -- p_delta_temps_cueillette
  INTEGER,   -- p_delta_temps_tronconnage
  INTEGER,   -- p_delta_temps_sechage
  INTEGER,   -- p_delta_temps_triage
  INTEGER    -- p_delta_temps_production
);
