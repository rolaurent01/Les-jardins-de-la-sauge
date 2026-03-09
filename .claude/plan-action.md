
# PLAN D'ACTION — Appli LJS

## Vue d'ensemble

**Objectif** : Application de traçabilité complète pour Les Jardins de la Sauge — de la graine au produit fini.
**Stack** : Next.js + Supabase + PWA offline → GitHub + Vercel

**Découpage en 2 grandes phases** :
- **PHASE A — Socle de données** : Toute la saisie fonctionne (bureau + mobile), le stock est juste, les données circulent. L'appli est utilisable au quotidien sur le terrain.
- **PHASE B — Vues & Analyse** : Exposition des données, tableaux de bord, graphiques, traçabilité, export. Développé dans un second temps avec Claude Code.

---

## Problèmes identifiés et anticipés

### 🔴 Risques critiques

1. **Mode offline mobile + sync**
   Le plus complexe du projet. Une PWA avec IndexedDB est la bonne approche vu le budget (gratuit), mais iOS Safari impose des limitations (50MB IndexedDB, purge possible). Mitigation : UUIDs générés côté client, sync idempotente (POST OK suffit), audit batch "Tout vérifier" comme filet de sécurité, archivage local 7 jours.

2. **Intégrité du stock event-sourced**
   Le stock est calculé, jamais stocké. Si un mouvement est oublié ou dupliqué, tout le stock est faux. Mitigation : mouvements de stock créés en **logique applicative** (routes API + transactions SQL, pas de triggers), plus facile à tracer et débugger. Tests d'intégration sur chaque flux de stock.

3. **Supabase gratuit — auto-pause + pas de backup**
   La base se désactive après 7 jours sans requête. Pas de backup automatique. Mitigation : cron Vercel quotidien keep-alive + cron backup quotidien (export JSON → repo GitHub privé).

4. **Adoption**
   L'app doit être si simple sur mobile que les 2-3 utilisateurs l'adoptent immédiatement. D'où l'importance d'une UX ultra-légère avec des grosses tuiles et un minimum de champs.

### 🟡 Risques modérés

5. **Harmonisation des rangs** : Le passage de "1a/1b/1c" à une numérotation séquentielle va demander une validation avec toi pour chaque parcelle.

6. **Recettes évolutives** : Le système de copie-modification de recette à chaque lot est plus souple mais impose une bonne UX pour ne pas perdre l'utilisateur.

7. **Soft delete** : Les tables critiques utilisent un soft delete (`deleted_at`). Toutes les requêtes doivent filtrer `WHERE deleted_at IS NULL`. Risque d'oubli → centraliser dans des vues SQL ou helpers.

8. **Isolation RLS multi-tenant** : La fonction `user_farm_ids()` est exécutée à chaque requête RLS. Risque de dégradation des performances si mal indexée. Mitigation : index sur `farm_access(user_id)`, `memberships(user_id)`, `farms(organization_id)` + `SECURITY DEFINER STABLE` sur la fonction pour permettre le cache de plan.

9. **Déduplication du catalogue variétés** : Le catalogue est partagé entre toutes les fermes. Risque de doublons si deux fermes créent "Menthe marocaine" et "menthe marocaine". Mitigation : contrainte UNIQUE insensible casse/accents sur `nom_vernaculaire` + recherche fuzzy à la création + outil de merge super admin.

10. **Migration SQL A0.9** : L'ajout de `farm_id NOT NULL` sur des tables existantes avec des données en base nécessite de bootstrapper l'organisation et la ferme LJS AVANT d'appliquer la contrainte NOT NULL. Mitigation : migration en 2 étapes (ajouter nullable → boostrap → passer NOT NULL).

---

# ═══════════════════════════════════════
# PHASE A — SOCLE DE DONNÉES
# ═══════════════════════════════════════

**Objectif** : toutes les données circulent, le stock est juste, l'appli est utilisable au quotidien (bureau + mobile).

**Organisation par les 5 ensembles métier** :
```
A0. Fondations + Référentiel
A1. 🌱 Semis
A2. 🌿 Suivi parcelle
A3. 🔄 Transformation
A4. 🧪 Création de produit
A5. 📦 Affinage du stock
A6. 📱 Mobile offline + Sync
A7. Polish Phase A
```

---

### A0 — Fondations + Référentiel
**Durée** : 2-3 jours

**Setup technique (1-2 jours)** :
- Projet Next.js initialisé (TypeScript, Tailwind, App Router)
- Projet Supabase créé, migrations SQL de toutes les tables (y compris `app_logs`, `stock_adjustments`)
- Déploiement Vercel configuré (auto-deploy depuis GitHub)
- Auth Supabase (2-3 comptes email/password)
- Crons Vercel : keep-alive Supabase + backup quotidien (export JSON → repo GitHub privé)
- Manifest PWA + Service Worker minimal
- Structure de l'arborescence projet
- Layout bureau : sidebar avec les 5 ensembles + ⚙️ Référentiel
- Setup Vitest pour les tests unitaires

**Référentiel (1-2 jours)** :
- CRUD Variétés avec recherche (nom vernaculaire, latin, famille, seuil alerte stock) + composant « Ajout rapide » réutilisable dans tous les formulaires contenant un sélecteur de variété
  - **`parties_utilisees`** : multi-select obligatoire (au moins 1 valeur), modifiable. Exemples : Menthe = [feuille], Calendula = [fleur, feuille], Fenouil = [feuille, graine], défaut = [plante_entiere]
- CRUD Sites → Parcelles → Rangs (architecture hiérarchique) — CRUD Rangs inclut `longueur_m` **et** `largeur_m` (dimensions du rang dans le référentiel)
- CRUD Matériaux externes (sel, sucre)
- Le référentiel sera saisi manuellement via l'interface (~70 variétés, quelques parcelles). Pas de migration Excel.

**Point de validation** : Vérifier que toutes les variétés sont bien nommées, les rangs bien numérotés, l'auth fonctionne, le déploiement Vercel est OK.

**Claude Code — Instruction** : Commencer par setup le projet avec toute l'infra. Ne pas coder de features tant que la base, l'auth, le backup et le déploiement ne marchent pas en production. Inclure le soft delete (`deleted_at`) sur les tables critiques dès le schéma initial.

---

### A0.9 — Migration multi-tenant
**Durée** : 2 jours
> ⚠️ **À exécuter MAINTENANT** (avant de continuer A2.4). Cette phase pose les fondations multi-tenant sur lesquelles tous les modules suivants seront développés nativement.

**Jour 1 — Migration SQL (`011_multitenant.sql`)** :
- Tables plateforme : `organizations`, `farms`, `memberships`, `farm_access`, `farm_modules`, `platform_admins`
- Tables catalogue partagé : `farm_variety_settings`, `farm_material_settings`
- Tables transversales : `notifications`, `audit_log`
- Colonnes `farm_id UUID REFERENCES farms(id)`, `created_by UUID`, `updated_by UUID` sur toutes les tables métier (ajout nullable d'abord, NOT NULL après bootstrap)
- Modifications `varieties` : ajout `created_by_farm_id`, `created_by`, `updated_by`, `verified`, `aliases`, `merged_into_id` — suppression `seuil_alerte_g` (déplacé vers `farm_variety_settings`)
- Contraintes UNIQUE composites avec `farm_id` : `seed_lots(farm_id, lot_interne)`, `production_lots(farm_id, numero_lot)`, `recipes(farm_id, nom)`, `parcels(farm_id, code)`, `forecasts(farm_id, ...)`, `production_summary(farm_id, ...)`
- Index `CREATE INDEX idx_[table]_farm ON [table](farm_id)` sur chaque table métier
- Fonction helper RLS : `user_farm_ids() RETURNS SETOF UUID` (SECURITY DEFINER STABLE)
- Nouvelles politiques RLS : catalogue partagé (SELECT/INSERT tous, UPDATE/DELETE créateur ou super admin), tables métier (`farm_id IN (SELECT user_farm_ids())`), tables plateforme, logs (super admin uniquement)
- Vue `v_stock` mise à jour avec `farm_id` dans SELECT et GROUP BY
- **Mise à jour des triggers `production_summary`** : les fonctions `_ps_upsert`, `fn_ps_harvests`, `fn_ps_cuttings`, `fn_ps_dryings`, `fn_ps_sortings`, `fn_ps_production_lot_ingredients`, `fn_ps_production_lots_time`, `fn_ps_direct_sales`, `fn_ps_purchases` doivent inclure `farm_id` dans la clause UPSERT (puisque la contrainte UNIQUE de `production_summary` inclut maintenant `farm_id`). La fonction `recalculate_production_summary()` doit aussi inclure `farm_id` dans le GROUP BY.
- **Bootstrap** : créer l'organisation "Les Jardins de la Sauge" + ferme "LJS" + membership pour les utilisateurs existants + passer `farm_id NOT NULL`
- Mettre à jour `supabase/types.ts` (regénérer les types TypeScript)

**Jour 2 — Code applicatif** :
- Helper `getContext()` dans `src/lib/context.ts` → retourne `{ userId, farmId, organizationId, orgSlug }` depuis le cookie `active_farm_id`
- Sélecteur de ferme dans le layout bureau (au-dessus de la sidebar, visible uniquement si ≥ 2 fermes accessibles)
- Refactoring des Server Actions existantes (A0, A1, A2.1, A2.2, A2.3) :
  - Ajout `.eq('farm_id', farmId)` sur tous les SELECT
  - Ajout `farm_id`, `created_by` sur tous les INSERT
  - Ajout `updated_by` sur tous les UPDATE
- Vérification que toutes les pages existantes fonctionnent avec la ferme LJS active
- **Restructuration du routing** : déplacer les routes `/(dashboard)/` sous `/[orgSlug]/(dashboard)/`. Créer le layout `[orgSlug]/layout.tsx` qui résout l'organisation par slug et injecte le branding (CSS variables `--color-primary`, `--color-primary-light`).
- **Migration des `revalidatePath`** : créer un helper `buildPath(slug, path)` et remplacer tous les `revalidatePath('/semis/sachets')` → `revalidatePath('/[orgSlug]/semis/sachets')` dans les Server Actions existantes.
- **Remplacement des couleurs hardcodées** : extraire les hex (#3A5A40, #588157) de la Sidebar, du MobileHeader et des composants existants vers les CSS variables (`var(--color-primary)`, `var(--color-primary-light)`).
- **Logo dynamique** : remplacer le SVG LJS hardcodé dans Sidebar.tsx et MobileHeader.tsx par un composant qui lit `organizations.logo_url` (avec fallback sur la première lettre de `nom_affiche`).
- **Création de `src/middleware.ts`** : middleware Next.js qui centralise l'authentification (`supabase.auth.getUser()`), vérifie l'existence de l'organisation (slug via `organizations WHERE slug = :slug`), vérifie l'appartenance de l'utilisateur à l'organisation, et redirige les non-authentifiés vers `/login`. Remplace les vérifications auth actuellement dispersées dans les layouts.

> Note : les étapes routing + branding ajoutent une demi-journée. Le total de A0.9 passe de 2 à 2-3 jours.

**Point de validation** : Toutes les pages existantes fonctionnent identiquement sous `/ljs/dashboard`. Le sélecteur de ferme est visible dans le layout. Les nouvelles saisies incluent `farm_id`. Les politiques RLS isolent correctement les données. Le branding LJS est affiché via CSS variables.

**Note pour la suite** : À partir de A2.4, tous les modules sont développés nativement multi-tenant. Le `farm_id`, `created_by`, `updated_by` sont inclus dans chaque nouvelle Server Action sans effort supplémentaire.

---

### A1 — 🌱 Semis
**Durée** : 2-3 jours
**Livrables** :
- Module Sachets de graines (`seed_lots`) : CRUD avec recherche par variété/fournisseur. Un sachet peut donner N semis.
- Module Suivi des semis (`seedlings`) : 2 processus
  - Mini-mottes : identifiées par N° de caisse (identifiant terrain "Caisse A"), nb_mottes, suivi pertes (mortes + données)
  - Caissette/godet : 2 étapes de perte tracées (mortes en caissette, mortes en godet, données)
- Calcul automatique des taux de perte (affiché, non stocké)
- Lien `seedlings.seed_lot_id` → traçabilité sachet → semis

**UX bureau** :
- Page "Sachets de graines" : tableau + slide-over pour nouveau/édition
- Page "Suivi semis" : tableau avec filtre par processus + slide-over adaptatif (champs différents selon mini-motte ou caissette/godet)

**Claude Code — Instruction** : Le formulaire de semis doit s'adapter au processus choisi (afficher les champs mini-motte OU caissette/godet, jamais les deux).

---

### A2 — 🌿 Suivi parcelle
**Durée** : 5-7 jours
**Livrables** :
- Module Travail de sol (`soil_works`) : par rang, type, temps
- Module Plantation (`plantings`) : lien vers semis d'origine **OU** fournisseur pour plants achetés, 1 semis → N rangs, 1 rang → N variétés possibles.
  - Dimensions pré-remplies depuis le rang (`longueur_m` et `largeur_m`), modifiables (ex : ne planter que sur 6m d'un rang de 10m, ou partager un rang entre 2 variétés)
  - Avertissement si la somme des `longueur_m` des plantings actifs dépasse la longueur du rang (informatif, pas de blocage)
  - Avertissement si plantation sur un rang déjà actif (pas de blocage, confirmation utilisateur)
  - Rendement calculable par variété × année : `rendement_kg_m2 = total_cueilli_g / surface_m2 / 1000`
- Module Suivi de rang (`row_care`) : désherbage, paillage, arrosage, avec **logique adaptative variété**
- Module Cueillette (`harvests`) : parcelle (avec logique adaptative) ou sauvage (texte libre avec autocomplétion)
  - **`partie_plante` obligatoire** : logique adaptative basée sur `varieties.parties_utilisees`. Si 1 seule valeur → auto-rempli. Si plusieurs → dropdown obligatoire. La partie est choisie ici et héritée dans toute la chaîne.
  - → La route API crée le stock_movement ENTRÉE frais (avec partie_plante) + met à jour production_summary (logique applicative, transaction SQL)
- Module Arrachage (`uprootings`) : avec logique adaptative, passe `plantings.actif = false`
- Module Occultation (`occultations`) : CRUD avec formulaire **adaptatif par méthode** (comme les 2 processus de semis)
  - Méthode paille : champs `fournisseur` + `attestation` (tous deux obligatoires/visibles)
  - Méthode foin : champ `fournisseur` uniquement
  - Méthode bâche : champ `temps_retrait_min` (affiché à la clôture de l'occultation)
  - Méthode engrais vert : `engrais_vert_nom` (autocomplétion sur valeurs existantes) + `engrais_vert_fournisseur` + `engrais_vert_facture` + `engrais_vert_certif_ab`
  - Avertissement à la plantation si le rang a une occultation active (`date_fin IS NULL`). Pas de blocage.

**Logique adaptative variété** (hook réutilisable `useRowVarieties(rowId)`) :
- Sélection du rang → requête `plantings WHERE row_id = X AND actif = true`
- 1 seule variété active → **auto-remplie** (95% des cas, zéro friction)
- Plusieurs variétés actives → **dropdown** pour choisir
- S'applique à : suivi de rang, cueillette, arrachage

**UX bureau** :
- Chaque module = tableau + filtres (année, parcelle, variété) + slide-over saisie
- Cueillette : slide-over adaptatif (parcelle vs sauvage — champs différents)
- Suivi rang multi-variétés : message "⚠️ Ce rang a 2 variétés actives" + bouton raccourci "+ Ajouter l'autre variété"

**Claude Code — Instruction** : La logique adaptative variété doit être un hook réutilisable partagé entre les 3 modules. Validation stricte côté client ET serveur. Toujours logguer le temps en minutes. Toutes les Server Actions incluent `farm_id`, `created_by`, `updated_by` nativement (via `getContext()`).

---

### A3 — 🔄 Transformation
**Durée** : 4-5 jours
**Livrables** :
- Les 3 modules ont **le même modèle** : entrées/sorties individuelles par variété avec date, poids, temps, état, **et partie_plante**
- Module Tronçonnage (`cuttings`) : entrée = `frais` (toujours) → sortie = `tronconnee`. **`partie_plante` hérité du stock frais en entrée, jamais re-saisi.**
- Module Séchage (`dryings`) : entrée = sélecteur `frais` | `tronconnee` → sortie = sélecteur `sechee` | `tronconnee_sechee`. **`partie_plante` hérité du stock en entrée.**
- Module Triage (`sortings`) : entrée = sélecteur `sechee` | `tronconnee_sechee` → sortie = sélecteur `sechee_triee` | `tronconnee_sechee_triee`. **`partie_plante` hérité du stock en entrée.**
- **6 états de stock cumulatifs** : les états portent l'historique des transformations
- **Logique applicative** : chaque route API crée les 2 stock_movements dans une transaction SQL (SORTIE état entrée + ENTRÉE état sortie). Pas de triggers pour les mouvements de stock.
- **Triggers uniquement pour `production_summary`** : mise à jour automatique des cumuls (avec fonction de recalcul admin en backup)

**UX bureau** :
- Même structure de page pour les 3 modules
- Deux boutons : [+ Entrée] et [+ Sortie] → slide-over avec sélecteurs d'état adaptés
- Tableau avec filtre Type (Entrée / Sortie / Tous) + badge coloré 🟢Entrée / 🔴Sortie

**Point de vigilance** — scénarios de test (~20% du temps de la phase) :
1. Flux complet : cueillette → tronçonnage → séchage (tronconnee→tronconnee_sechee) → triage (→tronconnee_sechee_triee) → vérifier les stocks sur les 3 dimensions (variété × partie × état)
2. Flux sans tronçonnage : cueillette → séchage (frais→sechee) → triage (→sechee_triee) → vérifier
3. Vérifier que `partie_plante` est bien hérité à chaque étape (tronçonnage, séchage, triage) depuis le stock en entrée
4. Vérifier que les transactions stock_movements ET les triggers production_summary fonctionnent en cascade
5. Tests unitaires Vitest : validation des états d'entrée/sortie, calcul des mouvements, héritage partie_plante

---

### A4 — 🧪 Création de produit
**Durée** : 4-5 jours
**Livrables** :
- Bibliothèque de recettes (`recipes` + `recipe_ingredients`) : CRUD avec composition en % + **état ET partie de stock par ingrédient plante**
  - Ex: Tisane → Menthe feuille `tronconnee_sechee_triee`, Calendula fleur `tronconnee_sechee_triee`
  - Ex: Sel Ail des ours → Ail des ours feuille `frais`, Sel = matériau externe (partie_plante = NULL)
- Catégories produits : Tisane, Aromate, Sel, Sucre, Vinaigre, Sirop
- **Wizard de production — 2 modes proposés au lancement** :

  **Mode "produit"** (wizard 4 étapes) :
  1. Choix recette + **nombre de sachets/pots** + date
  2. Ajuster composition (modifier %, changer une plante, **changer l'état d'un ingrédient**)
  3. Vérification stock **dans l'état ET la partie spécifiés** (variété × partie × état) + fournisseur obligatoire matériaux externes
  4. Confirmation → génération numéro de lot + DDM → déduction stock (`nb_unites` renseigné)

  **Mode "mélange"** (wizard 4 étapes adapté) :
  1. Choix recette + date — les % s'affichent comme guide
  2. Saisie des **poids réels par ingrédient** ; les % se recalculent automatiquement (informatif)
  3. Vérification stock (mêmes 3 dimensions) + fournisseur obligatoire matériaux externes
  4. Confirmation → génération numéro de lot + DDM → déduction stock (`nb_unites = NULL`)

  **Conditionnement** (action sur un lot existant en mode "mélange") :
  - Mise à jour de `nb_unites` sur le lot une fois les sachets/pots remplis
  - Accessible depuis la fiche du lot (bouton "Conditionner")

- Stock produits finis (`product_stock_movements`) : entrées/sorties de sachets

**UX bureau** :
- Page Recettes : tableau + slide-over avec tableau d'ingrédients éditable (%, variété, état)
- Page Production : tableau des lots + bouton [+ Produire un lot] → choix du mode → wizard pleine page
- Étape 3 du wizard : indicateurs ✅/⚠️ par ingrédient (stock suffisant ou pas)
- Lots en mode "mélange" sans `nb_unites` : badge "À conditionner" + bouton dédié

**Claude Code — Instruction** : Le workflow de production est LE moment critique pour le stock. Utiliser une transaction SQL. Le lot ne peut être validé que si le stock est suffisant pour CHAQUE ingrédient dans SA variété, SA partie ET SON état (les 3 dimensions). Vérifier `mode` pour adapter les calculs (`nb_unites × poids_sachet` en mode produit, somme des poids saisis en mode mélange). Toutes les Server Actions incluent `farm_id`, `created_by`, `updated_by` nativement (via `getContext()`). La numérotation des lots est scopée par `farm_id`.

---

### A5 — 📦 Affinage du stock
**Durée** : 2-3 jours
**Livrables** :
- Module Achats externes (`stock_purchases`) : entrée de plantes à tout état, fournisseur, certif AB, prix optionnel
  - → Route API crée le stock_movement ENTRÉE (logique applicative, transaction SQL)
- Module Ventes directes (`stock_direct_sales`) : sortie sans recette à tout état, destinataire optionnel
  - → Vérification stock suffisant + stock_movement SORTIE
- Module Ajustements manuels (`stock_adjustments`) : corrections d'inventaire (entrée ou sortie), **motif obligatoire**
  - → Route API crée le stock_movement correspondant

**UX bureau** :
- Chaque module = tableau + filtres + slide-over
- Ventes directes : le slide-over affiche le stock disponible dans l'état choisi en temps réel

---

### A6 — 📱 Mobile PWA Offline + Sync
**Durée** : 5-7 jours

Le mobile est UN TERMINAL DE SAISIE TERRAIN. Le protocole de sync garantit ZÉRO PERTE DE DONNÉES.

**Séquençage en 10 sous-phases :**

| Phase | Contenu | Dépendances |
|-------|---------|-------------|
| A6.1 | PWA Infrastructure (Serwist + manifest + useOnlineStatus) | — |
| A6.2 | IndexedDB schema + cache de référence (Dexie.js, scopé farm_id, filtrage variétés server-side) | A6.1 |
| A6.3 | API endpoints sync (POST /api/sync + POST /api/sync/audit avec pagination 200) | — |
| A6.4 | Moteur de sync client (cycle pending→synced, retry 30s, max 5 tentatives, archivage 7j, purge auto 80%) | A6.1, A6.2, A6.3 |
| A6.5 | Layout mobile + navigation tuiles + détection device (proxy User-Agent + lien bascule) | A6.2 |
| A6.6a | Formulaires mobiles : Semis (sachet, suivi semis) | A6.4, A6.5 |
| A6.6b | Formulaires mobiles : Parcelle (travail sol, plantation, suivi rang, cueillette, arrachage, occultation) | A6.4, A6.5 |
| A6.6c | Formulaires mobiles : Transfo + Stock + Produits (tronçonnage, séchage, triage, achat, vente, production lot) | A6.4, A6.5 |
| A6.7 | UI sync (barre permanente, boutons, audit visuel, indicateur stockage, timer chronomètre) | A6.4, A6.6* |
| A6.8 | Tests + polish + checklist E2E (mode avion → saisie → sync → audit) | Tout |

**Décisions techniques A6 :**
- Auth offline : session Supabase 30 jours, pas de fallback local
- Service Worker : Serwist (précache auto, pas de SW custom)
- Détection mobile : User-Agent au login dans le proxy + lien bascule
- Stockage : indicateur volume + purge auto archives à 80% du quota
- Cache variétés : filtrage server-side (hidden + merged + deleted exclus)
- Audit batch : paginé par lots de 200
- Multi-tenant : farm_id dans chaque payload, validé server-side, cache scopé par ferme

**Claude Code — Instruction** : Mobile le plus LÉGER possible. Validations Zod partagées. L'objectif est ZÉRO PERTE DE DONNÉES. Cache IndexedDB scopé par ferme active — au switch de ferme, le cache est rechargé entièrement. Le payload de sync inclut `farm_id` dans chaque enregistrement, validé côté serveur. Toutes les Server Actions de sync incluent `farm_id`, `created_by`, `updated_by` nativement.

---

### A7 — Polish Phase A
**Durée** : 2-3 jours
- Tests des flux de bout en bout (bureau + mobile)
- Correction bugs, optimisation (index SQL, cache)
- UX finale (transitions, confirmations)
- Vérification triggers (production_summary) + test de la fonction `recalculate_production_summary()`
- **Clôture de saison** : bouton admin "Clôturer la saison [année]" — confirmation rang par rang des vivaces, arrachage auto des annuelles non clôturées
- **Espace admin** : accès au recalcul production_summary, consultation des logs (`app_logs`), vérification backup
- **Page "Mes variétés"** : page bureau Référentiel → Mes variétés. Checkboxes pour sélectionner les variétés actives de la ferme. Impact direct sur le cache mobile (seules les variétés non masquées sont chargées).

**✅ Critère de fin Phase A** : tu vas au terrain avec ton téléphone, tu saisis toutes tes opérations, tu synchronises le soir, et les données sont justes. Le stock reflète la réalité. L'appli est utilisable au quotidien.

---

# ═══════════════════════════════════════
# PHASE B — VUES & ANALYSE (second temps)
# ═══════════════════════════════════════

**Objectif** : exploiter les données collectées en Phase A. Toutes les données sont déjà en base — Phase B ne fait que les exposer.

**Prérequis** : Phase A terminée et validée.
**Les phases B sont indépendantes entre elles** — on peut les faire dans l'ordre qu'on veut selon les priorités.

---

### B1 — 📊 Vue Stock
**Durée** : 2-3 jours
- Page dédiée `/stock`
- Tableau temps réel : variété × 6 états cumulatifs + colonne total
- Alertes stock bas (seuil par variété)
- Graphique barres empilées par état
- Filtres + export CSV/XLSX

---

### B2 — 📈 Vue Production totale
**Durée** : 3-4 jours
- Page dédiée `/production-totale`
- Tableau cumuls depuis `production_summary` (déjà alimentée par triggers Phase A)
- Colonnes : cueilli, tronçonné, séché, trié, produit, vendu, acheté, temps total
- Colonne prévisionnel + **barres d'avancement** (cueilli / prévu)
- Détail temps de travail par étape au clic
- Graphique barres empilées par variété
- Ligne de totaux + filtres + export

---

### B3 — 🏠 Dashboard
**Durée** : 2-3 jours
- Page d'accueil `/dashboard`
- Widgets résumé :
  - 🗺️ Vue Parcelles (plan visuel rangs)
  - 📦 Aperçu stocks → lien Vue Stock
  - 📈 Aperçu production → lien Vue Production
  - ⏱️ Temps de travail récent

---

### B4 — 🔍 Traçabilité + Prévisionnel
**Durée** : 2-3 jours
- Traçabilité : recherche lot → remontée complète (lot → ingrédients → cueillette → rang → semis → graine)
- Prévisionnel (`forecasts`) : saisie objectifs annuels + barres d'avancement

---

### B5 — Export & Polish final
**Durée** : 1-2 jours
- Export CSV/XLSX sur toutes les vues
- Documentation utilisateur (1 page)
- Optimisation performances des vues

---

### B6 — Interface super admin
**Durée** : 2-3 jours
- Route `/admin` séparée du dashboard classique (accès `platform_admins` uniquement)
- **Gestion plateforme** : liste des organisations, fermes, utilisateurs, memberships
- **Outil de merge de variétés** : fusionner un doublon vers une variété cible (UPDATE toutes les FK + soft delete + log audit)
- **Consultation logs** : lecture de `app_logs` avec filtres (niveau, source, date)
- **Super data cross-tenant** : requêtes d'agrégation via `service_role` (stock total plateforme, activité par organisation, variétés les plus utilisées) — pas de table dédiée, requêtes à la volée
- **Impersonation** : se connecter "en tant que" une ferme (cookie `impersonate_farm_id`) avec bandeau rouge visible dans tout l'UI. Permet de voir exactement ce que le client voit pour le support.
- **Gestion `farm_modules`** : activer/désactiver les modules par ferme
- **Branding client** : upload du logo (Supabase Storage bucket `org-logos`), configuration `couleur_primaire` / `couleur_secondaire` / `nom_affiche`, prévisualisation du rendu en temps réel

---

## Résumé visuel

```
═══ PHASE A — SOCLE DE DONNÉES ═══════════════════════════════════════

A0    ████████                    Fondations + Référentiel
A0.9  ████████  ← MAINTENANT     Migration multi-tenant (2j)
A1    ████████                    🌱 Semis
A2    ██████████████████          🌿 Suivi parcelle (A2.4 → A2.8)
A3    ████████████████            🔄 Transformation
A4    ████████████████            🧪 Création de produit
A5    ████████                    📦 Affinage du stock
A6    ██████████████████          📱 Mobile offline + Sync
A7    ████████                    Polish + Tests + Clôture saison

→ L'APPLI EST UTILISABLE AU QUOTIDIEN ✅

═══ PHASE B — VUES & ANALYSE (second temps, avec Claude Code) ════════

B1  ████████                      📊 Vue Stock
B2  ██████████████                📈 Vue Production totale
B3  ████████                      🏠 Dashboard
B4  ████████                      🔍 Traçabilité + Prévisionnel
B5  ████                          Export + Polish final
B6  ████████                      🔧 Interface super admin
```

**Durée estimée** :
- Phase A : ~24-35 jours (A0.9 ajoutée)
- Phase B : ~12-18 jours (B6 ajoutée)
- **Phase C (Miel) : à définir après stabilisation A+B**
- Total A+B : ~35-50 jours

---

## PHASE C — Module Miel (temps 3)

**Prérequis** : Phases A et B stables, application utilisée au quotidien.

Module autonome dans le même projet, avec des tables entièrement séparées des tables PAM. Partagé : auth, PWA, sync offline, charte graphique, sidebar. Séparé : tout le reste (schéma, workflow, vues). Le schéma Miel sera conçu intégralement en Phase C.

Le module Miel est **activable par ferme** via `farm_modules (module = 'apiculture')`. La sidebar n'affiche les sections apiculture que si le module est actif pour la ferme courante. Toutes les tables miel auront `farm_id`, `created_by`, `updated_by` dès leur création (nativement multi-tenant depuis A0.9).

---

## Comment utiliser ces documents avec Claude Code

1. Copier `context.md`, `plan-action.md` et `consignes.md` à la racine du projet
2. Donner à Claude Code les instructions phase par phase
3. Exemple de prompt pour Phase A0 :
   > "Lis context.md et plan-action.md. Implémente A0 : setup le projet Next.js, configure Supabase avec toutes les tables (y compris soft delete et app_logs), configure l'auth, les crons (keep-alive + backup), et déploie sur Vercel."
4. Valider chaque phase avant de passer à la suivante
5. **Phase B peut être priorisée** : commencer par B1 (Vue Stock) si c'est le plus urgent, ou B4 (Traçabilité) si tu as un contrôle qualité à passer
6. **Phase C (Miel)** : ne pas commencer avant que A+B soient stables. L'architecture est prête, il suffira de créer les tables spécifiques apicoles.
