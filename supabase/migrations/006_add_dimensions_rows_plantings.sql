-- Migration 006 : Ajout des dimensions sur rows et plantings
--
-- rows.largeur_m       : largeur du rang en mètres (référentiel)
-- plantings.longueur_m : longueur réelle de la plantation (copié depuis le rang, modifiable)
-- plantings.largeur_m  : largeur réelle de la plantation (copié depuis le rang, modifiable)
--
-- La surface m² = longueur_m × largeur_m est calculée à la volée, jamais stockée.

ALTER TABLE rows
  ADD COLUMN IF NOT EXISTS largeur_m DECIMAL;

COMMENT ON COLUMN rows.largeur_m IS 'Largeur du rang en mètres';

ALTER TABLE plantings
  ADD COLUMN IF NOT EXISTS longueur_m DECIMAL,
  ADD COLUMN IF NOT EXISTS largeur_m  DECIMAL;

COMMENT ON COLUMN plantings.longueur_m IS 'Longueur réelle de cette plantation en mètres — copiée depuis le rang à la création, modifiable';
COMMENT ON COLUMN plantings.largeur_m  IS 'Largeur réelle de cette plantation en mètres — copiée depuis le rang à la création, modifiable';
