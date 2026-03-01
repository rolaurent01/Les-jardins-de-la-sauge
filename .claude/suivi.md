# Suivi des actions — Appli LJS

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
