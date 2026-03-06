-- ============================================================
-- Migration 011 — Multi-tenant
-- Organisations, fermes, isolation RLS par farm_id
--
-- Prérequis : migrations 001 à 010 appliquées, base vide.
-- À exécuter dans le SQL Editor Supabase en une seule fois.
-- ============================================================


-- ============================================================
-- a. TABLES PLATEFORME
-- Ordre : organizations → farms → memberships, farm_access,
--         farm_modules, platform_admins → farm_variety_settings,
--         farm_material_settings, notifications, audit_log
-- ============================================================

-- Organisations (compte client, entité juridique, facturation)
CREATE TABLE organizations (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom                TEXT NOT NULL,
  slug               TEXT NOT NULL UNIQUE,
  nom_affiche        TEXT,
  logo_url           TEXT,
  couleur_primaire   TEXT DEFAULT '#3A5A40',
  couleur_secondaire TEXT DEFAULT '#588157',
  max_farms          INTEGER NOT NULL DEFAULT 1,
  max_users          INTEGER NOT NULL DEFAULT 3,
  plan               TEXT NOT NULL DEFAULT 'starter'
    CHECK (plan IN ('starter', 'pro', 'enterprise')),
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Fermes (unité opérationnelle — là où vivent les données métier)
CREATE TABLE farms (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  nom             TEXT NOT NULL,
  slug            TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, slug)
);

ALTER TABLE farms ENABLE ROW LEVEL SECURITY;

-- Memberships (user × organization × role)
CREATE TABLE memberships (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  user_id         UUID NOT NULL,
  role            TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner', 'admin', 'member')),
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;

-- Accès ferme (user × farm × permission)
-- Note : owners et admins d'une orga ont accès à TOUTES ses fermes sans entrée ici
CREATE TABLE farm_access (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id    UUID NOT NULL REFERENCES farms(id),
  user_id    UUID NOT NULL,
  permission TEXT NOT NULL DEFAULT 'full'
    CHECK (permission IN ('full', 'read', 'write')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(farm_id, user_id)
);

ALTER TABLE farm_access ENABLE ROW LEVEL SECURITY;

-- Modules activés par ferme
CREATE TABLE farm_modules (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id      UUID NOT NULL REFERENCES farms(id),
  module       TEXT NOT NULL
    CHECK (module IN ('pam', 'apiculture', 'maraichage')),
  activated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(farm_id, module)
);

ALTER TABLE farm_modules ENABLE ROW LEVEL SECURITY;

-- Super admins plateforme (opérateurs)
CREATE TABLE platform_admins (
  user_id    UUID PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;

-- Préférences variétés par ferme (masquage + seuil d'alerte personnalisable)
CREATE TABLE farm_variety_settings (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id        UUID NOT NULL REFERENCES farms(id),
  variety_id     UUID NOT NULL REFERENCES varieties(id),
  hidden         BOOLEAN NOT NULL DEFAULT false,
  seuil_alerte_g DECIMAL,
  UNIQUE(farm_id, variety_id)
);

ALTER TABLE farm_variety_settings ENABLE ROW LEVEL SECURITY;

-- Préférences matériaux par ferme (masquage)
CREATE TABLE farm_material_settings (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id              UUID NOT NULL REFERENCES farms(id),
  external_material_id UUID NOT NULL REFERENCES external_materials(id),
  hidden               BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(farm_id, external_material_id)
);

ALTER TABLE farm_material_settings ENABLE ROW LEVEL SECURITY;

-- Notifications (alertes stock bas, erreurs sync, backups)
CREATE TABLE notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id    UUID REFERENCES farms(id),   -- NULL = notification plateforme
  user_id    UUID,                         -- NULL = tous les users de la ferme
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  message    TEXT,
  read       BOOLEAN NOT NULL DEFAULT false,
  metadata   JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Audit log (traçabilité des opérations CUD sur les tables métier)
-- Rempli par les Server Actions (logique applicative, pas de trigger)
CREATE TABLE audit_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id    UUID REFERENCES farms(id),   -- NULL pour les opérations plateforme
  user_id    UUID NOT NULL,
  action     TEXT NOT NULL,               -- 'create', 'update', 'delete', 'archive', 'restore'
  table_name TEXT NOT NULL,
  record_id  UUID NOT NULL,
  old_data   JSONB,
  new_data   JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- b. MODIFICATIONS DU CATALOGUE PARTAGÉ
-- ============================================================

-- varieties : ajout colonnes multi-tenant + suppression seuil_alerte_g
-- (seuil_alerte_g est déplacé vers farm_variety_settings pour personnalisation par ferme)
ALTER TABLE varieties
  ADD COLUMN IF NOT EXISTS created_by_farm_id UUID REFERENCES farms(id),
  ADD COLUMN IF NOT EXISTS created_by         UUID,
  ADD COLUMN IF NOT EXISTS updated_by         UUID,
  ADD COLUMN IF NOT EXISTS verified           BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS aliases            TEXT[],
  ADD COLUMN IF NOT EXISTS merged_into_id     UUID REFERENCES varieties(id);

ALTER TABLE varieties DROP COLUMN IF EXISTS seuil_alerte_g;

-- Index unique sur nom_latin (insensible à la casse et aux accents) quand non-null
CREATE UNIQUE INDEX IF NOT EXISTS idx_varieties_nom_latin_unique
  ON varieties (lower(immutable_unaccent(nom_latin)))
  WHERE nom_latin IS NOT NULL AND deleted_at IS NULL;

-- external_materials : ajout colonnes multi-tenant
ALTER TABLE external_materials
  ADD COLUMN IF NOT EXISTS created_by_farm_id UUID REFERENCES farms(id),
  ADD COLUMN IF NOT EXISTS created_by         UUID,
  ADD COLUMN IF NOT EXISTS updated_by         UUID;

-- product_categories : ajout colonnes multi-tenant
ALTER TABLE product_categories
  ADD COLUMN IF NOT EXISTS created_by_farm_id UUID REFERENCES farms(id),
  ADD COLUMN IF NOT EXISTS created_by         UUID,
  ADD COLUMN IF NOT EXISTS updated_by         UUID;


-- ============================================================
-- c. BOOTSTRAP LJS
-- ============================================================

-- Organisation Les Jardins de la Sauge
INSERT INTO organizations (id, nom, slug, nom_affiche, couleur_primaire, couleur_secondaire, max_farms, max_users, plan)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Les Jardins de la Sauge',
  'ljs',
  'Les Jardins de la Sauge',
  '#3A5A40',
  '#588157',
  5,
  10,
  'enterprise'
);

-- Ferme LJS
INSERT INTO farms (id, organization_id, nom, slug)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'Les Jardins de la Sauge',
  'ljs'
);

-- Module PAM activé
INSERT INTO farm_modules (farm_id, module)
VALUES ('00000000-0000-0000-0000-000000000002', 'pam');

-- ⚠️ IMPORTANT : Après la migration, créer manuellement les memberships :
-- INSERT INTO memberships (organization_id, user_id, role)
-- VALUES ('00000000-0000-0000-0000-000000000001', '<USER_UUID>', 'owner');
-- Récupérer les user_id depuis Supabase Dashboard → Authentication → Users


-- ============================================================
-- d. AJOUT farm_id + created_by + updated_by SUR LES TABLES MÉTIER
-- Phase 1 : ajout nullable avec DEFAULT (sécurisé même si données existantes)
-- ============================================================

ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS farm_id    UUID REFERENCES farms(id) DEFAULT '00000000-0000-0000-0000-000000000002',
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS updated_by UUID;

ALTER TABLE parcels
  ADD COLUMN IF NOT EXISTS farm_id    UUID REFERENCES farms(id) DEFAULT '00000000-0000-0000-0000-000000000002',
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS updated_by UUID;

ALTER TABLE rows
  ADD COLUMN IF NOT EXISTS farm_id    UUID REFERENCES farms(id) DEFAULT '00000000-0000-0000-0000-000000000002',
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS updated_by UUID;

ALTER TABLE seed_lots
  ADD COLUMN IF NOT EXISTS farm_id    UUID REFERENCES farms(id) DEFAULT '00000000-0000-0000-0000-000000000002',
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS updated_by UUID;

ALTER TABLE seedlings
  ADD COLUMN IF NOT EXISTS farm_id    UUID REFERENCES farms(id) DEFAULT '00000000-0000-0000-0000-000000000002',
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS updated_by UUID;

ALTER TABLE soil_works
  ADD COLUMN IF NOT EXISTS farm_id    UUID REFERENCES farms(id) DEFAULT '00000000-0000-0000-0000-000000000002',
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS updated_by UUID;

ALTER TABLE plantings
  ADD COLUMN IF NOT EXISTS farm_id    UUID REFERENCES farms(id) DEFAULT '00000000-0000-0000-0000-000000000002',
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS updated_by UUID;

ALTER TABLE row_care
  ADD COLUMN IF NOT EXISTS farm_id    UUID REFERENCES farms(id) DEFAULT '00000000-0000-0000-0000-000000000002',
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS updated_by UUID;

ALTER TABLE harvests
  ADD COLUMN IF NOT EXISTS farm_id    UUID REFERENCES farms(id) DEFAULT '00000000-0000-0000-0000-000000000002',
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS updated_by UUID;

ALTER TABLE uprootings
  ADD COLUMN IF NOT EXISTS farm_id    UUID REFERENCES farms(id) DEFAULT '00000000-0000-0000-0000-000000000002',
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS updated_by UUID;

ALTER TABLE occultations
  ADD COLUMN IF NOT EXISTS farm_id    UUID REFERENCES farms(id) DEFAULT '00000000-0000-0000-0000-000000000002',
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS updated_by UUID;

ALTER TABLE cuttings
  ADD COLUMN IF NOT EXISTS farm_id    UUID REFERENCES farms(id) DEFAULT '00000000-0000-0000-0000-000000000002',
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS updated_by UUID;

ALTER TABLE dryings
  ADD COLUMN IF NOT EXISTS farm_id    UUID REFERENCES farms(id) DEFAULT '00000000-0000-0000-0000-000000000002',
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS updated_by UUID;

ALTER TABLE sortings
  ADD COLUMN IF NOT EXISTS farm_id    UUID REFERENCES farms(id) DEFAULT '00000000-0000-0000-0000-000000000002',
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS updated_by UUID;

-- stock_movements : pas de updated_by (mouvements immutables, uniquement soft delete)
ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS farm_id    UUID REFERENCES farms(id) DEFAULT '00000000-0000-0000-0000-000000000002',
  ADD COLUMN IF NOT EXISTS created_by UUID;

ALTER TABLE stock_purchases
  ADD COLUMN IF NOT EXISTS farm_id    UUID REFERENCES farms(id) DEFAULT '00000000-0000-0000-0000-000000000002',
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS updated_by UUID;

ALTER TABLE stock_direct_sales
  ADD COLUMN IF NOT EXISTS farm_id    UUID REFERENCES farms(id) DEFAULT '00000000-0000-0000-0000-000000000002',
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS updated_by UUID;

ALTER TABLE stock_adjustments
  ADD COLUMN IF NOT EXISTS farm_id    UUID REFERENCES farms(id) DEFAULT '00000000-0000-0000-0000-000000000002',
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS updated_by UUID;

ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS farm_id    UUID REFERENCES farms(id) DEFAULT '00000000-0000-0000-0000-000000000002',
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS updated_by UUID;

ALTER TABLE production_lots
  ADD COLUMN IF NOT EXISTS farm_id    UUID REFERENCES farms(id) DEFAULT '00000000-0000-0000-0000-000000000002',
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS updated_by UUID;

ALTER TABLE product_stock_movements
  ADD COLUMN IF NOT EXISTS farm_id    UUID REFERENCES farms(id) DEFAULT '00000000-0000-0000-0000-000000000002',
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS updated_by UUID;

ALTER TABLE forecasts
  ADD COLUMN IF NOT EXISTS farm_id    UUID REFERENCES farms(id) DEFAULT '00000000-0000-0000-0000-000000000002',
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS updated_by UUID;

-- production_summary : pas de created_by/updated_by (table d'agrégat maintenue par triggers)
ALTER TABLE production_summary
  ADD COLUMN IF NOT EXISTS farm_id UUID REFERENCES farms(id) DEFAULT '00000000-0000-0000-0000-000000000002';


-- Phase 2 : SET NOT NULL + DROP DEFAULT (toutes les lignes ont maintenant farm_id)

ALTER TABLE sites                  ALTER COLUMN farm_id SET NOT NULL;
ALTER TABLE sites                  ALTER COLUMN farm_id DROP DEFAULT;

ALTER TABLE parcels                ALTER COLUMN farm_id SET NOT NULL;
ALTER TABLE parcels                ALTER COLUMN farm_id DROP DEFAULT;

ALTER TABLE rows                   ALTER COLUMN farm_id SET NOT NULL;
ALTER TABLE rows                   ALTER COLUMN farm_id DROP DEFAULT;

ALTER TABLE seed_lots              ALTER COLUMN farm_id SET NOT NULL;
ALTER TABLE seed_lots              ALTER COLUMN farm_id DROP DEFAULT;

ALTER TABLE seedlings              ALTER COLUMN farm_id SET NOT NULL;
ALTER TABLE seedlings              ALTER COLUMN farm_id DROP DEFAULT;

ALTER TABLE soil_works             ALTER COLUMN farm_id SET NOT NULL;
ALTER TABLE soil_works             ALTER COLUMN farm_id DROP DEFAULT;

ALTER TABLE plantings              ALTER COLUMN farm_id SET NOT NULL;
ALTER TABLE plantings              ALTER COLUMN farm_id DROP DEFAULT;

ALTER TABLE row_care               ALTER COLUMN farm_id SET NOT NULL;
ALTER TABLE row_care               ALTER COLUMN farm_id DROP DEFAULT;

ALTER TABLE harvests               ALTER COLUMN farm_id SET NOT NULL;
ALTER TABLE harvests               ALTER COLUMN farm_id DROP DEFAULT;

ALTER TABLE uprootings             ALTER COLUMN farm_id SET NOT NULL;
ALTER TABLE uprootings             ALTER COLUMN farm_id DROP DEFAULT;

ALTER TABLE occultations           ALTER COLUMN farm_id SET NOT NULL;
ALTER TABLE occultations           ALTER COLUMN farm_id DROP DEFAULT;

ALTER TABLE cuttings               ALTER COLUMN farm_id SET NOT NULL;
ALTER TABLE cuttings               ALTER COLUMN farm_id DROP DEFAULT;

ALTER TABLE dryings                ALTER COLUMN farm_id SET NOT NULL;
ALTER TABLE dryings                ALTER COLUMN farm_id DROP DEFAULT;

ALTER TABLE sortings               ALTER COLUMN farm_id SET NOT NULL;
ALTER TABLE sortings               ALTER COLUMN farm_id DROP DEFAULT;

ALTER TABLE stock_movements        ALTER COLUMN farm_id SET NOT NULL;
ALTER TABLE stock_movements        ALTER COLUMN farm_id DROP DEFAULT;

ALTER TABLE stock_purchases        ALTER COLUMN farm_id SET NOT NULL;
ALTER TABLE stock_purchases        ALTER COLUMN farm_id DROP DEFAULT;

ALTER TABLE stock_direct_sales     ALTER COLUMN farm_id SET NOT NULL;
ALTER TABLE stock_direct_sales     ALTER COLUMN farm_id DROP DEFAULT;

ALTER TABLE stock_adjustments      ALTER COLUMN farm_id SET NOT NULL;
ALTER TABLE stock_adjustments      ALTER COLUMN farm_id DROP DEFAULT;

ALTER TABLE recipes                ALTER COLUMN farm_id SET NOT NULL;
ALTER TABLE recipes                ALTER COLUMN farm_id DROP DEFAULT;

ALTER TABLE production_lots        ALTER COLUMN farm_id SET NOT NULL;
ALTER TABLE production_lots        ALTER COLUMN farm_id DROP DEFAULT;

ALTER TABLE product_stock_movements ALTER COLUMN farm_id SET NOT NULL;
ALTER TABLE product_stock_movements ALTER COLUMN farm_id DROP DEFAULT;

ALTER TABLE forecasts              ALTER COLUMN farm_id SET NOT NULL;
ALTER TABLE forecasts              ALTER COLUMN farm_id DROP DEFAULT;

ALTER TABLE production_summary     ALTER COLUMN farm_id SET NOT NULL;
ALTER TABLE production_summary     ALTER COLUMN farm_id DROP DEFAULT;


-- Phase 3 : Index farm_id sur chaque table métier

CREATE INDEX IF NOT EXISTS idx_sites_farm                   ON sites(farm_id);
CREATE INDEX IF NOT EXISTS idx_parcels_farm                 ON parcels(farm_id);
CREATE INDEX IF NOT EXISTS idx_rows_farm                    ON rows(farm_id);
CREATE INDEX IF NOT EXISTS idx_seed_lots_farm               ON seed_lots(farm_id);
CREATE INDEX IF NOT EXISTS idx_seedlings_farm               ON seedlings(farm_id);
CREATE INDEX IF NOT EXISTS idx_soil_works_farm              ON soil_works(farm_id);
CREATE INDEX IF NOT EXISTS idx_plantings_farm               ON plantings(farm_id);
CREATE INDEX IF NOT EXISTS idx_row_care_farm                ON row_care(farm_id);
CREATE INDEX IF NOT EXISTS idx_harvests_farm                ON harvests(farm_id);
CREATE INDEX IF NOT EXISTS idx_uprootings_farm              ON uprootings(farm_id);
CREATE INDEX IF NOT EXISTS idx_occultations_farm            ON occultations(farm_id);
CREATE INDEX IF NOT EXISTS idx_cuttings_farm                ON cuttings(farm_id);
CREATE INDEX IF NOT EXISTS idx_dryings_farm                 ON dryings(farm_id);
CREATE INDEX IF NOT EXISTS idx_sortings_farm                ON sortings(farm_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_farm         ON stock_movements(farm_id);
CREATE INDEX IF NOT EXISTS idx_stock_purchases_farm         ON stock_purchases(farm_id);
CREATE INDEX IF NOT EXISTS idx_stock_direct_sales_farm      ON stock_direct_sales(farm_id);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_farm       ON stock_adjustments(farm_id);
CREATE INDEX IF NOT EXISTS idx_recipes_farm                 ON recipes(farm_id);
CREATE INDEX IF NOT EXISTS idx_production_lots_farm         ON production_lots(farm_id);
CREATE INDEX IF NOT EXISTS idx_product_stock_movements_farm ON product_stock_movements(farm_id);
CREATE INDEX IF NOT EXISTS idx_forecasts_farm               ON forecasts(farm_id);
CREATE INDEX IF NOT EXISTS idx_production_summary_farm      ON production_summary(farm_id);


-- ============================================================
-- e. MIGRATION DES CONTRAINTES UNIQUE VERS COMPOSITES AVEC farm_id
-- ============================================================

-- sites : UNIQUE(nom) global → UNIQUE(farm_id, nom) par ferme
ALTER TABLE sites DROP CONSTRAINT IF EXISTS sites_nom_key;
ALTER TABLE sites ADD CONSTRAINT sites_farm_nom_unique UNIQUE(farm_id, nom);

-- parcels : UNIQUE(code) global → UNIQUE(farm_id, code) par ferme
ALTER TABLE parcels DROP CONSTRAINT IF EXISTS parcels_code_key;
ALTER TABLE parcels ADD CONSTRAINT parcels_farm_code_unique UNIQUE(farm_id, code);

-- seed_lots : UNIQUE(lot_interne) global → UNIQUE(farm_id, lot_interne) par ferme
ALTER TABLE seed_lots DROP CONSTRAINT IF EXISTS seed_lots_lot_interne_key;
ALTER TABLE seed_lots ADD CONSTRAINT seed_lots_farm_lot_unique UNIQUE(farm_id, lot_interne);

-- recipes : UNIQUE(nom) global → UNIQUE(farm_id, nom) par ferme
ALTER TABLE recipes DROP CONSTRAINT IF EXISTS recipes_nom_key;
ALTER TABLE recipes ADD CONSTRAINT recipes_farm_nom_unique UNIQUE(farm_id, nom);

-- production_lots : UNIQUE(numero_lot) global → UNIQUE(farm_id, numero_lot) par ferme
ALTER TABLE production_lots DROP CONSTRAINT IF EXISTS production_lots_numero_lot_key;
ALTER TABLE production_lots ADD CONSTRAINT production_lots_farm_lot_unique UNIQUE(farm_id, numero_lot);

-- forecasts : contrainte ajoutée dans migration 004 avec NULLS NOT DISTINCT
-- Nom auto-généré : forecasts_annee_variety_id_etat_plante_partie_key
ALTER TABLE forecasts DROP CONSTRAINT IF EXISTS forecasts_annee_variety_id_etat_plante_partie_key;
ALTER TABLE forecasts ADD CONSTRAINT forecasts_farm_unique
  UNIQUE NULLS NOT DISTINCT (farm_id, annee, variety_id, etat_plante, partie_plante);

-- production_summary : UNIQUE NULLS NOT DISTINCT (variety_id, annee, mois) → ajouter farm_id
-- Nom auto-généré : production_summary_variety_id_annee_mois_key
ALTER TABLE production_summary DROP CONSTRAINT IF EXISTS production_summary_variety_id_annee_mois_key;
ALTER TABLE production_summary ADD CONSTRAINT production_summary_farm_unique
  UNIQUE NULLS NOT DISTINCT (farm_id, variety_id, annee, mois);


-- ============================================================
-- f. FONCTION HELPER RLS
-- Retourne les farm_id accessibles pour l'utilisateur courant.
-- Utilisée dans toutes les politiques RLS des tables métier.
-- SECURITY DEFINER + STABLE : plan d'exécution mis en cache par session.
-- ============================================================

CREATE OR REPLACE FUNCTION user_farm_ids() RETURNS SETOF UUID AS $$
  -- Accès direct via farm_access (membres avec permission explicite)
  SELECT fa.farm_id FROM farm_access fa WHERE fa.user_id = auth.uid()
  UNION
  -- Accès via membership owner/admin (accès à toutes les fermes de l'orga)
  SELECT f.id FROM farms f
  JOIN memberships m ON m.organization_id = f.organization_id
  WHERE m.user_id = auth.uid() AND m.role IN ('owner', 'admin')
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public;


-- ============================================================
-- g. REMPLACEMENT DES POLITIQUES RLS
-- ============================================================

-- Étape 1 : Supprimer toutes les anciennes politiques authenticated_full_access
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'varieties', 'external_materials', 'sites', 'parcels', 'rows',
    'seed_lots', 'seedlings',
    'soil_works', 'plantings', 'row_care', 'harvests', 'uprootings', 'occultations',
    'cuttings', 'dryings', 'sortings',
    'stock_movements', 'stock_purchases', 'stock_direct_sales', 'stock_adjustments',
    'product_categories', 'recipes', 'recipe_ingredients',
    'production_lots', 'production_lot_ingredients', 'product_stock_movements',
    'forecasts', 'production_summary', 'app_logs'
  ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "authenticated_full_access" ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS authenticated_full_access ON %I', t);
  END LOOP;
END $$;


-- Étape 2 : Nouvelles politiques différenciées

-- ── CATALOGUE PARTAGÉ : varieties ──
-- Lecture : tous les authentifiés (catalogue commun)
CREATE POLICY catalog_select ON varieties FOR SELECT
  USING (auth.role() = 'authenticated');
-- Création : tous les authentifiés (enrichissement collectif)
CREATE POLICY catalog_insert ON varieties FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
-- Modification : ferme créatrice ou super admin
CREATE POLICY catalog_update ON varieties FOR UPDATE
  USING (
    created_by_farm_id IN (SELECT user_farm_ids())
    OR auth.uid() IN (SELECT user_id FROM platform_admins)
  );
-- Suppression (soft delete) : ferme créatrice ou super admin
CREATE POLICY catalog_delete ON varieties FOR DELETE
  USING (
    created_by_farm_id IN (SELECT user_farm_ids())
    OR auth.uid() IN (SELECT user_id FROM platform_admins)
  );

-- ── CATALOGUE PARTAGÉ : external_materials ──
CREATE POLICY catalog_select ON external_materials FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY catalog_insert ON external_materials FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY catalog_update ON external_materials FOR UPDATE
  USING (
    created_by_farm_id IN (SELECT user_farm_ids())
    OR auth.uid() IN (SELECT user_id FROM platform_admins)
  );
CREATE POLICY catalog_delete ON external_materials FOR DELETE
  USING (
    created_by_farm_id IN (SELECT user_farm_ids())
    OR auth.uid() IN (SELECT user_id FROM platform_admins)
  );

-- ── CATALOGUE PARTAGÉ : product_categories ──
CREATE POLICY catalog_select ON product_categories FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY catalog_insert ON product_categories FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY catalog_update ON product_categories FOR UPDATE
  USING (
    created_by_farm_id IN (SELECT user_farm_ids())
    OR auth.uid() IN (SELECT user_id FROM platform_admins)
  );
CREATE POLICY catalog_delete ON product_categories FOR DELETE
  USING (
    created_by_farm_id IN (SELECT user_farm_ids())
    OR auth.uid() IN (SELECT user_id FROM platform_admins)
  );

-- ── TABLES MÉTIER : isolation complète par farm_id ──
CREATE POLICY tenant_isolation ON sites               FOR ALL USING (farm_id IN (SELECT user_farm_ids()));
CREATE POLICY tenant_isolation ON parcels             FOR ALL USING (farm_id IN (SELECT user_farm_ids()));
CREATE POLICY tenant_isolation ON rows                FOR ALL USING (farm_id IN (SELECT user_farm_ids()));
CREATE POLICY tenant_isolation ON seed_lots           FOR ALL USING (farm_id IN (SELECT user_farm_ids()));
CREATE POLICY tenant_isolation ON seedlings           FOR ALL USING (farm_id IN (SELECT user_farm_ids()));
CREATE POLICY tenant_isolation ON soil_works          FOR ALL USING (farm_id IN (SELECT user_farm_ids()));
CREATE POLICY tenant_isolation ON plantings           FOR ALL USING (farm_id IN (SELECT user_farm_ids()));
CREATE POLICY tenant_isolation ON row_care            FOR ALL USING (farm_id IN (SELECT user_farm_ids()));
CREATE POLICY tenant_isolation ON harvests            FOR ALL USING (farm_id IN (SELECT user_farm_ids()));
CREATE POLICY tenant_isolation ON uprootings          FOR ALL USING (farm_id IN (SELECT user_farm_ids()));
CREATE POLICY tenant_isolation ON occultations        FOR ALL USING (farm_id IN (SELECT user_farm_ids()));
CREATE POLICY tenant_isolation ON cuttings            FOR ALL USING (farm_id IN (SELECT user_farm_ids()));
CREATE POLICY tenant_isolation ON dryings             FOR ALL USING (farm_id IN (SELECT user_farm_ids()));
CREATE POLICY tenant_isolation ON sortings            FOR ALL USING (farm_id IN (SELECT user_farm_ids()));
CREATE POLICY tenant_isolation ON stock_movements     FOR ALL USING (farm_id IN (SELECT user_farm_ids()));
CREATE POLICY tenant_isolation ON stock_purchases     FOR ALL USING (farm_id IN (SELECT user_farm_ids()));
CREATE POLICY tenant_isolation ON stock_direct_sales  FOR ALL USING (farm_id IN (SELECT user_farm_ids()));
CREATE POLICY tenant_isolation ON stock_adjustments   FOR ALL USING (farm_id IN (SELECT user_farm_ids()));
CREATE POLICY tenant_isolation ON recipes             FOR ALL USING (farm_id IN (SELECT user_farm_ids()));
CREATE POLICY tenant_isolation ON production_lots     FOR ALL USING (farm_id IN (SELECT user_farm_ids()));
CREATE POLICY tenant_isolation ON product_stock_movements FOR ALL USING (farm_id IN (SELECT user_farm_ids()));
CREATE POLICY tenant_isolation ON forecasts           FOR ALL USING (farm_id IN (SELECT user_farm_ids()));
CREATE POLICY tenant_isolation ON production_summary  FOR ALL USING (farm_id IN (SELECT user_farm_ids()));

-- ── TABLES ENFANTS (sans farm_id — isolées via leur parent) ──
CREATE POLICY tenant_isolation ON recipe_ingredients FOR ALL
  USING (
    recipe_id IN (SELECT id FROM recipes WHERE farm_id IN (SELECT user_farm_ids()))
  );
CREATE POLICY tenant_isolation ON production_lot_ingredients FOR ALL
  USING (
    production_lot_id IN (SELECT id FROM production_lots WHERE farm_id IN (SELECT user_farm_ids()))
  );

-- ── TABLES PLATEFORME ──

-- organizations : visible si l'utilisateur en est membre
CREATE POLICY org_isolation ON organizations FOR ALL
  USING (
    id IN (SELECT organization_id FROM memberships WHERE user_id = auth.uid())
  );

-- farms : visible si l'utilisateur a accès (via user_farm_ids)
CREATE POLICY farm_isolation ON farms FOR ALL
  USING (id IN (SELECT user_farm_ids()));

-- memberships : visible si même organisation que l'utilisateur
CREATE POLICY membership_isolation ON memberships FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM memberships WHERE user_id = auth.uid()
    )
  );

-- farm_access : visible si la ferme est accessible
CREATE POLICY farm_access_isolation ON farm_access FOR ALL
  USING (farm_id IN (SELECT user_farm_ids()));

-- farm_modules : visible si la ferme est accessible
CREATE POLICY farm_modules_isolation ON farm_modules FOR ALL
  USING (farm_id IN (SELECT user_farm_ids()));

-- platform_admins : visible uniquement pour les platform_admins
CREATE POLICY admin_only ON platform_admins FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM platform_admins));

-- farm_variety_settings : isolation par ferme
CREATE POLICY tenant_isolation ON farm_variety_settings FOR ALL
  USING (farm_id IN (SELECT user_farm_ids()));

-- farm_material_settings : isolation par ferme
CREATE POLICY tenant_isolation ON farm_material_settings FOR ALL
  USING (farm_id IN (SELECT user_farm_ids()));

-- notifications : par ferme (NULL = plateforme → super admin seulement)
CREATE POLICY notification_isolation ON notifications FOR ALL
  USING (
    farm_id IN (SELECT user_farm_ids())
    OR (farm_id IS NULL AND auth.uid() IN (SELECT user_id FROM platform_admins))
  );

-- audit_log : par ferme (NULL = plateforme → super admin seulement)
CREATE POLICY audit_isolation ON audit_log FOR ALL
  USING (
    farm_id IN (SELECT user_farm_ids())
    OR (farm_id IS NULL AND auth.uid() IN (SELECT user_id FROM platform_admins))
  );

-- app_logs : super admin uniquement
CREATE POLICY logs_super_admin ON app_logs FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM platform_admins));


-- ============================================================
-- h. INDEX RLS CRITIQUES (performances de user_farm_ids())
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_farm_access_user ON farm_access(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_farms_org        ON farms(organization_id);


-- ============================================================
-- i. VUE v_stock MISE À JOUR (avec farm_id + security_invoker)
-- ============================================================

DROP VIEW IF EXISTS v_stock;

CREATE VIEW v_stock WITH (security_invoker = true) AS
SELECT
  farm_id,
  variety_id,
  partie_plante,
  etat_plante,
  SUM(CASE WHEN type_mouvement = 'entree' THEN poids_g ELSE -poids_g END) AS stock_g
FROM stock_movements
WHERE deleted_at IS NULL
GROUP BY farm_id, variety_id, partie_plante, etat_plante;


-- ============================================================
-- j. MISE À JOUR DES FONCTIONS production_summary
--
-- Nouvelle surcharge de _ps_upsert avec p_farm_id en premier paramètre.
-- Les anciennes fonctions trigger (fn_ps_*) sont remplacées pour passer
-- NEW.farm_id. La contrainte UNIQUE de production_summary inclut désormais
-- farm_id : ON CONFLICT ON CONSTRAINT production_summary_farm_unique.
-- ============================================================

-- Nouvelle version de _ps_upsert (16 params : farm_id + les 15 originaux)
CREATE OR REPLACE FUNCTION _ps_upsert(
  p_farm_id                  UUID,
  p_variety_id               UUID,
  p_annee                    INTEGER,
  p_mois                     INTEGER,
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
  v_months INTEGER[];
  m        INTEGER;
BEGIN
  -- p_mois non-NULL → mettre à jour mensuel + annuel ; NULL → annuel seul
  IF p_mois IS NOT NULL THEN
    v_months := ARRAY[p_mois, NULL::INTEGER];
  ELSE
    v_months := ARRAY[NULL::INTEGER];
  END IF;

  FOREACH m IN ARRAY v_months LOOP
    INSERT INTO production_summary (
      farm_id, variety_id, annee, mois,
      total_cueilli_g, total_tronconnee_g, total_sechee_g, total_triee_g,
      total_utilise_production_g, total_vendu_direct_g, total_achete_g,
      temps_cueillette_min, temps_tronconnage_min, temps_sechage_min,
      temps_triage_min, temps_production_min
    ) VALUES (
      p_farm_id, p_variety_id, p_annee, m,
      GREATEST(p_delta_cueilli, 0),           GREATEST(p_delta_tronconnee, 0),
      GREATEST(p_delta_sechee, 0),            GREATEST(p_delta_triee, 0),
      GREATEST(p_delta_utilise_prod, 0),      GREATEST(p_delta_vendu_direct, 0),
      GREATEST(p_delta_achete, 0),
      GREATEST(p_delta_temps_cueillette, 0),  GREATEST(p_delta_temps_tronconnage, 0),
      GREATEST(p_delta_temps_sechage, 0),     GREATEST(p_delta_temps_triage, 0),
      GREATEST(p_delta_temps_production, 0)
    )
    ON CONFLICT ON CONSTRAINT production_summary_farm_unique DO UPDATE SET
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
$$ LANGUAGE plpgsql SET search_path = public;


-- fn_ps_harvests : passe NEW.farm_id à la nouvelle surcharge _ps_upsert
CREATE OR REPLACE FUNCTION fn_ps_harvests() RETURNS TRIGGER AS $$
DECLARE
  v_annee INTEGER;
  v_mois  INTEGER;
  v_sign  INTEGER := 1;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.deleted_at IS NULL THEN
    v_sign := 1;
    v_annee := EXTRACT(YEAR FROM NEW.date)::INTEGER;
    v_mois  := EXTRACT(MONTH FROM NEW.date)::INTEGER;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      v_sign := -1;
    ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
      v_sign := 1;
    ELSE
      RETURN NEW;
    END IF;
    v_annee := EXTRACT(YEAR FROM NEW.date)::INTEGER;
    v_mois  := EXTRACT(MONTH FROM NEW.date)::INTEGER;
  ELSE
    RETURN NEW;
  END IF;

  PERFORM _ps_upsert(
    NEW.farm_id, NEW.variety_id, v_annee, v_mois,
    p_delta_cueilli          => v_sign * NEW.poids_g,
    p_delta_temps_cueillette => v_sign * COALESCE(NEW.temps_min, 0)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;


-- fn_ps_cuttings : passe NEW.farm_id
CREATE OR REPLACE FUNCTION fn_ps_cuttings() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type <> 'sortie' THEN RETURN NEW; END IF;

  PERFORM _ps_upsert(
    NEW.farm_id, NEW.variety_id,
    EXTRACT(YEAR FROM NEW.date)::INTEGER,
    EXTRACT(MONTH FROM NEW.date)::INTEGER,
    p_delta_tronconnee        => NEW.poids_g,
    p_delta_temps_tronconnage => COALESCE(NEW.temps_min, 0)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;


-- fn_ps_dryings : passe NEW.farm_id
CREATE OR REPLACE FUNCTION fn_ps_dryings() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type <> 'sortie' THEN RETURN NEW; END IF;

  PERFORM _ps_upsert(
    NEW.farm_id, NEW.variety_id,
    EXTRACT(YEAR FROM NEW.date)::INTEGER,
    EXTRACT(MONTH FROM NEW.date)::INTEGER,
    p_delta_sechee        => NEW.poids_g,
    p_delta_temps_sechage => COALESCE(NEW.temps_min, 0)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;


-- fn_ps_sortings : passe NEW.farm_id
CREATE OR REPLACE FUNCTION fn_ps_sortings() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type <> 'sortie' THEN RETURN NEW; END IF;

  PERFORM _ps_upsert(
    NEW.farm_id, NEW.variety_id,
    EXTRACT(YEAR FROM NEW.date)::INTEGER,
    EXTRACT(MONTH FROM NEW.date)::INTEGER,
    p_delta_triee        => NEW.poids_g,
    p_delta_temps_triage => COALESCE(NEW.temps_min, 0)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;


-- fn_ps_production_lot_ingredients : farm_id récupéré depuis production_lots (jointure)
CREATE OR REPLACE FUNCTION fn_ps_production_lot_ingredients() RETURNS TRIGGER AS $$
DECLARE
  v_lot production_lots%ROWTYPE;
BEGIN
  IF NEW.variety_id IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO v_lot FROM production_lots WHERE id = NEW.production_lot_id;

  PERFORM _ps_upsert(
    v_lot.farm_id, NEW.variety_id,
    EXTRACT(YEAR FROM v_lot.date_production)::INTEGER,
    EXTRACT(MONTH FROM v_lot.date_production)::INTEGER,
    p_delta_utilise_prod => NEW.poids_g
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;


-- fn_ps_production_lots_time : passe NEW.farm_id
CREATE OR REPLACE FUNCTION fn_ps_production_lots_time() RETURNS TRIGGER AS $$
DECLARE
  v_variety_id UUID;
BEGIN
  IF NEW.temps_min IS NULL OR NEW.temps_min = 0 THEN RETURN NEW; END IF;

  SELECT variety_id INTO v_variety_id
  FROM production_lot_ingredients
  WHERE production_lot_id = NEW.id AND variety_id IS NOT NULL
  LIMIT 1;

  IF v_variety_id IS NOT NULL THEN
    PERFORM _ps_upsert(
      NEW.farm_id, v_variety_id,
      EXTRACT(YEAR FROM NEW.date_production)::INTEGER,
      EXTRACT(MONTH FROM NEW.date_production)::INTEGER,
      p_delta_temps_production => NEW.temps_min
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;


-- fn_ps_direct_sales : passe NEW.farm_id
CREATE OR REPLACE FUNCTION fn_ps_direct_sales() RETURNS TRIGGER AS $$
BEGIN
  PERFORM _ps_upsert(
    NEW.farm_id, NEW.variety_id,
    EXTRACT(YEAR FROM NEW.date)::INTEGER,
    EXTRACT(MONTH FROM NEW.date)::INTEGER,
    p_delta_vendu_direct => NEW.poids_g
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;


-- fn_ps_purchases : passe NEW.farm_id
CREATE OR REPLACE FUNCTION fn_ps_purchases() RETURNS TRIGGER AS $$
BEGIN
  PERFORM _ps_upsert(
    NEW.farm_id, NEW.variety_id,
    EXTRACT(YEAR FROM NEW.date)::INTEGER,
    EXTRACT(MONTH FROM NEW.date)::INTEGER,
    p_delta_achete => NEW.poids_g
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;


-- recalculate_production_summary() : reconstruite avec farm_id dans GROUP BY et INSERT
CREATE OR REPLACE FUNCTION recalculate_production_summary()
RETURNS TEXT AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  TRUNCATE production_summary;

  -- 2. Cueillettes — mensuel
  INSERT INTO production_summary (farm_id, variety_id, annee, mois, total_cueilli_g, temps_cueillette_min)
  SELECT
    farm_id, variety_id,
    EXTRACT(YEAR FROM date)::INTEGER  AS annee,
    EXTRACT(MONTH FROM date)::INTEGER AS mois,
    SUM(poids_g), SUM(COALESCE(temps_min, 0))
  FROM harvests WHERE deleted_at IS NULL
  GROUP BY farm_id, variety_id, annee, mois
  ON CONFLICT ON CONSTRAINT production_summary_farm_unique DO UPDATE SET
    total_cueilli_g      = production_summary.total_cueilli_g      + EXCLUDED.total_cueilli_g,
    temps_cueillette_min = production_summary.temps_cueillette_min + EXCLUDED.temps_cueillette_min,
    updated_at = now();

  -- Cueillettes — annuel
  INSERT INTO production_summary (farm_id, variety_id, annee, mois, total_cueilli_g, temps_cueillette_min)
  SELECT
    farm_id, variety_id,
    EXTRACT(YEAR FROM date)::INTEGER AS annee,
    NULL AS mois,
    SUM(poids_g), SUM(COALESCE(temps_min, 0))
  FROM harvests WHERE deleted_at IS NULL
  GROUP BY farm_id, variety_id, annee
  ON CONFLICT ON CONSTRAINT production_summary_farm_unique DO UPDATE SET
    total_cueilli_g      = production_summary.total_cueilli_g      + EXCLUDED.total_cueilli_g,
    temps_cueillette_min = production_summary.temps_cueillette_min + EXCLUDED.temps_cueillette_min,
    updated_at = now();

  -- 3. Tronçonnage — mensuel
  INSERT INTO production_summary (farm_id, variety_id, annee, mois, total_tronconnee_g, temps_tronconnage_min)
  SELECT farm_id, variety_id,
    EXTRACT(YEAR FROM date)::INTEGER, EXTRACT(MONTH FROM date)::INTEGER,
    SUM(poids_g), SUM(COALESCE(temps_min, 0))
  FROM cuttings WHERE type = 'sortie'
  GROUP BY farm_id, variety_id, EXTRACT(YEAR FROM date)::INTEGER, EXTRACT(MONTH FROM date)::INTEGER
  ON CONFLICT ON CONSTRAINT production_summary_farm_unique DO UPDATE SET
    total_tronconnee_g    = production_summary.total_tronconnee_g    + EXCLUDED.total_tronconnee_g,
    temps_tronconnage_min = production_summary.temps_tronconnage_min + EXCLUDED.temps_tronconnage_min,
    updated_at = now();

  -- Tronçonnage — annuel
  INSERT INTO production_summary (farm_id, variety_id, annee, mois, total_tronconnee_g, temps_tronconnage_min)
  SELECT farm_id, variety_id, EXTRACT(YEAR FROM date)::INTEGER, NULL,
    SUM(poids_g), SUM(COALESCE(temps_min, 0))
  FROM cuttings WHERE type = 'sortie'
  GROUP BY farm_id, variety_id, EXTRACT(YEAR FROM date)::INTEGER
  ON CONFLICT ON CONSTRAINT production_summary_farm_unique DO UPDATE SET
    total_tronconnee_g    = production_summary.total_tronconnee_g    + EXCLUDED.total_tronconnee_g,
    temps_tronconnage_min = production_summary.temps_tronconnage_min + EXCLUDED.temps_tronconnage_min,
    updated_at = now();

  -- 4. Séchage — mensuel
  INSERT INTO production_summary (farm_id, variety_id, annee, mois, total_sechee_g, temps_sechage_min)
  SELECT farm_id, variety_id,
    EXTRACT(YEAR FROM date)::INTEGER, EXTRACT(MONTH FROM date)::INTEGER,
    SUM(poids_g), SUM(COALESCE(temps_min, 0))
  FROM dryings WHERE type = 'sortie'
  GROUP BY farm_id, variety_id, EXTRACT(YEAR FROM date)::INTEGER, EXTRACT(MONTH FROM date)::INTEGER
  ON CONFLICT ON CONSTRAINT production_summary_farm_unique DO UPDATE SET
    total_sechee_g    = production_summary.total_sechee_g    + EXCLUDED.total_sechee_g,
    temps_sechage_min = production_summary.temps_sechage_min + EXCLUDED.temps_sechage_min,
    updated_at = now();

  -- Séchage — annuel
  INSERT INTO production_summary (farm_id, variety_id, annee, mois, total_sechee_g, temps_sechage_min)
  SELECT farm_id, variety_id, EXTRACT(YEAR FROM date)::INTEGER, NULL,
    SUM(poids_g), SUM(COALESCE(temps_min, 0))
  FROM dryings WHERE type = 'sortie'
  GROUP BY farm_id, variety_id, EXTRACT(YEAR FROM date)::INTEGER
  ON CONFLICT ON CONSTRAINT production_summary_farm_unique DO UPDATE SET
    total_sechee_g    = production_summary.total_sechee_g    + EXCLUDED.total_sechee_g,
    temps_sechage_min = production_summary.temps_sechage_min + EXCLUDED.temps_sechage_min,
    updated_at = now();

  -- 5. Triage — mensuel
  INSERT INTO production_summary (farm_id, variety_id, annee, mois, total_triee_g, temps_triage_min)
  SELECT farm_id, variety_id,
    EXTRACT(YEAR FROM date)::INTEGER, EXTRACT(MONTH FROM date)::INTEGER,
    SUM(poids_g), SUM(COALESCE(temps_min, 0))
  FROM sortings WHERE type = 'sortie'
  GROUP BY farm_id, variety_id, EXTRACT(YEAR FROM date)::INTEGER, EXTRACT(MONTH FROM date)::INTEGER
  ON CONFLICT ON CONSTRAINT production_summary_farm_unique DO UPDATE SET
    total_triee_g    = production_summary.total_triee_g    + EXCLUDED.total_triee_g,
    temps_triage_min = production_summary.temps_triage_min + EXCLUDED.temps_triage_min,
    updated_at = now();

  -- Triage — annuel
  INSERT INTO production_summary (farm_id, variety_id, annee, mois, total_triee_g, temps_triage_min)
  SELECT farm_id, variety_id, EXTRACT(YEAR FROM date)::INTEGER, NULL,
    SUM(poids_g), SUM(COALESCE(temps_min, 0))
  FROM sortings WHERE type = 'sortie'
  GROUP BY farm_id, variety_id, EXTRACT(YEAR FROM date)::INTEGER
  ON CONFLICT ON CONSTRAINT production_summary_farm_unique DO UPDATE SET
    total_triee_g    = production_summary.total_triee_g    + EXCLUDED.total_triee_g,
    temps_triage_min = production_summary.temps_triage_min + EXCLUDED.temps_triage_min,
    updated_at = now();

  -- 6. Production (ingrédients plantes) — mensuel
  INSERT INTO production_summary (farm_id, variety_id, annee, mois, total_utilise_production_g)
  SELECT
    pl.farm_id, pli.variety_id,
    EXTRACT(YEAR FROM pl.date_production)::INTEGER,
    EXTRACT(MONTH FROM pl.date_production)::INTEGER,
    SUM(pli.poids_g)
  FROM production_lot_ingredients pli
  JOIN production_lots pl ON pl.id = pli.production_lot_id
  WHERE pli.variety_id IS NOT NULL AND pl.deleted_at IS NULL
  GROUP BY pl.farm_id, pli.variety_id,
    EXTRACT(YEAR FROM pl.date_production)::INTEGER,
    EXTRACT(MONTH FROM pl.date_production)::INTEGER
  ON CONFLICT ON CONSTRAINT production_summary_farm_unique DO UPDATE SET
    total_utilise_production_g = production_summary.total_utilise_production_g + EXCLUDED.total_utilise_production_g,
    updated_at = now();

  -- Production — annuel
  INSERT INTO production_summary (farm_id, variety_id, annee, mois, total_utilise_production_g)
  SELECT
    pl.farm_id, pli.variety_id,
    EXTRACT(YEAR FROM pl.date_production)::INTEGER,
    NULL,
    SUM(pli.poids_g)
  FROM production_lot_ingredients pli
  JOIN production_lots pl ON pl.id = pli.production_lot_id
  WHERE pli.variety_id IS NOT NULL AND pl.deleted_at IS NULL
  GROUP BY pl.farm_id, pli.variety_id, EXTRACT(YEAR FROM pl.date_production)::INTEGER
  ON CONFLICT ON CONSTRAINT production_summary_farm_unique DO UPDATE SET
    total_utilise_production_g = production_summary.total_utilise_production_g + EXCLUDED.total_utilise_production_g,
    updated_at = now();

  -- 7. Ventes directes — mensuel
  INSERT INTO production_summary (farm_id, variety_id, annee, mois, total_vendu_direct_g)
  SELECT farm_id, variety_id,
    EXTRACT(YEAR FROM date)::INTEGER, EXTRACT(MONTH FROM date)::INTEGER,
    SUM(poids_g)
  FROM stock_direct_sales
  GROUP BY farm_id, variety_id, EXTRACT(YEAR FROM date)::INTEGER, EXTRACT(MONTH FROM date)::INTEGER
  ON CONFLICT ON CONSTRAINT production_summary_farm_unique DO UPDATE SET
    total_vendu_direct_g = production_summary.total_vendu_direct_g + EXCLUDED.total_vendu_direct_g,
    updated_at = now();

  -- Ventes directes — annuel
  INSERT INTO production_summary (farm_id, variety_id, annee, mois, total_vendu_direct_g)
  SELECT farm_id, variety_id, EXTRACT(YEAR FROM date)::INTEGER, NULL, SUM(poids_g)
  FROM stock_direct_sales
  GROUP BY farm_id, variety_id, EXTRACT(YEAR FROM date)::INTEGER
  ON CONFLICT ON CONSTRAINT production_summary_farm_unique DO UPDATE SET
    total_vendu_direct_g = production_summary.total_vendu_direct_g + EXCLUDED.total_vendu_direct_g,
    updated_at = now();

  -- 8. Achats — mensuel
  INSERT INTO production_summary (farm_id, variety_id, annee, mois, total_achete_g)
  SELECT farm_id, variety_id,
    EXTRACT(YEAR FROM date)::INTEGER, EXTRACT(MONTH FROM date)::INTEGER,
    SUM(poids_g)
  FROM stock_purchases
  GROUP BY farm_id, variety_id, EXTRACT(YEAR FROM date)::INTEGER, EXTRACT(MONTH FROM date)::INTEGER
  ON CONFLICT ON CONSTRAINT production_summary_farm_unique DO UPDATE SET
    total_achete_g = production_summary.total_achete_g + EXCLUDED.total_achete_g,
    updated_at = now();

  -- Achats — annuel
  INSERT INTO production_summary (farm_id, variety_id, annee, mois, total_achete_g)
  SELECT farm_id, variety_id, EXTRACT(YEAR FROM date)::INTEGER, NULL, SUM(poids_g)
  FROM stock_purchases
  GROUP BY farm_id, variety_id, EXTRACT(YEAR FROM date)::INTEGER
  ON CONFLICT ON CONSTRAINT production_summary_farm_unique DO UPDATE SET
    total_achete_g = production_summary.total_achete_g + EXCLUDED.total_achete_g,
    updated_at = now();

  SELECT COUNT(*) INTO v_count FROM production_summary;
  RETURN format('production_summary reconstruite : %s lignes', v_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Usage : SELECT recalculate_production_summary();
