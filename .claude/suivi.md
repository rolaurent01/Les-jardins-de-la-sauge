# Suivi des actions — Appli LJS

---

## [2026-03-06] — feat(parcelles): A2.6 — Module Cueillette (backend + UI + transaction stock)

**Type :** `feature`
**Fichiers concernés :**
- `supabase/migrations/012_harvest_rpc.sql` *(nouveau)*
- `src/lib/supabase/types.ts` *(mis à jour — Functions RPC + cast fixes)*
- `src/lib/utils/parcelles-parsers.ts` *(ajout parseHarvestForm)*
- `src/app/[orgSlug]/(dashboard)/parcelles/cueillette/actions.ts` *(nouveau)*
- `src/app/[orgSlug]/(dashboard)/parcelles/cueillette/page.tsx` *(nouveau)*
- `src/components/parcelles/CueilletteClient.tsx` *(nouveau)*
- `src/components/parcelles/CueilletteSlideOver.tsx` *(nouveau)*
- `src/app/api/keep-alive/route.ts` *(fix — cast RPC ping)*
- 5 fichiers actions existants *(fix — `as unknown as` pour les casts jointures)*

### Description
Implémentation complète du module Cueillette (A2.6) : premier module avec mouvement de stock. La cueillette génère un mouvement d'ENTRÉE de stock à l'état `frais`, de façon atomique via une fonction RPC transactionnelle. Formulaire adaptatif parcelle/sauvage avec logique adaptative variété (useRowVarieties) et partie_plante (useVarietyParts).

### Détails techniques

#### Transaction stock — choix RPC
- **Option choisie** : fonction SQL `create_harvest_with_stock` (SECURITY DEFINER, plpgsql)
- **Raison** : vraie transaction SQL — impossible d'avoir un harvest sans stock_movement. L'option INSERT séquentiel avec rollback manuel est moins sûre (race condition théorique).
- La vérification d'accès est faite AVANT l'appel RPC côté Server Action via `getContext()`.

#### Migration `012_harvest_rpc.sql`
- Fonction `create_harvest_with_stock(12 params)` → INSERT harvest + INSERT stock_movement `entree`/`frais` dans la même transaction. Retourne l'UUID du harvest créé.

#### Types Supabase (`types.ts`)
- Ajout de la section `Functions` avec le type de `create_harvest_with_stock` (Args + Returns) — remplace `Record<string, never>`.
- **Effet de bord** : le SDK Supabase v2.x est devenu plus strict sur les casts de jointures une fois `Functions` non-vide. Tous les `as Type[]` avec jointures dans les actions existantes ont dû être convertis en `as unknown as Type[]` (7 fichiers).
- Fix `keep-alive/route.ts` : `supabase.rpc('ping')` casté via `(supabase as any)` car `ping` n'est pas déclaré dans Functions.

#### Parser `parseHarvestForm`
- Extrait `type_cueillette`, `variety_id`, `partie_plante`, `date`, `poids_g`, `row_id`, `lieu_sauvage`, `temps_min`, `commentaire`
- Valide via `harvestSchema` (Zod) avec superRefine : parcelle → row_id obligatoire, sauvage → lieu_sauvage obligatoire

#### Actions (6 Server Actions)
- `fetchHarvests()` : jointures varieties + rows → parcels, filtre farm_id + deleted_at
- `fetchLieuxSauvages()` : SELECT DISTINCT lieu_sauvage pour autocomplétion (dédoublonnage + tri JS)
- `createHarvest(fd)` : parse + `supabase.rpc('create_harvest_with_stock', {...})` — transactionnel
- `updateHarvest(id, fd)` : UPDATE harvest + UPDATE stock_movement correspondant (via source_type='cueillette' + source_id)
- `archiveHarvest(id)` : soft delete harvest + soft delete stock_movement correspondant — **critique pour la cohérence du stock**
- `restoreHarvest(id)` : restaure harvest + stock_movement correspondant

#### CueilletteClient.tsx
- Colonnes : Type (badge), Variété, Partie (badge coloré), Lieu, Date, Poids (formatté kg/g), Temps, Actions
- Filtres type de cueillette : Tous / Parcelle / Sauvage (boutons inline)
- Recherche insensible casse/accents sur variété, lieu, commentaire
- Toggle archives + confirmation archivage 2-clics (auto-reset 4s)
- Restauration depuis la vue archives

#### CueilletteSlideOver.tsx — formulaire adaptatif le plus complexe du projet
- **Type de cueillette** : 2 boutons toggle (Parcelle/Sauvage). Non modifiable en édition.
- **Mode Parcelle** : select rang groupé (optgroup Site — Parcelle) → `useRowVarieties(rowId)` pour la variété
- **Mode Sauvage** : input texte avec datalist (autocomplétion lieux existants) → select variété catalogue complet
- **Variété** : logique adaptative — auto si 1 seule variété active sur le rang, dropdown si plusieurs, fallback catalogue si aucune
- **Partie plante** : logique adaptative via `useVarietyParts(varietyId)` — auto si 1 seule partie (ex: Menthe → feuille), dropdown si plusieurs (ex: Calendula → feuille/fleur)
- **Enchaînement des hooks** : rang → variété → partie. Si rang mono-variété + variété mono-partie, l'utilisateur n'a qu'à saisir date + poids (cas 95% du temps).
- Poids, date, temps, commentaire en champs communs

### Résultats
- **Build** : ✅ compilé avec succès, 0 erreur
- **Tests** : 147/147 ✅
- **Route** : `/[orgSlug]/parcelles/cueillette` listée comme `ƒ (Dynamic)`

---

## [2026-03-06] — fix(auth): login — "aucune organisation associée" après signIn

**Type :** `fix`
**Fichiers concernés :**
- `src/app/login/actions.ts` *(modifié)*

### Description
Correction du bug où le login réussissait (signInWithPassword OK) mais la requête `memberships` suivante retournait null, affichant "Aucune organisation associée à ce compte".

### Cause racine
Après `signInWithPassword`, le client SSR Supabase écrit les tokens de session via `setAll` (cookies de réponse), mais `getAll` lit les cookies de la requête entrante. Dans la même Server Action, les cookies fraîchement écrits ne sont pas relus — `auth.uid()` retourne donc NULL dans les politiques RLS PostgreSQL. La politique `membership_isolation` (self-referencing : `organization_id IN (SELECT organization_id FROM memberships WHERE user_id = auth.uid())`) filtre alors toutes les lignes.

### Correction
Remplacement du client Supabase classique (anon key + RLS) par `createAdminClient()` (service role, bypass RLS) pour la requête de résolution du membership post-login. L'utilisateur est déjà authentifié via `signInWithPassword`, donc le `user_id` provient de `authData.user.id` (fiable).

### Résultats
- **TypeScript** : `tsc --noEmit` ✅ 0 erreur

---

## [2026-03-06] — feat(parcelles): A2.5 — Module Suivi de rang (backend + UI)

**Type :** `feature`
**Fichiers concernés :**
- `src/lib/utils/parcelles-parsers.ts` *(ajout `parseRowCareForm`)*
- `src/app/[orgSlug]/(dashboard)/parcelles/suivi-rang/actions.ts` *(nouveau)*
- `src/app/[orgSlug]/(dashboard)/parcelles/suivi-rang/page.tsx` *(nouveau)*
- `src/components/parcelles/SuiviRangClient.tsx` *(nouveau)*
- `src/components/parcelles/SuiviRangSlideOver.tsx` *(nouveau)*

### Description
Implementation complete du module Suivi de rang (A2.5) : parser de formulaire, Server Actions CRUD, page serveur, tableau client avec recherche et badges colores, slide-over avec logique adaptative variete via le hook `useRowVarieties`.

### Details techniques
- **`parseRowCareForm`** : nouveau parser dans `parcelles-parsers.ts`. Valide via `rowCareSchema` (Zod). Extrait row_id, variety_id, date, type_soin, temps_min, commentaire.
- **`actions.ts`** : CRUD complet avec `getContext()` et `buildPath()`. Jointures profondes (rows → parcels → sites, varieties). Filtre `farm_id`. Suppression reelle (pas de soft delete sur `row_care`).
- **`page.tsx`** : Server Component avec appels paralleles `fetchRowCare()`, `fetchRowsForSelect()`, `fetchVarietiesForSelect()`.
- **`SuiviRangClient.tsx`** : tableau avec colonnes Variete (gras), Rang, Date, Type (badge colore : desherbage/paillage/arrosage/autre), Temps, Commentaire (tronque), Actions. Recherche insensible casse/accents. Confirmation suppression 2-clics (auto-reset 4s).
- **`SuiviRangSlideOver.tsx`** : formulaire avec logique adaptative variete :
  - Hook `useRowVarieties(rowId)` declenche au changement de rang
  - 1 variete active → auto-selection + message informatif
  - Plusieurs varietes → dropdown restreint + bandeau avertissement
  - 0 variete → avertissement + fallback catalogue complet
  - Indicateur de chargement pendant la requete du hook

### Resultats
- **Build** : ✅ compile avec succes, 0 erreur
- **Tests** : 147/147 ✅
- **Route** : `/[orgSlug]/parcelles/suivi-rang` listee comme `ƒ (Dynamic)`

---

## [2026-03-06] — feat(parcelles): A2.4 — Module Plantation (UI bureau)

**Type :** `feature`
**Fichiers concernés :**
- `src/app/[orgSlug]/(dashboard)/parcelles/plantations/page.tsx` *(nouveau)*
- `src/components/parcelles/PlantationsClient.tsx` *(nouveau)*
- `src/components/parcelles/PlantationSlideOver.tsx` *(nouveau)*

### Description
Création de la page bureau `/[orgSlug]/parcelles/plantations` avec tableau filtrable, slide-over complet et système d'avertissements temps réel. Suit le même pattern que les modules Travail de sol et Sachets de graines. Les Server Actions (A2.3) ne sont pas modifiées.

### Détails techniques

**`page.tsx`** (Server Component) :
- Appels parallèles `Promise.all([fetchPlantings(), fetchRowsForSelect(), fetchVarietiesForSelect(), fetchSeedlingsForSelect()])`
- Gestion d'erreur avec message affiché en ocre

**`PlantationsClient.tsx`** (Client Component) :
- **Colonnes** : Variété (gras), Rang (Site — Parcelle — Rang N), Date (JJ/MM/AAAA), Plants, Type plant (badge coloré — 10 types avec couleurs distinctes), Origine (badge bleu "Semis MM/CG" ou violet "Fournisseur"), Surface (longueur × largeur en m²), État (badge vert "Actif" ou gris "Arraché"), Actions
- Recherche insensible casse/accents sur variété, rang, fournisseur
- Toggle archivés avec compteur
- Archivage soft delete avec confirmation 2-clics (auto-reset 4s) + restauration
- `router.refresh()` après chaque mutation

**`PlantationSlideOver.tsx`** (Client Component) :
- **Rang** : select groupé `<optgroup>` par site/parcelle (réutilise le pattern TravailSolSlideOver). Au changement → `fetchRowWarnings(rowId)` + pré-remplissage dimensions (création uniquement)
- **Variété** : select + `QuickAddVariety` pour ajout rapide
- **Origine** : toggle 2 boutons "Issu de mes semis" / "Plant acheté" — affiche conditionnellement le select semis ou le champ fournisseur
- **3 avertissements temps réel** après sélection du rang :
  1. Rang déjà planté (bandeau jaune avec liste des plantations actives)
  2. Dépassement longueur (bandeau jaune, recalculé en temps réel à chaque modification de longueur_m, exclut la plantation en cours en édition)
  3. Rang en occultation (bandeau orange avec méthode et date)
- **Champs** : année, date plantation, lune (optionnel), nb plants, type plant (10 options), espacement cm, longueur/largeur m (pré-remplies depuis rang), certif AB, date commande, n° facture, temps min, commentaire
- Mode édition : pas de pré-remplissage dimensions, avertissements toujours affichés

### Résultats
- **Build** : ✅ compilé avec succès, 0 erreur
- **Tests** : 147/147 ✅
- **Route** : `/[orgSlug]/parcelles/plantations` listée comme `ƒ (Dynamic)`

---

## [2026-03-06] — refactor(ui): Remplacement couleurs branding hardcodées par CSS variables

**Type :** `refactor`
**Fichiers concernés :**
- `src/components/referentiel/SiteSlideOver.tsx`
- `src/components/referentiel/RangSlideOver.tsx`
- `src/components/referentiel/ParcelleSlideOver.tsx`
- `src/components/referentiel/MaterielSlideOver.tsx`
- `src/components/referentiel/VarieteSlideOver.tsx`
- `src/components/referentiel/VarietesClient.tsx`
- `src/components/referentiel/MateriauxClient.tsx`
- `src/components/referentiel/SitesParcelsClient.tsx`
- `src/components/parcelles/TravailSolClient.tsx`
- `src/components/parcelles/TravailSolSlideOver.tsx`
- `src/components/semis/SachetsClient.tsx`
- `src/components/semis/SachetSlideOver.tsx`
- `src/components/semis/SemisClient.tsx`
- `src/components/semis/SemisSlideOver.tsx`
- `src/components/varieties/QuickAddVariety.tsx`
- `src/app/[orgSlug]/(dashboard)/dashboard/page.tsx`

### Description
Remplacement de toutes les couleurs de branding hardcodées (`#3A5A40`, `#588157`, et leurs variantes alpha) par des CSS variables (`var(--color-primary)`, `var(--color-primary-light)`) dans les composants de contenu. Les CSS variables sont injectées par le layout `[orgSlug]/layout.tsx` à partir des couleurs de l'organisation.

### Détails techniques
- **`#3A5A40`** → `var(--color-primary)` — ~80 occurrences dans 16 fichiers (boutons submit, focus borders, textes actifs, hover, badges, onglets)
- **`#588157`** → `var(--color-primary-light)` — 3 occurrences (QuickAddVariety hover, dashboard badges)
- **`#3A5A40XX`** (variantes hex+alpha) → `color-mix(in srgb, var(--color-primary) N%, transparent)` :
  - `#3A5A4012` (7%) : toggle archivés (MateriauxClient, SachetsClient, VarietesClient, SitesParcelsClient, SemisClient)
  - `#3A5A4014` (8%) : checkbox pills (QuickAddVariety, VarieteSlideOver)
  - `#3A5A4015` (8%) : badge dashboard
  - `#3A5A4018` (10%) : badge onglet actif (SitesParcelsClient)
  - `#3A5A4030` (19%) : bordure banner dashboard
- **Non modifiés** (intentionnel) :
  - `src/app/login/page.tsx` — hors layout `[orgSlug]`, CSS variables non disponibles
  - `src/app/layout.tsx` — `themeColor` meta tag, CSS variables inapplicables
  - `src/app/[orgSlug]/layout.tsx` — valeurs fallback par défaut (`|| '#3A5A40'`)
  - Couleurs non-branding (ocre, crème, texte, vert indicateur)

### Résultats
- **Build** : ✅ compilé avec succès, 0 erreur
- **Tests** : 147/147 ✅

---

## [2026-03-06] — fix(multitenant): P1 + P4 — Scope farm_id sur sites/page + alignement farm_access types

**Type :** `fix`
**Fichiers concernés :**
- `src/app/[orgSlug]/(dashboard)/referentiel/sites/page.tsx` *(modifié)*
- `src/lib/supabase/types.ts` *(modifié)*
- `src/lib/types.ts` *(modifié)*

### Description
Corrections post-revue multi-tenant : scope des requêtes par `farm_id` dans la page Sites et alignement du type TypeScript `farm_access` sur la migration SQL.

### Détails techniques

#### P1 — sites/page.tsx : requêtes non scopées par farm_id
- **Problème** : les 3 requêtes Supabase (sites, parcels, rows) dans le Server Component ne filtraient pas par `farm_id`, affichant potentiellement les données de toutes les fermes accessibles via RLS
- **Fix** : import de `getContext()`, extraction de `farmId`, ajout de `.eq('farm_id', farmId)` sur les 3 requêtes

#### P4 — farm_access : type TS désaligné avec SQL
- **Problème** : la migration SQL définit `permission CHECK ('full', 'read', 'write')` mais les types TS utilisaient `role: 'manager' | 'operator' | 'viewer'`
- **Fix supabase/types.ts** : `role` → `permission`, valeurs `'manager' | 'operator' | 'viewer'` → `'full' | 'read' | 'write'` (Row, Insert, Update)
- **Fix types.ts** : `FarmAccessRole` → `FarmAccessPermission = 'full' | 'read' | 'write'`, champ `role` → `permission` dans `FarmAccess`

### Résultats
- **Build** : ✅ compilé avec succès, 0 erreur
- **Tests** : 147/147 ✅

---

## [2026-03-06] — review(multitenant): A0.9 review complète

**Type :** `review(multitenant)`
**Fichiers analysés :** migration SQL, types, proxy, context, layouts, 8 fichiers d'actions, 4 composants, backup, login

### Statut global : ⚠️ Problèmes mineurs

Aucun bug critique bloquant. Build ✅ (0 erreur TS). Tests 147/147 ✅. Pas de `console.log`, pas de `@ts-expect-error`, pas de `revalidatePath('/...')` hardcodé.

---

### 1. Migration SQL (`011_multitenant.sql`) — ✅ Solide

| Check | Statut |
|-------|--------|
| 10 tables plateforme créées dans le bon ordre (FK respectées) | ✅ |
| `organizations` : nom_affiche, logo_url, couleur_primaire/secondaire, max_farms, max_users, plan | ✅ |
| `farms` : `UNIQUE(organization_id, slug)` | ✅ |
| `memberships` : `UNIQUE(organization_id, user_id)` + role CHECK | ✅ |
| `farm_access` : `UNIQUE(farm_id, user_id)` + permission CHECK | ✅ |
| `farm_modules` : `UNIQUE(farm_id, module)` + CHECK incluant 'pam', 'apiculture', 'maraichage' | ✅ |
| `farm_variety_settings` : hidden + seuil_alerte_g | ✅ |
| `seuil_alerte_g` supprimé de `varieties` | ✅ |
| `varieties` : 6 nouvelles colonnes (created_by_farm_id, created_by, updated_by, verified, aliases, merged_into_id) | ✅ |
| Index UNIQUE sur nom_latin (lower + immutable_unaccent, WHERE NOT NULL AND NOT deleted) | ✅ |
| `external_materials` : created_by_farm_id, created_by, updated_by | ✅ (`deleted_at` existait déjà via migration 002) |
| `product_categories` : created_by_farm_id, created_by, updated_by | ✅ |
| Bootstrap : orga LJS, ferme LJS, module PAM | ✅ |
| `farm_id NOT NULL REFERENCES farms(id)` sur 23 tables métier | ✅ (phase 1 DEFAULT + phase 2 SET NOT NULL + DROP DEFAULT) |
| `created_by UUID` + `updated_by UUID` sur les tables métier | ✅ (stock_movements sans updated_by, production_summary sans created_by/updated_by — justifié) |
| `recipe_ingredients` et `production_lot_ingredients` sans farm_id | ✅ (isolées via RLS parent FK) |
| Index `idx_[table]_farm` sur 23 tables | ✅ |
| Contraintes UNIQUE migrées avec farm_id (sites, parcels, seed_lots, recipes, production_lots, forecasts, production_summary) | ✅ |
| `user_farm_ids()` SECURITY DEFINER STABLE SET search_path | ✅ (UNION : farm_access direct + membership owner/admin → toutes fermes de l'orga) |
| Anciennes politiques `authenticated_full_access` supprimées (29 tables incluant occultations et app_logs) | ✅ |
| Nouvelles politiques RLS : catalogue (4 × 3 tables), tenant_isolation (23 tables), enfants (2 tables), plateforme, notifications, audit_log, app_logs | ✅ |
| Vue `v_stock` recréée avec `farm_id` + `security_invoker = true` | ✅ |
| `_ps_upsert` 16 params avec `p_farm_id` + `ON CONFLICT production_summary_farm_unique` | ✅ |
| 8 triggers `fn_ps_*` passent `NEW.farm_id` (ou via jointure pour `fn_ps_production_lot_ingredients`) | ✅ |
| `recalculate_production_summary()` avec farm_id dans GROUP BY et INSERT | ✅ |
| Index RLS : farm_access(user_id), memberships(user_id), farms(organization_id) | ✅ |
| RLS activé sur toutes les nouvelles tables | ✅ |

---

### 2. Types TypeScript — ✅

| Check | Statut |
|-------|--------|
| `supabase/types.ts` : 10 nouvelles tables avec Row/Insert/Update/Relationships | ✅ |
| Toutes les tables métier ont `farm_id: string` dans Row et Insert | ✅ |
| `created_by` et `updated_by` présents dans les types métier | ✅ |
| `varieties` n'a plus `seuil_alerte_g` dans Row/Insert/Update | ✅ |
| `varieties` a les 6 nouvelles colonnes | ✅ |
| Vue `v_stock` inclut `farm_id` | ✅ |
| `types.ts` : AppContext, Organization, Farm, Membership exportés | ✅ |
| Types métier (SeedLot, Seedling, Planting, etc.) incluent farm_id, created_by, updated_by | ✅ |

---

### 3. Proxy (`src/proxy.ts`) — ✅

| Check | Statut |
|-------|--------|
| /login public | ✅ |
| Vérification auth sur toutes les autres routes | ✅ |
| `/` → résolution orgSlug → redirect `/{orgSlug}/dashboard` | ✅ |
| `/{slug}/...` → vérif que le slug existe + user est membre | ✅ |
| Redirect si slug invalide ou pas membre | ✅ |

---

### 4. Context (`src/lib/context.ts`) — ✅

| Check | Statut |
|-------|--------|
| `getContext()` retourne `{ userId, farmId, organizationId, orgSlug }` | ✅ |
| Lit le cookie `active_farm_id` | ✅ |
| Vérifie que l'utilisateur a accès (membership check) | ✅ |
| Fallback vers la première ferme accessible si pas de cookie | ✅ |
| Met à jour le cookie si fallback | ✅ |

---

### 5. Routing — ✅

| Check | Statut |
|-------|--------|
| `src/app/[orgSlug]/(dashboard)/` contient toutes les routes métier | ✅ (7 routes) |
| `src/app/[orgSlug]/layout.tsx` injecte CSS variables | ✅ |
| `src/app/[orgSlug]/(dashboard)/layout.tsx` passe org, farms, activeFarmId aux composants | ✅ |
| Ancien chemin `src/app/(dashboard)/` entièrement supprimé | ✅ |

---

### 6. Server Actions — ⚠️ Problèmes mineurs

**Tous les fichiers d'actions utilisent correctement :**
- `getContext()` pour obtenir userId, farmId, orgSlug
- `buildPath(orgSlug, ...)` pour revalidatePath
- `farm_id: farmId` + `created_by: userId` dans les INSERT métier
- `updated_by: userId` dans les UPDATE
- `created_by_farm_id: farmId` (pas farm_id) pour les INSERT catalogue (varieties, external_materials)
- `.eq('farm_id', farmId)` pour les fetch métier
- Numérotation seed_lots scopée par farm_id

**Vérification par fichier :**
| Fichier | getContext | farm_id fetch | farm_id insert | created_by | updated_by | buildPath |
|---------|-----------|---------------|----------------|------------|------------|-----------|
| varietes/actions.ts | ✅ | N/A (catalogue) | N/A (created_by_farm_id) | ✅ | ✅ | ✅ |
| sites/actions.ts | ✅ | N/A (via page) | ✅ | ✅ | ✅ | ✅ |
| materiaux/actions.ts | ✅ | N/A (catalogue) | N/A (created_by_farm_id) | ✅ | ✅ | ✅ |
| semis/sachets/actions.ts | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| semis/suivi/actions.ts | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| parcelles/travail-sol/actions.ts | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| parcelles/plantations/actions.ts | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| parcelles/shared-actions.ts | ✅ | ✅ | N/A | N/A | N/A | N/A |

**Vérification transversale :**
- Aucun `revalidatePath('/` hardcodé : ✅ (0 occurrence trouvée)
- Aucun `console.log` : ✅
- Aucun `@ts-expect-error` : ✅

---

### 7. Composants — ✅

| Check | Statut |
|-------|--------|
| `Sidebar.tsx` utilise `var(--color-primary)` pour le fond | ✅ |
| `MobileHeader.tsx` utilise les CSS variables | ✅ |
| Logo dynamique (logo_url ou placeholder initiale) | ✅ |
| `FarmSelector` : cookie + router.refresh(), hidden si 1 ferme | ✅ |
| `VarietesClient.tsx` n'a plus de référence à `seuil_alerte_g` | ✅ |
| `VarieteSlideOver.tsx` : TODO commentaire pour seuil_alerte_g (farm_variety_settings) | ✅ (documenté) |

---

### 8. Login — ✅

| Check | Statut |
|-------|--------|
| Login → redirect `/{orgSlug}/dashboard` | ✅ |
| Logout → redirect `/login` | ✅ |
| Cas "aucune organisation" → message d'erreur explicite | ✅ |

---

### 9. Backup — ✅

| Check | Statut |
|-------|--------|
| Export par organisation | ✅ (`/orgs/{slug}/backup-YYYY-MM-DD.json`) |
| Catalogue partagé exporté séparément | ✅ (`/shared/catalog-YYYY-MM-DD.json`) |
| Utilise `createAdminClient()` (service_role, pas de RLS) | ✅ |
| Filtrage explicite par farm_id `.in('farm_id', farmIds)` | ✅ |
| Tables plateforme (memberships, farm_access, farm_modules, etc.) incluses | ✅ |

---

### Problèmes mineurs (pas de correction appliquée)

#### P1. `sites/page.tsx` : pas de filtrage applicatif par farm_id
- **Fichier :** `src/app/[orgSlug]/(dashboard)/referentiel/sites/page.tsx:10-18`
- **Description :** Les requêtes `supabase.from('sites').select('*')`, `parcels`, `rows` ne filtrent PAS par `farm_id`. Elles s'appuient uniquement sur RLS (`tenant_isolation`), qui retourne les données de TOUTES les fermes accessibles à l'utilisateur. Si un owner/admin a 2 fermes, il verra les sites des deux fermes mélangés au lieu de la ferme active uniquement.
- **Impact :** Pas de fuite de données (l'utilisateur a légitimement accès), mais expérience fonctionnelle dégradée en multi-fermes.
- **Correction suggérée :** Utiliser `getContext()` et ajouter `.eq('farm_id', farmId)` aux 3 requêtes.

#### P2. `#3A5A40` hardcodé dans ~25 composants
- **Fichiers :** SachetsClient, SemisClient, SachetSlideOver, SemisSlideOver, MateriauxClient, MaterielSlideOver, SitesParcelsClient, SiteSlideOver, ParcelleSlideOver, RangSlideOver, VarietesClient, VarieteSlideOver, TravailSolClient, TravailSolSlideOver, QuickAddVariety
- **Description :** La couleur primaire `#3A5A40` est hardcodée dans les styles inline de boutons, borders, focus rings, badges, etc. La Sidebar utilise correctement `var(--color-primary)`, mais les composants de contenu n'ont pas été migrés.
- **Impact :** Si une autre organisation utilise une couleur primaire différente, seuls la sidebar et le header seront rebrandés. Le contenu restera vert sauge.
- **Correction suggérée :** Remplacer les occurrences de `#3A5A40` dans les composants par `var(--color-primary)` et `#3A5A4012`/`#3A5A4014`/`#3A5A4018` par des variantes avec opacité de la CSS variable.

#### P3. `materiaux/page.tsx` et `varietes/page.tsx` : pas de filtrage hidden/merged
- **Fichier :** `src/app/[orgSlug]/(dashboard)/referentiel/materiaux/page.tsx:10-13`
- **Description :** `materiaux/page.tsx` fait `.select('*').order('nom')` sans filtre `deleted_at IS NULL`. Les matériaux archivés sont chargés sans filtrage — correct si le toggle "afficher archivés" existe dans le composant client, mais pourrait charger des données inutiles.
- **Impact :** Mineur, cohérent avec le pattern existant (toggle archivés côté client).

#### P4. `farm_access.permission` CHECK vs specs
- **Fichier :** `supabase/migrations/011_multitenant.sql:69`
- **Description :** La colonne `permission` de `farm_access` utilise les valeurs `'full', 'read', 'write'` alors que les specs `types.ts` définissent `FarmAccessRole = 'manager' | 'operator' | 'viewer'`. Il y a un désalignement entre le schéma SQL et les types TypeScript.
- **Impact :** Mineur tant que `farm_access` n'est pas utilisé dans l'UI (aucun CRUD pour le moment). À aligner quand le module d'administration sera implémenté (B6).

#### P5. `seuil_alerte_g` toujours dans `supabase/types.ts` pour `farm_variety_settings`
- **Fichier :** `src/lib/supabase/types.ts:247,257,267`
- **Description :** `seuil_alerte_g` est correctement présent dans `farm_variety_settings` (c'est sa nouvelle table), et correctement absent de `varieties`. Le TODO dans `VarieteSlideOver.tsx:267` documente la migration UI restante. Pas de bug — juste un point de suivi.

---

### Points positifs

1. **Migration SQL exemplaire** : approche en 3 phases (ADD nullable DEFAULT → SET NOT NULL → DROP DEFAULT) évite les erreurs sur données existantes. Commentaires clairs.
2. **getContext() centralisé** : toutes les actions passent par un point unique pour résoudre userId/farmId/orgSlug. Très propre.
3. **buildPath() systématique** : aucun revalidatePath hardcodé trouvé. Discipline parfaite.
4. **Backup multi-tenant complet** : séparation catalogue/orgs, filtrage explicite par farm_id (pas de dépendance à RLS en service_role).
5. **user_farm_ids() bien pensée** : la distinction owner/admin (accès toutes fermes) vs member (farm_access explicite) est correcte et documentée.
6. **RLS différenciée** : 4 jeux de politiques adaptés (catalogue partagé, tenant isolation, enfants sans farm_id, plateforme).
7. **Triggers production_summary** : tous les 8 triggers mis à jour avec `NEW.farm_id` ou jointure (fn_ps_production_lot_ingredients), recalculate inclut farm_id dans GROUP BY.

### Recommandations

1. **[Priorité haute]** Ajouter `.eq('farm_id', farmId)` dans `sites/page.tsx` (P1) — essentiel si un utilisateur a accès à plusieurs fermes.
2. **[Priorité moyenne]** Migrer `#3A5A40` vers `var(--color-primary)` dans les composants (P2) — nécessaire pour le branding multi-org.
3. **[Priorité basse]** Aligner `farm_access.permission` avec `FarmAccessRole` (P4) — avant l'implémentation de B6.
4. **[Améliorations futures]** Ajouter un membership bootstrap automatique lors du login (actuellement instruction manuelle SQL dans les commentaires de la migration).

### Résultats

- **Build** : ✅ compilé avec succès, 0 erreur
- **Tests** : 147/147 ✅

---

## [2026-03-06] — feat(multitenant): A0.9 Day 3 — Refactoring Server Actions + backup par organisation

**Type :** `feature`
**Fichiers concernés :**
- `src/app/[orgSlug]/(dashboard)/referentiel/varietes/actions.ts` *(ajout fetchVarieties, getContext, buildPath, created_by_farm_id, created_by, updated_by)*
- `src/app/[orgSlug]/(dashboard)/referentiel/varietes/page.tsx` *(utilise fetchVarieties, filtre merged_into_id)*
- `src/app/[orgSlug]/(dashboard)/referentiel/sites/actions.ts` *(getContext, farm_id, created_by, updated_by sur 12 actions)*
- `src/app/[orgSlug]/(dashboard)/referentiel/materiaux/actions.ts` *(getContext, created_by_farm_id, created_by, updated_by)*
- `src/app/[orgSlug]/(dashboard)/semis/sachets/actions.ts` *(getContext, farm_id, filtrage hidden variétés, comptage scopé par ferme)*
- `src/app/[orgSlug]/(dashboard)/semis/suivi/actions.ts` *(getContext, farm_id, created_by, updated_by)*
- `src/app/[orgSlug]/(dashboard)/parcelles/travail-sol/actions.ts` *(getContext, farm_id, created_by, updated_by)*
- `src/app/[orgSlug]/(dashboard)/parcelles/plantations/actions.ts` *(getContext, farm_id, created_by, updated_by + défense en profondeur fetchRowWarnings)*
- `src/app/[orgSlug]/(dashboard)/parcelles/shared-actions.ts` *(getContext, farm_id sur rows, filtrage hidden variétés)*
- `src/app/api/backup/route.ts` *(refactorisation complète — backup par organisation + catalogue partagé)*

### Description
Refactoring de toutes les Server Actions pour intégrer le contexte multi-tenant : chaque opération est désormais scopée par `farm_id` (isolation données), enrichie avec `created_by` / `updated_by` (traçabilité), et utilise `buildPath(orgSlug, ...)` pour les `revalidatePath` (routing `[orgSlug]`).

La route de backup a été entièrement refactée pour exporter par organisation : un fichier catalogue partagé + un fichier par organisation.

### Détails techniques

#### Pattern appliqué (8 fichiers d'actions)
- **`getContext()`** importé depuis `@/lib/context` — récupère `{ userId, farmId, orgSlug }` à chaque action
- **`buildPath(orgSlug, path)`** importé depuis `@/lib/utils/path` — remplace tous les `revalidatePath('/...')` hardcodés
- **SELECT tables métier** : `.eq('farm_id', farmId)` ajouté sur toutes les requêtes fetch
- **SELECT catalogue partagé** (varieties, external_materials) : pas de `farm_id`, mais filtrage `farm_variety_settings.hidden = true` dans les dropdowns
- **INSERT** : `farm_id: farmId, created_by: userId` (tables métier) ou `created_by_farm_id: farmId, created_by: userId` (catalogue)
- **UPDATE** : `updated_by: userId` ajouté systématiquement
- **archive/restore** : `updated_by: userId` + `deleted_at`

#### Spécificités par fichier
- **varietes/page.tsx** : utilise désormais `fetchVarieties()` (filtrage `merged_into_id IS NULL` pour exclure les fusionnées)
- **sachets/actions.ts** : comptage des lots pour numérotation `SL-YYYY-NNN` scopé par `farm_id` — chaque ferme a sa propre séquence
- **sachets/actions.ts + shared-actions.ts** : `fetchVarieties` / `fetchVarietiesForSelect` filtrent les variétés masquées via `farm_variety_settings`
- **plantations/actions.ts** : `fetchRowWarnings` ajoute `.eq('farm_id', farmId)` sur `plantings` et `occultations` (défense en profondeur)

#### Backup route (route.ts)
**Avant** : export global de toutes les tables en un seul fichier `backup-YYYY-MM-DD.json`

**Après** :
- `shared/catalog-YYYY-MM-DD.json` : varieties, external_materials, product_categories (catalogue partagé)
- `orgs/{slug}/backup-YYYY-MM-DD.json` : données métier scopées par `farm_id` + tables plateforme (farms, memberships, farm_access, farm_modules, farm_variety_settings, farm_material_settings, notifications, audit_log)
- Utilise `createAdminClient()` (bypass RLS) avec filtres `farm_id` explicites
- `TABLES_WITH_FARM_ID` : 23 tables métier
- `CATALOG_TABLES` : 3 tables catalogue

#### login/actions.ts
Déjà correctement implémenté (redirect `/${orgSlug}/dashboard`) — aucune modification nécessaire.

#### QuickAddVariety.tsx
Appelle `createVariety` qui gère `getContext()` côté serveur — aucune modification nécessaire.

#### Hooks useRowVarieties / useVarietyParts
Clients browser — RLS filtre automatiquement par `user_farm_ids()` — aucune modification nécessaire.

### Résultats
- **Build** : ✅ compilé sans erreur, 9 routes dynamiques sous `[orgSlug]`
- **Tests** : ✅ 147/147 passants (aucune régression)

### Vérifications manuelles à effectuer
- `/ljs/referentiel/varietes` : tableau catalogue complet
- `/ljs/referentiel/sites` : créer un site → vérifier `farm_id` + `created_by` en base
- `/ljs/semis/sachets` : créer un sachet → `lot_interne` commence par `SL-`, `farm_id` présent
- `/ljs/parcelles/travail-sol` : créer un travail → `farm_id` + `created_by`
- `/ljs/parcelles/plantations` : fonctionne
- Backup `/api/backup` : vérifie les fichiers `shared/` + `orgs/ljs/` sur GitHub

---

## [2026-03-06] — feat(multitenant): A0.9 Day 2 — Routage [orgSlug] + proxy + layout + composants

**Type :** `feature`
**Fichiers concernés :**
- `src/proxy.ts` *(réécrit — auth + org slug + membership check)*
- `src/lib/context.ts` *(nouveau — getContext())*
- `src/lib/utils/path.ts` *(nouveau — buildPath())*
- `src/app/[orgSlug]/layout.tsx` *(nouveau — CSS vars branding)*
- `src/app/[orgSlug]/(dashboard)/layout.tsx` *(modifié — org + farms props)*
- `src/components/layout/FarmSelector.tsx` *(nouveau)*
- `src/components/Sidebar.tsx` *(réécrit — CSS vars + dynamic logo + orgSlug links)*
- `src/components/MobileHeader.tsx` *(réécrit — CSS vars + dynamic logo + orgSlug links)*
- `src/app/login/actions.ts` *(modifié — redirect vers /{orgSlug}/dashboard)*
- `src/app/page.tsx` *(modifié — redirect vers /login)*
- `src/lib/types.ts` *(mis à jour — Organization, Farm, AppContext)*
- `src/lib/supabase/types.ts` *(mis à jour — organizations, farms)*
- `src/components/referentiel/VarietesClient.tsx` *(fix — suppression seuil_alerte_g)*
- `src/components/referentiel/VarieteSlideOver.tsx` *(fix — suppression seuil_alerte_g)*
- `src/app/[orgSlug]/(dashboard)/referentiel/varietes/actions.ts` *(fix — suppression seuil_alerte_g)*
- 9 fichiers composants/pages *(fix — imports @/app/(dashboard)/ → @/app/[orgSlug]/(dashboard)/)*
- `src/components/semis/SemisSlideOver.tsx` *(fix — previewSeedling farm_id/created_by/updated_by)*

### Description
Implémentation complète du routage multi-tenant avec `[orgSlug]` dans l'URL. Déplacement de `src/app/(dashboard)/` → `src/app/[orgSlug]/(dashboard)/`, création du middleware proxy (auth + vérification membership org), helpers de contexte et de chemin, layouts avec injection des variables CSS de branding, sélecteur de ferme, et réécriture de Sidebar/MobileHeader pour liens dynamiques. Correction des imports cassés après le déplacement de dossier et fix du type `Seedling`.

### Détails techniques

#### Routing avant/après
- Avant : `/dashboard`, `/semis/sachets`, etc.
- Après : `/[orgSlug]/dashboard`, `/[orgSlug]/semis/sachets`, etc.
- Build résultant : 7 routes sous `[orgSlug]` + `/login` + `ƒ Proxy (Middleware)`

#### proxy.ts (Next.js 16 remplace middleware.ts)
- Le projet utilisait déjà `proxy.ts` (spécificité Next.js 16) — middleware.ts créé puis supprimé après erreur de build
- Logique : `/login` public → vérif auth → `/` redirige vers `/{orgSlug}/dashboard` → `/{slug}/...` vérifie membership
- `resolveFirstOrgSlug()` : query `memberships` avec join `organizations(slug)`

#### Nouveaux helpers
- `src/lib/context.ts` : `getContext()` lit cookie `active_farm_id`, fallback sur premier farm depuis memberships, retourne `{ userId, farmId, organizationId, orgSlug }`
- `src/lib/utils/path.ts` : `buildPath(orgSlug, path)` → `/${orgSlug}/path` pour `revalidatePath` dans les Server Actions

#### Layout [orgSlug]/layout.tsx
- Résout l'org par slug, `notFound()` si absent
- Injecte `--color-primary` et `--color-primary-light` comme CSS variables via `style` attribute

#### Sidebar + MobileHeader
- Props : `{ userEmail, organization, farms, activeFarmId, orgSlug }`
- Background : `var(--color-primary)` au lieu de `#3A5A40` hardcodé
- Logo dynamique : `img` si `logo_url` sinon initiale sur fond `var(--color-primary-light)`
- Helper `h(path)` pour préfixer tous les liens avec `/${orgSlug}`
- `FarmSelector` : client component, cookie `active_farm_id` + `router.refresh()`, visible seulement si `farms.length > 1`

#### Fix imports (9 fichiers)
`@/app/(dashboard)/...` → `@/app/[orgSlug]/(dashboard)/...` dans :
SachetsClient, SemisClient, MateriauxClient, SitesParcelsClient, TravailSolClient, QuickAddVariety, semis/suivi/page.tsx, parcelles/travail-sol/page.tsx

#### Fix TypeScript SemisSlideOver
Ajout `farm_id: ''`, `created_by: null`, `updated_by: null` dans `previewSeedling` pour satisfaire le type `Seedling` mis à jour en 011

### Résultats
- **Build** : ✅ compilé avec succès, 0 erreur
- **Tests** : 147/147 ✅

---

## [2026-03-06] — feat(infra): A0.9 — Migration multi-tenant + types TypeScript

**Type :** `feature`
**Fichiers concernés :**
- `supabase/migrations/011_multitenant.sql` *(nouveau)*
- `src/lib/supabase/types.ts` *(mis à jour)*
- `src/lib/types.ts` *(mis à jour)*

### Description
Implémentation de la couche multi-tenant : migration SQL complète, types Supabase et types métier. Périmètre strict : SQL + types uniquement, sans toucher aux Server Actions, composants, layouts ni hooks.

### Détails techniques

#### Migration `011_multitenant.sql`
- **10 tables plateforme** : `organizations`, `farms`, `memberships`, `farm_access`, `farm_modules`, `platform_admins`, `farm_variety_settings`, `farm_material_settings`, `notifications`, `audit_log`
- **Catalogue partagé** : `varieties`, `external_materials`, `product_categories` — ajout `created_by_farm_id`, `created_by`, `updated_by` + champs variété (`verified`, `aliases`, `merged_into_id`) + suppression `seuil_alerte_g` (déplacé vers `farm_variety_settings`)
- **23 tables métier** : `farm_id NOT NULL` + `created_by` + `updated_by` sur toutes (sauf `stock_movements` sans `updated_by` — immutable, et `production_summary` sans created_by/updated_by — agrégat)
- **Bootstrap LJS** : INSERT org `00000000-…-0001` + farm `00000000-…-0002` + module `pam`
- **Contraintes UNIQUE composites** : sites(farm_id, nom), parcels(farm_id, code), seed_lots(farm_id, lot_interne), recipes(farm_id, nom), production_lots(farm_id, numero_lot), forecasts(farm_id, variety_id, annee, etat_plante, partie_plante), production_summary(farm_id, variety_id, annee, mois)
- **Fonction RLS** : `user_farm_ids() SECURITY DEFINER STABLE` — retourne les UUIDs des fermes accessibles
- **Politiques RLS** : suppression de `authenticated_full_access` (toutes tables) + création de 4 jeux de politiques différenciées (catalogue, isolation tenant, tables enfants, plateforme)
- **Vue `v_stock`** : recréée avec `farm_id` dans SELECT et GROUP BY, `security_invoker = true`
- **Fonction `_ps_upsert`** : nouvel overload 16-param (p_farm_id en tête) + `ON CONFLICT ON CONSTRAINT production_summary_farm_unique`
- **Triggers `fn_ps_*`** : 8 fonctions mises à jour pour appeler le nouvel overload avec `NEW.farm_id`
- **Index** : `idx_*_farm` sur toutes les tables métier + `idx_farm_access_user`, `idx_memberships_user`, `idx_farms_org`

#### `src/lib/supabase/types.ts`
- 10 nouvelles interfaces de tables plateforme avec Relationships FK
- `varieties` : suppression `seuil_alerte_g`, ajout `created_by_farm_id`, `created_by`, `updated_by`, `verified`, `aliases`, `merged_into_id`
- `external_materials` + `product_categories` : ajout `created_by_farm_id`, `created_by`, `updated_by`
- Toutes les tables métier : ajout `farm_id`, `created_by`, `updated_by` dans Row/Insert/Update
- `v_stock` : ajout `farm_id: string` dans la vue

#### `src/lib/types.ts`
- `Variety` : suppression `seuil_alerte_g`, ajout champs catalogue multi-tenant
- `ExternalMaterial` : ajout champs catalogue multi-tenant
- `Site`, `Parcel`, `Row`, `SeedLot`, `Seedling`, `SoilWork`, `Planting`, `RowCare`, `Harvest`, `Uprooting`, `Occultation` : ajout `farm_id`, `created_by`, `updated_by`
- Nouveaux types : `Organization`, `Farm`, `MembershipRole`, `FarmAccessRole`, `Membership`, `FarmAccess`, `AppContext`

### Résultats
- **Tests** : 147/147 ✅
- **Build** : 1 erreur TS attendue dans les composants (`seuil_alerte_g` supprimé de `Variety` — à corriger en A0.9 suite)
  - `VarietesClient.tsx:302` + `VarieteSlideOver.tsx:275` — à migrer vers `farm_variety_settings`

---

## [2026-03-06] — docs(arch): Corrections post-revue (deleted_at, arborescence, middleware, triggers)

**Type :** `documentation`
**Fichiers concernés :**
- `.claude/context.md` *(mis à jour)*
- `.claude/plan-action.md` *(mis à jour)*

### Description
Corrections ciblées suite à une revue des specs.

### Modifications context.md
- **`deleted_at`** : ajouté sur `external_materials`, `sites`, `parcels`, `rows` (alignement avec migration 002)
- **Section 5.1 `external_materials`** : note — pas de déduplication avancée, risque faible, correction manuelle par super admin
- **Section 11 arborescence** : remplacée par la structure reflétant le routing `/[orgSlug]/`, avec `middleware.ts`, `path.ts`, `orgSlug` dans `context.ts`

### Modifications plan-action.md
- **A0.9 Jour 1** : note triggers `production_summary` — fonctions `fn_ps_*` et `recalculate_production_summary()` à mettre à jour avec `farm_id`
- **A0.9 Jour 2** : ajout création `src/middleware.ts` (auth + résolution slug + vérification membership)

---

## [2026-03-06] — docs(arch): Branding multi-tenant + routing par path

**Type :** `documentation`
**Fichiers concernés :**
- `.claude/context.md` *(mis à jour)*
- `.claude/plan-action.md` *(mis à jour)*

### Description
Intégration du branding par organisation et du routing `/[orgSlug]/` dans les specs.

### Modifications context.md
- **Table `organizations`** : ajout colonnes `nom_affiche`, `logo_url`, `couleur_primaire`, `couleur_secondaire`
- **Section 2** : ajout note "Stockage des logos (Supabase Storage, bucket `org-logos`, accès public)"
- **Section 3.5 (nouvelle)** : routing multi-tenant par path — structure `src/app/[orgSlug]/`, résolution slug, migration `revalidatePath`, middleware
- **Section 4.1b (nouvelle)** : thème dynamique — CSS variables injectées par le layout, logo dynamique avec fallback initiales
- **Section 13** : 5 nouvelles décisions (branding, logos, URL par path, thème dynamique, revalidatePath)

### Modifications plan-action.md
- **A0.9 Jour 2** : ajout routing + migration revalidatePath + couleurs CSS variables + logo dynamique (+ ~0.5j → durée 2-3j)
- **getContext()** : retourne maintenant `orgSlug` en plus de `{ userId, farmId, organizationId }`
- **B6** : ajout livrable branding client (upload logo, config couleurs, prévisualisation)

---

## [2026-03-06] — docs(arch): A0.9 — Décisions architecture multi-tenant

**Type :** `documentation`
**Fichiers concernés :**
- `.claude/context.md` *(mis à jour)*
- `.claude/plan-action.md` *(mis à jour)*

### Description
Mise à jour complète des specs pour intégrer toutes les décisions d'architecture multi-tenant prises lors d'un audit architectural. L'application est désormais conçue pour accueillir plusieurs fermes sur la même plateforme.

### Modifications context.md
- **Section 3.2** : ajout note "cache IndexedDB scopé par ferme active, farm_id dans le payload sync"
- **Section 3.4 (nouvelle)** : architecture multi-tenant complète — hiérarchie org→farm→user, catalogue partagé, principes RLS
- **Section 5.1b (nouvelle)** : CREATE TABLE complets pour les tables plateforme : `organizations`, `farms`, `memberships`, `farm_access`, `farm_modules`, `platform_admins`, `farm_variety_settings`, `farm_material_settings`, `notifications`, `audit_log` + fonction helper RLS `user_farm_ids()`
- **Table `varieties`** : ajout `created_by_farm_id`, `created_by`, `updated_by`, `verified`, `aliases`, `merged_into_id` — suppression `seuil_alerte_g` (déplacé vers `farm_variety_settings`)
- **Table `external_materials`** : ajout `created_by_farm_id`, `created_by`, `updated_by`
- **Tables `sites`, `parcels`, `rows`** : ajout `farm_id NOT NULL`, `created_by`, `updated_by`, contraintes UNIQUE composites
- **Toutes les tables métier** (seed_lots, seedlings, soil_works, plantings, row_care, harvests, uprootings, occultations, cuttings, dryings, sortings, stock_movements, stock_purchases, stock_direct_sales, stock_adjustments, recipes, production_lots, product_stock_movements, forecasts, production_summary) : ajout `farm_id NOT NULL`, `created_by`, `updated_by`
- **Contraintes UNIQUE composites** : seed_lots(farm_id, lot_interne), production_lots(farm_id, numero_lot), recipes(farm_id, nom), parcels(farm_id, code), forecasts/production_summary avec farm_id
- **Vue `v_stock`** : farm_id ajouté dans SELECT et GROUP BY
- **Section 8.5 (nouvelle)** : sélecteur de ferme, catalogue partagé, déduplication variétés
- **Section 8.6 (nouvelle)** : notifications (table + cas d'usage)
- **Section 9** : A0.9 ajouté dans le tableau des phases + B6 + mise à jour estimations
- **Section 10.3** : remplacement de la politique `authenticated_full_access` par 4 politiques différenciées (catalogue, tables métier, tables plateforme, logs) + index RLS
- **Section 10.6** : backup par organisation (un fichier JSON par org dans /orgs/{slug}/)
- **Section 11** : ajout `src/lib/context.ts` + route `(admin)/admin/`
- **Section 13** : 18 nouvelles décisions ajoutées (multi-tenant, hiérarchie, catalogue, recettes, déduplication, modules, navigation, facturation, export RGPD, backup, offline, logs, notifications, audit, rétention, multi-langue, API, super admin, super data, numérotation, A0.9)

### Modifications plan-action.md
- **Risques** : ajout risques 8 (isolation RLS), 9 (déduplication catalogue), 10 (migration A0.9)
- **Phase A0.9 (nouvelle)** : migration multi-tenant, 2 jours, à exécuter MAINTENANT — SQL + code applicatif + bootstrap
- **Phases A2-A7** : note "Server Actions incluent farm_id, created_by, updated_by nativement"
- **Phase A6** : note "cache IndexedDB scopé par ferme, farm_id dans payload sync"
- **Phase B6 (nouvelle)** : interface super admin (impersonation, merge variétés, super data, logs)
- **Phase C** : module Miel activable par ferme via farm_modules, tables nativement multi-tenant
- **Résumé visuel** : A0.9 ajouté, B6 ajouté, estimations mises à jour (35-50j)

---

## [2026-03-04 22:30] — feat(parcelles): A2.3 — Plantation Server Actions (backend)

**Type :** `feature`
**Fichiers concernés :**
- `src/app/(dashboard)/parcelles/plantations/actions.ts` *(nouveau)*
- `src/lib/utils/parcelles-parsers.ts`
- `src/app/(dashboard)/parcelles/shared-actions.ts`
- `src/lib/types.ts`
- `src/lib/supabase/types.ts`

### Description
Implémentation complète du backend du module Plantation (A2.3) : parsers, Server Actions CRUD, et helpers partagés. Aucun composant UI créé (prévu en A2.4).

### Détails techniques
- **`parsePlantingForm`** : nouveau parser dans `parcelles-parsers.ts`. Valide via `plantingSchema` (Zod). Les champs `date_commande` et `numero_facture` sont absents du schéma Zod et ajoutés manuellement après validation. Nouveaux helpers `parseOptionalDecimal` et `parseBool` (gestion `'on'`/`'true'`/`'1'`).
- **`fetchVarietiesForSelect`** : ajouté dans `shared-actions.ts`, filtre `deleted_at IS NULL`, tri par `nom_vernaculaire`. Réutilisable par tous les modules A2.
- **`fetchPlantings`** : jointures profondes (varieties, rows → parcels → sites, seedlings), filtre `deleted_at IS NULL`, tri `date_plantation DESC`.
- **`fetchSeedlingsForSelect`** : semis actifs avec variété jointure, pour le dropdown "Semis d'origine".
- **`fetchRowWarnings`** : action serveur à la demande (appelée par le client lors de la sélection d'un rang). Retourne : plantings actifs, somme longueurs utilisées, longueur/largeur du rang, occultation sans date_fin. Type `RowWarnings` défini localement.
- **`createPlanting`** : pré-remplissage `longueur_m`/`largeur_m` depuis le rang si non saisis. `actif: true` forcé à la création.
- **`updatePlanting`** : update standard, sans toucher à `actif` (réservé à l'arrachage A2.8).
- **`archivePlanting`** / **`restorePlanting`** : soft delete (`deleted_at`).
- **Bugs corrigés** :
  - `Row` type (types.ts) : `largeur_m` manquant malgré migration 006 → ajouté.
  - `type_plant` (supabase/types.ts) : enum stale (`achat_godets`, `repiquage_pleine_terre`) → mis à jour avec les 10 valeurs actuelles de la migration.

---

## [2026-03-04 21:00] — feat(parcelles): A2.2 — Module Travail de sol (backend + UI)

**Type :** `feature`
**Fichiers concernés :** `src/lib/utils/format.ts`, `src/lib/utils/parcelles-parsers.ts`, `src/app/(dashboard)/parcelles/shared-actions.ts`, `src/app/(dashboard)/parcelles/travail-sol/actions.ts`, `src/app/(dashboard)/parcelles/travail-sol/page.tsx`, `src/components/parcelles/TravailSolClient.tsx`, `src/components/parcelles/TravailSolSlideOver.tsx`

### Description
Implémentation complète du module Travail de sol : parser de formulaire, Server Actions CRUD, page serveur, tableau client avec recherche et badges colorés, slide-over avec select rang groupé par site/parcelle.

### Détails techniques
- **`format.ts`** : `formatDuration` (→ "1h30") et `formatDate` (→ "JJ/MM/AAAA") réutilisables dans tous les modules A2-A7.
- **`parcelles-parsers.ts`** : `parseSoilWorkForm` — extraction + validation Zod des champs FormData.
- **`shared-actions.ts`** : `fetchRowsForSelect` — rangs actifs avec jointure, triés JS-side (site → parcelle → position_ordre → numero). Réutilisé par A2.3-A2.7.
- **`actions.ts`** : CRUD complet. Suppression réelle (pas de soft delete sur `soil_works`).
- **`TravailSolClient`** : badges colorés par type, recherche multi-critères, confirmation suppression 2-clics (auto-annulation 4s).
- **`TravailSolSlideOver`** : select rang groupé via `<optgroup>` (Site — Parcelle → Rang N).
- Build ✅ — route `/parcelles/travail-sol` dynamique.

---

## [2026-03-04 20:17] — feat(parcelles): A2.1 — Types, validation Zod et hooks adaptatifs

**Type :** `feature`
**Fichiers concernés :** `src/lib/types.ts`, `src/lib/validation/parcelles.ts`, `src/hooks/useRowVarieties.ts`, `src/hooks/useVarietyParts.ts`, `src/tests/parcelles/validation.test.ts`

### Description
Implémentation complète de la couche fondatrice du module Parcelles : types TypeScript, schémas de validation Zod pour les 6 tables, hooks logiques adaptatifs variété/partie_plante, et tests unitaires.

### Détails techniques
- **Types** dans `src/lib/types.ts` : 8 nouveaux types de base (`SoilWork`, `Planting`, `RowCare`, `Harvest`, `Uprooting`, `Occultation` + variantes `WithRelations`) + types annexes (`TypeTravailSol`, `TypePlant`, `TypeSoin`, `LunePlantation`). Réutilisation de `MethodeOccultation` importé de `supabase/types.ts`.
- **Validation** dans `src/lib/validation/parcelles.ts` : 6 schémas Zod (`soilWorkSchema`, `plantingSchema`, `rowCareSchema`, `harvestSchema`, `uprootingSchema`, `occultationSchema`) avec validations conditionnelles via `.superRefine()` (cueillette parcelle/sauvage, seedling vs fournisseur pour plantation, méthode occultation).
- **Hook `useRowVarieties`** : requête `plantings WHERE row_id=X AND actif=true AND deleted_at IS NULL`, dédoublonnage par variety_id, `autoVariety` non-null si exactement 1 variété.
- **Hook `useVarietyParts`** : requête `varieties.parties_utilisees`, `autoPart` non-null si exactement 1 partie.
- **Tests** : 71 nouveaux tests (147 total) couvrant cas valides, cas invalides et validations conditionnelles pour les 6 schémas.

---

## [2026-03-02] — fix(referentiel): select fermé pour l'unité de mesure dans MaterielSlideOver

**Type :** `fix`
**Fichiers concernés :** `src/components/referentiel/MaterielSlideOver.tsx`

### Description
Remplacement du champ `<input type="text" list="unites-list">` + `<datalist>` par un `<select>` fermé avec 2 options uniquement : `g (grammes)` et `mL (millilitres)`. Suppression de la constante `UNITES` devenue inutile.

### Détails techniques
- Avant : saisie libre avec suggestions datalist — l'utilisatrice pouvait entrer n'importe quelle valeur (ex : "kg", "KG", "Grammes")
- Après : `<select>` fermé — uniquement `g` et `mL`, valeur par défaut `g`
- Styles `inputStyle`, `onFocus`, `onBlur` conservés pour cohérence visuelle

### Vérification
- `npm run build` ✅ sans erreur TypeScript

---

## [2026-03-02] — test(semis): A1.6 — Tests + Polish du module Semis

**Type :** `test`
**Fichiers concernés :**
- `src/lib/utils/semis-parsers.ts` (création — extraction des parsers pour testabilité)
- `src/app/(dashboard)/semis/sachets/actions.ts` (refactor — import parseSeedLotForm depuis utils)
- `src/app/(dashboard)/semis/suivi/actions.ts` (refactor — import parseSeedlingForm depuis utils)
- `src/tests/semis/actions-parse.test.ts` (création)
- `src/tests/semis/lots-edge-cases.test.ts` (création)

### Description
Tests supplémentaires, vérification de cohérence schéma SQL ↔ TypeScript et polish du module Semis (A1.6).

### Détails techniques

**Vérification cohérence code ↔ schéma SQL** :
- `seed_lots` (SQL) ↔ `SeedLot` (TypeScript) : ✅ tous les champs couverts, `uuid_client` et `deleted_at` présents
- `seedlings` (SQL) ↔ `Seedling` (TypeScript) : ✅ tous les champs couverts
- Contraintes SQL (NOT NULL, DEFAULT, CHECK) ↔ Zod : ✅ cohérents
- Navigation sidebar : ✅ `/semis/sachets` et `/semis/suivi` déjà présents

**Refactoring pour testabilité** :
- `parseSeedLotForm` et `parseSeedlingForm` extraites vers `src/lib/utils/semis-parsers.ts`
- Raison : Next.js interdit d'exporter des fonctions synchrones depuis un fichier `'use server'` (toutes les exports doivent être `async`)
- Les actions importent maintenant ces fonctions depuis le module utilitaire — comportement identique

**`actions-parse.test.ts`** (26 tests) :
- `parseSeedLotForm` : formulaire minimal, certif_ab `'on'`/`'true'`/absent, poids_sachet_g float, champs optionnels vides → null, erreurs (variety_id manquant, UUID invalide, date future, poids négatif, trop de décimales)
- `parseSeedlingForm` — mini_motte : parsing basique, champs caissette_godet → null, nb_mortes defaulté à 0, comportement NOT NULL des colonnes mortes (envoi 0 pour l'autre processus), erreur si nb_mottes absent
- `parseSeedlingForm` — caissette_godet : parsing basique, champs mini_motte → null, nb_mortes defaulté à 0, erreurs nb_caissettes/nb_plants_caissette manquants
- `parseSeedlingForm` — cas invalides communs : processus absent, processus inconnu, variety_id absent, date_semis future

**`lots-edge-cases.test.ts`** (11 tests) :
- `generateSeedlingNumber` : format SM-AAAA-NNN, padding 3 chiffres, années multiples, count élevé (> 99, > 999)
- `generateProductionLotNumber` : format [CODE]AAAAMMJJ, padding mois/jour, fin d'année, préfixe multi-caractères

**Revue de code (6 fichiers du module Semis)** :
- Aucun `console.log` trouvé ✅
- Aucun code mort ou commenté ✅
- Gestion d'erreurs explicite partout ✅
- Tous les imports utilisés ✅
- Commentaires en français ✅
- Nommage en anglais ✅

### Résultats
- `npm run build` ✅ sans erreur TypeScript, routes `/semis/sachets` et `/semis/suivi` listées comme `ƒ (Dynamic)`
- `npm run test:run` ✅ **76 tests passants** (2 smoke + 5 lots + 11 lots-edge-cases + 11 seedling-stats + 21 validation + 26 actions-parse)

---

## [2026-03-02] — feat(semis): A1.5 — Page Suivi des semis (UI bureau)

**Type :** `feature`
**Fichiers concernés :** `src/app/(dashboard)/semis/suivi/page.tsx` (création), `src/components/semis/SemisClient.tsx` (création), `src/components/semis/SemisSlideOver.tsx` (création)

### Description
Création de la page bureau `/semis/suivi` avec tableau filtrable, slide-over adaptatif et récapitulatif de perte en temps réel. Suit le même pattern que la page Sachets de graines.

### Détails techniques

**`page.tsx`** (Server Component) :
- Appels parallèles `Promise.all([fetchSeedlings(), fetchSeedLotsForSelect(), fetchVarieties()])` pour optimiser les performances
- `fetchVarieties` réutilisée depuis `semis/sachets/actions.ts`
- Gestion des erreurs avec message affiché en ocre

**`SemisClient.tsx`** (Client Component) :
- Type `SeedLotForSelect` exporté et réutilisé par `SemisSlideOver`
- **Filtres processus** : 3 boutons inline — "Tous" | "Mini-mottes" | "Caissette/Godet", filtrage côté client
- **Colonnes** : Variété, Processus (badge vert/bleu), Sachet source, Date semis, Départ (nb_mottes ou nb_plants_caissette selon processus), Obtenus, Perte (badge coloré), Actions
- **Perte colorée** : calcul via `computeSeedlingLossRate` — vert < 20%, orange 20-40%, rouge > 40%
- Recherche insensible casse/accents sur `nom_vernaculaire`, `lot_interne`, `numero_caisse`
- Archivage soft delete avec confirmation inline double-clic (auto-reset 4s)

**`SemisSlideOver.tsx`** (Client Component) :
- **Sélecteur processus** : 2 boutons en haut du panneau, modifiable en mode édition
- **Champs adaptatifs** : sections "Mini-mottes" / "Caissette/Godet" affichées/masquées selon le processus sélectionné
- Intégration `QuickAddVariety` et select contrôlé pour la variété
- Select contrôlé pour le sachet source
- **Récapitulatif de perte en temps réel** : bloc coloré affiché dès que `nb_plants_obtenus` est renseigné — calcul via objet `Seedling` virtuel passé à `computeSeedlingLossRate`
- Composants locaux : `ProcessBtn`, `Separator`, `MiniMotteSummary`, `CaissetteSummary`, `perteColors`

**Navigation sidebar** : lien `/semis/suivi` déjà présent — aucune modification nécessaire.

### Vérification
- `npm run build` ✅ sans erreur TypeScript
- Route `/semis/suivi` listée comme `ƒ (Dynamic)`

---

## [2026-03-02] — feat(semis): A1.4 — Server Actions suivi des semis (seedlings)

**Type :** `feature`
**Fichiers concernés :** `src/app/(dashboard)/semis/suivi/actions.ts` (création)

### Description
Création des Server Actions pour le module suivi des semis (`seedlings`). Même pattern exact que `sachets/actions.ts`.

### Détails techniques

**`parseSeedlingForm(formData)`** :
- Extrait tous les champs du formulaire et les convertit aux bons types (int, float, date, string)
- Valide avec `seedlingSchema` (Zod)
- Champs de l'autre processus mis à null explicitement (sauf `nb_mortes_*` = 0 car NOT NULL DEFAULT en base)
- Retourne `{ data }` ou `{ error }` (premier message Zod)

**`normalizeMortesFields(data)`** :
- Helper interne : convertit `nb_mortes_mottes/caissette/godet` de `null → 0`
- Nécessaire car les types Supabase générés marquent ces colonnes NOT NULL (DEFAULT 0) sans accepter null

**`fetchSeedlings()`** : jointures `varieties` + `seed_lots`, filtre `deleted_at IS NULL`, tri `date_semis DESC, created_at DESC`

**`fetchSeedLotsForSelect()`** : sachets actifs avec variété, tri `lot_interne DESC`, pour le dropdown formulaire

**`createSeedling(formData)`** : insert + `revalidatePath('/semis/suivi')`, retourne `ActionResult<Seedling>`

**`updateSeedling(id, formData)`** : update (changement de processus autorisé), retourne `ActionResult<Seedling>`

**`archiveSeedling(id)`** / **`restoreSeedling(id)`** : soft delete / restore

### Décision notable
Les colonnes `nb_mortes_mottes`, `nb_mortes_caissette`, `nb_mortes_godet` sont générées NOT NULL par Supabase (DEFAULT 0). Pour l'autre processus, on envoie `0` (pas null) pour rester compatible avec les types générés.

### Vérification
- `npm run build` ✅ sans erreur

---

## [2026-03-02 23:45] — feat(semis): A1.3 — Page Sachets de graines (UI bureau)

**Type :** `feature`
**Fichiers concernés :** `src/app/(dashboard)/semis/sachets/actions.ts`, `src/app/(dashboard)/semis/sachets/page.tsx`, `src/components/semis/SachetsClient.tsx`, `src/components/semis/SachetSlideOver.tsx`

### Description
Création de la page bureau `/semis/sachets` avec tableau + slide-over, en suivant exactement le même pattern UX et code que le CRUD Variétés existant.

### Détails techniques

**`actions.ts`** (extension) :
- `fetchVarieties` : requête des variétés actives (`deleted_at IS NULL`), triées par `nom_vernaculaire`, retourne `Pick<Variety, 'id' | 'nom_vernaculaire' | 'nom_latin'>[]` — utilisée pour populer le select du formulaire

**`page.tsx`** (Server Component) :
- Appels parallèles `Promise.all([fetchSeedLots(), fetchVarieties()])` pour optimiser les performances
- Passe les données à `SachetsClient`
- Gestion des erreurs avec message affiché en ocre

**`SachetsClient.tsx`** (Client Component) :
- Même structure que `VarietesClient.tsx` : toolbar recherche + bouton Nouveau sachet + toggle archivés + tableau + état vide
- Colonnes : Lot (gras), Variété, Fournisseur, Date achat (JJ/MM/AAAA), Poids sachet (g), AB (badge vert), Actions
- Recherche insensible casse/accents sur `lot_interne`, `nom_vernaculaire`, `fournisseur`
- Archivage soft delete avec confirmation inline double-clic (auto-reset 4s)
- `formatDate` helper pour le format JJ/MM/AAAA
- `router.refresh()` après chaque mutation pour re-fetch Server Component

**`SachetSlideOver.tsx`** (Client Component) :
- Même pattern que `VarieteSlideOver.tsx` : panneau coulissant droit (480→500px), overlay blur, Escape pour fermer
- Mode création : titre "Nouveau sachet de graines", bouton "Créer le sachet"
- Mode édition : badge `lot_interne` en lecture seule dans l'en-tête, pré-remplissage de tous les champs
- Intégration `QuickAddVariety` à côté du label Variété — nouvelle variété créée → ajoutée au select local et auto-sélectionnée
- Champs en grille 2 colonnes : date_achat/date_facture, numero_facture/numero_lot_fournisseur, poids_sachet_g/certif_ab
- `selectedVarietyId` state contrôlé pour le select (synchronisé avec `fd.set` à la soumission)

**Navigation sidebar** : lien `/semis/sachets` déjà présent — aucune modification nécessaire.

**`npm run build`** : passe sans erreur TypeScript. Route `/semis/sachets` listée comme `ƒ (Dynamic)`.

---

## [2026-03-02 23:00] — feat(semis): A1.2 — Server Actions sachets de graines (seed_lots)

**Type :** `feature`
**Fichiers concernés :** `src/app/(dashboard)/semis/sachets/actions.ts`, `src/lib/validation/semis.ts`

### Description
Création des Server Actions pour le CRUD des sachets de graines (`seed_lots`), en suivant exactement le pattern établi dans `referentiel/varietes/actions.ts`.

Correction du bug Zod v4 dans `semis.ts` : `invalid_type_error` renommé en `error` (API v4).

### Détails techniques
- `parseSeedLotForm` : extraction et validation Zod de tous les champs formulaire (UUID, strings nullables, dates, float, boolean `certif_ab`)
- `fetchSeedLots` : jointure `varieties(id, nom_vernaculaire, nom_latin)`, filtre `deleted_at IS NULL`, tri `created_at DESC`
- `createSeedLot` : compte les `SL-{year}-%` (y compris archivés pour éviter les doublons), appelle `generateSeedLotNumber`, insert + revalidate
- `updateSeedLot` : exclut `lot_interne` de la mise à jour (immutable)
- `archiveSeedLot` / `restoreSeedLot` : soft delete (`deleted_at`) identique au pattern variétés
- `mapSupabaseError` : code `23505` → message explicite de doublon
- `npm run build` passe sans erreur TypeScript

---

## [2026-03-02 22:00] — feat(semis): A1.1 — types, validation Zod, utilitaires et tests unitaires

**Type :** `feature`
**Fichiers concernés :** `src/lib/types.ts`, `src/lib/validation/semis.ts`, `src/lib/utils/lots.ts`, `src/lib/utils/seedling-stats.ts`, `src/tests/semis/lots.test.ts`, `src/tests/semis/seedling-stats.test.ts`, `src/tests/semis/validation.test.ts`

### Description
Mise en place de la couche fondatrice du module Semis (A1.1) : types TypeScript, schémas de validation Zod, utilitaires métier et tests unitaires complets (39 tests passants). Aucun composant UI ni Server Action (prévu en A1.2 / A1.3).

### Détails techniques

**`src/lib/types.ts`** (ajouts) :
- `Processus = 'caissette_godet' | 'mini_motte'`
- `SeedLot` : tous les champs de la table `seed_lots` (id, uuid_client, lot_interne, variety_id, fournisseur, numero_lot_fournisseur, date_achat, date_facture, numero_facture, poids_sachet_g, certif_ab, deleted_at, created_at)
- `SeedLotWithVariety` : SeedLot + varieties jointure (id, nom_vernaculaire, nom_latin)
- `Seedling` : tous les champs de la table `seedlings` (processus, champs mini-motte, champs caissette/godet, champs communs)
- `SeedlingWithRelations` : Seedling + varieties + seed_lots jointures

**`src/lib/validation/semis.ts`** (nouveau) :
- `seedLotSchema` : variety_id (UUID RFC 4122 strict), date_achat (≤ aujourd'hui), poids_sachet_g (décimal > 0, max 2 décimales), certif_ab (boolean, default false)
- `seedlingSchema` : processus (enum), date_semis (≤ aujourd'hui), validation conditionnelle via `.superRefine()` — nb_mottes obligatoire si mini_motte, nb_caissettes + nb_plants_caissette obligatoires si caissette_godet
- `SeedLotFormData` et `SeedlingFormData` exportés via `z.infer<>`

**`src/lib/utils/lots.ts`** (nouveau) :
- `generateSeedLotNumber(year, existingCount)` → `SL-AAAA-NNN` (padding 3 chiffres)
- `generateSeedlingNumber(year, existingCount)` → `SM-AAAA-NNN` (stub pour A1.2)
- `generateProductionLotNumber(recipeCode, date)` → `[CODE]AAAAMMJJ` (stub pour A4)

**`src/lib/utils/seedling-stats.ts`** (nouveau) :
- `computeMiniMotteLossRate(seedling)` → `{ total_depart, mortes, donnees, plantes, perte_pct }` — perte = 1 - (nb_plants_obtenus / nb_mottes), arrondi à 2 décimales
- `computeCaissetteGodetLossRate(seedling)` → `{ total_depart, mortes_caissette, mortes_godet, donnees, plantes, perte_caissette_pct, perte_godet_pct, perte_globale_pct }` — 3 taux selon les formules du context.md
- `computeSeedlingLossRate(seedling)` → dispatcher ; retourne null pour chaque taux si les données sont manquantes ou si le départ = 0

**Tests** (39 tests, 100% passants) :
- `lots.test.ts` : 5 tests (format, padding, incrémentation, années multiples, dépassement 999)
- `seedling-stats.test.ts` : 11 tests incluant les exemples exacts du context.md (98 mottes → 23%, 50 caissette → 30%), cas nulls, zéros, dispatcher
- `validation.test.ts` : 21 tests (cas valides et invalides pour les deux schémas + champs conditionnels)

### Notes
- Zod v4.3.6 installé — UUID validation plus stricte qu'en v3 (RFC 4122, versions 1-8 uniquement). Tests adaptés avec de vrais UUIDs v4.
- Dépendance ajoutée : `zod@^4.3.6`

---

## [2026-03-02 15:00] — docs(schema): ajout mode mélange sur production_lots

**Type :** `docs`
**Fichiers concernés :** `.claude/context.md`, `.claude/plan-action.md`

### Description
Ajout d'un deuxième mode de production "mélange" en complément du mode "produit" existant. Pas de migration SQL (tables pas encore créées). Modifications docs uniquement pour que le schéma soit correct au moment de coder A4.

### Détails techniques
- `production_lots.mode TEXT CHECK ('produit'|'melange') NOT NULL DEFAULT 'produit'` — choix du mode au lancement du wizard
- `nb_unites INTEGER` — suppression NOT NULL (NULL en mode mélange, renseigné au conditionnement)
- `poids_total_g DECIMAL` — suppression NOT NULL (calculé différemment selon le mode)
- context.md §5.6 : processus de création réécrit avec les deux flux + action "Conditionnement"
- context.md §13 : décision "Mode production" ajoutée
- plan-action.md A4 : wizard décrit en 2 modes + badge et bouton "Conditionner" pour lots mélange sans nb_unites

---

## [2026-03-02 14:00] — fix(schema): dates obligatoires pour la traçabilité + lune à la plantation

**Type :** `fix`
**Fichiers concernés :** `supabase/migrations/008_not_null_dates_lune.sql`, `.claude/context.md`, `src/lib/supabase/types.ts`

### Description
Renforcement de la traçabilité en rendant NOT NULL les trois dates critiques du cycle cultural, et ajout de la phase lunaire à la plantation pour analyses futures.

### Détails techniques
- `seed_lots.date_achat` : NOT NULL — date d'achat indispensable pour la traçabilité semences
- `seedlings.date_semis` : NOT NULL — date de semis obligatoire pour calculer les durées de levée
- `plantings.date_plantation` : NOT NULL — date de plantation obligatoire pour les calculs de rendement
- `plantings.lune` : ajout colonne nullable `TEXT CHECK ('montante' | 'descendante')` — optionnel, pour corrélation future avec les rendements
- context.md mis à jour (3 colonnes NOT NULL + colonne lune avec commentaire)
- types.ts mis à jour : Row/Insert sans `| null` pour les 3 dates; Insert sans `?` optionnel; lune ajouté dans Row/Insert/Update de `plantings`

---

## [2026-03-02 11:30] — feat(occultations): ajout module occultation de rangs

**Type :** `feature`
**Fichiers concernés :** `supabase/migrations/007_add_occultations.sql`, `src/lib/supabase/types.ts`, `src/components/Sidebar.tsx`, `src/components/MobileHeader.tsx`, `.claude/context.md`, `.claude/plan-action.md`

### Description
Ajout du module Occultation de rangs : table SQL, types TypeScript, navigation, et documentation complète. L'occultation régénère un rang entre deux cultures (arrachage → occultation → travail de sol → replantation).

### Détails techniques
- **Migration 007** : `CREATE TABLE occultations` avec 4 méthodes (paille, foin, bache, engrais_vert), champs adaptatifs par méthode, index sur `row_id` et `date_fin IS NULL`, RLS
- **types.ts** : export `MethodeOccultation` (union des 4 valeurs) + type complet `occultations` (Row/Insert/Update/Relationships) inséré après `uprootings` dans la section Module Parcelles
- **Sidebar.tsx** : ajout `{ label: 'Occultation', href: '/parcelles/occultation' }` dans 🌿 Suivi parcelle
- **MobileHeader.tsx** : idem dans les sous-actions 🌿 Parcelle
- **context.md §5.3** : nouvelle sous-section `occultations` avec CREATE TABLE, notes cycle, formulaire adaptatif, autocomplétion `engrais_vert_nom`, avertissement plantation sur rang occulté
- **context.md §8.1** : 3 nouvelles lignes dans le tableau des validations (Plantation → Rang occulté, Occultation → Engrais vert, Occultation → Paille/Foin)
- **context.md §13** : décision "Occultation de rangs" ajoutée
- **context.md §4.2** : "Occultation" ajouté dans la sidebar 🌿 Suivi parcelle
- **context.md §4.3** : "Occultation" ajouté dans les sous-actions 🌿 Parcelle
- **plan-action.md A2** : Module Occultation ajouté avec détail formulaire adaptatif par méthode et avertissement
- **plan-action.md A6** : Occultation ajouté dans la liste des sous-actions 🌿 Parcelle mobile

---

## [2026-03-02 10:00] — Ajout dimensions rangs et surfaces de plantation

**Type :** `feature`
**Fichiers concernés :** `supabase/migrations/006_add_dimensions_rows_plantings.sql`, `.claude/context.md`, `.claude/plan-action.md`, `src/lib/supabase/types.ts`

### Description
Ajout des colonnes de dimension sur `rows` (largeur_m) et `plantings` (longueur_m, largeur_m) pour permettre le calcul de surface et de rendement par variété et par saison.

### Détails techniques
- **Migration 006** : `ALTER TABLE rows ADD COLUMN largeur_m DECIMAL` + `ALTER TABLE plantings ADD COLUMN longueur_m DECIMAL, ADD COLUMN largeur_m DECIMAL`
- **context.md §5.1** : ajout `largeur_m` dans le CREATE TABLE `rows` avec commentaire
- **context.md §5.3** : ajout `longueur_m` + `largeur_m` dans `plantings` + 4 notes (pré-remplissage, avertissement dépassement, calcul surface, calcul rendement)
- **context.md §8.1** : nouvelle ligne "Plantation → Dimensions" dans le tableau des validations
- **context.md §13** : décision "Dimensions rangs" ajoutée
- **plan-action.md A0** : CRUD Rangs inclut explicitement `largeur_m`
- **plan-action.md A2** : plantation avec pré-remplissage dimensions, avertissements (dépassement + rang déjà actif), rendement calculable
- **types.ts** : `rows.Row/Insert/Update` + `largeur_m: number | null` ; `plantings.Row/Insert/Update` + `longueur_m: number | null` + `largeur_m: number | null`
- Surface m² et rendement kg/m² sont **calculés à la volée** (jamais stockés)

---

## [2026-03-02 00:00] — Avertissement rang déjà occupé lors d'une plantation

**Type :** `docs`
**Fichiers concernés :** `.claude/context.md`, `.claude/plan-action.md`

### Description
Ajout de la spécification d'avertissement pour le cas où un rang a déjà un planting actif au moment d'une nouvelle plantation. Pas de blocage — l'utilisateur confirme ou annule (2 variétés sur un même rang est un cas légitime).

### Détails techniques
- `context.md §5.3` : note ajoutée après le CREATE TABLE `plantings` décrivant le comportement attendu (message d'avertissement avec variété + date, bouton confirmer / annuler)
- `context.md §8.1` : nouvelle ligne dans le tableau des capteurs et validations — "Plantation → Rang | Avertissement si le rang a déjà un planting actif. Pas de blocage."
- `plan-action.md A2` : livrable Module Plantation complété avec la mention de cet avertissement

---

## [2026-03-01 18:00] — feat(referentiel): ajout catégorie Sirop + matériaux externes associés

**Type :** `feature`
**Fichiers concernés :** `supabase/migrations/005_add_sirop_category.sql`, `.claude/context.md`, `.claude/plan-action.md`

### Description
Ajout de la catégorie produit Sirop au projet : migration SQL, documentation des specs et plan d'action.

### Détails techniques
- **`005_add_sirop_category.sql`** : INSERT `('Sirop')` dans `product_categories` + INSERT `('Sucre blond de canne bio', 'g')` et `('Eau', 'mL')` dans `external_materials`, tous avec `ON CONFLICT DO NOTHING`
- **`context.md` §5.6** : commentaire SQL `product_categories.nom` mis à jour — ajout "Sirop" à la liste
- **`context.md` §8.2** : nouvelle ligne dans le tableau de numérotation des lots — format `SI[CODE]AAAAMMJJ` (ex : SIAV20250604)
- **`context.md` §13** : nouvelle ligne dans le tableau des décisions — description complète de la catégorie Sirop (plantes fraîches/séchées + Eau + Sucre blond de canne bio, conditionnement bouteille 770mL/520mL, poids en grammes en base, UI affiche mL pour les liquides)
- **`plan-action.md` A4** : Sirop ajouté à la liste des catégories produits
- Le sucre blond de canne bio n'était **pas encore seedé** dans external_materials (aucune migration antérieure ne l'insérait) → créé par la migration 005

---

## [2026-03-01 16:15] — fix(types): correction vue v_stock + backup route — build Vercel

**Type :** `fix`
**Fichiers concernés :** `src/lib/supabase/types.ts`, `src/app/api/backup/route.ts`

### Description
Correction de deux erreurs TypeScript qui bloquaient le build Vercel.

### Détails techniques
- **`supabase/types.ts`** : ajout de `Relationships: []` sur la vue `v_stock`. Sans ce champ, le type ne satisfaisait pas `GenericNonUpdatableView` du SDK (`{ Row, Relationships }` requis). En conséquence, `Database['public']` ne satisfaisait plus `GenericSchema`, et le SDK Supabase tombait sur son type par défaut `{ PostgrestVersion: "12"; }` où toutes les tables sont `never`.
- **`backup/route.ts`** : `.from(table)` avec un `string` générique est maintenant rejeté depuis que `Database` est correctement reconnu (le SDK exige une union des noms de tables). Cast `(supabase as any)` justifié car la route de backup itère dynamiquement sur des tables découvertes via l'API OpenAPI.

---

## [2026-03-01 10:00] — feat(referentiel): intégration parties_utilisees dans le CRUD Variétés

**Type :** `feature`
**Fichiers concernés :** `src/lib/types.ts`, `src/app/(dashboard)/referentiel/varietes/actions.ts`, `src/components/referentiel/VarieteSlideOver.tsx`, `src/components/referentiel/VarietesClient.tsx`, `src/components/varieties/QuickAddVariety.tsx`

### Description
Intégration du champ `parties_utilisees` (ajouté en migration 004) dans toute la couche UI du CRUD Variétés : formulaire principal, tableau liste, et composant d'ajout rapide.

### Détails techniques
- **`types.ts`** : ajout de `PartiePlante` (union type), `PARTIES_PLANTE` (tableau des 6 valeurs), `PARTIE_PLANTE_LABELS` (labels FR), et `parties_utilisees: PartiePlante[]` dans le type `Variety`
- **`actions.ts`** : `parseVarietyForm` lit les valeurs via `formData.getAll('parties_utilisees')`, filtre les valeurs invalides, retourne `{ error }` si tableau vide ; `createVariety` et `updateVariety` gèrent ce retour d'erreur
- **`VarieteSlideOver.tsx`** : champ checkboxes-pills multi-select avec état local `selectedParties`, validation front (au moins 1 valeur), reset à l'ouverture selon la variété en édition
- **`VarietesClient.tsx`** : nouvelle colonne "Parties" avec badges colorés par partie (vert=feuille, rose=fleur, ambre=graine, jaune-brun=racine, orange=fruit, gris=plante_entière) ; import `PARTIE_COLORS` local et `PARTIE_PLANTE_LABELS` depuis types
- **`QuickAddVariety.tsx`** : champ checkboxes-pills identique, même UX, reset complet à fermeture/succès/annulation

---

## [2026-03-01 01:30] — fix(migration): correction vue v_stock — DROP avant CREATE

**Type :** `fix`
**Fichiers concernés :** `supabase/migrations/004_add_partie_plante.sql`

### Description
`CREATE OR REPLACE VIEW` échoue quand on insère une colonne au milieu d'une vue existante — Postgres interprète le changement de position comme un renommage. Remplacement par `DROP VIEW IF EXISTS v_stock` suivi d'un `CREATE VIEW`.

### Détails techniques
- Erreur : `cannot change name of view column "etat_plante" to "partie_plante"`
- Cause : `CREATE OR REPLACE` ne peut qu'ajouter des colonnes en fin de liste, pas en insérer au milieu
- Fix : `DROP VIEW IF EXISTS v_stock; CREATE VIEW v_stock AS ...`

---

## [2026-03-01 01:00] — feat(migration): migration SQL 004 + types TypeScript partie_plante

**Type :** `feature`
**Fichiers concernés :** `supabase/migrations/004_add_partie_plante.sql`, `src/lib/supabase/types.ts`

### Description
Création de la migration SQL 004 et mise à jour des types TypeScript pour intégrer la dimension `partie_plante` dans le schéma de base de données.

### Détails techniques
**004_add_partie_plante.sql** :
- `varieties` : `ADD COLUMN parties_utilisees TEXT[] NOT NULL DEFAULT '{"plante_entiere"}'`
- `harvests` : `ADD COLUMN IF NOT EXISTS deleted_at` (sécurité) + `ADD COLUMN partie_plante NOT NULL DEFAULT 'plante_entiere'`
- `cuttings`, `dryings`, `sortings` : `ADD COLUMN partie_plante NOT NULL DEFAULT 'plante_entiere'` (hérité)
- `stock_movements`, `stock_purchases`, `stock_direct_sales`, `stock_adjustments` : idem NOT NULL
- `recipe_ingredients`, `production_lot_ingredients` : `ADD COLUMN partie_plante` nullable (NULL = matériaux externes)
- `forecasts` : colonne nullable + `DROP CONSTRAINT forecasts_annee_variety_id_etat_plante_key` + nouvelle contrainte `UNIQUE NULLS NOT DISTINCT (annee, variety_id, etat_plante, partie_plante)`
- Vue `v_stock` : recréée avec `partie_plante` dans SELECT et GROUP BY (3 dimensions)
- Index `idx_stock_movements_partie_plante` + index composite `idx_stock_movements_variety_partie_etat`

**types.ts** :
- Export du type union `PartiePlante` réutilisable dans tout le code applicatif
- `varieties.parties_utilisees: PartiePlante[]`
- Tables avec `partie_plante: PartiePlante` (obligatoire) : harvests, cuttings, dryings, sortings, stock_movements, stock_purchases, stock_direct_sales, stock_adjustments
- Tables avec `partie_plante: PartiePlante | null` (nullable) : recipe_ingredients, production_lot_ingredients, forecasts
- Vue `v_stock` ajoutée dans la section `Views` avec les 3 dimensions
- `production_lot_ingredients` : ajout du champ `fournisseur` qui manquait dans les types

---

## [2026-03-01 00:00] — docs(modèle): ajout dimension partie_plante au modèle de données

**Type :** `docs`
**Fichiers concernés :** `.claude/context.md`, `.claude/plan-action.md`

### Description
Intégration de la 3ème dimension du stock : `partie_plante` (feuille, fleur, graine, racine, fruit, plante_entiere). Le stock est désormais à 3 dimensions : variété × partie × état. La partie est choisie à la cueillette et héritée dans toute la chaîne de transformation.

### Détails techniques
**context.md** :
- `varieties` : ajout `parties_utilisees TEXT[] NOT NULL DEFAULT '{"plante_entiere"}'`
- `harvests` : ajout `partie_plante NOT NULL` + `deleted_at` (manquant dans le CREATE TABLE) + commentaire logique adaptative
- `cuttings`, `dryings`, `sortings` : ajout `partie_plante NOT NULL` + commentaire "hérité"
- `stock_movements` : ajout `partie_plante NOT NULL`
- `stock_purchases`, `stock_direct_sales`, `stock_adjustments` : ajout `partie_plante NOT NULL`
- `recipe_ingredients`, `production_lot_ingredients` : ajout `partie_plante` nullable (NULL = matériaux externes)
- `forecasts` : ajout `partie_plante` nullable + contrainte UNIQUE modifiée en `(annee, variety_id, etat_plante, partie_plante)`
- Vue stock SQL : `partie_plante` ajouté dans SELECT et GROUP BY
- Tableau des flux (§5.5) : colonne `partie_plante` (CHOISI à la cueillette, HÉRITÉ ensuite)
- Diagramme de flux : explication stock 3 dimensions avec exemples concrets
- Tableau Vue Stock (§5.9) : colonne Partie avec exemples (Menthe feuille, Menthe fleur, Fenouil graine...)
- Processus de création de lot : vérification stock sur les 3 dimensions (variété × partie × état)
- §10.1 : bloc détaillé sur `partie_plante` (valeurs, logique adaptative, obligatoire/nullable)
- §10.2 : index ajouté sur `stock_movements(partie_plante)`
- §13 : ligne `partie_plante` dans le tableau des décisions

**plan-action.md** :
- A0 Référentiel : CRUD Variétés inclut `parties_utilisees` (multi-select obligatoire, au moins 1 valeur)
- A2 Cueillette : `partie_plante` obligatoire, logique adaptative sur `varieties.parties_utilisees`
- A3 Transformation : `partie_plante` hérité sur les 3 modules, ajouté dans les scénarios de test
- A4 Production : recettes et lots incluent état ET partie par ingrédient, vérification stock sur les 3 dimensions

---

## [2026-02-28 18:00] — refactor(backup): découverte dynamique des tables via l'API OpenAPI Supabase

**Type :** `refactor`
**Fichiers concernés :** `src/app/api/backup/route.ts`

### Description
Remplacement de la liste statique `TABLES_TO_BACKUP` par une découverte dynamique via l'endpoint OpenAPI de Supabase (`GET /rest/v1/`). Toute nouvelle table est désormais automatiquement incluse dans le backup sans modifier le code.

### Détails techniques
- `discoverPublicTables()` : GET `/rest/v1/` avec la clé service role → lit `spec.definitions` qui contient toutes les tables du schéma public exposées par PostgREST
- Filtre simple : exclut les entrées préfixées `pg_` ou `_` (vues système)
- Le payload JSON inclut maintenant `tables_discovered` (liste des noms) pour audit
- Résultat : 29 tables découvertes et exportées, zéro erreur
- Rend obsolète tout fix de noms de tables manquantes

---

## [2026-02-28 17:30] — fix(backup): correction des noms de tables dans TABLES_TO_BACKUP

**Type :** `fix`
**Fichiers concernés :** `src/app/api/backup/route.ts`

### Description
3 tables avaient des noms incorrects dans la liste de backup, provoquant des erreurs à chaque exécution.

### Détails techniques
- `production_batches` → `production_lots`
- `purchases` → `stock_purchases`
- `sales` → `stock_direct_sales`
- Résultat après correction : 22/22 tables exportées, zéro erreur

---

## [2026-02-28 17:00] — feat(backup): implémentation complète de la route /api/backup

**Type :** `feature`
**Fichiers concernés :** `src/app/api/backup/route.ts`

### Description
Remplacement du squelette par l'implémentation complète de la route de backup quotidien.
La route exporte toutes les tables Supabase en JSON, pousse le fichier sur GitHub, et log le résultat dans `app_logs`.

### Détails techniques
- **Export Supabase** : boucle sur les 22 tables via le client admin (`SUPABASE_SERVICE_ROLE_KEY`). Tables absentes ignorées silencieusement (schéma non encore migré).
- **GitHub REST API** : GET pour récupérer le SHA si le fichier du jour existe déjà → PUT pour créer ou écraser. Variables `GITHUB_BACKUP_TOKEN` et `GITHUB_BACKUP_REPO` (déjà dans `.env.local`).
- **Nom du fichier** : `backup-YYYY-MM-DD.json` — un seul fichier par jour, écrasé si le cron tourne plusieurs fois.
- **Logging** : insertion dans `app_logs` (succès et erreur) via `logToAppLogs()`. Échoue silencieusement si la table n'existe pas encore.
- **vercel.json** : déjà correct (`/api/backup` → `0 3 * * *`), aucune modification nécessaire.
- **Test local** : `curl http://localhost:3000/api/backup`

---

## [2026-02-28] — fix(sidebar): Dashboard reste surligné après clic sur section header

**Type :** `fix`
**Fichiers concernés :** `src/components/Sidebar.tsx`

### Description
Dashboard restait surligné quand on cliquait sur un section header depuis `/dashboard`, car `pathname === '/dashboard'` restait vrai.

### Détails techniques
- **Fix** : `isDashActive = pathname === '/dashboard' && openSection === null` — Dashboard n'est actif visuellement que si on est sur `/dashboard` ET qu'aucune section n'est ouverte.

---

## [2026-02-28] — fix(sidebar): Dashboard — accordéon précédent reste surligné après navigation

**Type :** `fix`
**Fichiers concernés :** `src/components/Sidebar.tsx`

### Description
Correction du bug où cliquer sur "Dashboard" laissait l'accordéon précédemment ouvert surligné. Cause : `openSection` n'était pas réinitialisé lors de la navigation vers `/dashboard`.

### Détails techniques
- **Fix** : ajout de `onClick={() => setOpenSection(null)}` sur le `<Link>` Dashboard — ferme l'accordéon ouvert au moment du clic, avant la navigation.

---

## [2026-02-28] — fix(sidebar): texte main titre — highlight reste sur l'ancien accordéon cliqué

**Type :** `fix`
**Fichiers concernés :** `src/components/Sidebar.tsx`

### Description
Correction du bug où la couleur de texte d'un main titre (section header) restait `sectionActive` (blanc vif) même après avoir cliqué sur un autre accordéon.

### Détails techniques
- **Cause** : `color` du section header suivait `hasActive` (enfant actif dans l'URL) tandis que `backgroundColor` suivait déjà `isOpen` — incohérence introduite lors du fix précédent.
- **Fix** : toutes les propriétés visuelles du header (couleur texte, opacité emoji, garde `onMouseEnter`, restauration `onMouseLeave`) alignées sur `isOpen` au lieu de `hasActive`.
- **Suppression** : variable `hasActive` devenue inutilisée, retirée pour supprimer le warning TypeScript `6133`.

---

## [2026-02-28] — Sidebar : accordéon exclusif + fix highlight bloqué + Dashboard main titre

**Type :** `fix`
**Fichiers concernés :** `src/components/Sidebar.tsx`

### Description
Trois corrections de comportement sidebar : accordéon exclusif (une section à la fois), fix du highlight Référentiel bloqué, Dashboard aligné visuellement avec les main titres.

### Détails techniques
- **Accordéon exclusif** : `useState<string[]>` → `useState<string | null>`, `toggleSection` remplace le tableau par un id unique (`prev === id ? null : id`)
- **Fix highlight bloqué** : `backgroundColor: hasActive ? C.activeBg` → `backgroundColor: isOpen ? C.activeBg` — le fond suit l'état ouvert/fermé, pas la page active
- **onMouseLeave cohérent** : `isOpen ? C.activeBg : 'transparent'` pour restaurer le bon état après survol
- **Dashboard main titre** : suppression `border-left` + `paddingLeft` compensé → `padding: '6px 8px'` uniforme, couleurs `sectionText`/`sectionActive` identiques aux sections, hover `hoverBg` + `sectionHover`

---

## [2026-02-28] — Sidebar : réordonnancement, lisibilité et effets bloc main titres

**Type :** `feat`
**Fichiers concernés :** `src/components/Sidebar.tsx`

### Description
5 améliorations de la sidebar : ordre NAV, opacité texte, tailles, effet sélection bloc sur main titres, hover main titres.

### Détails techniques
- **Ordre NAV** : Référentiel déplacé en avant-dernière position (après Stock, avant Miel)
- **Opacités** : `normalText` 0.62→0.78, `sectionText` 0.38→0.62, `sectionActive` 0.68→0.95, `sectionHover` 0.58→0.88
- **Tailles** : sections 11→13px, sous-items 12.5→13px, dashboard 13→14px, emoji 12→13px
- **Effet bloc actif** : `backgroundColor: C.activeBg` sur le bouton de section quand `hasActive` (même style que sous-item actif)
- **Hover main titres** : `onMouseEnter` ajoute `backgroundColor: C.hoverBg` + couleur texte (avant : couleur texte seulement)
- **Transition** : `color 150ms` → `all 150ms` sur les boutons de section
- **fallback initialOpen** : `['referentiel']` → `[NAV[0].id]` (s'adapte à l'ordre)

---

## [2026-02-28] — Sidebar : hiérarchie visuelle — labels section vs sous-items

**Type :** `feat`
**Fichiers concernés :** `src/components/Sidebar.tsx`

### Description
Refonte visuelle v2 : correction du problème de hiérarchie (tout au même niveau). Les labels de section et les sous-items ont désormais des styles visuellement très distincts.

### Détails techniques
- **Section headers** : 11px, opacity 0.38, emoji opacity 0.38 → rôle de "label de catégorie" discret
- **Sous-items** : 12.5px, opacity 0.62 → éléments de navigation principaux
- **Item actif** : border-left 2px `#7DC87D` + bg `rgba(255,255,255,0.11)` + texte `#F3F8F3` → ressort clairement
- **Padding compensation** : `paddingLeft: 8px` actif vs `10px` inactif pour border-left sans décalage layout
- **Chevron SVG** : remplacement du caractère `▾` par un SVG path propre avec `strokeLinecap: round`
- **Hover section** : uniquement changement de couleur texte (pas de background), pour distinguer visuellement les labels des items
- **Hover items** : background `rgba(255,255,255,0.06)` + texte plus clair, 150ms
- **Espacement** : `marginTop: 10px` entre sections (6px pour la première), `space-y-px` entre sous-items

---

## [2026-02-28] — Sidebar : redesign SaaS premium (style Linear/Stripe)

**Type :** `feat`
**Fichiers concernés :** `src/components/Sidebar.tsx`

### Description
Refonte visuelle complète de la sidebar sans toucher à la structure ni à la logique. Objectif : rendu SaaS premium, sobre, lisible, avec hiérarchie visuelle claire.

### Détails techniques
- **Tokens de design** : objet `C` centralisé + constante `TRANSITION` pour cohérence
- **BrandHeader** : plus compact (py-[13px], icône 28px dans carré arrondi), style app SaaS
- **ActiveBar** : composant `<ActiveBar visible>` — barre 2px absolue gauche, transition opacity 150ms
- **Item actif** : barre verte `#7CC47C` + fond `rgba(255,255,255,0.09)` + texte `#EDF5EE` + fontWeight 500
- **Hover** : fond `rgba(255,255,255,0.05)` + texte plus clair, transition 150ms, jamais sur les items actifs
- **Sections ouvertes** : fond très subtil `rgba(255,255,255,0.04)` pour indiquer l'état open
- **Icônes** : opacity 0.55 inactif → 1 actif, uniformisées w-4 h-4
- **Sous-items** : `border-left 2px` avec compensation padding (pl 8→6px) + `rgba(124,196,124,0)` transparent → coloré pour transition CSS propre. Texte 12.5px vs 13px section
- **Séparateurs** : `height: 1px` au lieu de `border-top` pour éviter le doublement
- **Footer** : email plus discret (`#638064`), déconnexion avec icône opacity 0.45

---

## [2026-02-28] — Responsive mobile : MobileHeader + layout adaptatif dashboard

**Type :** `feat`
**Fichiers concernés :** `src/components/MobileHeader.tsx`, `src/app/(dashboard)/layout.tsx`, `src/app/(dashboard)/dashboard/page.tsx`

### Description
Correction de l'affichage mobile du dashboard sans impacter le layout desktop. La sidebar (w-60) était visible sur mobile, écrasant le contenu.

### Détails techniques
- **`MobileHeader.tsx`** : Nouveau composant client — barre top sticky vert sauge (h-14) avec brand SVG + bouton hamburger. Drawer latéral droit (w-72) avec la même navigation que la sidebar desktop (accordion, links actifs, déconnexion). Overlay fond sombre derrière le drawer.
- **`layout.tsx`** : Sidebar wrappée dans `<div className="hidden md:block">` → invisible sur mobile. `MobileHeader` monté dans `<div className="md:hidden">` à l'intérieur du `<main>`. Aucun changement pour desktop (≥ md).
- **`dashboard/page.tsx`** : Padding `p-4 md:p-8`, titre `text-xl md:text-2xl`, grille `grid-cols-2` (vs 1 colonne avant) sur mobile, gap réduit `gap-3 md:gap-4`, descriptions des cartes masquées sur mobile (`hidden sm:block`).

---

## [2026-02-28] — Sidebar : composant BrandHeader SVG (icône feuille + texte)

**Type :** `feat`
**Fichiers concernés :** `src/components/Sidebar.tsx`

### Description
Remplacement du composant `LogoSauge` par `BrandHeader` : icône SVG double-feuille dans un cercle + texte "Les Jardins / de la Sauge" aligné à droite. Design sobre sur fond vert sauge, sans PNG externe.

---

## [2026-02-28] — Sidebar : remplacement bloc logo par composant LogoSauge SVG

**Type :** `feat`
**Fichiers concernés :** `src/components/Sidebar.tsx`

### Description
Remplacement du bloc crème avec PNG par un composant `LogoSauge` : cercle SVG feuille + texte "Les Jardins de la Sauge" sur fond vert. Suppression de l'import `next/image` devenu inutile.

---

## [2026-02-28] — Sidebar : logo LJS en en-tête dans bloc crème agrandi

**Type :** `feat`
**Fichiers concernés :** `src/components/Sidebar.tsx`

### Description
Logo LJS replacé en en-tête de sidebar dans un bloc crème (#F9F8F6) arrondi, logo zoomé (160×80px). Suppression du bloc logo du bas.

---

## [2026-02-28] — Sidebar : logo LJS en bas dans bloc crème + nav remontée

**Type :** `feat`
**Fichiers concernés :** `src/components/Sidebar.tsx`

### Description
Suppression de l'en-tête avec emoji/texte. Navigation remontée en haut de la sidebar. Logo LJS placé dans un bloc crème (#F9F8F6) arrondi au-dessus de l'email en pied de sidebar.

### Détails techniques
- Bloc logo : `rounded-xl`, `backgroundColor: #F9F8F6`, dimensions 120×48px
- Dashboard link et nav démarrent dès le haut (pt-3 uniquement)

---

## [2026-02-28] — Page login : remplacement emoji/sous-titre par logo LJS

**Type :** `feat`
**Fichiers concernés :** `src/app/login/page.tsx`, `public/logo-ljs.png`

### Description
Remplacement de l'emoji 🌿 et du sous-titre "Traçabilité de la graine au produit fini" par le logo officiel LJS (PNG sans fond).

### Détails techniques
- Copie de `ressources/LJS Sans fond.png` → `public/logo-ljs.png`
- Utilisation du composant `next/image` (optimisation automatique)
- Dimensions : 200×120px, `priority` pour chargement immédiat (above the fold)

---

## [2026-02-28] — Favicon emoji 🌿

**Type :** `feat`
**Fichiers concernés :** `src/app/icon.tsx`, `src/app/favicon.ico` (supprimé)

### Description
Remplacement du favicon par défaut par l'emoji 🌿 via un composant Next.js `icon.tsx` utilisant `ImageResponse` (génération dynamique PNG 32×32). Suppression de l'ancien `favicon.ico`.

---

## [2026-02-28 22:00] — Fix datalist unités Matériaux : g et mL uniquement

**Type :** `fix`
**Fichiers concernés :** `src/components/referentiel/MaterielSlideOver.tsx`

### Description
Réduction du datalist des unités de mesure dans le slide-over Matériaux externes à g et mL uniquement (retrait de kg, L, pièce, sachet).

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
