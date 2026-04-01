-- Migration 040 : Table boutures (multiplications végétatives)
-- Permet de tracer les boutures depuis la récupération du matériel végétal
-- jusqu'à la plantation en rang, avec suivi plaque alvéolée → godet.
-- Note : la table s'appelle "boutures" (et non "cuttings") car "cuttings"
-- est déjà utilisée pour le tronçonnage (module transformation).

BEGIN;

-- ============================================================
-- 1. Table boutures
-- ============================================================

CREATE TABLE boutures (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id              UUID NOT NULL REFERENCES farms(id),
  uuid_client          UUID UNIQUE,
  variety_id           UUID REFERENCES varieties(id),

  -- Type de multiplication végétative
  type_multiplication  TEXT NOT NULL CHECK (type_multiplication IN (
    'rhizome', 'bouture', 'marcotte', 'eclat_pied', 'drageon', 'eclat_racine'
  )),

  -- Origine du matériel végétal
  origine              TEXT,                -- "Jardin La Sauge", "Collègue X - Ferme Y"
  certif_ab            BOOLEAN DEFAULT false,

  -- Statut (recalculé en logique applicative, pas en trigger)
  -- Recalculé dans 3 situations :
  --   1. Mise à jour d'une bouture (date_rempotage, nb_plants_obtenus)
  --   2. Création d'un planting avec bouture_id
  --   3. Suppression/archivage d'un planting avec bouture_id
  statut               TEXT NOT NULL DEFAULT 'bouture' CHECK (statut IN (
    'bouture', 'repiquage', 'pret', 'en_plantation', 'epuise'
  )),

  -- Phase 1 : Plaque alvéolée (NULL si direct en godet)
  nb_plaques           INTEGER,
  nb_trous_par_plaque  INTEGER,
  nb_mortes_plaque     INTEGER DEFAULT 0,
  date_mise_en_plaque  DATE,
  temps_bouturage_min  INTEGER,            -- temps de préparation + mise en plaque/godet

  -- Phase 2 : Godet (après plaque OU directement)
  nb_godets            INTEGER,
  nb_mortes_godet      INTEGER DEFAULT 0,
  date_rempotage       DATE,               -- plaque→godet ou mise en godet directe
  temps_rempotage_min  INTEGER,

  -- Résultat final (avant plantation)
  nb_plants_obtenus    INTEGER,            -- plants vivants prêts à planter
  nb_donnees           INTEGER DEFAULT 0,  -- plants donnés (pas morts, pas plantés)

  -- Date principale
  date_bouturage       DATE NOT NULL,

  commentaire          TEXT,
  deleted_at           TIMESTAMPTZ DEFAULT NULL,
  created_by           UUID,
  updated_by           UUID,
  created_at           TIMESTAMPTZ DEFAULT now()
);

-- Index pour les requêtes courantes
CREATE INDEX idx_boutures_farm ON boutures(farm_id);
CREATE INDEX idx_boutures_variety ON boutures(variety_id);
CREATE INDEX idx_boutures_statut ON boutures(farm_id, statut) WHERE deleted_at IS NULL;

-- RLS
ALTER TABLE boutures ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON boutures
  FOR ALL USING (farm_id IN (SELECT user_farm_ids()));

-- ============================================================
-- 2. Ajout de bouture_id sur plantings
-- ============================================================

ALTER TABLE plantings ADD COLUMN bouture_id UUID REFERENCES boutures(id);
CREATE INDEX idx_plantings_bouture ON plantings(bouture_id) WHERE bouture_id IS NOT NULL;

-- Contrainte : un planting ne peut pas avoir à la fois seedling_id et bouture_id
ALTER TABLE plantings ADD CONSTRAINT chk_plantings_source_exclusive
  CHECK (NOT (seedling_id IS NOT NULL AND bouture_id IS NOT NULL));

COMMENT ON COLUMN plantings.bouture_id IS
  'Bouture source. Mutuellement exclusif avec seedling_id et fournisseur.';

COMMIT;
