-- Migration 009 : correction SECURITY DEFINER sur la vue v_stock
-- Supabase signale que v_stock s'exécute avec les permissions du créateur
-- (postgres), ce qui contourne le RLS. On recrée la vue avec security_invoker
-- pour qu'elle respecte les politiques RLS de l'utilisateur appelant.

DROP VIEW IF EXISTS v_stock;

CREATE VIEW v_stock
  WITH (security_invoker = true)
AS
SELECT
  v.id                                                AS variety_id,
  v.nom_vernaculaire,
  sm.partie_plante,
  sm.etat_plante,
  SUM(
    CASE WHEN sm.type_mouvement = 'entree' THEN sm.poids_g
         ELSE -sm.poids_g
    END
  )                                                   AS stock_g
FROM stock_movements sm
JOIN varieties v ON v.id = sm.variety_id
WHERE sm.deleted_at IS NULL
  AND v.deleted_at  IS NULL
GROUP BY v.id, v.nom_vernaculaire, sm.partie_plante, sm.etat_plante;

-- Utilisation : SELECT * FROM v_stock WHERE variety_id = '...' ORDER BY partie_plante, etat_plante;
-- Pour le tableau complet bureau (colonnes par état, lignes par variété+partie) : pivoter côté applicatif.
