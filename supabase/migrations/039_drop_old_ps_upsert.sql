-- Migration 039 : Suppression de l'ancienne surcharge _ps_upsert (16 params)
-- La migration 036 a ajouté une version 21 params (avec temps culture),
-- mais CREATE OR REPLACE ne remplace que les fonctions de même signature.
-- Résultat : 2 surcharges coexistent et les appels avec paramètres nommés
-- échouent avec "function _ps_upsert(...) is not unique".
--
-- ⚠️ A exécuter manuellement dans Supabase SQL Editor.

DROP FUNCTION IF EXISTS _ps_upsert(
  UUID,      -- p_farm_id
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
