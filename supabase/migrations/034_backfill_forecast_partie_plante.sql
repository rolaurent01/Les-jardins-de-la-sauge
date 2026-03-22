-- 034 : Remplir partie_plante sur les forecasts existants
-- Pour les variétés qui n'ont qu'une seule partie utilisée,
-- on peut déduire automatiquement la partie du forecast.

UPDATE forecasts f
SET partie_plante = v.parties_utilisees[1]
FROM varieties v
WHERE f.variety_id = v.id
  AND f.partie_plante IS NULL
  AND array_length(v.parties_utilisees, 1) = 1;
