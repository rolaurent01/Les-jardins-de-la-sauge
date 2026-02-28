-- ============================================================
-- APPLI LJS — Les Jardins de la Sauge
-- Schéma PostgreSQL complet
-- À coller dans l'éditeur SQL Supabase (Dashboard → SQL Editor)
-- et exécuter en une seule fois.
-- ============================================================


-- ============================================================
-- 0. EXTENSIONS
-- ============================================================

-- UUID v4 : déjà disponible via gen_random_uuid() en PG 13+
CREATE EXTENSION IF NOT EXISTS unaccent;  -- Nécessaire pour l'index insensible aux accents sur varieties


-- ============================================================
-- 1. TABLES DE RÉFÉRENCE
-- ============================================================

-- ------------------------------------
-- 1.1 varieties — Référentiel plantes
-- ------------------------------------
CREATE TABLE varieties (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom_vernaculaire      TEXT NOT NULL,
  nom_latin             TEXT,
  famille               TEXT,
  type_cycle            TEXT CHECK (type_cycle IN ('annuelle', 'bisannuelle', 'perenne', 'vivace')),
  duree_peremption_mois INTEGER DEFAULT 24,
  seuil_alerte_g        DECIMAL,          -- Alerte stock bas (NULL = pas d'alerte)
  notes                 TEXT,
  deleted_at            TIMESTAMPTZ DEFAULT NULL,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  -- Anti-doublon insensible à la casse : géré par un index unique fonctionnel (voir section Indexes)
  CONSTRAINT varieties_nom_vernaculaire_unique UNIQUE (nom_vernaculaire)
);

-- ------------------------------------
-- 1.2 external_materials — Matières premières non-plantes (sel, sucre…)
-- ------------------------------------
CREATE TABLE external_materials (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom        TEXT NOT NULL UNIQUE,
  unite      TEXT DEFAULT 'g',
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ------------------------------------
-- 1.3 sites — Sites de culture
-- ------------------------------------
CREATE TABLE sites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom         TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ------------------------------------
-- 1.4 parcels — Parcelles
-- ------------------------------------
CREATE TABLE parcels (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id     UUID REFERENCES sites(id),
  nom         TEXT NOT NULL,
  code        TEXT NOT NULL UNIQUE,
  orientation TEXT,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (site_id, nom)
);

-- ------------------------------------
-- 1.5 rows — Rangs
-- ------------------------------------
CREATE TABLE rows (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id      UUID REFERENCES parcels(id),
  numero         TEXT NOT NULL,
  ancien_numero  TEXT,
  longueur_m     DECIMAL,
  position_ordre INTEGER,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE (parcel_id, numero)
);


-- ============================================================
-- 2. MODULE SEMIS
-- ============================================================

-- ------------------------------------
-- 2.1 seed_lots — Sachets de graines
-- ------------------------------------
CREATE TABLE seed_lots (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uuid_client              UUID UNIQUE,
  lot_interne              TEXT NOT NULL UNIQUE,   -- Format : SL-AAAA-NNN (généré côté appli)
  variety_id               UUID REFERENCES varieties(id),
  fournisseur              TEXT,
  numero_lot_fournisseur   TEXT,
  date_achat               DATE,
  date_facture             DATE,
  numero_facture           TEXT,
  poids_sachet_g           DECIMAL,
  certif_ab                BOOLEAN DEFAULT false,
  commentaire              TEXT,
  deleted_at               TIMESTAMPTZ DEFAULT NULL,
  created_at               TIMESTAMPTZ DEFAULT now()
);

-- ------------------------------------
-- 2.2 seedlings — Semis et levée
-- ------------------------------------
CREATE TABLE seedlings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uuid_client           UUID UNIQUE,
  seed_lot_id           UUID REFERENCES seed_lots(id),
  variety_id            UUID REFERENCES varieties(id),
  processus             TEXT CHECK (processus IN ('caissette_godet', 'mini_motte')),

  -- Processus 1 : mini-mottes
  numero_caisse         TEXT,
  nb_mottes             INTEGER,
  nb_mortes_mottes      INTEGER DEFAULT 0,

  -- Processus 2 : caissette/godet (2 étapes de perte)
  nb_caissettes         INTEGER,
  nb_plants_caissette   INTEGER,
  nb_mortes_caissette   INTEGER DEFAULT 0,
  nb_godets             INTEGER,
  nb_mortes_godet       INTEGER DEFAULT 0,

  -- Commun
  nb_donnees            INTEGER DEFAULT 0,
  nb_plants_obtenus     INTEGER,
  date_semis            DATE,
  poids_graines_utilise_g DECIMAL,
  date_levee            DATE,
  date_repiquage        DATE,
  temps_semis_min       INTEGER,
  temps_repiquage_min   INTEGER,
  commentaire           TEXT,
  deleted_at            TIMESTAMPTZ DEFAULT NULL,
  created_at            TIMESTAMPTZ DEFAULT now()
);


-- ============================================================
-- 3. MODULE PARCELLES
-- ============================================================

-- ------------------------------------
-- 3.1 soil_works — Travail de sol
-- ------------------------------------
CREATE TABLE soil_works (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uuid_client   UUID UNIQUE,
  row_id        UUID REFERENCES rows(id),
  date          DATE NOT NULL,
  type_travail  TEXT CHECK (type_travail IN ('depaillage', 'motoculteur', 'amendement', 'autre')),
  detail        TEXT,
  temps_min     INTEGER,
  commentaire   TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ------------------------------------
-- 3.2 plantings — Plan de culture / Plantation
-- ------------------------------------
CREATE TABLE plantings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uuid_client     UUID UNIQUE,
  row_id          UUID REFERENCES rows(id),
  variety_id      UUID REFERENCES varieties(id),
  seedling_id     UUID REFERENCES seedlings(id),
  fournisseur     TEXT,
  -- Logique : seedling_id rempli = issu de mes semis, fournisseur rempli = plant acheté
  annee           INTEGER NOT NULL,
  date_plantation DATE,
  nb_plants       INTEGER,
  type_plant      TEXT CHECK (type_plant IN (
    'godet', 'caissette', 'mini_motte', 'plant_achete',
    'division', 'bouture', 'marcottage', 'stolon', 'rhizome', 'semis_direct'
  )),
  espacement_cm   INTEGER,
  certif_ab       BOOLEAN DEFAULT false,
  date_commande   DATE,
  numero_facture  TEXT,
  temps_min       INTEGER,
  commentaire     TEXT,
  actif           BOOLEAN DEFAULT true,
  deleted_at      TIMESTAMPTZ DEFAULT NULL,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ------------------------------------
-- 3.3 row_care — Suivi de rang
-- ------------------------------------
CREATE TABLE row_care (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uuid_client UUID UNIQUE,
  row_id      UUID REFERENCES rows(id),
  variety_id  UUID REFERENCES varieties(id) NOT NULL,
  date        DATE NOT NULL,
  type_soin   TEXT CHECK (type_soin IN ('desherbage', 'paillage', 'arrosage', 'autre')),
  temps_min   INTEGER,
  commentaire TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
  -- Si un rang a 2 variétés, saisir 2 lignes (une par variété) pour imputer le temps
);

-- ------------------------------------
-- 3.4 harvests — Cueillette ⭐ crée du stock frais
-- ------------------------------------
CREATE TABLE harvests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uuid_client     UUID UNIQUE,
  type_cueillette TEXT CHECK (type_cueillette IN ('parcelle', 'sauvage')) NOT NULL,
  row_id          UUID REFERENCES rows(id),    -- NULL si sauvage
  lieu_sauvage    TEXT,                         -- Texte libre avec autocomplétion (uniquement si sauvage)
  variety_id      UUID REFERENCES varieties(id) NOT NULL,
  date            DATE NOT NULL,
  poids_g         DECIMAL NOT NULL CHECK (poids_g > 0),
  temps_min       INTEGER CHECK (temps_min IS NULL OR temps_min > 0),
  commentaire     TEXT,
  deleted_at      TIMESTAMPTZ DEFAULT NULL,
  created_at      TIMESTAMPTZ DEFAULT now()
  -- → La route API crée le stock_movement ENTRÉE frais en logique applicative (transaction SQL)
);

-- ------------------------------------
-- 3.5 uprootings — Arrachage
-- ------------------------------------
CREATE TABLE uprootings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uuid_client UUID UNIQUE,
  row_id      UUID REFERENCES rows(id) NOT NULL,
  variety_id  UUID REFERENCES varieties(id),   -- NULL = tout le rang arraché
  date        DATE NOT NULL,
  temps_min   INTEGER CHECK (temps_min IS NULL OR temps_min > 0),
  commentaire TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
  -- → Passe plantings.actif = false pour la variété arrachée sur ce rang (logique applicative)
);


-- ============================================================
-- 4. MODULE TRANSFORMATION
-- ============================================================

-- ------------------------------------
-- 4.1 cuttings — Tronçonnage ⭐ génère du stock
-- ------------------------------------
CREATE TABLE cuttings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uuid_client UUID UNIQUE,
  variety_id  UUID REFERENCES varieties(id) NOT NULL,
  type        TEXT CHECK (type IN ('entree', 'sortie')) NOT NULL,
  date        DATE NOT NULL,
  poids_g     DECIMAL NOT NULL CHECK (poids_g > 0),
  temps_min   INTEGER CHECK (temps_min IS NULL OR temps_min > 0),
  commentaire TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
  -- entree : stock_movement SORTIE frais (logique applicative)
  -- sortie : stock_movement ENTRÉE tronconnee (logique applicative)
);

-- ------------------------------------
-- 4.2 dryings — Séchage ⭐ génère du stock
-- ------------------------------------
CREATE TABLE dryings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uuid_client UUID UNIQUE,
  variety_id  UUID REFERENCES varieties(id) NOT NULL,
  type        TEXT CHECK (type IN ('entree', 'sortie')) NOT NULL,
  etat_plante TEXT NOT NULL,
  date        DATE NOT NULL,
  poids_g     DECIMAL NOT NULL CHECK (poids_g > 0),
  temps_min   INTEGER CHECK (temps_min IS NULL OR temps_min > 0),
  commentaire TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  -- entree ne peut être que frais ou tronconnee
  -- sortie ne peut être que sechee ou tronconnee_sechee
  CONSTRAINT dryings_etat_plante_check CHECK (
    (type = 'entree' AND etat_plante IN ('frais', 'tronconnee'))
    OR
    (type = 'sortie' AND etat_plante IN ('sechee', 'tronconnee_sechee'))
  )
);

-- ------------------------------------
-- 4.3 sortings — Triage ⭐ génère du stock
-- ------------------------------------
CREATE TABLE sortings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uuid_client UUID UNIQUE,
  variety_id  UUID REFERENCES varieties(id) NOT NULL,
  type        TEXT CHECK (type IN ('entree', 'sortie')) NOT NULL,
  etat_plante TEXT NOT NULL,
  date        DATE NOT NULL,
  poids_g     DECIMAL NOT NULL CHECK (poids_g > 0),
  temps_min   INTEGER CHECK (temps_min IS NULL OR temps_min > 0),
  commentaire TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  -- entree ne peut être que sechee ou tronconnee_sechee
  -- sortie ne peut être que sechee_triee ou tronconnee_sechee_triee
  CONSTRAINT sortings_etat_plante_check CHECK (
    (type = 'entree' AND etat_plante IN ('sechee', 'tronconnee_sechee'))
    OR
    (type = 'sortie' AND etat_plante IN ('sechee_triee', 'tronconnee_sechee_triee'))
  )
);


-- ============================================================
-- 5. MODULE STOCK (event-sourced)
-- ============================================================

-- ------------------------------------
-- 5.1 stock_movements — Tous les mouvements de stock
-- Le stock ne se stocke jamais directement : il se calcule depuis cette table.
-- ------------------------------------
CREATE TABLE stock_movements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variety_id      UUID REFERENCES varieties(id) NOT NULL,
  date            DATE NOT NULL,
  type_mouvement  TEXT CHECK (type_mouvement IN ('entree', 'sortie')) NOT NULL,
  etat_plante     TEXT CHECK (etat_plante IN (
    'frais', 'tronconnee', 'sechee',
    'tronconnee_sechee', 'sechee_triee', 'tronconnee_sechee_triee'
  )) NOT NULL,
  poids_g         DECIMAL NOT NULL CHECK (poids_g > 0),
  source_type     TEXT NOT NULL,  -- 'cueillette' | 'tronconnage_entree' | 'tronconnage_sortie'
                                  -- | 'sechage_entree' | 'sechage_sortie'
                                  -- | 'triage_entree' | 'triage_sortie'
                                  -- | 'production' | 'achat' | 'vente_directe' | 'ajustement'
  source_id       UUID,           -- ID de l'enregistrement source (NULL pour ajustements manuels)
  commentaire     TEXT,
  deleted_at      TIMESTAMPTZ DEFAULT NULL,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ------------------------------------
-- 5.2 stock_purchases — Achats de plantes externes
-- ------------------------------------
CREATE TABLE stock_purchases (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uuid_client            UUID UNIQUE,
  variety_id             UUID REFERENCES varieties(id) NOT NULL,
  date                   DATE NOT NULL,
  etat_plante            TEXT CHECK (etat_plante IN (
    'frais', 'tronconnee', 'sechee',
    'tronconnee_sechee', 'sechee_triee', 'tronconnee_sechee_triee'
  )) NOT NULL,
  poids_g                DECIMAL NOT NULL CHECK (poids_g > 0),
  fournisseur            TEXT NOT NULL,
  numero_lot_fournisseur TEXT,
  certif_ab              BOOLEAN DEFAULT false,
  prix                   DECIMAL CHECK (prix IS NULL OR prix >= 0),
  commentaire            TEXT,
  created_at             TIMESTAMPTZ DEFAULT now()
  -- → La route API génère le stock_movement ENTRÉE (logique applicative, transaction SQL)
);

-- ------------------------------------
-- 5.3 stock_direct_sales — Ventes directes de plantes en vrac
-- ------------------------------------
CREATE TABLE stock_direct_sales (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uuid_client  UUID UNIQUE,
  variety_id   UUID REFERENCES varieties(id) NOT NULL,
  date         DATE NOT NULL,
  etat_plante  TEXT CHECK (etat_plante IN (
    'frais', 'tronconnee', 'sechee',
    'tronconnee_sechee', 'sechee_triee', 'tronconnee_sechee_triee'
  )) NOT NULL,
  poids_g      DECIMAL NOT NULL CHECK (poids_g > 0),
  destinataire TEXT,
  commentaire  TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
  -- → La route API génère le stock_movement SORTIE après vérification du solde disponible
);

-- ------------------------------------
-- 5.4 stock_adjustments — Ajustements manuels de stock
-- ------------------------------------
CREATE TABLE stock_adjustments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uuid_client    UUID UNIQUE,
  variety_id     UUID REFERENCES varieties(id) NOT NULL,
  date           DATE NOT NULL,
  type_mouvement TEXT CHECK (type_mouvement IN ('entree', 'sortie')) NOT NULL,
  etat_plante    TEXT CHECK (etat_plante IN (
    'frais', 'tronconnee', 'sechee',
    'tronconnee_sechee', 'sechee_triee', 'tronconnee_sechee_triee'
  )) NOT NULL,
  poids_g        DECIMAL NOT NULL CHECK (poids_g > 0),
  motif          TEXT NOT NULL,    -- Obligatoire pour traçabilité
  created_at     TIMESTAMPTZ DEFAULT now()
  -- → Génère un stock_movement avec source_type = 'ajustement' (logique applicative)
);


-- ============================================================
-- 6. MODULE PRODUITS
-- ============================================================

-- ------------------------------------
-- 6.1 product_categories — Catégories de produits
-- ------------------------------------
CREATE TABLE product_categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom        TEXT NOT NULL UNIQUE,   -- "Tisane", "Mélange aromate", "Sel", "Sucre"
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ------------------------------------
-- 6.2 recipes — Recettes de base
-- ------------------------------------
CREATE TABLE recipes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id     UUID REFERENCES product_categories(id),
  nom             TEXT NOT NULL UNIQUE,
  numero_tisane   TEXT,
  poids_sachet_g  DECIMAL NOT NULL CHECK (poids_sachet_g > 0),
  description     TEXT,
  actif           BOOLEAN DEFAULT true,
  deleted_at      TIMESTAMPTZ DEFAULT NULL,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ------------------------------------
-- 6.3 recipe_ingredients — Composition de base (% théorique)
-- ------------------------------------
CREATE TABLE recipe_ingredients (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id            UUID REFERENCES recipes(id) ON DELETE CASCADE,
  variety_id           UUID REFERENCES varieties(id),
  external_material_id UUID REFERENCES external_materials(id),
  etat_plante          TEXT CHECK (etat_plante IN (
    'frais', 'tronconnee', 'sechee',
    'tronconnee_sechee', 'sechee_triee', 'tronconnee_sechee_triee'
  )),                                       -- NULL pour les matériaux externes
  pourcentage          DECIMAL NOT NULL CHECK (pourcentage > 0 AND pourcentage <= 1),
  ordre                INTEGER,
  created_at           TIMESTAMPTZ DEFAULT now(),
  -- Exactement l'un des deux doit être rempli
  CONSTRAINT recipe_ingredients_source_check CHECK (
    (variety_id IS NOT NULL AND external_material_id IS NULL)
    OR
    (variety_id IS NULL AND external_material_id IS NOT NULL)
  )
);

-- ------------------------------------
-- 6.4 production_lots — Lots de production
-- ------------------------------------
CREATE TABLE production_lots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uuid_client     UUID UNIQUE,
  recipe_id       UUID REFERENCES recipes(id),
  numero_lot      TEXT NOT NULL UNIQUE,   -- Format auto-généré : [CODE]AAAAMMJJ (ex: BD20250604)
  date_production DATE NOT NULL,
  ddm             DATE NOT NULL,
  nb_unites       INTEGER NOT NULL CHECK (nb_unites > 0),
  poids_total_g   DECIMAL NOT NULL CHECK (poids_total_g > 0),
  temps_min       INTEGER CHECK (temps_min IS NULL OR temps_min > 0),
  commentaire     TEXT,
  deleted_at      TIMESTAMPTZ DEFAULT NULL,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ------------------------------------
-- 6.5 production_lot_ingredients — Composition RÉELLE du lot (fait foi pour stock et traçabilité)
-- ------------------------------------
CREATE TABLE production_lot_ingredients (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_lot_id    UUID REFERENCES production_lots(id) ON DELETE CASCADE,
  variety_id           UUID REFERENCES varieties(id),
  external_material_id UUID REFERENCES external_materials(id),
  etat_plante          TEXT CHECK (etat_plante IN (
    'frais', 'tronconnee', 'sechee',
    'tronconnee_sechee', 'sechee_triee', 'tronconnee_sechee_triee'
  )),
  pourcentage          DECIMAL NOT NULL CHECK (pourcentage > 0 AND pourcentage <= 1),
  poids_g              DECIMAL NOT NULL CHECK (poids_g > 0),
  annee_recolte        INTEGER,
  created_at           TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT production_lot_ingredients_source_check CHECK (
    (variety_id IS NOT NULL AND external_material_id IS NULL)
    OR
    (variety_id IS NULL AND external_material_id IS NOT NULL)
  )
);

-- ------------------------------------
-- 6.6 product_stock_movements — Mouvements stock produits finis
-- ------------------------------------
CREATE TABLE product_stock_movements (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_lot_id UUID REFERENCES production_lots(id),
  date              DATE NOT NULL,
  type_mouvement    TEXT CHECK (type_mouvement IN ('entree', 'sortie')) NOT NULL,
  quantite          INTEGER NOT NULL CHECK (quantite > 0),
  commentaire       TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);


-- ============================================================
-- 7. MODULE PRÉVISIONNEL
-- ============================================================

CREATE TABLE forecasts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  annee               INTEGER NOT NULL,
  variety_id          UUID REFERENCES varieties(id) NOT NULL,
  etat_plante         TEXT CHECK (etat_plante IN (
    'frais', 'tronconnee', 'sechee',
    'tronconnee_sechee', 'sechee_triee', 'tronconnee_sechee_triee'
  )),
  quantite_prevue_g   DECIMAL CHECK (quantite_prevue_g IS NULL OR quantite_prevue_g >= 0),
  commentaire         TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  UNIQUE (annee, variety_id, etat_plante)
);


-- ============================================================
-- 8. TABLE PRODUCTION_SUMMARY (cache des cumuls — maintenu par triggers)
-- ============================================================

CREATE TABLE production_summary (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variety_id                UUID REFERENCES varieties(id) NOT NULL,
  annee                     INTEGER NOT NULL,
  mois                      INTEGER CHECK (mois IS NULL OR (mois >= 1 AND mois <= 12)),
  -- Volumes par étape (grammes)
  total_cueilli_g           DECIMAL DEFAULT 0,
  total_tronconnee_g        DECIMAL DEFAULT 0,
  total_sechee_g            DECIMAL DEFAULT 0,   -- sechee + tronconnee_sechee
  total_triee_g             DECIMAL DEFAULT 0,   -- sechee_triee + tronconnee_sechee_triee
  total_utilise_production_g DECIMAL DEFAULT 0,
  total_vendu_direct_g      DECIMAL DEFAULT 0,
  total_achete_g            DECIMAL DEFAULT 0,
  -- Temps de travail cumulés (minutes)
  temps_cueillette_min      INTEGER DEFAULT 0,
  temps_tronconnage_min     INTEGER DEFAULT 0,
  temps_sechage_min         INTEGER DEFAULT 0,
  temps_triage_min          INTEGER DEFAULT 0,
  temps_production_min      INTEGER DEFAULT 0,
  updated_at                TIMESTAMPTZ DEFAULT now(),
  -- NULL = cumul annuel ; 1-12 = cumul mensuel
  -- NULLS NOT DISTINCT : (variety_id, annee, NULL) est traité comme unique
  UNIQUE NULLS NOT DISTINCT (variety_id, annee, mois)
);


-- ============================================================
-- 9. TABLE APP_LOGS (journalisation des événements critiques)
-- ============================================================

CREATE TABLE app_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level      TEXT CHECK (level IN ('info', 'warn', 'error')) NOT NULL,
  source     TEXT NOT NULL,   -- 'sync' | 'stock' | 'production' | 'backup' | 'auth' | …
  message    TEXT NOT NULL,
  metadata   JSONB,           -- Détails supplémentaires (payload, erreur, ids concernés…)
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Purge automatique des logs > 90 jours via pg_cron (si disponible) ou cron Vercel.
-- Exécuter périodiquement : DELETE FROM app_logs WHERE created_at < now() - INTERVAL '90 days';


-- ============================================================
-- 10. VUE v_stock — Stock en temps réel (calculé, jamais stocké)
-- ============================================================

CREATE OR REPLACE VIEW v_stock AS
SELECT
  v.id                                                AS variety_id,
  v.nom_vernaculaire,
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
GROUP BY v.id, v.nom_vernaculaire, sm.etat_plante;

-- Utilisation : SELECT * FROM v_stock WHERE variety_id = '...' ORDER BY etat_plante;
-- Pour le tableau complet bureau (colonnes par état) : pivoter côté applicatif.


-- ============================================================
-- 11. INDEXES (colonnes fréquemment filtrées)
-- ============================================================

-- unaccent() est STABLE par défaut dans PostgreSQL, donc interdite dans une expression d'index.
-- Solution standard : wrapper IMMUTABLE qui délègue à unaccent().
CREATE OR REPLACE FUNCTION immutable_unaccent(text)
RETURNS text AS $$
  SELECT unaccent($1);
$$ LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE;

-- Anti-doublon variétés insensible à la casse et aux accents
CREATE UNIQUE INDEX varieties_nom_ci ON varieties (lower(immutable_unaccent(nom_vernaculaire)))
  WHERE deleted_at IS NULL;

-- stock_movements
CREATE INDEX idx_stock_movements_variety_id   ON stock_movements (variety_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_stock_movements_date         ON stock_movements (date)       WHERE deleted_at IS NULL;
CREATE INDEX idx_stock_movements_etat_plante  ON stock_movements (etat_plante);
CREATE INDEX idx_stock_movements_source       ON stock_movements (source_type, source_id);

-- harvests
CREATE INDEX idx_harvests_variety_id  ON harvests (variety_id)  WHERE deleted_at IS NULL;
CREATE INDEX idx_harvests_row_id      ON harvests (row_id)      WHERE deleted_at IS NULL;
CREATE INDEX idx_harvests_date        ON harvests (date)        WHERE deleted_at IS NULL;

-- plantings
CREATE INDEX idx_plantings_row_id     ON plantings (row_id)     WHERE deleted_at IS NULL;
CREATE INDEX idx_plantings_variety_id ON plantings (variety_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_plantings_actif      ON plantings (actif)      WHERE deleted_at IS NULL;
CREATE INDEX idx_plantings_annee      ON plantings (annee);

-- row_care
CREATE INDEX idx_row_care_row_id      ON row_care (row_id);
CREATE INDEX idx_row_care_variety_id  ON row_care (variety_id);

-- cuttings / dryings / sortings
CREATE INDEX idx_cuttings_variety_id  ON cuttings (variety_id);
CREATE INDEX idx_cuttings_date        ON cuttings (date);
CREATE INDEX idx_dryings_variety_id   ON dryings  (variety_id);
CREATE INDEX idx_dryings_date         ON dryings  (date);
CREATE INDEX idx_sortings_variety_id  ON sortings (variety_id);
CREATE INDEX idx_sortings_date        ON sortings (date);

-- production
CREATE INDEX idx_production_lots_recipe_id        ON production_lots (recipe_id)    WHERE deleted_at IS NULL;
CREATE INDEX idx_production_lots_date_production  ON production_lots (date_production);
CREATE INDEX idx_production_lot_ingredients_lot   ON production_lot_ingredients (production_lot_id);
CREATE INDEX idx_production_lot_ingredients_var   ON production_lot_ingredients (variety_id);

-- production_summary
CREATE INDEX idx_production_summary_variety_annee ON production_summary (variety_id, annee);

-- seed_lots
CREATE INDEX idx_seed_lots_variety_id ON seed_lots (variety_id) WHERE deleted_at IS NULL;

-- app_logs (purge + filtrage)
CREATE INDEX idx_app_logs_created_at ON app_logs (created_at);
CREATE INDEX idx_app_logs_level      ON app_logs (level);
CREATE INDEX idx_app_logs_source     ON app_logs (source);


-- ============================================================
-- 12. ROW LEVEL SECURITY (RLS)
-- ============================================================
-- Politique simple : tout utilisateur authentifié a accès à tout.
-- (Petite équipe de confiance — 2-3 personnes)

DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'varieties', 'external_materials', 'sites', 'parcels', 'rows',
    'seed_lots', 'seedlings',
    'soil_works', 'plantings', 'row_care', 'harvests', 'uprootings',
    'cuttings', 'dryings', 'sortings',
    'stock_movements', 'stock_purchases', 'stock_direct_sales', 'stock_adjustments',
    'product_categories', 'recipes', 'recipe_ingredients',
    'production_lots', 'production_lot_ingredients', 'product_stock_movements',
    'forecasts', 'production_summary', 'app_logs'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY "authenticated_full_access" ON %I
       FOR ALL TO authenticated
       USING (true) WITH CHECK (true)',
      t
    );
  END LOOP;
END $$;


-- ============================================================
-- 13. FONCTIONS UTILITAIRES
-- ============================================================

-- ------------------------------------
-- 13.1 Mise à jour automatique de updated_at
-- ------------------------------------
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_varieties_updated_at
  BEFORE UPDATE ON varieties
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_recipes_updated_at
  BEFORE UPDATE ON recipes
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ------------------------------------
-- 13.2 Fonction helper interne — UPSERT production_summary
-- Met à jour la ligne mensuelle ET la ligne annuelle (mois = NULL) en un appel.
-- ------------------------------------
CREATE OR REPLACE FUNCTION _ps_upsert(
  p_variety_id               UUID,
  p_annee                    INTEGER,
  p_mois                     INTEGER,  -- non-NULL = met à jour mensuel + annuel ; NULL = annuel seul
  p_delta_cueilli            DECIMAL  DEFAULT 0,
  p_delta_tronconnee         DECIMAL  DEFAULT 0,
  p_delta_sechee             DECIMAL  DEFAULT 0,
  p_delta_triee              DECIMAL  DEFAULT 0,
  p_delta_utilise_prod       DECIMAL  DEFAULT 0,
  p_delta_vendu_direct       DECIMAL  DEFAULT 0,
  p_delta_achete             DECIMAL  DEFAULT 0,
  p_delta_temps_cueillette   INTEGER  DEFAULT 0,
  p_delta_temps_tronconnage  INTEGER  DEFAULT 0,
  p_delta_temps_sechage      INTEGER  DEFAULT 0,
  p_delta_temps_triage       INTEGER  DEFAULT 0,
  p_delta_temps_production   INTEGER  DEFAULT 0
) RETURNS VOID AS $$
DECLARE
  -- Boucle sur le mois fourni + NULL (cumul annuel).
  -- Si p_mois IS NULL, v_months = {NULL} → une seule itération sur la ligne annuelle.
  -- Si p_mois = 5,     v_months = {5, NULL} → deux itérations (mensuel + annuel).
  v_months INTEGER[];
  m        INTEGER;
BEGIN
  IF p_mois IS NOT NULL THEN
    v_months := ARRAY[p_mois, NULL::INTEGER];
  ELSE
    v_months := ARRAY[NULL::INTEGER];
  END IF;

  FOREACH m IN ARRAY v_months LOOP
    INSERT INTO production_summary (
      variety_id, annee, mois,
      total_cueilli_g, total_tronconnee_g, total_sechee_g, total_triee_g,
      total_utilise_production_g, total_vendu_direct_g, total_achete_g,
      temps_cueillette_min, temps_tronconnage_min, temps_sechage_min,
      temps_triage_min, temps_production_min
    ) VALUES (
      p_variety_id, p_annee, m,
      GREATEST(p_delta_cueilli, 0),           GREATEST(p_delta_tronconnee, 0),
      GREATEST(p_delta_sechee, 0),            GREATEST(p_delta_triee, 0),
      GREATEST(p_delta_utilise_prod, 0),      GREATEST(p_delta_vendu_direct, 0),
      GREATEST(p_delta_achete, 0),
      GREATEST(p_delta_temps_cueillette, 0),  GREATEST(p_delta_temps_tronconnage, 0),
      GREATEST(p_delta_temps_sechage, 0),     GREATEST(p_delta_temps_triage, 0),
      GREATEST(p_delta_temps_production, 0)
    )
    ON CONFLICT (variety_id, annee, mois) DO UPDATE SET
      total_cueilli_g            = production_summary.total_cueilli_g            + p_delta_cueilli,
      total_tronconnee_g         = production_summary.total_tronconnee_g         + p_delta_tronconnee,
      total_sechee_g             = production_summary.total_sechee_g             + p_delta_sechee,
      total_triee_g              = production_summary.total_triee_g              + p_delta_triee,
      total_utilise_production_g = production_summary.total_utilise_production_g + p_delta_utilise_prod,
      total_vendu_direct_g       = production_summary.total_vendu_direct_g       + p_delta_vendu_direct,
      total_achete_g             = production_summary.total_achete_g             + p_delta_achete,
      temps_cueillette_min       = production_summary.temps_cueillette_min       + p_delta_temps_cueillette,
      temps_tronconnage_min      = production_summary.temps_tronconnage_min      + p_delta_temps_tronconnage,
      temps_sechage_min          = production_summary.temps_sechage_min          + p_delta_temps_sechage,
      temps_triage_min           = production_summary.temps_triage_min           + p_delta_temps_triage,
      temps_production_min       = production_summary.temps_production_min       + p_delta_temps_production,
      updated_at                 = now();
  END LOOP;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- 14. TRIGGERS — production_summary
-- Chaque opération incrémente (delta positif) ou décrémente (delta négatif)
-- la ligne mensuelle ET la ligne annuelle de production_summary.
-- Les décréments gèrent le soft delete (deleted_at NULL → non-NULL).
-- ============================================================

-- ------------------------------------
-- 14.1 harvests → total_cueilli_g + temps_cueillette_min
-- ------------------------------------
CREATE OR REPLACE FUNCTION fn_ps_harvests() RETURNS TRIGGER AS $$
DECLARE
  v_annee INTEGER;
  v_mois  INTEGER;
  v_sign  INTEGER := 1;  -- +1 pour ajout, -1 pour suppression
BEGIN
  -- Déterminer la ligne à modifier et le signe
  IF TG_OP = 'INSERT' AND NEW.deleted_at IS NULL THEN
    v_sign := 1;
    v_annee := EXTRACT(YEAR FROM NEW.date)::INTEGER;
    v_mois  := EXTRACT(MONTH FROM NEW.date)::INTEGER;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Soft delete : deleted_at vient d'être renseigné → décrémenter
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      v_sign := -1;
    -- Un-delete → incrémenter
    ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
      v_sign := 1;
    ELSE
      RETURN NEW;  -- Autre UPDATE sans changement de deleted_at : ignorer
    END IF;
    v_annee := EXTRACT(YEAR FROM NEW.date)::INTEGER;
    v_mois  := EXTRACT(MONTH FROM NEW.date)::INTEGER;
  ELSE
    RETURN NEW;
  END IF;

  PERFORM _ps_upsert(
    NEW.variety_id, v_annee, v_mois,
    p_delta_cueilli          => v_sign * NEW.poids_g,
    p_delta_temps_cueillette => v_sign * COALESCE(NEW.temps_min, 0)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ps_harvests
  AFTER INSERT OR UPDATE ON harvests
  FOR EACH ROW EXECUTE FUNCTION fn_ps_harvests();

-- ------------------------------------
-- 14.2 cuttings → total_tronconnee_g + temps_tronconnage_min
-- Seul type='sortie' crée du stock tronconnee (la sortie correspond à l'OUTPUT de l'opération).
-- Le temps est attribué à la sortie (fin de l'opération).
-- ------------------------------------
CREATE OR REPLACE FUNCTION fn_ps_cuttings() RETURNS TRIGGER AS $$
BEGIN
  -- On n'impacte production_summary que pour les sorties (output tronconnee)
  IF NEW.type <> 'sortie' THEN RETURN NEW; END IF;

  PERFORM _ps_upsert(
    NEW.variety_id,
    EXTRACT(YEAR FROM NEW.date)::INTEGER,
    EXTRACT(MONTH FROM NEW.date)::INTEGER,
    p_delta_tronconnee        => NEW.poids_g,
    p_delta_temps_tronconnage => COALESCE(NEW.temps_min, 0)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ps_cuttings
  AFTER INSERT ON cuttings
  FOR EACH ROW EXECUTE FUNCTION fn_ps_cuttings();

-- ------------------------------------
-- 14.3 dryings → total_sechee_g + temps_sechage_min
-- Seul type='sortie' compte (sechee ou tronconnee_sechee produits).
-- ------------------------------------
CREATE OR REPLACE FUNCTION fn_ps_dryings() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type <> 'sortie' THEN RETURN NEW; END IF;

  PERFORM _ps_upsert(
    NEW.variety_id,
    EXTRACT(YEAR FROM NEW.date)::INTEGER,
    EXTRACT(MONTH FROM NEW.date)::INTEGER,
    p_delta_sechee        => NEW.poids_g,
    p_delta_temps_sechage => COALESCE(NEW.temps_min, 0)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ps_dryings
  AFTER INSERT ON dryings
  FOR EACH ROW EXECUTE FUNCTION fn_ps_dryings();

-- ------------------------------------
-- 14.4 sortings → total_triee_g + temps_triage_min
-- Seul type='sortie' compte (sechee_triee ou tronconnee_sechee_triee produits).
-- ------------------------------------
CREATE OR REPLACE FUNCTION fn_ps_sortings() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type <> 'sortie' THEN RETURN NEW; END IF;

  PERFORM _ps_upsert(
    NEW.variety_id,
    EXTRACT(YEAR FROM NEW.date)::INTEGER,
    EXTRACT(MONTH FROM NEW.date)::INTEGER,
    p_delta_triee        => NEW.poids_g,
    p_delta_temps_triage => COALESCE(NEW.temps_min, 0)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ps_sortings
  AFTER INSERT ON sortings
  FOR EACH ROW EXECUTE FUNCTION fn_ps_sortings();

-- ------------------------------------
-- 14.5 production_lot_ingredients → total_utilise_production_g
-- Déclenché à la validation du lot (INSERT des ingrédients).
-- L'année/mois est récupérée depuis la table production_lots parente.
-- Seuls les ingrédients plantes (variety_id non NULL) impactent le stock.
-- Le temps de production est loggué sur production_lots (pas sur les ingrédients).
-- ------------------------------------
CREATE OR REPLACE FUNCTION fn_ps_production_lot_ingredients() RETURNS TRIGGER AS $$
DECLARE
  v_lot production_lots%ROWTYPE;
BEGIN
  IF NEW.variety_id IS NULL THEN RETURN NEW; END IF;  -- Matériau externe : ignorer

  SELECT * INTO v_lot FROM production_lots WHERE id = NEW.production_lot_id;

  PERFORM _ps_upsert(
    NEW.variety_id,
    EXTRACT(YEAR FROM v_lot.date_production)::INTEGER,
    EXTRACT(MONTH FROM v_lot.date_production)::INTEGER,
    p_delta_utilise_prod => NEW.poids_g
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ps_production_lot_ingredients
  AFTER INSERT ON production_lot_ingredients
  FOR EACH ROW EXECUTE FUNCTION fn_ps_production_lot_ingredients();

-- Le temps de production est mis à jour depuis production_lots directement :
CREATE OR REPLACE FUNCTION fn_ps_production_lots_time() RETURNS TRIGGER AS $$
DECLARE
  v_variety_id UUID;
BEGIN
  -- Mise à jour du temps de production sur la ligne annuelle + mensuelle
  -- (déclenché à l'INSERT du lot, quand temps_min est renseigné)
  IF NEW.temps_min IS NULL OR NEW.temps_min = 0 THEN RETURN NEW; END IF;

  -- On a besoin d'une variety_id : on prend la première plante de ce lot
  -- Le temps est imputé à la 1ère variété plante — limitation connue,
  -- acceptable pour une petite structure. Le recalcul admin corrige si besoin.
  SELECT variety_id INTO v_variety_id
  FROM production_lot_ingredients
  WHERE production_lot_id = NEW.id AND variety_id IS NOT NULL
  LIMIT 1;

  IF v_variety_id IS NOT NULL THEN
    PERFORM _ps_upsert(
      v_variety_id,
      EXTRACT(YEAR FROM NEW.date_production)::INTEGER,
      EXTRACT(MONTH FROM NEW.date_production)::INTEGER,
      p_delta_temps_production => NEW.temps_min
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note : ce trigger sur production_lots ne peut être déclenché qu'APRÈS l'insertion
-- des production_lot_ingredients (qui ont leur propre trigger). Dans l'implémentation
-- applicative, insérer d'abord le lot puis les ingrédients.
CREATE TRIGGER trg_ps_production_lots_time
  AFTER INSERT ON production_lots
  FOR EACH ROW EXECUTE FUNCTION fn_ps_production_lots_time();

-- ------------------------------------
-- 14.6 stock_direct_sales → total_vendu_direct_g
-- ------------------------------------
CREATE OR REPLACE FUNCTION fn_ps_direct_sales() RETURNS TRIGGER AS $$
BEGIN
  PERFORM _ps_upsert(
    NEW.variety_id,
    EXTRACT(YEAR FROM NEW.date)::INTEGER,
    EXTRACT(MONTH FROM NEW.date)::INTEGER,
    p_delta_vendu_direct => NEW.poids_g
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ps_direct_sales
  AFTER INSERT ON stock_direct_sales
  FOR EACH ROW EXECUTE FUNCTION fn_ps_direct_sales();

-- ------------------------------------
-- 14.7 stock_purchases → total_achete_g
-- ------------------------------------
CREATE OR REPLACE FUNCTION fn_ps_purchases() RETURNS TRIGGER AS $$
BEGIN
  PERFORM _ps_upsert(
    NEW.variety_id,
    EXTRACT(YEAR FROM NEW.date)::INTEGER,
    EXTRACT(MONTH FROM NEW.date)::INTEGER,
    p_delta_achete => NEW.poids_g
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ps_purchases
  AFTER INSERT ON stock_purchases
  FOR EACH ROW EXECUTE FUNCTION fn_ps_purchases();


-- ============================================================
-- 15. FONCTION ADMIN — recalculate_production_summary()
-- Reconstruit entièrement production_summary depuis les tables sources.
-- À utiliser via un bouton admin sur le bureau en cas de doute sur l'intégrité.
-- ============================================================

CREATE OR REPLACE FUNCTION recalculate_production_summary()
RETURNS TEXT AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  -- 1. Vider la table
  TRUNCATE production_summary;

  -- 2. Cueillettes (harvests actives)
  INSERT INTO production_summary (variety_id, annee, mois, total_cueilli_g, temps_cueillette_min)
  SELECT
    variety_id,
    EXTRACT(YEAR FROM date)::INTEGER AS annee,
    EXTRACT(MONTH FROM date)::INTEGER AS mois,
    SUM(poids_g),
    SUM(COALESCE(temps_min, 0))
  FROM harvests
  WHERE deleted_at IS NULL
  GROUP BY variety_id, annee, mois
  ON CONFLICT (variety_id, annee, mois) DO UPDATE SET
    total_cueilli_g      = production_summary.total_cueilli_g      + EXCLUDED.total_cueilli_g,
    temps_cueillette_min = production_summary.temps_cueillette_min + EXCLUDED.temps_cueillette_min,
    updated_at = now();

  -- Ligne annuelle (mois = NULL) pour cueillettes
  INSERT INTO production_summary (variety_id, annee, mois, total_cueilli_g, temps_cueillette_min)
  SELECT
    variety_id,
    EXTRACT(YEAR FROM date)::INTEGER AS annee,
    NULL AS mois,
    SUM(poids_g),
    SUM(COALESCE(temps_min, 0))
  FROM harvests
  WHERE deleted_at IS NULL
  GROUP BY variety_id, annee
  ON CONFLICT (variety_id, annee, mois) DO UPDATE SET
    total_cueilli_g      = production_summary.total_cueilli_g      + EXCLUDED.total_cueilli_g,
    temps_cueillette_min = production_summary.temps_cueillette_min + EXCLUDED.temps_cueillette_min,
    updated_at = now();

  -- 3. Tronçonnage — sorties seulement
  INSERT INTO production_summary (variety_id, annee, mois, total_tronconnee_g, temps_tronconnage_min)
  SELECT variety_id, EXTRACT(YEAR FROM date)::INTEGER, EXTRACT(MONTH FROM date)::INTEGER,
         SUM(poids_g), SUM(COALESCE(temps_min, 0))
  FROM cuttings WHERE type = 'sortie'
  GROUP BY variety_id, EXTRACT(YEAR FROM date)::INTEGER, EXTRACT(MONTH FROM date)::INTEGER
  ON CONFLICT (variety_id, annee, mois) DO UPDATE SET
    total_tronconnee_g    = production_summary.total_tronconnee_g    + EXCLUDED.total_tronconnee_g,
    temps_tronconnage_min = production_summary.temps_tronconnage_min + EXCLUDED.temps_tronconnage_min,
    updated_at = now();

  INSERT INTO production_summary (variety_id, annee, mois, total_tronconnee_g, temps_tronconnage_min)
  SELECT variety_id, EXTRACT(YEAR FROM date)::INTEGER, NULL,
         SUM(poids_g), SUM(COALESCE(temps_min, 0))
  FROM cuttings WHERE type = 'sortie'
  GROUP BY variety_id, EXTRACT(YEAR FROM date)::INTEGER
  ON CONFLICT (variety_id, annee, mois) DO UPDATE SET
    total_tronconnee_g    = production_summary.total_tronconnee_g    + EXCLUDED.total_tronconnee_g,
    temps_tronconnage_min = production_summary.temps_tronconnage_min + EXCLUDED.temps_tronconnage_min,
    updated_at = now();

  -- 4. Séchage — sorties seulement
  INSERT INTO production_summary (variety_id, annee, mois, total_sechee_g, temps_sechage_min)
  SELECT variety_id, EXTRACT(YEAR FROM date)::INTEGER, EXTRACT(MONTH FROM date)::INTEGER,
         SUM(poids_g), SUM(COALESCE(temps_min, 0))
  FROM dryings WHERE type = 'sortie'
  GROUP BY variety_id, EXTRACT(YEAR FROM date)::INTEGER, EXTRACT(MONTH FROM date)::INTEGER
  ON CONFLICT (variety_id, annee, mois) DO UPDATE SET
    total_sechee_g    = production_summary.total_sechee_g    + EXCLUDED.total_sechee_g,
    temps_sechage_min = production_summary.temps_sechage_min + EXCLUDED.temps_sechage_min,
    updated_at = now();

  INSERT INTO production_summary (variety_id, annee, mois, total_sechee_g, temps_sechage_min)
  SELECT variety_id, EXTRACT(YEAR FROM date)::INTEGER, NULL,
         SUM(poids_g), SUM(COALESCE(temps_min, 0))
  FROM dryings WHERE type = 'sortie'
  GROUP BY variety_id, EXTRACT(YEAR FROM date)::INTEGER
  ON CONFLICT (variety_id, annee, mois) DO UPDATE SET
    total_sechee_g    = production_summary.total_sechee_g    + EXCLUDED.total_sechee_g,
    temps_sechage_min = production_summary.temps_sechage_min + EXCLUDED.temps_sechage_min,
    updated_at = now();

  -- 5. Triage — sorties seulement
  INSERT INTO production_summary (variety_id, annee, mois, total_triee_g, temps_triage_min)
  SELECT variety_id, EXTRACT(YEAR FROM date)::INTEGER, EXTRACT(MONTH FROM date)::INTEGER,
         SUM(poids_g), SUM(COALESCE(temps_min, 0))
  FROM sortings WHERE type = 'sortie'
  GROUP BY variety_id, EXTRACT(YEAR FROM date)::INTEGER, EXTRACT(MONTH FROM date)::INTEGER
  ON CONFLICT (variety_id, annee, mois) DO UPDATE SET
    total_triee_g    = production_summary.total_triee_g    + EXCLUDED.total_triee_g,
    temps_triage_min = production_summary.temps_triage_min + EXCLUDED.temps_triage_min,
    updated_at = now();

  INSERT INTO production_summary (variety_id, annee, mois, total_triee_g, temps_triage_min)
  SELECT variety_id, EXTRACT(YEAR FROM date)::INTEGER, NULL,
         SUM(poids_g), SUM(COALESCE(temps_min, 0))
  FROM sortings WHERE type = 'sortie'
  GROUP BY variety_id, EXTRACT(YEAR FROM date)::INTEGER
  ON CONFLICT (variety_id, annee, mois) DO UPDATE SET
    total_triee_g    = production_summary.total_triee_g    + EXCLUDED.total_triee_g,
    temps_triage_min = production_summary.temps_triage_min + EXCLUDED.temps_triage_min,
    updated_at = now();

  -- 6. Production (ingrédients plantes des lots actifs)
  INSERT INTO production_summary (variety_id, annee, mois, total_utilise_production_g)
  SELECT
    pli.variety_id,
    EXTRACT(YEAR FROM pl.date_production)::INTEGER,
    EXTRACT(MONTH FROM pl.date_production)::INTEGER,
    SUM(pli.poids_g)
  FROM production_lot_ingredients pli
  JOIN production_lots pl ON pl.id = pli.production_lot_id
  WHERE pli.variety_id IS NOT NULL AND pl.deleted_at IS NULL
  GROUP BY pli.variety_id, EXTRACT(YEAR FROM pl.date_production)::INTEGER, EXTRACT(MONTH FROM pl.date_production)::INTEGER
  ON CONFLICT (variety_id, annee, mois) DO UPDATE SET
    total_utilise_production_g = production_summary.total_utilise_production_g + EXCLUDED.total_utilise_production_g,
    updated_at = now();

  INSERT INTO production_summary (variety_id, annee, mois, total_utilise_production_g)
  SELECT
    pli.variety_id,
    EXTRACT(YEAR FROM pl.date_production)::INTEGER,
    NULL,
    SUM(pli.poids_g)
  FROM production_lot_ingredients pli
  JOIN production_lots pl ON pl.id = pli.production_lot_id
  WHERE pli.variety_id IS NOT NULL AND pl.deleted_at IS NULL
  GROUP BY pli.variety_id, EXTRACT(YEAR FROM pl.date_production)::INTEGER
  ON CONFLICT (variety_id, annee, mois) DO UPDATE SET
    total_utilise_production_g = production_summary.total_utilise_production_g + EXCLUDED.total_utilise_production_g,
    updated_at = now();

  -- 7. Ventes directes
  INSERT INTO production_summary (variety_id, annee, mois, total_vendu_direct_g)
  SELECT variety_id, EXTRACT(YEAR FROM date)::INTEGER, EXTRACT(MONTH FROM date)::INTEGER, SUM(poids_g)
  FROM stock_direct_sales
  GROUP BY variety_id, EXTRACT(YEAR FROM date)::INTEGER, EXTRACT(MONTH FROM date)::INTEGER
  ON CONFLICT (variety_id, annee, mois) DO UPDATE SET
    total_vendu_direct_g = production_summary.total_vendu_direct_g + EXCLUDED.total_vendu_direct_g,
    updated_at = now();

  INSERT INTO production_summary (variety_id, annee, mois, total_vendu_direct_g)
  SELECT variety_id, EXTRACT(YEAR FROM date)::INTEGER, NULL, SUM(poids_g)
  FROM stock_direct_sales
  GROUP BY variety_id, EXTRACT(YEAR FROM date)::INTEGER
  ON CONFLICT (variety_id, annee, mois) DO UPDATE SET
    total_vendu_direct_g = production_summary.total_vendu_direct_g + EXCLUDED.total_vendu_direct_g,
    updated_at = now();

  -- 8. Achats
  INSERT INTO production_summary (variety_id, annee, mois, total_achete_g)
  SELECT variety_id, EXTRACT(YEAR FROM date)::INTEGER, EXTRACT(MONTH FROM date)::INTEGER, SUM(poids_g)
  FROM stock_purchases
  GROUP BY variety_id, EXTRACT(YEAR FROM date)::INTEGER, EXTRACT(MONTH FROM date)::INTEGER
  ON CONFLICT (variety_id, annee, mois) DO UPDATE SET
    total_achete_g = production_summary.total_achete_g + EXCLUDED.total_achete_g,
    updated_at = now();

  INSERT INTO production_summary (variety_id, annee, mois, total_achete_g)
  SELECT variety_id, EXTRACT(YEAR FROM date)::INTEGER, NULL, SUM(poids_g)
  FROM stock_purchases
  GROUP BY variety_id, EXTRACT(YEAR FROM date)::INTEGER
  ON CONFLICT (variety_id, annee, mois) DO UPDATE SET
    total_achete_g = production_summary.total_achete_g + EXCLUDED.total_achete_g,
    updated_at = now();

  SELECT COUNT(*) INTO v_count FROM production_summary;
  RETURN format('production_summary reconstruite : %s lignes', v_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Usage : SELECT recalculate_production_summary();


-- ============================================================
-- FIN DU SCHÉMA
-- ============================================================
-- Tables créées (28) :
--   Référentiel  : varieties, external_materials, sites, parcels, rows
--   Semis        : seed_lots, seedlings
--   Parcelles    : soil_works, plantings, row_care, harvests, uprootings
--   Transformation: cuttings, dryings, sortings
--   Stock        : stock_movements, stock_purchases, stock_direct_sales, stock_adjustments
--   Produits     : product_categories, recipes, recipe_ingredients,
--                  production_lots, production_lot_ingredients, product_stock_movements
--   Prévisionnel : forecasts
--   Système      : production_summary, app_logs
--
-- Vues (1)     : v_stock
-- Fonctions (9): fn_set_updated_at, _ps_upsert, fn_ps_harvests, fn_ps_cuttings,
--                fn_ps_dryings, fn_ps_sortings, fn_ps_production_lot_ingredients,
--                fn_ps_production_lots_time, fn_ps_direct_sales, fn_ps_purchases,
--                recalculate_production_summary
-- Triggers (11): updated_at × 2, production_summary × 9
-- ============================================================
