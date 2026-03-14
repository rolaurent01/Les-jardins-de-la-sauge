-- Migration 029 : Ajout des champs certification bio sur les fermes
-- Permet de marquer une ferme comme certifiée Agriculture Biologique
-- et de pré-cocher automatiquement certif_ab dans les formulaires.

ALTER TABLE farms ADD COLUMN IF NOT EXISTS certif_bio BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE farms ADD COLUMN IF NOT EXISTS organisme_certificateur TEXT;
ALTER TABLE farms ADD COLUMN IF NOT EXISTS numero_certificat TEXT;

COMMENT ON COLUMN farms.certif_bio IS 'Ferme certifiée Agriculture Biologique';
COMMENT ON COLUMN farms.organisme_certificateur IS 'Organisme certificateur (Ecocert, Bureau Veritas, Certipaq…)';
COMMENT ON COLUMN farms.numero_certificat IS 'Numéro de certificat AB';
