# Suivi des actions — Appli LJS

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
