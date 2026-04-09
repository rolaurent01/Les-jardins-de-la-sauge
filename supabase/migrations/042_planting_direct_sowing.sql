-- Migration 042 : Semis direct — lien plantation → sachet de graines
--
-- Ajoute seed_lot_id sur plantings pour permettre de tracer l'origine
-- d'un semis direct depuis un sachet de graines du stock.
-- Pas de mouvement de stock automatique : le stock est géré par inventaire manuel.
--
-- A exécuter manuellement dans Supabase SQL Editor.

BEGIN;

-- 1. Nouvelle colonne seed_lot_id
ALTER TABLE plantings ADD COLUMN seed_lot_id UUID REFERENCES seed_lots(id);
CREATE INDEX idx_plantings_seed_lot ON plantings(seed_lot_id) WHERE seed_lot_id IS NOT NULL;

COMMENT ON COLUMN plantings.seed_lot_id IS
  'Sachet de graines source pour semis direct. Mutuellement exclusif avec seedling_id, bouture_id et fournisseur.';

-- 2. Remplacer la contrainte d'exclusivité existante (seedling_id vs bouture_id)
--    par une contrainte couvrant les 4 sources
ALTER TABLE plantings DROP CONSTRAINT IF EXISTS chk_plantings_source_exclusive;
ALTER TABLE plantings ADD CONSTRAINT chk_plantings_source_exclusive CHECK (
  (CASE WHEN seedling_id  IS NOT NULL THEN 1 ELSE 0 END)
+ (CASE WHEN bouture_id   IS NOT NULL THEN 1 ELSE 0 END)
+ (CASE WHEN fournisseur  IS NOT NULL AND fournisseur != '' THEN 1 ELSE 0 END)
+ (CASE WHEN seed_lot_id  IS NOT NULL THEN 1 ELSE 0 END)
  <= 1
);

COMMIT;
