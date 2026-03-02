-- Migration 008 : Dates obligatoires pour la traçabilité + phase lunaire à la plantation
--
-- Rend NOT NULL les colonnes de date essentielles à la traçabilité :
--   • seed_lots.date_achat      — date d'achat du sachet
--   • seedlings.date_semis      — date de semis
--   • plantings.date_plantation — date de plantation
--
-- Ajoute la phase lunaire à la plantation (optionnel, pour analyse des rendements) :
--   • plantings.lune            — 'montante' | 'descendante' | NULL

-- Contraintes NOT NULL sur les dates de traçabilité
ALTER TABLE seed_lots ALTER COLUMN date_achat SET NOT NULL;
ALTER TABLE seedlings ALTER COLUMN date_semis SET NOT NULL;
ALTER TABLE plantings ALTER COLUMN date_plantation SET NOT NULL;

-- Phase lunaire au moment de la plantation (optionnel, pour analyse des rendements)
ALTER TABLE plantings ADD COLUMN lune TEXT CHECK (lune IN ('montante', 'descendante'));

COMMENT ON COLUMN plantings.lune IS 'Phase lunaire au moment de la plantation (optionnel, pour analyse des rendements)';
