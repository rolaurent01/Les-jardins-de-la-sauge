
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
- CRUD Sites → Parcelles → Rangs (architecture hiérarchique)
- CRUD Matériaux externes (sel, sucre)
- Le référentiel sera saisi manuellement via l'interface (~70 variétés, quelques parcelles). Pas de migration Excel.

**Point de validation** : Vérifier que toutes les variétés sont bien nommées, les rangs bien numérotés, l'auth fonctionne, le déploiement Vercel est OK.

**Claude Code — Instruction** : Commencer par setup le projet avec toute l'infra. Ne pas coder de features tant que la base, l'auth, le backup et le déploiement ne marchent pas en production. Inclure le soft delete (`deleted_at`) sur les tables critiques dès le schéma initial.

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
- Module Plantation (`plantings`) : lien vers semis d'origine **OU** fournisseur pour plants achetés, 1 semis → N rangs, 1 rang → N variétés possibles
- Module Suivi de rang (`row_care`) : désherbage, paillage, arrosage, avec **logique adaptative variété**
- Module Cueillette (`harvests`) : parcelle (avec logique adaptative) ou sauvage (texte libre avec autocomplétion)
  - **`partie_plante` obligatoire** : logique adaptative basée sur `varieties.parties_utilisees`. Si 1 seule valeur → auto-rempli. Si plusieurs → dropdown obligatoire. La partie est choisie ici et héritée dans toute la chaîne.
  - → La route API crée le stock_movement ENTRÉE frais (avec partie_plante) + met à jour production_summary (logique applicative, transaction SQL)
- Module Arrachage (`uprootings`) : avec logique adaptative, passe `plantings.actif = false`

**Logique adaptative variété** (hook réutilisable `useRowVarieties(rowId)`) :
- Sélection du rang → requête `plantings WHERE row_id = X AND actif = true`
- 1 seule variété active → **auto-remplie** (95% des cas, zéro friction)
- Plusieurs variétés actives → **dropdown** pour choisir
- S'applique à : suivi de rang, cueillette, arrachage

**UX bureau** :
- Chaque module = tableau + filtres (année, parcelle, variété) + slide-over saisie
- Cueillette : slide-over adaptatif (parcelle vs sauvage — champs différents)
- Suivi rang multi-variétés : message "⚠️ Ce rang a 2 variétés actives" + bouton raccourci "+ Ajouter l'autre variété"

**Claude Code — Instruction** : La logique adaptative variété doit être un hook réutilisable partagé entre les 3 modules. Validation stricte côté client ET serveur. Toujours logguer le temps en minutes.

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
- Workflow de production de lot — **wizard 4 étapes** :
  1. Choix recette + nombre de sachets/pots + date
  2. Ajuster composition (modifier %, changer une plante, **changer l'état d'un ingrédient**)
  3. Vérification stock **dans l'état ET la partie spécifiés pour chaque ingrédient** (les 3 dimensions : variété × partie × état) + **fournisseur obligatoire pour les matériaux externes**
  4. Confirmation → génération numéro de lot + DDM → déduction stock
- Stock produits finis (`product_stock_movements`) : entrées/sorties de sachets

**UX bureau** :
- Page Recettes : tableau + slide-over avec tableau d'ingrédients éditable (%, variété, état)
- Page Production : tableau des lots + bouton [+ Produire un lot] → wizard pleine page (4 étapes)
- Étape 3 du wizard : indicateurs ✅/⚠️ par ingrédient (stock suffisant ou pas)

**Claude Code — Instruction** : Le workflow de production est LE moment critique pour le stock. Utiliser une transaction SQL. Le lot ne peut être validé que si le stock est suffisant pour CHAQUE ingrédient dans SA variété, SA partie ET SON état (les 3 dimensions).

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

### A6 — 📱 Mobile PWA Offline (terminal de saisie terrain)
**Durée** : 5-7 jours

Le mobile est UN TERMINAL DE SAISIE TERRAIN. Pas de consultation, pas de dashboard, pas de tableaux. 3 écrans max : choix d'action → formulaire → confirmation.

**Livrables** :
- Service Worker : cache des pages et assets pour fonctionnement offline
- IndexedDB (via Dexie.js) :
  - Cache des données de référence (variétés, parcelles, rangs) pour pré-remplir les sélecteurs
  - Table `sync_queue` : file d'attente des saisies
- UI mobile **ultra-légère** :
  - Écran d'accueil = 5 tuiles correspondant aux 5 ensembles :
    ```
    🌱 Semis       🌿 Parcelle
    🔄 Transfo     📦 Stock
    🧪 Produits
    ```
  - Tap sur un ensemble → sous-actions
  - Tap sur une sous-action → formulaire minimaliste → Enregistrer → "✅" → retour
  - Barre de sync permanente + bouton "Forcer la synchronisation"
  - Timer start/stop optionnel pour mesurer le temps de travail
  - **AUCUNE page de consultation**
- **PROTOCOLE SYNC ZÉRO PERTE** (détail dans context.md section 3.2) :
  - UUID client généré localement pour chaque saisie
  - Cycle simplifié : pending → syncing → synced (POST OK suffit) → archivé 7j → supprimé
  - Idempotence serveur (ON CONFLICT DO NOTHING)
  - Retry auto 30s, max 5 tentatives
  - Archivage 7 jours post-sync
- **Audit "Tout vérifier"** 🔍 : vérification batch mobile↔serveur (remplace le GET verify unitaire)
- Endpoints : POST /api/sync, POST /api/sync/audit
- **Pas de création de variété en offline** : message "notez en commentaire, ajoutez au retour"
- Logs client IndexedDB pour diagnostic terrain
- Tests CRITIQUES (~20% du temps) : mode avion, coupure pendant envoi, audit, idempotence, perte serveur simulée

**Claude Code — Instruction** : Mobile le plus LÉGER possible. Validations Zod partagées. L'objectif est ZÉRO PERTE DE DONNÉES.

---

### A7 — Polish Phase A
**Durée** : 2-3 jours
- Tests des flux de bout en bout (bureau + mobile)
- Correction bugs, optimisation (index SQL, cache)
- UX finale (transitions, confirmations)
- Vérification triggers (production_summary) + test de la fonction `recalculate_production_summary()`
- **Clôture de saison** : bouton admin "Clôturer la saison [année]" — confirmation rang par rang des vivaces, arrachage auto des annuelles non clôturées
- **Espace admin** : accès au recalcul production_summary, consultation des logs (`app_logs`), vérification backup

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

## Résumé visuel

```
═══ PHASE A — SOCLE DE DONNÉES ═══════════════════════════════════════

A0  ████████                      Fondations + Référentiel
A1  ████████                      🌱 Semis
A2  ██████████████████            🌿 Suivi parcelle
A3  ████████████████              🔄 Transformation
A4  ████████████████              🧪 Création de produit
A5  ████████                      📦 Affinage du stock
A6  ██████████████████            📱 Mobile offline + Sync
A7  ████████                      Polish + Tests + Clôture saison

→ L'APPLI EST UTILISABLE AU QUOTIDIEN ✅

═══ PHASE B — VUES & ANALYSE (second temps, avec Claude Code) ════════

B1  ████████                      📊 Vue Stock
B2  ██████████████                📈 Vue Production totale
B3  ████████                      🏠 Dashboard
B4  ████████                      🔍 Traçabilité + Prévisionnel
B5  ████                          Export + Polish final
```

**Durée estimée** :
- Phase A : ~22-33 jours
- Phase B : ~10-15 jours
- **Phase C (Miel) : à définir après stabilisation A+B**
- Total A+B : ~30-45 jours

---

## PHASE C — Module Miel (temps 3)

**Prérequis** : Phases A et B stables, application utilisée au quotidien.

Module autonome dans le même projet, avec des tables entièrement séparées des tables PAM. Partagé : auth, PWA, sync offline, charte graphique, sidebar. Séparé : tout le reste (schéma, workflow, vues). Le schéma Miel sera conçu intégralement en Phase C.

---

## Comment utiliser ces documents avec Claude Code

1. Copier `context.md`, `plan-action.md` et `consignes.md` à la racine du projet
2. Donner à Claude Code les instructions phase par phase
3. Exemple de prompt pour Phase A0 :
   > "Lis context.md et plan-action.md. Implémente A0 : setup le projet Next.js, configure Supabase avec toutes les tables (y compris soft delete et app_logs), configure l'auth, les crons (keep-alive + backup), et déploie sur Vercel."
4. Valider chaque phase avant de passer à la suivante
5. **Phase B peut être priorisée** : commencer par B1 (Vue Stock) si c'est le plus urgent, ou B4 (Traçabilité) si tu as un contrôle qualité à passer
6. **Phase C (Miel)** : ne pas commencer avant que A+B soient stables. L'architecture est prête, il suffira de créer les tables spécifiques apicoles.
