# Suivi des actions — Appli LJS

---

## [2026-02-28 21:45] — Fix TypeScript : types Supabase complets + tsconfig

**Type :** `fix`
**Fichiers concernés :** `src/lib/supabase/types.ts`, `src/lib/types.ts`, `src/app/(dashboard)/referentiel/varietes/actions.ts`, `tsconfig.json`

### Description
Correction du build Vercel qui échouait sur des erreurs de typage TypeScript dues à un `Database` type placeholder vide.

### Détails techniques
- **`supabase/types.ts`** : Remplacement du placeholder `Tables: Record<string, never>` par le type complet des 28 tables (Row, Insert, Update, Relationships). Le champ `Relationships: []` est requis par le SDK Supabase v2.98 pour que les types Insert/Update ne soient pas inférés comme `never`. Les FK (parcels→sites, rows→parcels) sont déclarées dans Relationships.
- **`types.ts`** : `ActionResult<T = undefined>` → `ActionResult<T = unknown>`. Permet d'assigner `ActionResult<Site>` à `ActionResult` sans perdre la sûreté de type (évite `any`).
- **`varietes/actions.ts`** : `type_cycle` casté via whitelist `VALID_TYPE_CYCLES` pour passer de `string | null` au type union strict `TypeCycle | null` attendu par le SDK.
- **`tsconfig.json`** : Ajout de `"src/tests/**/*"` dans `exclude` pour éviter que Vitest (qui a ses propres globals) soit compilé avec le tsconfig Next.js.

### Résultat
`npx tsc --noEmit` passe sans erreur.

---

## [2026-02-28 21:15] — CRUD Sites/Parcelles/Rangs + CRUD Matériaux externes (Phase A0.5)

**Type :** `feat`
**Fichiers concernés :**
- `supabase/migrations/002_soft_delete_referentiel.sql`
- `src/lib/types.ts` (extension)
- `src/app/(dashboard)/referentiel/sites/page.tsx`
- `src/app/(dashboard)/referentiel/sites/actions.ts`
- `src/components/referentiel/SitesParcelsClient.tsx`
- `src/components/referentiel/SiteSlideOver.tsx`
- `src/components/referentiel/ParcelleSlideOver.tsx`
- `src/components/referentiel/RangSlideOver.tsx`
- `src/app/(dashboard)/referentiel/materiaux/page.tsx`
- `src/app/(dashboard)/referentiel/materiaux/actions.ts`
- `src/components/referentiel/MateriauxClient.tsx`
- `src/components/referentiel/MaterielSlideOver.tsx`

### Description
CRUD hiérarchique Sites → Parcelles → Rangs sur une seule page à onglets (`/referentiel/sites`), plus CRUD Matériaux externes (`/referentiel/materiaux`). Même architecture que Variétés : tableau + recherche insensible aux accents, slide-over création/édition, archivage soft delete avec confirmation inline.

### Détails techniques
- **Migration 002** : `ALTER TABLE ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ` sur `sites`, `parcels`, `rows`, `external_materials` (à exécuter dans Supabase SQL Editor).
- **`types.ts`** : Nouveaux types `Site`, `Parcel`, `ParcelWithSite`, `Row`, `RowWithParcel`, `ExternalMaterial`.
- **`sites/actions.ts`** : 12 Server Actions regroupées — create/update/archive/restore × 3 entités. Parsers DRY (`parseParcelForm`, `parseRowForm`). Gestion erreur `23505`. Jointures PostgREST : `select('*, sites(id, nom)')` pour parcelles, `select('*, parcels(id, nom, code, sites(id, nom))')` pour rangs.
- **`SitesParcelsClient.tsx`** : Composant tabulé (Sites | Parcelles | Rangs). Chaque onglet = sous-composant local (`SitesTab`, `ParcellesTab`, `RangsTab`) avec état propre (search, showArchived, confirmId). Slide-overs montés au niveau parent avec `key` pour remounting. Helpers partagés : `Toolbar`, `CountLine`, `EntityTable`, `RowActions`, `EmptyState`.
- **`ParcelleSlideOver.tsx`** : Select site obligatoire. Code converti en majuscules côté action. Orientation via `<input list>` (datalist N/NE/E…).
- **`RangSlideOver.tsx`** : Parcelles groupées par site via `<optgroup>` pour ergonomie du select.
- **`MateriauxClient.tsx`** : Même pattern que `VarietesClient`. Badge unité coloré. Recherche sur nom + unité + notes.
- **`MaterielSlideOver.tsx`** : Unité via datalist (g, kg, mL, L, pièce, sachet). Par défaut = 'g'.

### ⚠️ Action requise
Exécuter `supabase/migrations/002_soft_delete_referentiel.sql` dans Supabase Dashboard → SQL Editor avant d'utiliser les nouvelles pages.

---

## [2026-02-28 19:40] — CRUD Variétés + composant QuickAddVariety

**Type :** `feat`
**Fichiers concernés :** `src/lib/types.ts`, `src/app/(dashboard)/referentiel/varietes/page.tsx`, `src/app/(dashboard)/referentiel/varietes/actions.ts`, `src/components/referentiel/VarietesClient.tsx`, `src/components/referentiel/VarieteSlideOver.tsx`, `src/components/varieties/QuickAddVariety.tsx`

### Description
CRUD complet des variétés dans la section Référentiel. Tableau avec recherche insensible aux accents, slide-over création/édition, archivage soft-delete avec confirmation inline, et composant QuickAddVariety réutilisable.

### Détails techniques
- **`types.ts`** : Types `Variety`, `TypeCycle`, `ActionResult<T>` partagés.
- **`actions.ts`** : 4 Server Actions — `createVariety`, `updateVariety`, `archiveVariety`, `restoreVariety`. Gestion erreur `23505` (UNIQUE). Helper `parseVarietyForm()` DRY.
- **`VarietesClient.tsx`** : Filtrage client-side `normalize()` (insensible casse + accents). Toggle archivées. Confirmation inline double-clic (auto-reset 4s). `useEffect` sync props après `router.refresh()`. Badges colorés par `type_cycle`.
- **`VarieteSlideOver.tsx`** : Panneau coulissant droite (CSS transform 0.3s). Tous les champs context.md §5. Focus auto, Escape. `key` dans parent pour remounting create/edit.
- **`QuickAddVariety.tsx`** : Mini-modal dropdown, 3 champs. Dédoublonnage client-side avant appel serveur. Si doublon → propose sélection. Prop `onCreated(variety)` → callback parent.

---

## [2026-02-28 19:10] — Auth + Layout bureau + Sidebar

**Type :** `feat`
**Fichiers concernés :** `src/middleware.ts`, `src/app/login/page.tsx`, `src/app/login/actions.ts`, `src/components/Sidebar.tsx`, `src/app/(dashboard)/layout.tsx`, `src/app/(dashboard)/dashboard/page.tsx`, `src/app/page.tsx`, `src/app/globals.css`

### Description
Auth Supabase complète + layout bureau avec sidebar de navigation. Respecte la charte graphique LJS (§4 context.md).

### Détails techniques
- **`globals.css`** : Palette LJS complète via `@theme` Tailwind v4 — `--color-sage-deep` (#3A5A40), `--color-cream` (#F9F8F6), `--color-anthracite` (#2C3E2D), `--color-ocre` (#DDA15E), border-radius genereux, scrollbar discrète.
- **`middleware.ts`** : Protège toutes les routes sauf `/api`, `_next`, assets PWA. Non-authentifié → `/login`. Authentifié + `/login` → `/dashboard`. Utilise `supabase.auth.getUser()` (pas `getSession()` pour la sécurité).
- **`login/actions.ts`** : Server Actions `login()` (retourne `{error}` ou redirect /dashboard) + `logout()` (signOut + redirect /login).
- **`login/page.tsx`** : Client Component. Formulaire email/password avec `useTransition`, focus ring vert, carte crème arrondie, fond crème.
- **`Sidebar.tsx`** : Client Component `'use client'`. 7 sections (⚙️ Référentiel, 🌱 Semis, 🌿 Suivi parcelle, 🔄 Transformation, 🧪 Création de produit, 📦 Affinage du stock, 🍯 Miel). Accord accordion avec `useState`, items actifs mis en évidence via `usePathname`. Section Miel désactivée avec badge "Phase C". Email utilisateur + bouton logout en pied.
- **`(dashboard)/layout.tsx`** : Route group Next.js (n'apparaît pas dans l'URL). Server Component — charge le user pour passer son email à Sidebar. Layout `flex h-screen` sidebar + main.
- **`(dashboard)/dashboard/page.tsx`** : Page d'accueil avec grille de 6 placeholders Phase B + bandeau "Phase A en cours".
- **`page.tsx`** : Redirect immédiat vers `/dashboard` (le middleware gère le cas non-authentifié).

---

## [2026-02-28 18:50] — Correction SQL : wrapper immutable_unaccent en plpgsql

**Type :** `fix`
**Fichiers concernés :** `supabase/migrations/001_initial_schema.sql`

### Description
Troisième erreur lors de l'exécution : même en `LANGUAGE sql IMMUTABLE`, PostgreSQL tente d'inliner la fonction au moment de la création de l'index, ce qui échoue car `unaccent()` n'est pas résolvable dans ce contexte.

### Détails techniques
- **Erreur** (`42883: function unaccent(text) does not exist` — CONTEXT: SQL function "immutable_unaccent" during inlining) : l'inlining SQL résout `unaccent()` dans un contexte où le search_path est insuffisant.
- **Fix** : passage de `LANGUAGE sql` à `LANGUAGE plpgsql`. Les fonctions plpgsql ne sont jamais inlinées par PostgreSQL → la résolution se fait à l'exécution, pas à la compilation de l'index. La fonction wrapper devient donc :
  ```sql
  CREATE OR REPLACE FUNCTION immutable_unaccent(text) RETURNS text AS $$
  BEGIN RETURN unaccent($1); END;
  $$ LANGUAGE plpgsql IMMUTABLE STRICT PARALLEL SAFE;
  ```
- ✅ Schéma exécuté avec succès — 28 tables, 1 vue, fonctions, triggers et RLS en place.

---

## [2026-02-28 18:35] — Corrections SQL : extension unaccent + wrapper IMMUTABLE

**Type :** `fix`
**Fichiers concernés :** `supabase/migrations/001_initial_schema.sql`

### Description
Deux erreurs successives rencontrées lors de l'exécution dans le SQL Editor Supabase, corrigées dans le fichier.

### Détails techniques
- **Erreur 1** (`42883: function unaccent(text) does not exist`) : extension `unaccent` non activée par défaut. Fix : ajout de `CREATE EXTENSION IF NOT EXISTS unaccent;` en Section 0, avant toute création de table.
- **Erreur 2** (`42P17: functions in index expression must be marked IMMUTABLE`) : `unaccent()` est `STABLE`, pas `IMMUTABLE`, donc inutilisable dans une expression d'index. Fix : création d'une fonction wrapper `immutable_unaccent(text)` marquée `IMMUTABLE STRICT PARALLEL SAFE` qui délègue à `unaccent()`.

---

## [2026-02-28 18:10] — Schéma SQL complet (migrations)

**Type :** `chore`
**Fichiers concernés :** `supabase/migrations/001_initial_schema.sql`

### Description
Création du schéma PostgreSQL complet à coller dans l'éditeur SQL Supabase.
Couvre la totalité des tables décrites dans context.md §5, plus les index, RLS, triggers et fonctions.

### Détails techniques
- **28 tables** dans l'ordre de dépendance (référentiel → semis → parcelles → transformation → stock → produits → prévisionnel → système)
- **Soft delete** (`deleted_at TIMESTAMPTZ DEFAULT NULL`) sur : `varieties`, `seed_lots`, `seedlings`, `plantings`, `harvests`, `recipes`, `production_lots`, `stock_movements` (conformément à context.md §10.1)
- **Contraintes CHECK composites** sur `dryings` et `sortings` : valide que l'état de la plante est cohérent avec le type entrée/sortie (au niveau DB, en plus de la validation applicative)
- **Index** sur toutes les colonnes fréquemment filtrées : `variety_id`, `row_id`, `date`, `etat_plante`, `actif`, `source_type`
- **Index unique fonctionnel** sur `varieties.nom_vernaculaire` insensible à la casse et aux accents (`lower(unaccent(...))`)
- **RLS** activé sur toutes les tables : politique unique `authenticated_full_access` via boucle DO$$
- **Vue `v_stock`** : calcul du stock en temps réel par variété et état, avec filtre soft delete
- **`UNIQUE NULLS NOT DISTINCT`** sur `production_summary(variety_id, annee, mois)` pour que mois=NULL soit traité comme une valeur unique (PostgreSQL 15+, disponible sur Supabase)
- **Fonction `_ps_upsert`** : helper PL/pgSQL qui met à jour simultanément la ligne mensuelle ET la ligne annuelle de `production_summary` avec des deltas (positifs ou négatifs pour gestion soft delete)
- **9 triggers** sur `production_summary` : harvests, cuttings, dryings, sortings, production_lot_ingredients, production_lots (temps), stock_direct_sales, stock_purchases, + updated_at ×2
- **Fonction `recalculate_production_summary()`** : reconstruit entièrement la table depuis les sources (bouton admin)
- **`app_logs`** : niveaux info/warn/error, champ JSONB metadata, purge 90j à implémenter via cron

---

## [2026-02-28 17:23] — Setup Vitest

**Type :** `config`
**Fichiers concernés :** `vitest.config.ts`, `src/tests/setup.ts`, `src/tests/smoke.test.ts`, `package.json`

### Description
Configuration de Vitest pour les tests unitaires. Ajout d'un test de smoke qui valide le bon fonctionnement de l'environnement de test.

### Détails techniques
- Environnement : `jsdom` (rendu React côté test)
- Globals activés (`describe`, `it`, `expect` sans import)
- Alias `@/` → `src/` aligné avec `tsconfig.json`
- Scripts ajoutés : `test`, `test:run`, `test:coverage`
- 2 tests passants au lancement initial

---

## [2026-02-28 17:22] — Manifest PWA minimal

**Type :** `config`
**Fichiers concernés :** `public/manifest.json`, `src/app/layout.tsx`

### Description
Création du manifest PWA avec les couleurs de la charte LJS (`#3A5A40` theme, `#F9F8F6` background). Référencé dans le `layout.tsx` via les métadonnées Next.js. Dossier `public/icons/` créé en attente des icônes réelles.

### Détails techniques
- `display: standalone` → se comporte comme une app native sur iOS/Android
- `orientation: portrait` → adapté à la saisie terrain mobile
- `lang: fr`
- Icônes 192px et 512px à fournir avant déploiement en production
- Police simplifiée : `Geist` uniquement (suppression de `Geist_Mono` inutilisée)
- `viewport` exporté séparément (bonne pratique Next.js 15+)

---

## [2026-02-28 17:21] — Routes API crons + vercel.json

**Type :** `config`
**Fichiers concernés :** `vercel.json`, `src/app/api/keep-alive/route.ts`, `src/app/api/backup/route.ts`

### Description
Mise en place des 2 crons Vercel pour maintenir Supabase actif et effectuer un backup quotidien. Critique pour le plan Supabase gratuit (auto-pause après 7 jours sans activité).

### Détails techniques
- `keep-alive` : déclenché à 6h UTC, fait un SELECT sur `varieties` (table qui existera en premier). Utilise `createAdminClient` pour contourner RLS.
- `backup` : déclenché à 3h UTC, exporte toutes les tables critiques en JSON. Les tables non encore créées (schéma en cours) sont ignorées silencieusement. **TODO** : envoi vers repo GitHub privé via API GitHub (Phase A0).
- `vercel.json` : format cron standard `"0 6 * * *"` (daily 6h UTC)

---

## [2026-02-28 17:20] — Configuration Supabase (client + server)

**Type :** `config`
**Fichiers concernés :** `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/types.ts`

### Description
Mise en place des 3 fichiers Supabase selon le pattern officiel `@supabase/ssr`. Séparation stricte client/serveur.

### Détails techniques
- `client.ts` : `createBrowserClient` pour les Client Components
- `server.ts` : `createServerClient` (avec gestion cookies) pour les Server Components/Route Handlers + `createAdminClient` (service_role) pour le backup et les opérations admin
- `types.ts` : placeholder typé — sera remplacé par `supabase gen types typescript` après création des migrations SQL
- **Prérequis manquant** : `SUPABASE_SERVICE_ROLE_KEY` doit être ajouté dans `.env.local` (clé disponible dans le dashboard Supabase → Settings → API → service_role)

---

## [2026-02-28 17:18] — Initialisation Next.js

**Type :** `chore`
**Fichiers concernés :** `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.*`, `src/app/layout.tsx`, `src/app/page.tsx`

### Description
Initialisation du projet Next.js 16 avec TypeScript strict, Tailwind CSS v4, App Router et dossier `src/`. Le projet a été créé dans `/tmp/app-ljs` puis copié vers le répertoire cible (contournement de la restriction npm sur le nom de dossier "Application LJS").

### Détails techniques
- Stack : Next.js 16.1.6 + React 19 + TypeScript 5 + Tailwind 4
- `--src-dir` : arborescence dans `src/` conformément au context.md §11
- `--import-alias "@/*"` : alias `@/` → `src/` dans tsconfig et vitest
- `--no-turbopack` : Webpack par défaut (plus stable pour la prod)
- Packages Supabase installés : `@supabase/supabase-js@^2`, `@supabase/ssr@^0.8`

---
