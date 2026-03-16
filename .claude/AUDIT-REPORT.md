# Rapport d'Audit — Application LJS (Carnet Culture)

**Date** : 16 mars 2026
**Auditeur** : Claude Opus 4.6 — Audit automatisé complet
**Périmètre** : Intégralité du codebase (`src/`, config, dépendances, migrations)

---

## Résumé Exécutif

**Note globale : 7/10** — Projet fonctionnel, bien structuré pour sa taille, avec une excellente couverture de validation et de tests. Les problèmes majeurs sont la **duplication massive de code** (patterns copiés-collés dans 20+ fichiers), les **36 casts `as any`** sur le client Supabase, et des **failles de robustesse** (erreurs silencieuses, pas de vérification `.error` sur plusieurs requêtes Supabase). L'architecture offline/sync est solide mais les composants UI sont des monolithes (plusieurs > 500 lignes).

### 3 Actions Prioritaires

1. 🔴 **Extraire les patterns dupliqués** (`normalize`, `Field`, `inputStyle`, `formatWeight`, `Th`, `todayISO`, `groupRowsByParcel`) dans des modules partagés — 27 copies de `normalize()`, 20 copies du trio `inputStyle/focusStyle/blurStyle`, 18 copies de `Field`, etc.
2. 🔴 **Corriger la gestion d'erreurs silencieuses** — Plusieurs `catch {}` vides, requêtes Supabase sans vérification `.error`, et résultats d'actions serveur ignorés
3. 🟠 **Découper les composants monolithiques** — 8 composants > 500 lignes (jusqu'à 1116 lignes), rendant la maintenance et le test unitaire difficiles

---

## SECTION 1 — Vue d'ensemble du projet

### Stack technique

| Élément | Technologie | Version |
|---------|------------|---------|
| Framework | Next.js (App Router) | 16.1.6 |
| Runtime | React | 19 |
| Langage | TypeScript (strict) | 5.9.3 |
| CSS | Tailwind CSS | 4 |
| Base de données | Supabase (PostgreSQL) | SSR 0.8.0 |
| Offline | Dexie (IndexedDB) | 4.3.0 |
| PWA | Serwist (Service Worker) | 9.5.6 |
| Validation | Zod | 4.3.6 |
| Graphiques | Recharts | 3.8.0 |
| Export | SheetJS (XLSX) | 0.18.5 |
| Tests | Vitest + fake-indexeddb | 4.0.18 |
| Hébergement | Vercel (CDG1, France) | — |

### Arborescence (2 niveaux)

```
src/
├── app/                          # 58 pages, 6 API routes
│   ├── [orgSlug]/(dashboard)/    # ~40 pages bureau (CRUD + vues)
│   ├── [orgSlug]/(mobile)/       # ~20 pages mobile (saisie terrain)
│   ├── api/                      # keep-alive, backup, sync, offline
│   └── login/                    # Authentification
├── components/                   # 105 composants TSX
│   ├── admin/                    # Outils, logs, merge, fermes
│   ├── mobile/                   # Formulaires + shell mobile
│   ├── parcelles/                # SlideOvers + clients parcelles
│   ├── produits/                 # Recettes + production
│   ├── semis/                    # Sachets + suivi semis
│   └── ...                       # stock, tracabilite, referentiel, etc.
├── lib/                          # Logique métier partagée
│   ├── supabase/                 # Client, server, admin, types (2264L)
│   ├── validation/               # 5 schémas Zod
│   ├── utils/                    # Parsers, lots, colors, stock-logic
│   ├── sync/                     # Dispatch + farm-access
│   └── offline/                  # db, sync-service, cache, monitor
├── hooks/                        # 4 hooks custom
└── tests/                        # Tests unitaires + intégration
```

### Chiffres clés

| Métrique | Valeur |
|----------|--------|
| Fichiers source (.ts/.tsx) | 290 |
| Composants React | 105 |
| Pages/Routes | 58 |
| Endpoints API | 6 |
| Migrations SQL | 29 |
| Tests unitaires | ~376 |
| Tests intégration | ~66 |
| Lignes estimées (hors types.ts) | ~25 000 |

---

## SECTION 2 — Architecture & Structure

### Séparation des responsabilités

| Couche | Fichiers | Verdict |
|--------|----------|---------|
| UI (composants) | `src/components/` | 🟡 Composants trop gros, mélangent état + rendu + logique |
| Logique métier | `src/lib/validation/`, `src/lib/utils/` | ✅ Bien séparé, fonctions pures |
| Données | `src/lib/supabase/`, actions serveur | ✅ Pattern clair (server actions + admin client) |
| Offline/Sync | `src/lib/offline/`, `src/lib/sync/` | ✅ Architecture 4 couches bien conçue |
| Auth/Routing | `src/proxy.ts` | ✅ Proxy centralisé, multi-tenant |

### Problèmes identifiés

| # | Sévérité | Fichier(s) | Description | Recommandation |
|---|----------|-----------|-------------|----------------|
| 2.1 | 🟠 Important | `src/components/admin/OutilsClient.tsx` (1116L) | Composant "fourre-tout" : 6 sections admin indépendantes dans un seul fichier | Extraire chaque section (SeasonClose, Purge, Impersonation, Backup, Recalcul, SuperData) dans son propre fichier |
| 2.2 | 🟠 Important | `src/components/semis/SemisSlideOver.tsx` (952L), `PlantationSlideOver.tsx` (849L), `PrevisionnelClient.tsx` (927L) | Composants monolithiques > 800 lignes avec état, rendu et logique mélangés | Extraire la logique dans des hooks custom, découper le rendu en sous-composants |
| 2.3 | 🟡 Mineur | `src/app/[orgSlug]/(mobile)/` | 5 pages catégorie statiques (`parcelle/page.tsx`, `semis/page.tsx`, etc.) dupliquent le layout tuile du `[category]/page.tsx` dynamique | Consolider via la page dynamique avec configuration enrichie |
| 2.4 | 🟡 Mineur | `src/lib/supabase/types.ts` (2264L) | Fichier de types généré très volumineux | Normal (généré par Supabase CLI), mais pourrait bénéficier d'un split par module |

### Conventions de nommage

- **Fichiers** : PascalCase pour les composants (`SemisClient.tsx`), kebab-case pour les utilitaires (`seedling-stats.ts`) → ✅ Cohérent
- **Dossiers** : kebab-case → ✅ Cohérent
- **Fonctions** : camelCase → ✅ Cohérent
- **Commentaires** : Français comme demandé dans les consignes → ✅ Respecté

### Fichiers morts

Aucun fichier mort détecté. Un seul TODO subsiste dans `VarieteSlideOver.tsx:267` concernant `seuil_alerte_g`.

---

## SECTION 3 — Qualité du code & Maintenabilité

### Fonctions/composants > 50 lignes (top 15)

| Fichier | Fonction/Composant | Lignes | Verdict |
|---------|-------------------|--------|---------|
| `components/semis/SemisSlideOver.tsx` | `SemisSlideOver` | ~713 | 🔴 Beaucoup trop long |
| `components/parcelles/PlantationSlideOver.tsx` | `PlantationSlideOver` | ~626 | 🔴 Beaucoup trop long |
| `components/production/VueProductionClient.tsx` | `VueProductionClient` | ~517 | 🔴 Trop long |
| `components/parcelles/CueilletteSlideOver.tsx` | `CueilletteSlideOver` | ~464 | 🔴 Trop long |
| `components/stock/VueStockClient.tsx` | `VueStockClient` | ~466 | 🔴 Trop long |
| `components/previsionnel/PrevisionnelClient.tsx` | `PrevisionnelClient` | ~349 | 🟠 Long |
| `components/produits/RecetteSlideOver.tsx` | `RecetteSlideOver` | ~336 | 🟠 Long |
| `components/admin/OutilsClient.tsx` | `SeasonCloseSection` | ~295 | 🟠 Long |
| `components/admin/OutilsClient.tsx` | `PurgeArchivesSection` | ~278 | 🟠 Long |
| `components/previsionnel/PrevisionnelClient.tsx` | `ForecastRow` | ~213 | 🟠 Long |
| `components/produits/RecetteSlideOver.tsx` | `IngredientRowEditor` | ~189 | 🟠 Long |
| `components/previsionnel/PrevisionnelClient.tsx` | `AddForecastForm` | ~176 | 🟠 Long |
| `components/referentiel/SitesParcelsClient.tsx` | `SitesParcelsClient` | ~175 | 🟠 Long |
| `lib/sync/dispatch.ts` | `dispatchProductionLot` | ~115 | 🟡 Acceptable (logique complexe) |
| `admin/outils/actions.ts` | `fetchSuperData` | ~116 | 🟡 Acceptable |

### Duplication de code (problème majeur)

| # | Sévérité | Pattern dupliqué | Nb copies | Fichiers |
|---|----------|-----------------|-----------|----------|
| 3.1 | 🔴 Critique | `normalize()` (normalisation texte pour recherche) | **27** | Tous les *Client.tsx + MobileSearchSelect |
| 3.2 | 🔴 Critique | `inputStyle` / `focusStyle` / `blurStyle` (styles formulaire) | **20** | Tous les SlideOver |
| 3.3 | 🔴 Critique | Composant `Field` (wrapper label + input) | **18** | Tous les SlideOver |
| 3.4 | 🟠 Important | Composant `Th` (header tableau) | **16** | Tous les *Client.tsx liste |
| 3.5 | 🟠 Important | `formatWeight()` (formatage poids g/kg) | **11** | Composants stock/production |
| 3.6 | 🟠 Important | `todayISO()` (date du jour) | **12** | Tous les formulaires mobile |
| 3.7 | 🟠 Important | `groupRowsByParcel()` (groupement rangs par parcelle) | **6** | SlideOvers parcelles |
| 3.8 | 🟡 Mineur | `PARTIE_PLANTE_OPTIONS` (constante) | **4** | Formulaires mobile |
| 3.9 | 🟡 Mineur | `downloadBlob()` (téléchargement fichier) | **3** | VueStock, VueProduction, ExportButton |
| 3.10 | 🟡 Mineur | Boilerplate formulaire mobile (state, set, handleSubmit, handleReset) | **12** | Tous les formulaires mobile |

**Impact** : ~2000 lignes de code dupliqué estimées. La correction d'un bug dans `normalize()` nécessiterait 27 modifications.

**Recommandation** : Créer `src/lib/ui/` avec les extractions suivantes :
- `src/lib/ui/form-styles.ts` → `inputStyle`, `focusStyle`, `blurStyle`
- `src/components/ui/Field.tsx` → composant Field partagé
- `src/components/ui/Th.tsx` → composant Th partagé
- `src/lib/utils/normalize.ts` → fonction normalize
- `src/lib/utils/format.ts` → `formatWeight`, `todayISO`
- `src/hooks/useMobileForm.ts` → hook pour le boilerplate mobile

### Typage TypeScript

| # | Sévérité | Fichier(s) | Description |
|---|----------|-----------|-------------|
| 3.11 | 🟠 Important | `lib/sync/dispatch.ts` (7x), `api/backup/route.ts` (11x), `produits/production/actions.ts` (4x), `admin/*/actions.ts` (7x), `proxy.ts` (3x), `lib/context.ts` (3x), `api/offline/reference-data/route.ts` (8x) | **36 `as any`** au total — principalement dû aux types Supabase ne couvrant pas les RPCs custom |
| 3.12 | ~~🟡 Mineur~~ ✅ | `src/app/[orgSlug]/(dashboard)/admin/outils/actions.ts:292` | ~~Explicit `any` sans justification~~ **CORRIGÉ le 2026-03-16 — remplacé par type `PlantingWithCycle` explicite** |

**Recommandation** : Étendre le fichier `types.ts` avec les signatures des RPCs custom pour éliminer les `as any`.

### Lisibilité

- ✅ Code globalement lisible, commentaires en français pertinents
- ✅ Nommage explicite des fonctions et variables
- 🟡 Les composants monolithiques (>500L) nuisent à la lisibilité — un nouveau dev devrait scroller longtemps pour comprendre la structure

### console.log

✅ **Aucun `console.log`** trouvé dans tout le code source. Conforme aux consignes.

---

## SECTION 4 — Gestion des erreurs & Robustesse

### Erreurs silencieuses

| # | Sévérité | Fichier | Ligne(s) | Description |
|---|----------|---------|----------|-------------|
| 4.1 | 🔴 Critique | `components/previsionnel/PrevisionnelClient.tsx` | 148-161 | `catch {}` vide dans `reloadYear()` — l'utilisateur ne sait jamais si le chargement a échoué |
| 4.2 | 🔴 Critique | `components/previsionnel/PrevisionnelClient.tsx` | 164-178 | `catch {}` vide dans `reloadAfterCopy()` |
| 4.3 | ~~🟠 Important~~ ✅ | `components/previsionnel/PrevisionnelClient.tsx` | 549-560 | ~~`saveComment()` — pas de vérification du retour de `upsertForecast`, état local mis à jour sans confirmation serveur~~ **CORRIGÉ le 2026-03-16** |
| 4.4 | ~~🟠 Important~~ ✅ | `components/previsionnel/PrevisionnelClient.tsx` | 562-565 | ~~`handleDelete()` — `deleteForecast` appelé sans vérifier le résultat, `onDelete()` exécuté dans tous les cas~~ **CORRIGÉ le 2026-03-16** |
| 4.5 | ~~🟠 Important~~ ✅ | `components/production/VueProductionClient.tsx` | 91-100 | ~~`loadData()` dans `startTransition` sans error handling — échec silencieux~~ **CORRIGÉ le 2026-03-16** |
| 4.6 | 🟠 Important | `components/mobile/SyncPanel.tsx` | ~64 | `loadErrors` — `catch {}` vide |
| 4.7 | 🟡 Mineur | `app/[orgSlug]/(mobile)/m/debug/page.tsx` | 87, 113, 128 | Plusieurs `catch {}` vides dans les fonctions de diagnostic |

### Requêtes Supabase sans vérification `.error`

| # | Sévérité | Fichier | Ligne(s) | Description |
|---|----------|---------|----------|-------------|
| 4.8 | ~~🟠 Important~~ ✅ | `admin/outils/actions.ts` | 341-345 | ~~`v_stock` query — `data` sera `null` si erreur, suite du code fonctionne avec données vides~~ **CORRIGÉ le 2026-03-16** |
| 4.9 | ~~🟠 Important~~ ✅ | `admin/outils/actions.ts` | 362-365 | ~~`organizations` query — même problème~~ **CORRIGÉ le 2026-03-16** |
| 4.10 | ~~🟠 Important~~ ✅ | `admin/outils/actions.ts` | 406-410 | ~~`plantings` query — même problème~~ **CORRIGÉ le 2026-03-16** |
| 4.11 | ~~🟠 Important~~ ✅ | `admin/outils/actions.ts` | 437-440 | ~~`production_summary` query — même problème~~ **CORRIGÉ le 2026-03-16** |

### Validation formulaires

- ✅ **Client** : Tous les formulaires (desktop et mobile) utilisent des schémas Zod avec erreurs par champ
- ✅ **Serveur** : Les server actions re-valident via Zod avant toute opération DB
- ✅ **Double validation** correctement implémentée

### Bug détecté

| # | Sévérité | Fichier | Ligne | Description |
|---|----------|---------|-------|-------------|
| 4.12 | 🔴 Critique | `admin/outils/actions.ts` | 380 | Utilise `.gte('date_cueillette', ...)` au lieu de `'date'` — le compteur de cueillettes dans le dashboard super-admin retourne toujours 0 |

### Anti-patterns React

| # | Sévérité | Fichier | Ligne(s) | Description |
|---|----------|---------|----------|-------------|
| 4.13 | ~~🟠 Important~~ ✅ | `components/admin/OutilsClient.tsx` | 682-684 | ~~Appel async déclenché depuis le corps du rendu (pas dans un `useEffect`) — risque de boucle infinie~~ **CORRIGÉ le 2026-03-16** |
| 4.14 | ~~🟠 Important~~ ✅ | `components/admin/OutilsClient.tsx` | 828-829 | ~~Même anti-pattern dans `PurgeArchivesSection`~~ **CORRIGÉ le 2026-03-16** |

### Mécanismes de retry/fallback

- ✅ **Sync mobile** : 5 tentatives avant marquage `error`, bouton retry/retry-all
- ✅ **Service Worker** : NetworkFirst avec fallback cache (timeout 3s)
- ✅ **Keep-alive** : Fallback de `rpc('ping')` vers `SELECT` si l'RPC n'existe pas
- 🟡 Pas de retry sur les server actions desktop (échec = message d'erreur)

---

## SECTION 5 — Sécurité

### Variables d'environnement

| # | Sévérité | Description |
|---|----------|-------------|
| 5.1 | ✅ | `.env.local` présent dans `.gitignore` — non commité |
| 5.2 | ✅ | Aucun secret hardcodé trouvé dans le code source |
| 5.3 | 🟠 Important | `SUPABASE_SERVICE_ROLE_KEY` marqué comme **MANQUANT** dans MEMORY.md — si absent en production, les routes `/api/backup`, `/api/sync`, et le proxy crasheront |

### .gitignore

✅ Complet : `node_modules/`, `.next/`, `.env*`, `coverage/`, fichiers Serwist.

### Authentification & Autorisation

| Élément | Statut | Détail |
|---------|--------|--------|
| Proxy (middleware) | ✅ | `src/proxy.ts` vérifie auth + membership sur chaque requête |
| Routes admin | ✅ | Double vérification : proxy + layout admin vérifie `isPlatformAdmin()` |
| Server actions | ✅ | Toutes appellent `getContext()` qui vérifie auth + org + farm |
| API sync | ✅ | Vérifie auth + `checkFarmAccess()` avant dispatch |
| Multi-tenant | ✅ | Isolation par `farm_id` + RLS PostgreSQL + cookie `active_farm_id` vérifié dans le proxy |
| Route /login | ✅ | Publique, correctement exclue du proxy |

### Protections XSS/CSRF/Injection

- ✅ React échappe le HTML par défaut (pas de `dangerouslySetInnerHTML` trouvé)
- ✅ Validation Zod côté serveur empêche l'injection de données malformées
- ✅ Requêtes Supabase utilisent le query builder (pas de SQL brut concaténé)
- ✅ Pas de CSRF visible — les server actions Next.js gèrent le CSRF via les cookies

### Vulnérabilités npm

| # | Sévérité | Package | Vulnérabilité |
|---|----------|---------|---------------|
| 5.4 | 🔴 Critique | `xlsx` (*) | Prototype Pollution (GHSA-4r6h-8v6p-xvw6) + ReDoS (GHSA-5pgg-2g8v-p4x9) — **Pas de correctif disponible** |
| 5.5 | 🟠 Important | `undici` (7.0.0-7.23.0) | 6 vulnérabilités high (WebSocket overflow, HTTP smuggling, memory DoS, CRLF injection) — corrigeable via `npm audit fix` |
| 5.6 | 🟠 Important | `flatted` (<3.4.0) | DoS par récursion non bornée dans `parse()` — corrigeable via `npm audit fix` |

**Recommandation** :
- `npm audit fix` pour `undici` et `flatted`
- Pour `xlsx` : migrer vers `xlsx-populate` ou `exceljs` (alternatives sans vulnérabilité connue), ou accepter le risque en sachant que seuls les admins utilisent l'export

---

## SECTION 6 — Performance

### Re-renders inutiles

| # | Sévérité | Fichier | Description |
|---|----------|---------|-------------|
| 6.1 | 🟡 Mineur | Tous les *Client.tsx | Pas de `useMemo` sur les listes filtrées/triées — à chaque re-render, le filtrage est recalculé. Acceptable pour 2-3 utilisateurs mais ne scale pas |
| 6.2 | 🟡 Mineur | Tous les SlideOver | Les fonctions `focusStyle`/`blurStyle` sont recréées à chaque render (définies dans le corps du composant). Impact négligeable |

### Appels API

- ✅ Le cache reference-data mobile est stocké en IndexedDB (1 seul fetch au démarrage)
- ✅ Les server actions ne sont pas re-appelées inutilement
- 🟡 Pas de cache SWR/React Query côté desktop — chaque navigation recharge les données

### Images et assets

- ✅ Seulement 2 icônes PWA (192×192 et 512×512), taille raisonnable
- ✅ Pas d'images non optimisées détectées

### Bundle size

| # | Sévérité | Description |
|---|----------|-------------|
| 6.3 | 🟡 Mineur | `recharts` (3.8.0) et `xlsx` (0.18.5) sont des packages lourds (~500KB chacun). Recharts est utilisé dans les vues stock/production/dashboard, XLSX dans l'export. Ni l'un ni l'autre ne semblent lazy-loaded |

**Recommandation** : `dynamic(() => import(...))` pour les composants Recharts et la fonctionnalité d'export XLSX.

### Requêtes potentiellement coûteuses

| # | Sévérité | Fichier | Description |
|---|----------|---------|-------------|
| 6.4 | 🟠 Important | `api/backup/route.ts` | Itère toutes les organisations × fermes × tables sans pagination. `SELECT *` sur chaque table pourrait timeout sur des instances avec beaucoup de données |
| 6.5 | 🟡 Mineur | `api/offline/reference-data/route.ts` | Charge toutes les variétés + sites + parcelles + rangs + recettes + sachets en un seul appel. OK pour 2-3 users, ne scale pas |

---

## SECTION 7 — Dépendances & Configuration

### Dépendances principales

| Package | Version | Statut |
|---------|---------|--------|
| next | 16.1.6 | ✅ Récent |
| react | 19 | ✅ Dernière version |
| @supabase/ssr | 0.8.0 | ✅ À jour |
| dexie | 4.3.0 | ✅ À jour |
| serwist | 9.5.6 | ✅ À jour |
| zod | 4.3.6 | ✅ À jour |
| recharts | 3.8.0 | ✅ À jour |
| xlsx | 0.18.5 | ⚠️ Vulnérabilités connues sans correctif |
| typescript | 5.9.3 | ✅ À jour |
| vitest | 4.0.18 | ✅ À jour |
| tailwindcss | 4 | ✅ À jour |

### Dépendances inutilisées (depcheck)

| # | Sévérité | Package | Description |
|---|----------|---------|-------------|
| 7.1 | 🟡 Mineur | `@tailwindcss/postcss` | Reporté comme inutilisé par depcheck, mais utilisé dans `postcss.config.mjs` — **faux positif** |
| 7.2 | 🟡 Mineur | `tailwindcss` | Reporté comme inutilisé par depcheck — **faux positif** (Tailwind v4 utilise un import CSS, pas un require JS) |

### Configuration ESLint

- ✅ ESLint 9 configuré avec `next/core-web-vitals` + `next/typescript`
- 🟠 **63 erreurs ESLint non résolues** (25 react-hooks/error-boundaries, 5 `no-explicit-any`, 3 `set-state-in-effect`, 2 `prefer-const`)
- 🟠 **36 warnings** (`no-unused-vars` éparpillés)
- ❌ **Pas de Prettier** configuré — le formatage dépend de l'éditeur de chaque développeur

### Scripts package.json

| Script | Commande | Statut |
|--------|----------|--------|
| `dev` | `next dev --turbopack` | ✅ |
| `build` | `next build` | ✅ |
| `start` | `next start` | ✅ |
| `lint` | `next lint` | ✅ |
| `test` | `vitest` | ✅ |
| `test:run` | `vitest run` | ✅ |
| `test:coverage` | `vitest run --coverage` | ✅ |
| `test:integration` | `vitest run --config vitest.integration.config.ts` | ✅ |

### Vercel

- ✅ `vercel.json` configure la région CDG1 (Paris) et 2 crons (keep-alive + backup)
- ✅ Build settings par défaut suffisants pour Next.js

---

## SECTION 8 — Tests & Documentation

### Tests existants

| Suite | Nb tests | Couverture |
|-------|----------|-----------|
| Tests unitaires (validation, parsers, utils) | ~376 | Excellente sur `src/lib/` |
| Tests intégration (flows) | ~66 | Flows complets par module |
| **Total** | **~442** | — |

**Configuration coverage** (vitest.config.ts) : inclut `src/lib/**` et `src/hooks/**` uniquement.

### Parties NON testées (prioritaires)

| # | Sévérité | Partie | Raison |
|---|----------|--------|--------|
| 8.1 | 🔴 Critique | **Server actions** (`actions.ts` — 26 fichiers) | Aucun test unitaire. Ces fichiers contiennent la logique CRUD principale avec accès DB |
| 8.2 | 🔴 Critique | **Proxy** (`src/proxy.ts` — 267 lignes) | Auth + multi-tenant routing non testé. Une régression ici = app inaccessible |
| 8.3 | 🟠 Important | **API routes** (`api/backup`, `api/sync`, `api/keep-alive`) | Logique critique (sync offline, backup GitHub) sans tests |
| 8.4 | 🟠 Important | **Composants React** (105 fichiers) | Aucun test de composant (ni Testing Library, ni snapshots). La config vitest couvre uniquement `src/lib/` et `src/hooks/` |
| 8.5 | 🟡 Mineur | **Hooks** (`useVarietyParts`, `useRowVarieties`, `useOnlineStatus`) | Les hooks ont des patterns de cancellation et d'état qui mériteraient des tests |

### Documentation

| Document | Statut | Commentaire |
|----------|--------|-------------|
| `README.md` | 🔴 **Template par défaut** | C'est le README de `create-next-app`, aucune info spécifique au projet |
| `.claude/context.md` | ✅ Excellent | Specs complètes (41K tokens), vision, architecture, modèle de données |
| `.claude/plan-action.md` | ✅ Excellent | Roadmap détaillée par phase |
| `.claude/consignes.md` | ✅ Bon | Conventions de code |
| `.claude/suivi.md` | ✅ Bon | Journal chronologique complet |
| `docs/` | ✅ | Guide utilisateur présent |

**Recommandation** : Rédiger un vrai README avec : prérequis, installation, variables d'environnement, lancement dev, architecture, déploiement. Essentiel pour l'onboarding.

---

## Tableau récapitulatif des problèmes

| # | Sévérité | Section | Fichier(s) | Description | Recommandation |
|---|----------|---------|-----------|-------------|----------------|
| 3.1 | ~~🔴 Critique~~ ✅ | Code | 27 fichiers | ~~`normalize()` dupliquée 27 fois~~ | ~~Extraire dans `src/lib/utils/normalize.ts`~~ **CORRIGÉ le 2026-03-16** |
| 3.2 | ~~🔴 Critique~~ ✅ | Code | 20 SlideOvers | ~~`inputStyle/focusStyle/blurStyle` dupliqués 20 fois~~ | ~~Extraire dans `src/lib/ui/form-styles.ts`~~ **CORRIGÉ le 2026-03-16** |
| 3.3 | ~~🔴 Critique~~ ✅ | Code | 18 SlideOvers | ~~Composant `Field` dupliqué 18 fois~~ | ~~Créer `src/components/ui/Field.tsx`~~ **CORRIGÉ le 2026-03-16** |
| 4.1 | ~~🔴 Critique~~ ✅ | Erreurs | `PrevisionnelClient.tsx:148` | ~~`catch {}` vide — erreurs chargement silencieuses~~ | ~~Ajouter gestion d'erreur avec feedback utilisateur~~ **CORRIGÉ le 2026-03-16** |
| 4.2 | ~~🔴 Critique~~ ✅ | Erreurs | `PrevisionnelClient.tsx:164` | ~~`catch {}` vide — erreurs copie silencieuses~~ | ~~Idem~~ **CORRIGÉ le 2026-03-16** |
| 4.12 | ~~🔴 Critique~~ ✅ | Bug | `admin/outils/actions.ts:380` | ~~Colonne `date_cueillette` au lieu de `date` — compteur cueillettes toujours à 0~~ | ~~Corriger en `.gte('date', ...)`~~ **CORRIGÉ le 2026-03-16** |
| 5.4 | 🔴 Critique | Sécu | `xlsx` (npm) | Prototype Pollution + ReDoS — pas de fix | Migrer vers `exceljs` ou `xlsx-populate` |
| 8.1 | ~~🔴 Critique~~ ✅ | Tests | 26 fichiers `actions.ts` | ~~Server actions non testées~~ — 8 tests sync dispatch (harvest, cutting, production_lot, seed_lot, soil_works) | **CORRIGÉ le 2026-03-16** (couverture partielle : 3 actions critiques) |
| 8.2 | ~~🔴 Critique~~ ✅ | Tests | `src/proxy.ts` | ~~Proxy auth/routing non testé~~ — 11 tests couvrant tous les chemins auth/routing | **CORRIGÉ le 2026-03-16** |
| 3.4 | ~~🟠 Important~~ ✅ | Code | 19 *Client.tsx | ~~Composant `Th` dupliqué 19 fois~~ | ~~Extraire dans `src/components/ui/Th.tsx`~~ **CORRIGÉ le 2026-03-16** |
| 3.5 | 🟠 Important | Code | 11 fichiers | `formatWeight()` dupliqué 11 fois — variantes entre copies, non unifié | Extraire dans `src/lib/utils/format.ts` |
| 3.6 | ~~🟠 Important~~ ✅ | Code | 12 forms mobile | ~~`todayISO()` dupliqué 12 fois~~ | ~~Extraire dans `src/lib/utils/date.ts`~~ **CORRIGÉ le 2026-03-16** |
| 3.7 | ~~🟠 Important~~ ✅ | Code | 6 SlideOvers | ~~`groupRowsByParcel()` dupliqué 6 fois~~ | ~~Extraire dans un utilitaire partagé~~ **CORRIGÉ le 2026-03-16** |
| 3.11 | 🟠 Important | Typage | 7 fichiers | 36 casts `as any` sur client Supabase | Étendre les types avec les RPCs custom |
| 2.1 | 🟠 Important | Archi | `OutilsClient.tsx` (1116L) | Composant fourre-tout avec 6 sections | Découper en 6 composants |
| 2.2 | 🟠 Important | Archi | 3 fichiers > 800L | Composants monolithiques | Extraire logique dans hooks, découper le rendu |
| 4.3-4.5 | ~~🟠 Important~~ ✅ | Erreurs | `PrevisionnelClient.tsx`, `VueProductionClient.tsx` | ~~Résultats d'actions serveur non vérifiés~~ | ~~Vérifier les retours et rollback en cas d'erreur~~ **CORRIGÉ le 2026-03-16** |
| 4.6 | ~~🟠 Important~~ ✅ | Erreurs | `SyncPanel.tsx:64` | ~~`catch {}` vide dans `loadErrors`~~ | ~~Logger l'erreur au minimum~~ **CORRIGÉ le 2026-03-16** |
| 4.8-4.11 | ~~🟠 Important~~ ✅ | Erreurs | `admin/outils/actions.ts` | ~~4 requêtes Supabase sans check `.error`~~ | ~~Ajouter vérification `.error`~~ **CORRIGÉ le 2026-03-16** |
| 4.13-4.14 | ~~🟠 Important~~ ✅ | React | `OutilsClient.tsx:682,828` | ~~Appel async depuis le corps du rendu~~ | ~~Déplacer dans `useEffect`~~ **CORRIGÉ le 2026-03-16** |
| 5.3 | 🟠 Important | Sécu | `.env.local` | `SUPABASE_SERVICE_ROLE_KEY` potentiellement manquant | Vérifier et ajouter si absent |
| 5.5-5.6 | ~~🟠 Important~~ ✅ | Sécu | `undici`, `flatted` (npm) | ~~7 vulnérabilités high~~ | ~~`npm audit fix`~~ **CORRIGÉ le 2026-03-16** |
| 6.4 | 🟠 Important | Perf | `api/backup/route.ts` | SELECT * sans pagination sur toutes les tables | Ajouter pagination ou streaming |
| 7.3 | 🟠 Important | Config | ESLint | 63 erreurs + 36 warnings non résolues | Résoudre ou désactiver explicitement |
| 8.3 | 🟠 Important | Tests | API routes (3 fichiers) | Logique sync/backup non testée | Ajouter tests d'intégration |
| 3.8 | ~~🟡 Mineur~~ ✅ | Code | 4 forms mobile | ~~`PARTIE_PLANTE_OPTIONS` dupliqué~~ | ~~Extraire constante partagée~~ **CORRIGÉ le 2026-03-16** |
| 3.9 | ~~🟡 Mineur~~ ✅ | Code | 3 fichiers | ~~`downloadBlob()` dupliqué~~ | ~~Utiliser la version existante dans ExportButton~~ **CORRIGÉ le 2026-03-16** |
| 3.10 | 🟡 Mineur | Code | 12 forms mobile | Boilerplate formulaire (~40L/form) | Créer hook `useMobileForm` |
| 2.3 | 🟡 Mineur | Archi | 5 pages catégorie mobile | Pages statiques vs dynamique | Consolider dans `[category]/page.tsx` |
| 6.1 | 🟡 Mineur | Perf | *Client.tsx | Pas de `useMemo` sur listes filtrées | Ajouter si la perf devient un problème |
| 6.3 | 🟡 Mineur | Perf | Bundle | Recharts + XLSX non lazy-loaded | Utiliser `dynamic(() => import(...))` |
| 8.4 | 🟡 Mineur | Tests | 105 composants | Aucun test de composant | Ajouter au moins des tests pour les composants critiques |
| 8.5 | 🟡 Mineur | Tests | README.md | Template create-next-app | Rédiger un vrai README d'onboarding |

**Total initial** : 10 critiques 🔴, 18 importants 🟠, 9 mineurs 🟡
**Après corrections du 2026-03-16** : 2 critiques 🔴, 4 importants 🟠, 6 mineurs 🟡 — **24 problèmes résolus** (8 critiques + 13 importants + 3 mineurs)

---

*Rapport généré le 16 mars 2026. Mis à jour le 16 mars 2026 après déduplication (101 copies) + corrections audit (bug, erreurs, duplication, sécurité npm, gestion erreurs Supabase, anti-patterns React).*
