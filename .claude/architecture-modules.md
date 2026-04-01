# Architecture Multi-Modules — Spécification technique

> Document de réflexion — à challenger avant implémentation.
> Date : 2026-03-21

---

## 1. État actuel

### Ce qui existe

| Couche | État | Détail |
|--------|------|--------|
| Table `farm_modules` | ✅ En base | CHECK `('pam', 'apiculture', 'maraichage')`, UNIQUE(farm_id, module) |
| Admin toggle | ✅ Fonctionnel | `FermesClient.tsx` — 3 boutons PAM/Apiculture/Maraîchage par ferme |
| Bootstrap LJS | ✅ | INSERT `pam` pour la ferme LJS |
| Backup | ✅ | `farm_modules` exporté dans le backup GitHub |
| Type TS | ✅ | `FarmModule = 'pam' \| 'apiculture' \| 'maraichage'` |

### Ce qui n'existe PAS

| Couche | Problème |
|--------|----------|
| Sidebar desktop | 7 sections PAM affichées en dur, aucun filtrage par module |
| Navigation mobile | 6 sections en dur dans `MobileHeader.tsx` |
| Grille saisie mobile | 5 tuiles en dur dans `/m/saisie/page.tsx` |
| Routes desktop | Aucun guard — toutes les pages PAM accessibles même si module désactivé |
| Routes mobile | 36 URLs précachées en dur dans `mobile-routes.ts` |
| AppContext | Ne contient pas les modules actifs (userId, farmId, orgSlug, certifBio — c'est tout) |
| Sync dispatch | Aucune vérification du module avant d'accepter une entrée sync |
| Cache offline | Les modules actifs ne sont pas chargés dans IndexedDB |
| Dashboard | Pas de filtrage des widgets par module |

**Résumé** : le système de modules est câblé à 30% (base + admin). Il n'a aucun effet en aval — activer ou désactiver un module ne change rien dans l'application.

---

## 2. Objectif

Faire de PAM un module conditionnel au même titre qu'Apiculture et Maraîchage. Une ferme peut activer n'importe quelle combinaison de modules. L'interface s'adapte : navigation, formulaires, saisie mobile, sync, cache offline.

**Exemples de configurations possibles :**
- Ferme A : PAM uniquement (état actuel LJS)
- Ferme B : Apiculture uniquement
- Ferme C : PAM + Maraîchage
- Ferme D : PAM + Apiculture + Maraîchage

---

## 3. Décisions de design

### 3.1 Modules actifs = source de vérité unique

`farm_modules` reste la source de vérité. On ne duplique pas cette info ailleurs. On la **propage** via le contexte applicatif.

### 3.2 AppContext étendu

Actuellement :
```typescript
type AppContext = {
  userId: string
  farmId: string
  organizationId: string
  orgSlug: string
  certifBio: boolean
  isImpersonating: boolean
}
```

Après modification :
```typescript
type AppContext = {
  userId: string
  farmId: string
  organizationId: string
  orgSlug: string
  certifBio: boolean
  isImpersonating: boolean
  activeModules: FarmModule[]  // ← AJOUT
}
```

`getContext()` dans `context.ts` fera un SELECT supplémentaire sur `farm_modules` pour la ferme courante. Ce SELECT est léger (1-3 rows max, indexé sur farm_id).

### 3.3 Mapping module → sections navigation

Chaque module "possède" des sections de navigation. Ce mapping est une constante, pas une donnée en base.

```typescript
const MODULE_SECTIONS: Record<FarmModule, string[]> = {
  pam: ['semis', 'parcelles', 'transformation', 'produits', 'stock'],
  apiculture: ['apiculture'],      // à définir quand le module existe
  maraichage: ['maraichage'],       // à définir quand le module existe
}

// Sections transverses — toujours visibles
const ALWAYS_VISIBLE = ['referentiel', 'analyse', 'dashboard']
```

**Question ouverte** : le Référentiel (variétés, sites, parcelles, matériaux) est-il toujours visible, ou seulement si PAM ou Maraîchage est actif ? Les sites/parcelles pourraient servir au maraîchage aussi. À trancher avec les clients.

### 3.4 Mapping module → tables sync

Même principe pour le dispatch offline :

```typescript
const MODULE_TABLES: Record<FarmModule, string[]> = {
  pam: [
    'seed_lots', 'seedlings', 'soil_works', 'plantings', 'row_care',
    'harvests', 'uprootings', 'occultations', 'cuttings', 'dryings',
    'sortings', 'production_lots', 'stock_purchases', 'stock_direct_sales',
    'stock_adjustments',
  ],
  apiculture: [
    // tables api_* à définir
  ],
  maraichage: [
    // tables veg_* à définir
  ],
}
```

---

## 4. Modifications par couche

### 4.1 `context.ts` — Ajouter `activeModules`

- Requêter `farm_modules` dans `getContext()`
- Retourner `activeModules: FarmModule[]`
- Coût : +1 SELECT léger par appel server action

**Alternative** : mettre les modules dans un cookie/header au moment du login ou du switch de ferme, pour éviter le SELECT à chaque action. Mais ça ajoute de la complexité de sync cookie/base. Le SELECT est probablement acceptable vu le nombre d'utilisateurs (2-3).

### 4.2 Sidebar desktop — Filtrage conditionnel

**Fichier** : `Sidebar.tsx`

Actuellement le tableau `NAV` est une constante. Deux approches :

**Approche A — Filtrage côté rendu** (recommandée) :
- `NAV` reste complet (toutes les sections de tous les modules)
- Chaque section porte un tag `module: FarmModule | null` (null = toujours visible)
- Le composant filtre `NAV.filter(s => s.module === null || activeModules.includes(s.module))`
- Avantage : un seul tableau, facile à maintenir

**Approche B — NAV dynamique** :
- Chaque module exporte son propre tableau de sections
- Le Sidebar concatène les tableaux des modules actifs
- Avantage : isolation totale entre modules
- Inconvénient : plus complexe, ordre des sections à gérer

**Recommandation** : Approche A pour commencer. Passer en B si les modules deviennent nombreux ou si des plugins externes sont envisagés.

### 4.3 MobileHeader — Même logique

**Fichier** : `MobileHeader.tsx`

Même approche que Sidebar : tag `module` sur chaque entrée NAV, filtrage par `activeModules`.

### 4.4 Grille saisie mobile — Tuiles conditionnelles

**Fichier** : `/m/saisie/page.tsx`

Le tableau `TILES` devient :
```typescript
const TILES = [
  { id: 'semis',     label: 'Semis',     emoji: '🌱', module: 'pam' },
  { id: 'parcelle',  label: 'Parcelle',  emoji: '🌿', module: 'pam' },
  { id: 'transfo',   label: 'Transfo',   emoji: '🔄', module: 'pam' },
  { id: 'stock',     label: 'Stock',     emoji: '📦', module: 'pam' },
  { id: 'produits',  label: 'Produits',  emoji: '🧪', module: 'pam' },
  // Futures tuiles apiculture/maraîchage
]
```

Filtré par les modules actifs côté rendu.

**Problème** : cette page est un client component qui tourne offline. Comment connaître les modules actifs sans connexion ?

### 4.5 Modules actifs en cache offline

**Fichier** : `cache-loader.ts` + `db.ts`

Il faut stocker les modules actifs dans IndexedDB pour que le mobile offline sache quoi afficher.

- Ajouter une table Dexie `farmModules` (ou un simple store key-value)
- Le `loadReferenceData()` charge aussi `farm_modules` pour la ferme
- L'API `/api/offline/reference-data` retourne les modules actifs en plus des données de référence
- Les composants mobile lisent `useCachedModules()` au lieu de constantes en dur

### 4.6 Routes desktop — Guard par module

**Nouveau helper** : `requireModule(module: FarmModule)`

```typescript
export async function requireModule(module: FarmModule) {
  const { activeModules, orgSlug } = await getContext()
  if (!activeModules.includes(module)) {
    redirect(`/${orgSlug}/dashboard`)
  }
}
```

**Où l'appliquer** :
- Chaque `page.tsx` PAM appelle `await requireModule('pam')` en première ligne
- Idem pour les futures pages apiculture/maraîchage
- Les pages transverses (dashboard, admin, référentiel) n'ont pas de guard

**Impact** : modifier ~25 fichiers `page.tsx` existants pour ajouter l'appel. C'est mécanique mais volumineux.

**Alternative** : un middleware Next.js qui inspecte le path et bloque si le module n'est pas actif. Moins de fichiers à toucher mais plus opaque et nécessite de lire les modules dans le middleware (cookies ou requête Supabase).

### 4.7 Sync dispatch — Validation module

**Fichier** : `dispatch.ts`

Avant de router une entrée, vérifier que la `table_cible` appartient à un module actif pour la ferme. Si le module est désactivé → rejet avec erreur explicite.

```typescript
// En début de dispatch
const farmModules = await getFarmModules(farmId)
const requiredModule = TABLE_TO_MODULE[table_cible]
if (requiredModule && !farmModules.includes(requiredModule)) {
  return { error: `Module ${requiredModule} non activé pour cette ferme` }
}
```

**Objectif** : empêcher la création de données pour un module désactivé, même via sync mobile.

### 4.8 Routes mobile précachées — Dynamiques

**Fichier** : `mobile-routes.ts`

Actuellement 36 URLs en dur. Il faut les rendre conditionnelles :
- Soit les routes portent un tag module et sont filtrées au moment du précache
- Soit on précache tout (les pages existent, elles afficheront juste un message "module non activé")

**Recommandation** : précacher tout. Le coût est négligeable (quelques KB de HTML). Les pages non-accessibles affichent un message au lieu de planter.

### 4.9 Dashboard — Widgets conditionnels

Les widgets du dashboard (Stock, Production, Parcelles, etc.) sont liés au PAM. Si PAM est désactivé, ces widgets n'ont pas de sens.

- Chaque widget porte un tag `module`
- Le dashboard ne rend que les widgets des modules actifs
- Chaque module pourra ajouter ses propres widgets

### 4.10 Backup — Déjà OK

`farm_modules` est déjà exporté. Les tables métier futures (api_*, veg_*) devront être ajoutées au backup quand elles existeront.

---

## 5. Tables partagées entre modules

### 5.1 Décision clé : topologie (sites/parcelles/rangs)

**Option A — Partagé** : une même parcelle peut accueillir du PAM et du maraîchage. Les tables `sites`, `parcels`, `rows` ne portent pas de notion de module.

- Avantage : pas de duplication si la ferme cultive PAM et légumes sur les mêmes rangs
- Inconvénient : la section Référentiel > Sites/Parcelles doit être visible dès qu'au moins un module "terrain" est actif (PAM ou Maraîchage)
- Inconvénient : les filtres dans les formulaires doivent potentiellement distinguer "rangs PAM" vs "rangs maraîchage"

**Option B — Séparé** : chaque module a sa propre topologie (veg_sites, veg_parcels, veg_rows).

- Avantage : isolation totale, pas d'ambiguïté
- Inconvénient : duplication si les mêmes parcelles physiques sont utilisées
- Inconvénient : l'utilisateur doit maintenir deux fois la même parcelle

**Recommandation** : Option A (partagé). C'est la réalité terrain — une parcelle est un lieu physique, pas un concept lié à un module. La distinction se fait au niveau de la **plantation** (planting PAM vs planting maraîchage), pas de la parcelle.

### 5.2 Variétés — Partagé avec filtre

Les variétés PAM (menthe, lavande...) et maraîchères (tomate, carotte...) sont des plantes. Elles peuvent cohabiter dans le même catalogue `varieties`.

**Options** :
- Ajouter `module TEXT DEFAULT 'pam'` sur `varieties` pour filtrer dans les dropdowns
- Ou utiliser `farm_variety_settings` avec un tag module pour la personnalisation par ferme

**À trancher avec le client** : est-ce que certaines plantes sont à la fois PAM et maraîchage ? (ex: basilic)

### 5.3 Matériaux externes — Probablement partagé

Sel, sucre, etc. sont utilisés en PAM. Le miel pourrait avoir ses propres matériaux (bocaux, étiquettes). Les légumes aussi (cagettes, emballages).

Le catalogue `external_materials` peut rester partagé, avec un éventuel tag module pour filtrer.

---

## 6. Tables séparées entre modules

Chaque module a ses propres tables métier. Convention de nommage par préfixe :

| Module | Préfixe | Exemples |
|--------|---------|----------|
| PAM | (aucun — historique) | `seed_lots`, `harvests`, `cuttings`, `production_lots` |
| Apiculture | `api_` | `api_apiaries`, `api_hives`, `api_inspections` |
| Maraîchage | `veg_` | `veg_harvests`, `veg_sales`, `veg_successions` |

Chaque table suit le pattern existant :
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `farm_id UUID NOT NULL REFERENCES farms(id)`
- `uuid_client UUID` (sync mobile)
- `created_by UUID`, `updated_by UUID`
- `created_at TIMESTAMPTZ DEFAULT now()`, `updated_at TIMESTAMPTZ DEFAULT now()`
- RLS : `CREATE POLICY tenant_isolation ON table FOR ALL USING (farm_id IN (SELECT user_farm_ids()))`

**Pas de FK entre modules.** Une table PAM ne référence jamais une table apicole et inversement.

---

## 7. Ordre d'implémentation recommandé

### Étape 1 — Câblage du système de modules (sans nouveau module)

Ce travail est **indépendant** de la conception métier apiculture/maraîchage. Il peut être fait maintenant.

1. **`context.ts`** : ajouter `activeModules` dans `getContext()`
2. **`Sidebar.tsx`** : tag `module` sur chaque section, filtrage conditionnel
3. **`MobileHeader.tsx`** : idem
4. **`/m/saisie/page.tsx`** : tuiles conditionnelles
5. **Cache offline** : stocker les modules actifs dans IndexedDB
6. **Guard `requireModule()`** : créer le helper
7. **Pages PAM existantes** : ajouter `await requireModule('pam')` sur les ~25 pages
8. **`dispatch.ts`** : validation module avant dispatch
9. **Dashboard** : widgets conditionnels

**Test** : désactiver le module PAM sur la ferme LJS → vérifier que toute la navigation PAM disparaît, que les routes retournent un redirect, que le sync rejette les entrées PAM.

### Étape 2 — Module Apiculture (quand le besoin métier est défini)

1. Migration SQL : tables `api_*`
2. Section Sidebar apiculture
3. Pages desktop `apiculture/*`
4. Formulaires mobile
5. Dispatch sync + cache offline
6. Dashboard widgets apicoles

### Étape 3 — Module Maraîchage (quand le besoin métier est défini)

Même séquence. Potentiellement plus complexe si des tables sont partagées avec PAM (topologie, variétés).

---

## 8. Points ouverts (à trancher avec les clients)

| # | Question | Impact technique |
|---|----------|-----------------|
| 1 | **Un même terrain (parcelle/rang) peut-il accueillir PAM et maraîchage ?** | Si oui → topologie partagée. Si non → tables séparées. |
| 2 | **Certaines plantes sont-elles à la fois PAM et maraîchage ?** (basilic, ciboulette…) | Si oui → variétés partagées avec multi-tag. Si non → `module` sur varieties. |
| 3 | **Le Référentiel est-il toujours visible ou conditionné ?** | Si une ferme n'a que l'apiculture, a-t-elle besoin de voir Sites/Parcelles/Variétés ? |
| 4 | **Un module désactivé doit-il cacher les données existantes ou juste bloquer la saisie ?** | Cacher = plus de travail (filtrage vues). Bloquer saisie = plus simple (guard + dispatch). |
| 5 | **Faut-il une notion de module "principal" par ferme ?** | Pour déterminer la page d'accueil par défaut après login. |
| 6 | **Le stock PAM et le stock maraîchage sont-ils séparés ?** | Le stock PAM est en grammes avec 6 états de transformation. Le maraîchage est probablement en kg, frais uniquement. Tables séparées recommandées. |
| 7 | **Le prévisionnel et la traçabilité sont-ils transverses ou par module ?** | La traçabilité PAM (lot → graine) n'a pas de sens pour le miel. Vues séparées par module. |
| 8 | **Offline multi-modules : `loadReferenceData()` doit-il adapter son chargement aux modules actifs ?** | Aujourd'hui l'API `/api/offline/reference-data` charge tout (variétés, sites, parcelles, rangs, recettes, semences, matériaux). Pour une ferme apiculture seule, charger les rangs de culture n'a pas de sens. Faut-il filtrer par module ou tout charger systématiquement (volume négligeable pour 2-3 users) ? |
| 9 | **Formulaires mobile multi-modules : comment filtrer les dropdowns ?** | Une ferme PAM + Maraîchage a des variétés des deux modules. Les dropdowns (variétés, parcelles, etc.) doivent-ils être filtrés automatiquement selon la tuile choisie (chaque tuile porte son module) ou y a-t-il un sélecteur de module global sur la page saisie ? |
| 10 | **Apiculture : quelles données de référence en cache offline ?** | Un apiculteur a besoin de sites (emplacements de ruchers) mais probablement pas de rangs de culture ni de variétés PAM. Faut-il une notion de "référentiel par module" (ex: `api_apiaries` en cache) ou le référentiel topologique existant (sites/parcelles/rangs) suffit-il en l'étendant ? |
| 11 | **Barre de sync mobile : identique quel que soit le module ?** | La barre de sync (pastille verte/orange/rouge, compteur pending) est transverse. Mais faut-il un compteur par module ou un compteur global unique ? Pour 2-3 users un compteur global semble suffisant. |
| 12 | **Précache routes : une ferme mono-module doit-elle précacher les routes des autres modules ?** | Recommandation actuelle = tout précacher (coût négligeable). Mais si le nombre de modules/routes augmente, faut-il filtrer les routes précachées par modules actifs (lu depuis IndexedDB) ? |

---

## 9. Risques et mitigations

| Risque | Mitigation |
|--------|------------|
| Performance du SELECT `farm_modules` dans chaque `getContext()` | Table minuscule (1-3 rows), indexée. Acceptable pour 2-3 utilisateurs. Si problème → mettre en cache dans un cookie signé. |
| Oubli de guard sur une page existante | Créer un test automatisé qui vérifie que chaque `page.tsx` sous les dossiers PAM appelle `requireModule('pam')`. |
| Données orphelines si un module est désactivé | Désactiver ≠ supprimer. Les données restent en base. Le module peut être réactivé. Aucune suppression automatique. |
| Complexité du dispatch offline si beaucoup de modules | Le mapping `TABLE_TO_MODULE` reste simple. Pas de logique complexe. |
| Migration des fermes existantes | Toutes les fermes existantes ont déjà `pam` dans `farm_modules` (bootstrap). Aucune migration de données nécessaire. |

---

## 10. Estimation d'effort

| Tâche | Effort |
|-------|--------|
| Étape 1 — Câblage système de modules | 2-3 jours |
| Étape 2 — Module Apiculture (hors conception métier) | 8-15 jours |
| Étape 3 — Module Maraîchage (hors conception métier) | 10-18 jours |

L'étape 1 est le prérequis. Elle peut être réalisée dès maintenant, avant même de connaître les besoins métier des clients.
