# Suivi des actions — Appli LJS

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
