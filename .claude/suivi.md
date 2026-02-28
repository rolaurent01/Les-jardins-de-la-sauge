# Suivi des actions — Appli LJS

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
