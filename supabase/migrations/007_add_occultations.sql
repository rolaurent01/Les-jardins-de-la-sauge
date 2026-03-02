-- Migration 007 : Ajout de la table occultations
--
-- L'occultation régénère un rang entre deux cultures.
-- Quatre méthodes : paille (fournisseur + attestation),
--                   foin (fournisseur),
--                   bâche (temps de retrait au démontage),
--                   engrais vert (nom graine + fournisseur + facture + certif AB — champs texte, pas de lien variétés)
--
-- Cycle : arrachage → rang libre → occultation (date_debut) → ...
--         → occultation (date_fin renseignée) → soil_works → replantation
--
-- Avertissement à la plantation : si date_fin IS NULL sur une occultation du rang,
-- afficher un warning non-bloquant (voir context.md §5.3).

CREATE TABLE occultations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uuid_client UUID UNIQUE,                  -- UUID généré par le mobile, pour idempotence sync
  row_id UUID REFERENCES rows(id) NOT NULL,
  date_debut DATE NOT NULL,
  date_fin DATE,                             -- NULL = occultation en cours
  methode TEXT CHECK (methode IN ('paille', 'foin', 'bache', 'engrais_vert')) NOT NULL,

  -- Paille et Foin
  fournisseur TEXT,                          -- Provenance (paille et foin)
  attestation TEXT,                          -- Certification (paille uniquement)

  -- Engrais vert (champs texte — pas de lien avec le référentiel variétés)
  engrais_vert_nom TEXT,                     -- Ex : "Moutarde blanche", "Seigle"
  engrais_vert_fournisseur TEXT,             -- Provenance des graines
  engrais_vert_facture TEXT,                 -- Numéro de facture
  engrais_vert_certif_ab BOOLEAN DEFAULT false,

  -- Bâche
  temps_retrait_min INTEGER,                 -- Temps pour retirer la bâche (bâche uniquement)

  -- Commun
  temps_min INTEGER,                         -- Temps de mise en place
  commentaire TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE occultations IS 'Occultation de rangs entre deux cultures. Cycle : arrachage → occultation → soil_works → replantation.';
COMMENT ON COLUMN occultations.date_fin IS 'NULL = occultation en cours';
COMMENT ON COLUMN occultations.fournisseur IS 'Provenance du paillis — obligatoire pour méthodes paille et foin';
COMMENT ON COLUMN occultations.attestation IS 'Certification du paillis — paille uniquement';
COMMENT ON COLUMN occultations.engrais_vert_nom IS 'Nom commun de la plante semée (ex : Moutarde blanche). Autocomplétion sur valeurs existantes.';
COMMENT ON COLUMN occultations.temps_retrait_min IS 'Temps de démontage de la bâche — bâche uniquement';
COMMENT ON COLUMN occultations.temps_min IS 'Temps de mise en place de l''occultation';

-- Index pour les requêtes fréquentes
CREATE INDEX idx_occultations_row_id ON occultations(row_id);
CREATE INDEX idx_occultations_date_fin ON occultations(date_fin) WHERE date_fin IS NULL;

-- RLS
ALTER TABLE occultations ENABLE ROW LEVEL SECURITY;
CREATE POLICY authenticated_full_access ON occultations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
