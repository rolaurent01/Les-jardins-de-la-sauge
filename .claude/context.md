# CONTEXT.md — Appli LJS (Les Jardins de la Sauge)

## 1. VISION DU PROJET

Application de gestion complète pour une micro-structure de plantes aromatiques et médicinales (PAM). L'objectif est de remplacer un ensemble de fichiers Excel par une application web + mobile permettant de tracer la totalité du cycle de vie : de la graine au produit fini (tisanes, aromates, sels, sucres).

**Nom du projet** : Appli LJS
**Structure** : Les Jardins de la Sauge
**Utilisateurs** : 2-3 personnes (saisie terrain mobile + consultation bureau)
**Gestion** : Par année calendaire

---

## 2. STACK TECHNIQUE IMPOSÉE

| Composant | Choix | Contraintes |
|-----------|-------|-------------|
| Frontend web | **Next.js (App Router)** | Hébergé sur Vercel (plan gratuit, 100GB bandwidth) |
| Base de données | **Supabase (plan gratuit)** | 500MB stockage, auto-pause après 1 semaine d'inactivité |
| Mobile | **PWA (Progressive Web App)** | Service Worker + IndexedDB pour mode offline |
| Repo | **GitHub** | |
| Hébergement | **Vercel.app** (gratuit) | |
| Auth | **Supabase Auth** | Email/password simple, 2-3 comptes |

### Contraintes Supabase gratuit — CRITIQUE
- **Auto-pause** : La base se désactive après 7 jours sans requête. Il FAUT un cron job (Vercel Cron ou équivalent) qui ping la base toutes les 24-48h pour la garder active.
- **Implémentation** : Créer une route API `/api/keep-alive` qui fait un simple `SELECT 1` sur Supabase, et configurer un cron dans `vercel.json` :
```json
{
  "crons": [
    { "path": "/api/keep-alive", "schedule": "0 6 * * *" },
    { "path": "/api/backup", "schedule": "0 3 * * *" }
  ]
}
```

### Stockage des logos (Supabase Storage)
Les logos des organisations sont stockés dans un bucket Supabase Storage `org-logos`, avec une politique d'accès publique en lecture (les logos sont affichés sur la page de login et dans la sidebar, sans authentification nécessaire). Le chemin est `org-logos/{organization_id}/logo.png`. Le super admin uploade le logo lors de la création du compte client (onboarding manuel).

---

## 3. ARCHITECTURE APPLICATIVE

### 3.1 Vue d'ensemble

**Principe fondamental : le bureau fait TOUT, le mobile ne fait que saisir.**
- Le bureau (desktop) est l'application complète : saisie, consultation, dashboard, analyse, gestion des recettes, export.
- Le mobile est un terminal de saisie terrain ultra-léger : choisir une action → remplir un formulaire → enregistrer. C'est tout.
- Les données saisies sur mobile sont synchronisées puis consultées et traitées sur le bureau.

```
┌─────────────────────────────────────────────────────┐
│                    VERCEL (Next.js)                  │
│                                                     │
│  ┌─────────────┐    ┌──────────────────────────┐    │
│  │  Version     │    │    Version Bureau        │    │
│  │  Mobile PWA  │    │    (Dashboard + Saisie)  │    │
│  │  (Saisie)    │    │                          │    │
│  └──────┬───────┘    └────────────┬─────────────┘    │
│         │                        │                   │
│         │    ┌───────────────┐   │                   │
│         └────┤  API Routes   ├───┘                   │
│              │  (Next.js)    │                        │
│              └───────┬───────┘                        │
└──────────────────────┼───────────────────────────────┘
                       │
              ┌────────▼────────┐
              │    SUPABASE     │
              │  (PostgreSQL)   │
              │  + Auth         │
              │  + RLS          │
              └─────────────────┘
```

### 3.2 Mode Offline Mobile — ARCHITECTURE CRITIQUE

Le mobile doit fonctionner SANS connexion pendant quelques heures (journée de travail terrain), puis synchroniser le soir en Wi-Fi.

**Principe** :
1. Au lancement (online), l'app charge les données de référence en cache local (variétés, parcelles, rangs, recettes).
2. Sur le terrain (offline), l'utilisateur saisit des données qui sont stockées dans **IndexedDB** avec un statut `pending`.
3. Au retour en Wi-Fi, l'app détecte la connexion et lance la synchronisation.
4. Chaque enregistrement synchonisé passe en statut `synced` côté client.
5. **Chemin retour** : l'app vérifie que le serveur a bien reçu chaque donnée avant de la supprimer du stockage local. On ne supprime JAMAIS une donnée locale sans confirmation serveur.

**Implémentation** :
- Service Worker pour le cache des assets (pages, CSS, JS)
- IndexedDB (via `idb` ou `Dexie.js`) pour le cache de données de référence + file d'attente des saisies
- Table locale `sync_queue` : `{ id, uuid_client, table_cible, payload, status: 'pending'|'syncing'|'synced'|'error', tentatives: number, derniere_erreur: text, created_at, synced_at }`
- Indicateur visuel clair dans l'UI mobile : pastille verte/orange/rouge selon l'état de sync
- Compteur de données en attente d'envoi
- Bouton "Forcer la synchronisation"

### PROTOCOLE DE SYNC — OBJECTIF ZÉRO PERTE DE DONNÉES

C'est le point le plus critique de l'application. Voici le protocole complet :

#### Cycle de vie d'une saisie mobile

```
1. SAISIE         → Donnée écrite en IndexedDB, status = 'pending'
                     UUID généré côté client (uuid_client)
                     
2. ENVOI           → Quand connexion détectée, status passe à 'syncing'
                     Envoi POST vers /api/sync avec uuid_client + payload
                     
3. RÉCEPTION       → Le serveur insère la donnée dans Supabase
                     Le serveur retourne { success: true, uuid_client, server_id }
                     
4. CONFIRMATION    → Le client reçoit la réponse OK
                     Status passe à 'synced', synced_at = now()
                     
5. ARCHIVAGE       → La donnée locale reste en IndexedDB pendant 7 jours
                     après confirmation, comme filet de sécurité.
                     
6. NETTOYAGE       → Après 7 jours en statut 'synced' :
                     La donnée locale est supprimée de IndexedDB.
```

**Note** : La vérification unitaire GET verify a été supprimée du protocole. Le POST OK du serveur est considéré comme suffisant pour confirmer la persistance. L'audit batch "Tout vérifier" 🔍 couvre le risque résiduel (crash serveur entre commit et réponse) de manière groupée et plus efficace.

**Règles de sécurité absolues :**
- **Pas de suppression locale avant 7 jours** après confirmation POST OK
- **Retry automatique** : si l'envoi échoue, la donnée reste en 'pending' et sera renvoyée au prochain cycle (toutes les 30 secondes quand online)
- **Maximum 5 tentatives** avant passage en status 'error' — les erreurs sont visibles et doivent être résolues manuellement
- **Idempotence** : le `uuid_client` garantit qu'envoyer la même donnée 2 fois ne crée pas de doublon côté serveur (le serveur fait un UPSERT sur uuid_client)
- **Archivage local** : les données synced ne sont pas supprimées immédiatement mais gardées 7 jours en local comme filet de sécurité
- **Garde-fou anti-saturation** : si IndexedDB dépasse 80% de sa capacité estimée (~40 Mo), purger automatiquement les archives confirmées les plus anciennes en priorité. La saisie de nouvelles données ne doit JAMAIS être bloquée
- **Audit batch** : le bouton "Tout vérifier" 🔍 est le filet de sécurité ultime — il remplace la vérification unitaire par une vérification groupée de toutes les données synced

#### Endpoint serveur `/api/sync`

```typescript
// POST /api/sync — Réception d'une saisie mobile
// Body : { uuid_client, table, payload }
// Réponse : { success: true, uuid_client, server_id }
// Le serveur fait un INSERT ... ON CONFLICT (uuid_client) DO NOTHING
```

#### Fonction d'AUDIT — bouton "Tout vérifier" 🔍

**CRITIQUE** : Un bouton accessible sur le mobile ET sur le bureau qui permet de lancer un audit complet de synchronisation.

Fonctionnement :
1. Le client récupère TOUTES les entrées locales (IndexedDB) qui ont un status 'synced'
2. Pour chacune, il envoie le `uuid_client` au serveur via `/api/sync/audit`
3. Le serveur répond avec la liste des uuid_client qu'il connaît / ne connaît pas
4. **Si une donnée est marquée 'synced' localement mais ABSENTE du serveur** → alerte rouge + re-push automatique
5. Résultat affiché à l'utilisateur :
   - ✅ "47 saisies vérifiées — tout est en ordre"
   - ⚠️ "2 saisies n'étaient pas sur le serveur — renvoyées automatiquement"
   - ❌ "1 saisie en erreur — détail : [erreur]"

```typescript
// POST /api/sync/audit
// Body : { uuid_clients: ["uuid1", "uuid2", ...] }
// Réponse : { 
//   confirmed: ["uuid1", "uuid2"],      // Présents en base
//   missing: ["uuid3"],                  // ABSENTS — à re-pusher !
//   total_checked: 47
// }
```

#### Cache local et multi-tenant

Le cache IndexedDB ne contient que les données de la **ferme active** (ferme sélectionnée via le cookie `active_farm_id`). Au switch de ferme, le cache est entièrement rechargé depuis le serveur. Chaque enregistrement dans `sync_queue` inclut `farm_id` dans son payload — ce champ est validé côté serveur pour correspondre à une ferme accessible à l'utilisateur.

#### Indicateurs visuels mobile (barre de sync permanente)

| État | Affichage | Couleur |
|------|-----------|---------|
| Tout synced, 0 en attente | "✅ Tout synchronisé" | Vert |
| Online, X en attente d'envoi | "⏳ X saisies en cours d'envoi..." | Orange |
| Offline, X en attente | "📴 Hors ligne — X saisies en attente" | Gris |
| Erreurs de sync | "❌ X erreurs de sync — vérifier" | Rouge |
| Audit en cours | "🔍 Vérification en cours..." | Bleu |

#### Bouton "Forcer la synchronisation" 
Déclenche immédiatement :
1. Envoi de toutes les saisies 'pending'
2. Lancement de l'audit batch sur toutes les saisies 'synced'
3. Affichage du résultat d'audit

**Résolution de conflits** : Last-write-wins avec timestamp. Les saisies terrain sont additives (on ajoute des entrées, on ne modifie pas les mêmes enregistrements), donc les conflits devraient être rares.

### 3.3 Version Bureau vs Mobile — SÉPARATION STRICTE

Le bureau est le CENTRE DE COMMANDE complet. Le mobile est un TERMINAL DE SAISIE terrain, rien de plus.

| | Bureau (Desktop) — COMPLET | Mobile (PWA) — MINIMAL |
|---|---|---|
| **Rôle** | Tout : saisie, consultation, dashboard, analyse, gestion, export | Saisie terrain uniquement |
| **UX** | Complète, riche, apaisée, avec navigation, widgets, graphiques | Ultra-léger : 1 écran de choix d'action → 1 formulaire → enregistrer → retour |
| **Fonctionnalités** | Toutes les fonctionnalités de l'application | UNIQUEMENT : choisir une action, remplir le formulaire, enregistrer |
| **Consultation** | Oui : dashboard, stocks, historique, traçabilité, prévisionnel | NON — aucune consultation, aucun tableau, aucun graphique |
| **Offline** | Non requis (toujours connecté) | Oui, obligatoire |
| **Dashboard** | Oui, complet et personnalisable | NON |
| **Export données** | Oui (CSV/Excel) | NON |
| **Gestion recettes/variétés** | Oui (CRUD complet) | Ajout rapide de variété uniquement (depuis un formulaire). Pas de modification/suppression. |
| **Traitement des données** | Tout le traitement, la vérification, l'analyse se fait ici | Les données saisies sur mobile sont traitées/vérifiées sur le bureau |

#### Routing mobile

Les routes mobile sont sous `src/app/[orgSlug]/(mobile)/` :

```
src/app/[orgSlug]/(mobile)/
├── layout.tsx          # Layout mobile : barre sync permanente, pas de sidebar
└── saisie/
    ├── page.tsx        # Grille 5 tuiles d'actions
    └── [action]/
        └── page.tsx    # Formulaire de saisie
```

**Détection et redirection** : le proxy détecte le User-Agent au login et redirige :
- Mobile → `/{orgSlug}/m/saisie`
- Desktop → `/{orgSlug}/dashboard`

Chaque layout (bureau et mobile) inclut un lien de bascule vers l'autre version ("Mode terrain" / "Mode bureau"). Pas de blocage — l'utilisateur peut accéder manuellement à l'autre version.

### 3.4 Architecture Multi-Tenant

L'application est conçue pour accueillir plusieurs structures indépendantes (fermes) sur la même plateforme technique. L'isolation des données est garantie par RLS PostgreSQL.

#### Hiérarchie à 3 niveaux

```
PLATEFORME
├── platform_admins (super admins — opérateurs de la plateforme)
│
├── organizations (compte client, entité juridique, facturation)
│   ├── memberships (user × organization × role)
│   │     role = 'owner' | 'admin' | 'member'
│   │
│   └── farms (unité opérationnelle — là où vivent les données métier)
│       ├── farm_access (user × farm × permission)
│       │     permission = 'full' | 'read' | 'write'
│       │
│       ├── farm_modules (modules activés : 'pam', 'apiculture', 'maraichage')
│       │
│       └── [TOUTES les tables métier opérationnelles avec farm_id]
│
├── CATALOGUE PARTAGÉ (pas de farm_id — visible par tous)
│   ├── varieties (référentiel plantes, partagé plateforme)
│   ├── external_materials (matières premières non-plantes)
│   └── product_categories (catégories de produits)
│
└── PRÉFÉRENCES PAR FERME (personnalisation du catalogue)
    ├── farm_variety_settings (farm_id, variety_id → hidden, seuil_alerte_g)
    └── farm_material_settings (farm_id, external_material_id → hidden)
```

#### Principes clés

- **Base unique** : toutes les données dans la même base Supabase, isolation logique par `farm_id`.
- **Catalogue partagé** : `varieties`, `external_materials`, `product_categories` sont visibles par toutes les fermes. Chaque ferme peut masquer les entrées non pertinentes via `farm_variety_settings` / `farm_material_settings`.
- **Données métier scopées** : toutes les tables opérationnelles (sites, parcels, rows, seed_lots, plantings, harvests…) ont une colonne `farm_id NOT NULL`.
- **Ownership du catalogue** : une variété est créable par n'importe quelle ferme (CREATE pour tous les authentifiés). Elle est ensuite modifiable uniquement par la ferme créatrice (`created_by_farm_id`) ou un super admin. Cela favorise l'enrichissement collectif du référentiel tout en protégeant l'intégrité.
- **Sélecteur de ferme** : dans le layout bureau (au-dessus de la sidebar), un sélecteur permet de choisir la ferme active. Une seule ferme est active à la fois. Les owners/admins d'une organisation ont accès à toutes ses fermes sans entrée dans `farm_access`.
- **Super admin multi-org** : les `platform_admins` sont automatiquement membres (role `owner`) de toutes les organisations via un trigger SQL `AFTER INSERT ON organizations`. Un sélecteur d'organisation (composant `OrgSwitcher`) est affiché dans la sidebar uniquement pour les platform_admins, permettant de basculer d'une organisation à l'autre. Les RLS et `getContext()` fonctionnent nativement puisque le membership existe.
- **Contexte applicatif** : le helper `getContext()` (src/lib/context.ts) retourne `{ userId, farmId, organizationId }` depuis le cookie `active_farm_id`. Toutes les Server Actions l'utilisent pour scoper automatiquement les opérations.
- **Modules activables** : chaque ferme active les modules qu'elle utilise via `farm_modules`. La sidebar s'adapte en conséquence (module PAM = sections Semis, Parcelles, etc. ; module Apiculture = sections Miel en Phase C).
- **Audit trail** : colonnes `created_by UUID` et `updated_by UUID` sur toutes les tables métier, plus table `audit_log` pour les opérations CUD critiques.

### 3.5 Routing multi-tenant par path

Chaque organisation a un slug unique utilisé dans l'URL : `https://[domaine]/[orgSlug]/dashboard`, `https://[domaine]/[orgSlug]/semis/sachets`, etc.

**Structure des routes Next.js :**
```
src/app/
├── login/                          # Page login générique (sans slug, branding plateforme)
├── [orgSlug]/                      # Segment dynamique — résout l'organisation
│   ├── layout.tsx                  # Charge l'orga par slug, injecte le branding (CSS variables)
│   ├── (dashboard)/                # Routes métier
│   │   ├── dashboard/
│   │   ├── semis/
│   │   ├── parcelles/
│   │   ├── referentiel/
│   │   └── ...
│   └── admin/                      # Routes super admin (si platform_admin)
└── api/                            # Routes API (inchangées, pas de slug)
```

**Résolution du slug :**
- Le layout `[orgSlug]/layout.tsx` résout l'organisation via `SELECT * FROM organizations WHERE slug = :slug`
- Si le slug n'existe pas → 404
- Si l'utilisateur n'est pas membre de cette organisation → redirect vers sa propre organisation
- Le branding (couleurs, logo, nom affiché) est injecté comme CSS variables dans le layout

**Page de login :**
- `/login` est la page générique (branding plateforme par défaut)
- Après login, l'utilisateur est redirigé vers `/{orgSlug}/dashboard` de sa première organisation

**Migration des routes existantes :**
- Les routes actuelles `/(dashboard)/semis/sachets` deviennent `/[orgSlug]/(dashboard)/semis/sachets`
- Chaque `revalidatePath('/semis/sachets')` dans les Server Actions doit être mis à jour vers `revalidatePath('/[orgSlug]/semis/sachets')` (ou utiliser un helper `buildPath(slug, '/semis/sachets')`)
- Le middleware vérifie l'authentification et l'appartenance à l'organisation du slug

---

## 4. CHARTE GRAPHIQUE & UX

### 4.1 Identité visuelle — Les Jardins de la Sauge

**Palette officielle :**

| Rôle | Couleur | Code hex | Usage |
|------|---------|----------|-------|
| **Primaire** | Vert Sauge / Vert Forêt | `#3A5A40` (profond) ou `#588157` (doux) | Boutons d'action, bannières, sidebar, éléments identitaires. Rappelle la plante (sauge) et la nature. |
| **Fond** | Blanc Cassé / Crème | `#F9F8F6` ou `#FAF5E9` | Arrière-plan principal. Pas de blanc pur (#FFF) — la teinte crème apporte chaleur et authenticité, comme du papier recyclé. |
| **Texte** | Gris Anthracite / Noir Doux | `#2C3E2D` (teinté vert) ou `#333333` | Titres et corps de texte. Noir atténué, lisible et doux pour les yeux, en accord avec l'univers apaisant. |
| **Accentuation** | Ocre / Doré | `#DDA15E` ou `#BC6C25` | Touches chaudes par petites doses : badges, alertes, étoiles, indicateurs. Apporte lumière et gourmandise. |

- **Ambiance** : Apaisée, nature, organique
- **Formes** : Blocs arrondis (border-radius généreux), pas d'angles vifs
- **Icônes** : Emojis nature / icônes douces (🌱 🌿 🌻 ☀️ 🍃 📦 ⏱️)
- **Typographie** : Une police ronde et lisible (ex: Inter, Nunito)

### 4.1b Thème dynamique par organisation

Les couleurs de la charte ne sont pas hardcodées. Le layout `[orgSlug]/layout.tsx` injecte les couleurs de l'organisation comme CSS variables :

```css
:root {
  --color-primary: #3A5A40;       /* organizations.couleur_primaire */
  --color-primary-light: #588157; /* organizations.couleur_secondaire */
}
```

Les composants (Sidebar, MobileHeader, boutons, badges) utilisent ces variables au lieu de valeurs hex hardcodées. La palette par défaut (#3A5A40 / #588157) reste celle des nouvelles organisations si elles ne personnalisent pas leurs couleurs.

Le logo de l'organisation (depuis `organizations.logo_url`) remplace le logo LJS dans la sidebar et le MobileHeader. Si pas de logo configuré, un placeholder avec la première lettre de `nom_affiche` est affiché.

### 4.2 UX Bureau — EXPÉRIENCE COMPLÈTE
Le bureau est le centre de commande. C'est ici que tout se passe : saisie, consultation, analyse, gestion.

- **Dashboard** avec widgets personnalisables : état des parcelles, stocks, avancement prévisionnel, temps de travail
- **Navigation claire** par les 5 ensembles métier dans une sidebar :
  - 🌱 Semis : Sachets de graines, Suivi semis
  - 🌿 Suivi parcelle : Travail sol, Plantation, Suivi rang, Cueillette, Arrachage, Occultation
  - 🔄 Transformation : Tronçonnage, Séchage, Triage
  - 🧪 Création de produit : Recettes, Production de lots, Stock produits finis
  - 📦 Affinage du stock : Achats, Ventes directes, Ajustements
  - *(Phase B)* 📊 Analyse : Dashboard, **Vue Stock**, **Vue Production totale**, Traçabilité, Prévisionnel
  - ⚙️ Référentiel : Variétés (ajout/modif/suppression), Sites/Parcelles/Rangs, Matériaux externes
  - **Ajout rapide de variété** : dans tout formulaire contenant un sélecteur de variété (plantation, cueillette, transformation, recette), un bouton « + Nouvelle variété » permet d'en créer une à la volée (nom vernaculaire obligatoire, nom latin et famille optionnels). La variété est immédiatement disponible dans le sélecteur sans quitter le formulaire en cours. **Anti-doublon** : la recherche dans le sélecteur est insensible à la casse et aux accents. Si le nom existe déjà (contrainte UNIQUE), l'application affiche « Cette variété existe déjà » et propose de la sélectionner directement.
- **Saisie complète** : tous les formulaires de saisie sont aussi disponibles sur le bureau (pas uniquement sur mobile)
- **Consultation et traitement** : c'est sur le bureau qu'on consulte, filtre, trie, exporte et analyse les données saisies (y compris celles saisies depuis le mobile)
- **Environnement apaisant** : pas de surcharge visuelle, espaces généreux, blocs arrondis, palette nature
- **Export** : possibilité d'extraire des tableaux en CSV / XLSX depuis toutes les vues de données

### 4.3 UX Mobile — ULTRA-MINIMAL
Le mobile est un **terminal de saisie terrain**. Rien d'autre. L'objectif : ne pas perdre de données, garantir l'adoption par sa simplicité.

**Principe** : 3 écrans max pour saisir une donnée
1. **Écran 1** — Choix de l'ensemble (5 grosses tuiles tactiles) :
   ```
   🌱 Semis       🌿 Parcelle
   🔄 Transfo     📦 Stock
   🧪 Produits
   ```
2. **Écran 1b** — Choix de la sous-action (tap sur un ensemble) :
   - 🌱 Semis → Sachet de graines, Suivi semis
   - 🌿 Parcelle → Travail sol, Plantation, Suivi rang, Cueillette, Arrachage, Occultation
   - 🔄 Transfo → Tronçonnage, Séchage, Triage
   - 📦 Stock → Achat, Vente directe
   - 🧪 Produits → Production de lot
3. **Écran 2** — Formulaire de saisie (champs minimum, sélecteurs pré-remplis, clavier adapté)
4. **Écran 3** — Confirmation ("Enregistré ✅") → retour à l'écran 1

**Ce que le mobile NE FAIT PAS** :
- Pas de consultation de données
- Pas de dashboard
- Pas de tableaux ou de listes
- Pas de gestion de recettes ou de variétés
- Pas de vue stock
- Pas de graphiques
- Pas de navigation complexe
- **Pas de création de nouvelles variétés** (uniquement en ligne, sur bureau ou mobile connecté)

**Éléments UI mobile** :
- Barre de sync toujours visible en haut : "3 en attente ⏳" / "Tout envoyé ✅"
- Bouton "Forcer la sync" dans la barre
- Formulaires : le strict nécessaire, dropdowns pré-remplis depuis le cache, validation instantanée
- Pas de menu latéral, pas de tabs — juste les tuiles d'action et les formulaires
- Possibilité de saisir un timer (chronomètre start/stop pour mesurer le temps de travail)

---

## 5. MODÈLE DE DONNÉES — SCHÉMA COMPLET

### 5.1 Tables de référence

#### `varieties` — Référentiel plantes (catalogue partagé plateforme)
C'est LA table centrale. Chaque plante cultivée ou récoltée à l'état sauvage y est référencée. **Catalogue partagé** : visible par toutes les fermes, créable par n'importe quelle ferme authentifiée, modifiable uniquement par la ferme créatrice ou un super admin. `seuil_alerte_g` est déplacé dans `farm_variety_settings` pour être personnalisable par ferme.
```sql
CREATE TABLE varieties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom_vernaculaire TEXT NOT NULL,           -- "Lavande vraie", "Menthe marocaine"
  nom_latin TEXT,                           -- "Lavandula angustifolia"
  famille TEXT,                             -- "Lamiacées", "Astéracées"
  type_cycle TEXT CHECK (type_cycle IN ('annuelle', 'bisannuelle', 'perenne', 'vivace')),
  duree_peremption_mois INTEGER DEFAULT 24, -- Durée après séchage en mois
  parties_utilisees TEXT[] NOT NULL DEFAULT '{"plante_entiere"}', -- Parties récoltables (au moins 1 obligatoire)
  notes TEXT,
  -- Catalogue partagé — traçabilité création/modification
  created_by_farm_id UUID REFERENCES farms(id), -- Ferme créatrice (peut modifier/supprimer)
  created_by UUID,                          -- auth.uid() du créateur
  updated_by UUID,                          -- auth.uid() du dernier modificateur
  -- Qualité du référentiel
  verified BOOLEAN DEFAULT false,           -- Validée par super admin
  aliases TEXT[],                           -- Noms alternatifs pour recherche fuzzy : ['Menthe nanah', 'Nana mint']
  merged_into_id UUID REFERENCES varieties(id), -- Si doublon fusionné, pointe vers la variété cible
  -- Soft delete
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
-- Contrainte UNIQUE insensible à la casse et aux accents sur nom_vernaculaire (index existant)
-- CREATE UNIQUE INDEX idx_varieties_nom_vernaculaire_unique ON varieties (lower(immutable_unaccent(nom_vernaculaire)));
-- Contrainte UNIQUE sur nom_latin quand renseigné
-- CREATE UNIQUE INDEX idx_varieties_nom_latin_unique ON varieties (lower(immutable_unaccent(nom_latin))) WHERE nom_latin IS NOT NULL;
```

**IMPORTANT — Nettoyage des noms** : Dans les Excel historiques, la même plante peut apparaître sous plusieurs noms (ex: "Matricaire" / "Camomille matricaire" / "Camomille romaine" sont des plantes différentes). La saisie manuelle du référentiel devra créer un référentiel propre et dédoublonné. Liste des variétés identifiées dans les fichiers (non exhaustive) :

Lamiacées : Lavande vraie, Romarin, Sarriette, Serpolet, Thym citron, Thym vulgaire, Marjolaine, Hysope, Sauge officinale, Sauge sclarée, Mélisse, Menthe marocaine, Menthe poivrée, Menthe bergamote, Menthe gingembre, Menthe africaine, Menthe verte, Basilic grand vert, Basilic citron, Basilic thaï, Basilic tulsi, Basilic cannelle, Basilic loki, Origan, Origan grec, Agastache anisée, Agastache rugosa, Estragon, Géranium rosat, Perilla pourpre, Lierre terrestre

Astéracées : Matricaire (Camomille matricaire), Camomille romaine, Calendula (Souci des jardins), Achillée, Hélichryse, Echinacée pourpre, Artemesia annua, Bleuet, Chardon marie, Tanaisie, Chicorée

Malvacées : Mauve (de Mauritanie), Guimauve

Autres familles : Verveine citronnée (Verbénacées), Verveine argentine, Pavot de Californie (Papavéracées), Coquelicot, Fenouil (Apiacées), Aneth, Angélique, Livèche, Carvi, Monarde (Lamiacées), Bouillon blanc (Scrophulariacées), Valériane (Valérianacées), Alchemille (Rosacées), Bourrache (Boraginacées), Pensée sauvage, Œillet de poète

Sauvages (non cultivées) : Sureau, Frêne, Bruyère, Ronce, Coucou, Ortie, Rose, Aubépine, Reine des prés, Ail des ours, Jeune pousse de sapin, Lotier, Cassis (feuille)

#### `external_materials` — Matières premières non-plantes (catalogue partagé plateforme)
Pour les ingrédients qui ne sont pas des plantes (sel, sucre, etc.). Même règles que `varieties` : catalogue partagé, masquable par ferme via `farm_material_settings`.
```sql
CREATE TABLE external_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,                       -- "Sel de Guérande", "Sucre blond de canne"
  unite TEXT DEFAULT 'g',
  notes TEXT,
  -- Catalogue partagé — traçabilité création/modification
  created_by_farm_id UUID REFERENCES farms(id),
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMPTZ DEFAULT NULL,     -- Soft delete
  created_at TIMESTAMPTZ DEFAULT now()
);
```

> **Note** : contrairement à `varieties`, les matériaux externes n'ont pas de colonnes `verified`, `aliases`, `merged_into_id`. Le risque de doublon est faible (quelques dizaines d'entrées maximum : sel, sucre, eau, vinaigre). Si un doublon est créé, le super admin peut le corriger manuellement via `audit_log` et SQL direct.

#### `sites` — Sites de culture (table métier — scopée par ferme)
```sql
CREATE TABLE sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id), -- Ferme propriétaire
  nom TEXT NOT NULL,                        -- "La Sauge", "Le Combet"
  description TEXT,
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMPTZ DEFAULT NULL,      -- Soft delete
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(farm_id, nom)
);
-- CREATE INDEX idx_sites_farm ON sites(farm_id);
```

#### `parcels` — Parcelles (table métier — scopée par ferme)
```sql
CREATE TABLE parcels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id), -- Ferme propriétaire
  site_id UUID REFERENCES sites(id),
  nom TEXT NOT NULL,                       -- "Parcelle principale", "Jardin 1", "Jardin 2", etc.
  code TEXT NOT NULL,                      -- "SAU", "COM-J1", "COM-J2", etc.
  orientation TEXT,                         -- "EST-OUEST", "NORD-SUD"
  description TEXT,
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMPTZ DEFAULT NULL,     -- Soft delete
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(farm_id, code),                   -- Code unique par ferme (pas global)
  UNIQUE(site_id, nom)
);
-- CREATE INDEX idx_parcels_farm ON parcels(farm_id);
```

Parcelles à créer :
- **La Sauge** : "Rang 1 à 17" (code SAU-A), "Rang 18 à 34" (code SAU-B), "Rangs proches serre" (code SAU-S)
- **Le Combet** : "Jardin 1" (COM-J1), "Jardin 2" (COM-J2), "Jardin 3 Petits fruits" (COM-J3), "Jardin 4" (COM-J4), "Jardin 5" (COM-J5)

#### `rows` — Rangs (table métier — scopée par ferme)
```sql
CREATE TABLE rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id), -- Ferme propriétaire
  parcel_id UUID REFERENCES parcels(id),
  numero TEXT NOT NULL,                    -- "1", "2", "3"... harmonisé
  ancien_numero TEXT,                      -- Pour garder la trace de l'ancien "1a", "1b"
  longueur_m DECIMAL,                      -- Longueur du rang en mètres (dimension de référence)
  largeur_m DECIMAL,                       -- Largeur du rang en mètres
  position_ordre INTEGER,                  -- Ordre d'affichage (1, 2, 3...)
  notes TEXT,
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMPTZ DEFAULT NULL,     -- Soft delete
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(parcel_id, numero)
);
-- CREATE INDEX idx_rows_farm ON rows(farm_id);
```

**Harmonisation des rangs** : Les anciens sous-rangs (1a, 1b, 1c) deviennent des rangs à part entière avec une numérotation séquentielle. L'ancien numéro est conservé dans `ancien_numero` pour la traçabilité. Exemple pour Le Combet J2 : ancien "1a" → rang 1, ancien "1b" → rang 2, ancien "1" → rang 3, etc.

### 5.1b Tables Plateforme

Ces tables gèrent la hiérarchie multi-tenant : organisations, fermes, accès utilisateurs, modules, et les tables transversales (notifications, audit).

```sql
-- Organisations (compte client, entité juridique, facturation)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,               -- pour l'URL (/app/mon-jardin)
  nom_affiche TEXT,                        -- Nom affiché dans l'UI ("Les Jardins de la Sauge"), peut différer du nom légal
  logo_url TEXT,                           -- URL du logo dans Supabase Storage (bucket 'org-logos', chemin : {org_id}/logo.png)
  couleur_primaire TEXT DEFAULT '#3A5A40', -- Couleur principale (hex) — sidebar, boutons, header
  couleur_secondaire TEXT DEFAULT '#588157', -- Couleur secondaire (hex) — accents, hover, badges
  max_farms INTEGER NOT NULL DEFAULT 1,    -- Limite du plan
  max_users INTEGER NOT NULL DEFAULT 3,    -- Limite du plan
  plan TEXT NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter', 'pro', 'enterprise')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Fermes (unité opérationnelle — là où vivent les données métier)
CREATE TABLE farms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  nom TEXT NOT NULL,
  slug TEXT NOT NULL,                      -- unique au sein de l'orga
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, slug)
);

-- Memberships (user × organization × role)
CREATE TABLE memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID NOT NULL,                   -- auth.uid()
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

-- Accès ferme (user × farm × permission)
-- Note : les owners et admins de l'organisation ont accès à TOUTES les fermes sans entrée ici
CREATE TABLE farm_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id),
  user_id UUID NOT NULL,                   -- auth.uid()
  permission TEXT NOT NULL DEFAULT 'full' CHECK (permission IN ('full', 'read', 'write')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(farm_id, user_id)
);

-- Modules activés par ferme
CREATE TABLE farm_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id),
  module TEXT NOT NULL CHECK (module IN ('pam', 'apiculture', 'maraichage')),
  activated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(farm_id, module)
);

-- Super admins plateforme (opérateurs)
CREATE TABLE platform_admins (
  user_id UUID PRIMARY KEY,                -- auth.uid()
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Préférences variétés par ferme (masquage + seuil d'alerte)
CREATE TABLE farm_variety_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id),
  variety_id UUID NOT NULL REFERENCES varieties(id),
  hidden BOOLEAN NOT NULL DEFAULT false,   -- Masquer du catalogue pour cette ferme
  seuil_alerte_g DECIMAL,                  -- Seuil d'alerte stock bas (déplacé depuis varieties)
  UNIQUE(farm_id, variety_id)
);

-- Préférences matériaux par ferme (masquage)
CREATE TABLE farm_material_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id),
  external_material_id UUID NOT NULL REFERENCES external_materials(id),
  hidden BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(farm_id, external_material_id)
);

-- Notifications (alertes stock bas, erreurs sync, backups)
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID REFERENCES farms(id),       -- NULL = notification plateforme
  user_id UUID,                            -- NULL = tous les users de la ferme
  type TEXT NOT NULL,                      -- 'stock_bas', 'sync_error', 'backup_failed', etc.
  title TEXT NOT NULL,
  message TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Audit log (traçabilité des opérations CUD sur les tables métier)
-- Rempli par les Server Actions (logique applicative, pas de trigger)
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID REFERENCES farms(id),       -- NULL pour les opérations plateforme
  user_id UUID NOT NULL,                   -- auth.uid()
  action TEXT NOT NULL,                    -- 'create', 'update', 'delete', 'archive', 'restore'
  table_name TEXT NOT NULL,               -- 'varieties', 'seed_lots', etc.
  record_id UUID NOT NULL,                -- ID de l'enregistrement modifié
  old_data JSONB,                          -- état avant modification (NULL pour create)
  new_data JSONB,                          -- état après modification (NULL pour delete)
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Fonction helper RLS** :
```sql
CREATE OR REPLACE FUNCTION user_farm_ids() RETURNS SETOF UUID AS $$
  -- Fermes accessibles via farm_access (membres) OU via membership owner/admin (accès toutes fermes de l'orga)
  SELECT fa.farm_id FROM farm_access fa WHERE fa.user_id = auth.uid()
  UNION
  SELECT f.id FROM farms f
  JOIN memberships m ON m.organization_id = f.organization_id
  WHERE m.user_id = auth.uid() AND m.role IN ('owner', 'admin')
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public;
```

### 5.2 Module Semis (étape 1)

#### `seed_lots` — Sachets de graines
Un sachet peut donner **plusieurs semis** (on sème une partie, puis une autre plus tard).
Relation : `seed_lots (1) ←── (N) seedlings`
```sql
CREATE TABLE seed_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id), -- Ferme propriétaire
  uuid_client UUID UNIQUE,                   -- UUID généré par le mobile, pour idempotence sync
  lot_interne TEXT NOT NULL,               -- N° auto-attribué par le système : "SL-2025-001"
  variety_id UUID REFERENCES varieties(id),
  fournisseur TEXT,                         -- "Agrosemens", "Sativa", etc.
  numero_lot_fournisseur TEXT,             -- Lot du fournisseur
  date_achat DATE NOT NULL,
  date_facture DATE,
  numero_facture TEXT,
  poids_sachet_g DECIMAL,
  certif_ab BOOLEAN DEFAULT false,
  commentaire TEXT,
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMPTZ DEFAULT NULL,       -- Soft delete
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(farm_id, lot_interne)             -- Numérotation unique par ferme
);
-- CREATE INDEX idx_seed_lots_farm ON seed_lots(farm_id);
```

#### `seedlings` — Semis et levée
Un semis peut être **réparti sur plusieurs rangs** (ex: 42 plants → 20 rang 12 + 22 rang 13).
Relation : `seedlings (1) ←── (N) plantings`

Deux processus possibles, avec **suivi des pertes** (mortes vs données) :
- **Process 1 — Mini-mottes** : Sachet → Caisse de mini-mottes (identifiant terrain : "Caisse A") → Plantation
- **Process 2 — Caissette/godet** : Sachet → Caissette → Godet (étape intermédiaire de repiquage) → Plantation

```sql
CREATE TABLE seedlings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id), -- Ferme propriétaire
  uuid_client UUID UNIQUE,                   -- UUID généré par le mobile, pour idempotence sync
  seed_lot_id UUID REFERENCES seed_lots(id),
  variety_id UUID REFERENCES varieties(id),
  processus TEXT CHECK (processus IN ('caissette_godet', 'mini_motte')),

  -- ===== PROCESS 1 : MINI-MOTTES =====
  numero_caisse TEXT,                      -- "A", "B"... identifiant terrain
  nb_mottes INTEGER,
  nb_mortes_mottes INTEGER DEFAULT 0,

  -- ===== PROCESS 2 : CAISSETTE/GODET =====
  nb_caissettes INTEGER,
  nb_plants_caissette INTEGER,
  nb_mortes_caissette INTEGER DEFAULT 0,
  nb_godets INTEGER,
  nb_mortes_godet INTEGER DEFAULT 0,

  -- ===== STATUT LIFECYCLE =====
  statut TEXT NOT NULL DEFAULT 'semis' CHECK (statut IN ('semis', 'leve', 'repiquage', 'pret', 'en_plantation', 'epuise')),

  -- ===== COMMUN AUX 2 PROCESSUS =====
  nb_donnees INTEGER DEFAULT 0,
  nb_plants_obtenus INTEGER,
  date_semis DATE NOT NULL,
  poids_graines_utilise_g DECIMAL,
  date_levee DATE,
  date_repiquage DATE,
  temps_semis_min INTEGER,
  temps_repiquage_min INTEGER,
  commentaire TEXT,
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMPTZ DEFAULT NULL,       -- Soft delete
  created_at TIMESTAMPTZ DEFAULT now()
);
-- CREATE INDEX idx_seedlings_farm ON seedlings(farm_id);
```

**Calcul des taux de perte** (automatique, affiché dans les vues bureau) :

Process 1 — Mini-mottes :
```
Perte globale = 1 - (nb_plants_obtenus / nb_mottes)
Détail : nb_mortes_mottes mortes + nb_donnees données
Ex: 98 mottes → 75 plantées (20 mortes + 3 données) = 23% perte
```

Process 2 — Caissette/godet :
```
Perte étape caissette = nb_mortes_caissette / nb_plants_caissette
Perte étape godet = (nb_mortes_godet + nb_donnees) / nb_godets
Perte globale = 1 - (nb_plants_obtenus / nb_plants_caissette)
Ex: 50 caissette → 45 godets (5 mortes) → 35 plantées (5 mortes + 5 données) = 30% perte
```

**Cycle de vie du semis — 6 statuts** :

Le statut d'un semis est calculé en logique applicative (fonction `computeSeedlingStatut()`, pas de trigger) et recalculé automatiquement à chaque mutation sur `seedlings` ou `plantings` liés.

| Statut | Condition de passage |
|--------|---------------------|
| `semis` | État initial à la création |
| `leve` | `date_levee` renseignée |
| `repiquage` | `date_repiquage` renseignée (process caissette/godet uniquement) |
| `pret` | `nb_plants_obtenus` renseigné et > 0 |
| `en_plantation` | Au moins 1 planting lié, `plants_restants > 0` |
| `epuise` | `plants_restants = 0` |

> **Plants restants** (calculé, jamais stocké) : `plants_restants = nb_plants_obtenus - SUM(plantings.nb_plants WHERE seedling_id = X AND deleted_at IS NULL AND actif = true)`. Affiché dans le sélecteur de semis du formulaire plantation.

> **Recalcul automatique** : le statut est recalculé après chaque `createSeedling`, `updateSeedling`, `restoreSeedling`, `createPlanting`, `updatePlanting`, `archivePlanting`, `restorePlanting`. Côté sync mobile, `dispatchSeedling` calcule le statut initial, `dispatchPlanting` recalcule après insert, `dispatchUprooting` recalcule les seedlings liés.

> **UX bureau** : les semis sont affichés en fiches avec un timeline/stepper visuel (4 étapes pour mini-motte, 5 pour caissette/godet). Le formulaire est un accordéon progressif ouvert sur la section du statut courant. Filtres par statut avec compteurs.

### 5.3 Module Parcelles (étapes 2 à 6)

#### `soil_works` — Travail de sol (étape 2)
```sql
CREATE TABLE soil_works (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id),
  uuid_client UUID UNIQUE,                 -- UUID généré par le mobile, pour idempotence sync
  row_id UUID REFERENCES rows(id),
  date DATE NOT NULL,
  type_travail TEXT CHECK (type_travail IN ('depaillage', 'motoculteur', 'amendement', 'autre')),
  detail TEXT,                              -- Précisions (type d'amendement, etc.)
  temps_min INTEGER,
  commentaire TEXT,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- CREATE INDEX idx_soil_works_farm ON soil_works(farm_id);
```

#### `plantings` — Plan de culture / Plantation (étape 3)
Un rang peut avoir **plusieurs variétés** (rare mais possible). Plusieurs `plantings` peuvent pointer vers le même `row_id`.
Relation : `rows (1) ←── (N) plantings`
```sql
CREATE TABLE plantings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id),
  uuid_client UUID UNIQUE,                 -- UUID généré par le mobile, pour idempotence sync
  row_id UUID REFERENCES rows(id),
  variety_id UUID REFERENCES varieties(id),
  seedling_id UUID REFERENCES seedlings(id),  -- Lien vers semis d'origine (NULL si plant acheté)
  fournisseur TEXT,                          -- Nom du fournisseur si plant acheté (ex: "Les Tilleuls", "Serres du Lycée")
  -- Logique : seedling_id rempli = issu de mes semis, fournisseur rempli = plant acheté
  annee INTEGER NOT NULL,
  date_plantation DATE NOT NULL,
  lune TEXT CHECK (lune IN ('montante', 'descendante')),
  nb_plants INTEGER,
  type_plant TEXT CHECK (type_plant IN ('godet', 'caissette', 'mini_motte', 'plant_achete', 'division', 'bouture', 'marcottage', 'stolon', 'rhizome', 'semis_direct')),
  espacement_cm INTEGER,
  certif_ab BOOLEAN DEFAULT false,
  date_commande DATE,
  numero_facture TEXT,
  temps_min INTEGER,
  commentaire TEXT,
  longueur_m DECIMAL,                        -- Copiée depuis le rang à la création, modifiable
  largeur_m DECIMAL,                         -- Copiée depuis le rang à la création, modifiable
  actif BOOLEAN DEFAULT true,               -- false si rang détruit/arraché
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMPTZ DEFAULT NULL,       -- Soft delete
  created_at TIMESTAMPTZ DEFAULT now()
);
-- CREATE INDEX idx_plantings_farm ON plantings(farm_id);
```

> **Pré-remplissage des dimensions** : à la création d'une plantation, `longueur_m` et `largeur_m` sont copiées depuis le rang sélectionné. L'utilisateur peut les modifier (ex : ne planter que sur 6m d'un rang de 10m, ou partager un rang entre 2 variétés).

> **Avertissement dépassement** : si la somme des `longueur_m` des plantings actifs sur un rang dépasse la `longueur_m` du rang, afficher un avertissement informatif : « ⚠️ Ce rang fait 10m, les plantations actives occupent déjà 6m. Il reste 4m disponibles. » Pas de blocage.

> **Calcul de surface** : `surface_m2 = longueur_m × largeur_m` — calculé, pas stocké.

> **Calcul de rendement par saison** : `rendement_kg_m2 = total_cueilli_g(variety, annee) / surface_m2 / 1000` — calculé depuis `harvests` et `plantings` pour la même variété et année.

> **Lien semis → plantation** : si `seedling_id` est renseigné, `nb_plants` ne peut pas dépasser `plants_restants` du semis lié (validation applicative, bloquante). Après création d'un planting avec `seedling_id` → recalcul automatique du statut du semis. Après suppression/archivage d'un planting avec `seedling_id` → recalcul du statut (le semis peut repasser de `epuise` à `en_plantation` ou `pret`). Le sélecteur de semis dans le formulaire plantation affiche la variété, le n° de caisse, le stock dispo/total, et grise les semis épuisés.

> **Avertissement rang déjà planté** : à la création d'une plantation, si le rang sélectionné a déjà un ou plusieurs `plantings` actifs (`actif = true`), afficher un avertissement : « ⚠️ Ce rang a déjà une plantation active : [variété, date]. Continuer quand même ? » L'utilisateur peut confirmer (cas légitime : 2 variétés sur un même rang) ou annuler (erreur de saisie). Pas de blocage, juste un warning.

#### `row_care` — Suivi de rang (étape 4)

**Logique adaptative variété** : à la sélection du rang, le système requête les variétés actives (`plantings WHERE row_id = X AND actif = true`). Si 1 seule → auto-remplie. Si plusieurs → dropdown pour choisir. Cela permet d'imputer le temps de travail par variété.

```sql
CREATE TABLE row_care (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id),
  uuid_client UUID UNIQUE,                 -- UUID généré par le mobile, pour idempotence sync
  row_id UUID REFERENCES rows(id),
  variety_id UUID REFERENCES varieties(id) NOT NULL,
  date DATE NOT NULL,
  type_soin TEXT CHECK (type_soin IN ('desherbage', 'paillage', 'arrosage', 'autre')),
  temps_min INTEGER,
  commentaire TEXT,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- Si un rang a 2 variétés, l'utilisateur saisit 2 lignes (une par variété)
-- CREATE INDEX idx_row_care_farm ON row_care(farm_id);
```

#### `harvests` — Cueillette (étape 5) ⭐ CRÉE DU STOCK FRAIS

**Logique adaptative variété** : même logique que le suivi de rang. Sélection du rang → si 1 variété active → auto-remplie. Si plusieurs → dropdown.

```sql
CREATE TABLE harvests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id),
  uuid_client UUID UNIQUE,                 -- UUID généré par le mobile, pour idempotence sync
  type_cueillette TEXT CHECK (type_cueillette IN ('parcelle', 'sauvage')) NOT NULL,
  row_id UUID REFERENCES rows(id),          -- NULL si sauvage
  lieu_sauvage TEXT,                         -- Texte libre : "Bord de la rivière", "Forêt du Combet"
  variety_id UUID REFERENCES varieties(id) NOT NULL,
  partie_plante TEXT CHECK (partie_plante IN ('feuille', 'fleur', 'graine', 'racine', 'fruit', 'plante_entiere')) NOT NULL,
  date DATE NOT NULL,
  poids_g DECIMAL NOT NULL,
  temps_min INTEGER,
  commentaire TEXT,
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMPTZ DEFAULT NULL,       -- Soft delete
  created_at TIMESTAMPTZ DEFAULT now()
);
-- → La route API crée le stock_movement ENTRÉE frais en logique applicative (dans une transaction SQL)
-- CREATE INDEX idx_harvests_farm ON harvests(farm_id);
```

#### `uprootings` — Arrachage (étape 6)

**Logique adaptative** : même logique. Si le rang a plusieurs variétés, on précise laquelle est arrachée. L'arrachage passe `plantings.actif = false` pour la plantation correspondante (pas forcément toutes les variétés du rang).

```sql
CREATE TABLE uprootings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id),
  uuid_client UUID UNIQUE,                 -- UUID généré par le mobile, pour idempotence sync
  row_id UUID REFERENCES rows(id) NOT NULL,
  variety_id UUID REFERENCES varieties(id),  -- Auto-rempli si mono, choisi si multi. NULL = tout le rang
  date DATE NOT NULL,
  temps_min INTEGER,
  commentaire TEXT,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- → Passe plantings.actif = false pour la variété arrachée sur ce rang
-- CREATE INDEX idx_uprootings_farm ON uprootings(farm_id);
```

#### `occultations` — Occultation de rangs (étape 2b, entre arrachage et replantation)

L'occultation régénère un rang. Quatre méthodes : paille (fournisseur + attestation), foin (fournisseur), bâche (temps de retrait au démontage), engrais vert (nom de la graine + fournisseur + facture + certif AB, en champs texte — pas de lien avec le référentiel variétés).

**Cycle** : arrachage → occultation (début) → … → occultation (fin, `date_fin` renseignée) → travail de sol (`soil_works`) → replantation

```sql
CREATE TABLE occultations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id),
  uuid_client UUID UNIQUE,                  -- UUID généré par le mobile, pour idempotence sync
  row_id UUID REFERENCES rows(id) NOT NULL,
  date_debut DATE NOT NULL,
  date_fin DATE,                             -- NULL = en cours
  methode TEXT CHECK (methode IN ('paille', 'foin', 'bache', 'engrais_vert')) NOT NULL,
  -- Paille / Foin
  fournisseur TEXT,
  attestation TEXT,                          -- Certification (paille uniquement)
  -- Engrais vert
  engrais_vert_nom TEXT,
  engrais_vert_fournisseur TEXT,
  engrais_vert_facture TEXT,
  engrais_vert_certif_ab BOOLEAN DEFAULT false,
  -- Bâche
  temps_retrait_min INTEGER,
  -- Commun
  temps_min INTEGER,
  commentaire TEXT,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- CREATE INDEX idx_occultations_farm ON occultations(farm_id);
```

> **Avertissement plantation sur rang occulté** : si un rang a une occultation active (`date_fin IS NULL`), afficher un avertissement à la plantation : « ⚠️ Ce rang est en occultation depuis le [date]. Continuer quand même ? » Pas de blocage.

> **Formulaire adaptatif par méthode** (comme les 2 processus de semis) : les champs `fournisseur`/`attestation` apparaissent pour paille/foin, les champs engrais vert pour engrais_vert, `temps_retrait_min` pour bâche.

> **Autocomplétion** : `engrais_vert_nom` utilise une autocomplétion sur les valeurs déjà saisies (comme `lieu_sauvage` sur les cueillettes).

> **Temps** : `temps_min` = temps de mise en place. `temps_retrait_min` concerne uniquement la méthode bâche (saisi lors de la clôture de l'occultation).

> **Retravail du sol** : le travail du sol après l'occultation est saisi comme un `soil_works` classique — pas de champ spécifique sur l'occultation.

### 5.4 Module Transformation (étapes 7 à 9)

#### `cuttings` — Tronçonnage (étape 7) ⭐ GÉNÈRE DU STOCK
Même modèle simplifié que séchage et triage : entrées et sorties individuelles.
```sql
CREATE TABLE cuttings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id),
  uuid_client UUID UNIQUE,                 -- UUID généré par le mobile, pour idempotence sync
  variety_id UUID REFERENCES varieties(id) NOT NULL,
  partie_plante TEXT CHECK (partie_plante IN ('feuille', 'fleur', 'graine', 'racine', 'fruit', 'plante_entiere')) NOT NULL,
  type TEXT CHECK (type IN ('entree', 'sortie')) NOT NULL,
  date DATE NOT NULL,
  poids_g DECIMAL NOT NULL,
  temps_min INTEGER,
  commentaire TEXT,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- → Si type = entree : stock_movement SORTIE frais
-- → Si type = sortie : stock_movement ENTRÉE tronçonnée
-- CREATE INDEX idx_cuttings_farm ON cuttings(farm_id);
```

#### `dryings` — Séchage (étape 8) ⭐ GÉNÈRE DU STOCK
Même modèle simplifié : entrées et sorties individuelles. L'utilisateur choisit l'état de la plante via un sélecteur.
```sql
CREATE TABLE dryings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id),
  uuid_client UUID UNIQUE,                 -- UUID généré par le mobile, pour idempotence sync
  variety_id UUID REFERENCES varieties(id) NOT NULL,
  partie_plante TEXT CHECK (partie_plante IN ('feuille', 'fleur', 'graine', 'racine', 'fruit', 'plante_entiere')) NOT NULL,
  type TEXT CHECK (type IN ('entree', 'sortie')) NOT NULL,
  etat_plante TEXT NOT NULL,
  -- Si type = 'entree' : sélecteur → 'frais' | 'tronconnee'
  -- Si type = 'sortie' : sélecteur → 'sechee' | 'tronconnee_sechee'
  date DATE NOT NULL,
  poids_g DECIMAL NOT NULL,
  temps_min INTEGER,
  commentaire TEXT,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- → Si type = entree : stock_movement SORTIE de etat_plante (frais ou tronconnee)
-- → Si type = sortie : stock_movement ENTRÉE dans etat_plante (sechee ou tronconnee_sechee)
-- CREATE INDEX idx_dryings_farm ON dryings(farm_id);
```

#### `sortings` — Triage (étape 9) ⭐ GÉNÈRE DU STOCK
Même modèle simplifié. L'utilisateur choisit l'état de la plante via un sélecteur.
```sql
CREATE TABLE sortings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id),
  uuid_client UUID UNIQUE,                 -- UUID généré par le mobile, pour idempotence sync
  variety_id UUID REFERENCES varieties(id) NOT NULL,
  partie_plante TEXT CHECK (partie_plante IN ('feuille', 'fleur', 'graine', 'racine', 'fruit', 'plante_entiere')) NOT NULL,
  type TEXT CHECK (type IN ('entree', 'sortie')) NOT NULL,
  etat_plante TEXT NOT NULL,
  -- Si type = 'entree' : sélecteur → 'sechee' | 'tronconnee_sechee'
  -- Si type = 'sortie' : sélecteur → 'sechee_triee' | 'tronconnee_sechee_triee'
  date DATE NOT NULL,
  poids_g DECIMAL NOT NULL,
  temps_min INTEGER,
  commentaire TEXT,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- → Si type = entree : stock_movement SORTIE de etat_plante (sechee ou tronconnee_sechee)
-- → Si type = sortie : stock_movement ENTRÉE dans etat_plante (sechee_triee ou tronconnee_sechee_triee)
-- CREATE INDEX idx_sortings_farm ON sortings(farm_id);
```

### 5.5 Module Stock (étape 10) — EVENT-SOURCED

Le stock n'est JAMAIS stocké directement. Il est **calculé** à partir de tous les mouvements. C'est un principe fondamental pour la traçabilité.

#### `stock_movements` — Mouvements de stock
```sql
CREATE TABLE stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id),
  variety_id UUID REFERENCES varieties(id) NOT NULL,
  partie_plante TEXT CHECK (partie_plante IN ('feuille', 'fleur', 'graine', 'racine', 'fruit', 'plante_entiere')) NOT NULL,
  date DATE NOT NULL,
  type_mouvement TEXT CHECK (type_mouvement IN ('entree', 'sortie')) NOT NULL,
  etat_plante TEXT CHECK (etat_plante IN ('frais', 'tronconnee', 'sechee', 'tronconnee_sechee', 'sechee_triee', 'tronconnee_sechee_triee')) NOT NULL,
  poids_g DECIMAL NOT NULL,
  source_type TEXT NOT NULL,                -- 'cueillette', 'tronconnage_entree', ..., 'production', 'achat', 'vente_directe', 'ajustement'
  source_id UUID,                           -- ID de l'enregistrement source
  commentaire TEXT,
  created_by UUID,
  deleted_at TIMESTAMPTZ DEFAULT NULL,       -- Soft delete
  created_at TIMESTAMPTZ DEFAULT now()
);
-- CREATE INDEX idx_stock_movements_farm ON stock_movements(farm_id);
-- CREATE INDEX idx_stock_movements_partie ON stock_movements(partie_plante);
```

**Règles de flux automatique — ÉTATS CUMULATIFS** :

Les états sont cumulatifs : ils portent l'historique des transformations subies. L'état de sortie est **déduit automatiquement** de l'état d'entrée.

| Événement | partie_plante | État d'entrée | → | État de sortie | Note |
|-----------|--------------|--------------|---|---------------|------|
| Cueillette | **CHOISI** (auto si 1 seule valeur dans varieties.parties_utilisees, dropdown sinon) | — | → | **frais** | Toujours |
| Tronçonnage | HÉRITÉ du stock en entrée | frais | → | **tronconnee** | Toujours frais en entrée |
| Séchage | HÉRITÉ du stock en entrée | frais | → | **sechee** | Sélecteur utilisateur |
| Séchage | HÉRITÉ du stock en entrée | tronconnee | → | **tronconnee_sechee** | Sélecteur utilisateur |
| Triage | HÉRITÉ du stock en entrée | sechee | → | **sechee_triee** | Toujours séché en entrée |
| Triage | HÉRITÉ du stock en entrée | tronconnee_sechee | → | **tronconnee_sechee_triee** | Toujours séché en entrée |
| Production | HÉRITÉ de la recette / lot | tout état sauf tronconnee seule | → | SORTIE | Par ingrédient dans la recette |
| Achat externe | SAISI obligatoirement | — | → | tout état au choix | ENTRÉE |
| Vente directe | SAISI obligatoirement | tout état | → | SORTIE | Sans recette |
| Ajustement | SAISI obligatoirement | tout état | → | ENTRÉE ou SORTIE | Correction manuelle |

Chaque opération génère **deux mouvements de stock** automatiques :
- SORTIE de l'état d'entrée (le stock dans cet état baisse)
- ENTRÉE dans l'état de sortie (le stock dans le nouvel état monte)

**Les 6 états possibles** :
```
frais                          → cueilli, pas transformé
tronconnee                     → cueilli + tronçonné (attend le séchoir)
sechee                         → cueilli + séché (sans tronçonnage)
tronconnee_sechee              → cueilli + tronçonné + séché
sechee_triee                   → cueilli + séché + trié
tronconnee_sechee_triee        → chemin complet
```

**Flux possible par plante** — toutes les plantes ne suivent pas le même chemin :
```
                                     partie_plante = CHOISI à la cueillette
                                     (ex: Calendula → 'fleur' ou 'feuille')
                                     ↓ hérité dans toute la chaîne
                              ┌──→ vente/production (frais — ex: sels)
                              │
Cueillette → [frais] ────────┤
                              │
                              ├──→ séchage → [sechee] ──→ triage → [sechee_triee] ──→ production
                              │
                              └──→ tronçonnage → [tronconnee] ──→ séchage → [tronconnee_sechee] ──→ triage → [tronconnee_sechee_triee] ──→ production
```
Les étapes de tronçonnage et de triage sont optionnelles. Le séchage prend en entrée du frais ou du tronçonné (sélecteur). La production utilise du stock dans l'état spécifié par ingrédient. L'état **tronconnee** seul n'est jamais utilisé en production.

**Stock à 3 dimensions** : le stock est identifié par `variété × partie_plante × etat_plante`. Exemple :
```
Menthe    | feuille | frais                   → 2.4 kg
Menthe    | feuille | tronconnee_sechee_triee → 1.2 kg
Menthe    | fleur   | sechee_triee            → 0.2 kg
Calendula | fleur   | frais                   → 1.1 kg
Fenouil   | graine  | sechee                  → 0.2 kg
```

#### `stock_purchases` — Achats de plantes externes
Pour tracer les achats de plantes fraîches ou séchées auprès d'autres producteurs.
```sql
CREATE TABLE stock_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id),
  uuid_client UUID UNIQUE,                 -- UUID généré par le mobile, pour idempotence sync
  variety_id UUID REFERENCES varieties(id) NOT NULL,
  partie_plante TEXT CHECK (partie_plante IN ('feuille', 'fleur', 'graine', 'racine', 'fruit', 'plante_entiere')) NOT NULL,
  date DATE NOT NULL,
  etat_plante TEXT CHECK (etat_plante IN ('frais', 'tronconnee', 'sechee', 'tronconnee_sechee', 'sechee_triee', 'tronconnee_sechee_triee')) NOT NULL,
  poids_g DECIMAL NOT NULL,
  fournisseur TEXT,
  numero_lot_fournisseur TEXT,
  certif_ab BOOLEAN DEFAULT false,
  prix DECIMAL,
  commentaire TEXT,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- → La route API génère le stock_movement de type 'achat' en ENTRÉE (dans une transaction SQL)
-- CREATE INDEX idx_stock_purchases_farm ON stock_purchases(farm_id);
```

#### `stock_direct_sales` — Ventes directes de plantes (sans recette)
Pour vendre du vrac ou des plantes en l'état, sans passer par la production d'un lot.
```sql
CREATE TABLE stock_direct_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id),
  uuid_client UUID UNIQUE,                 -- UUID généré par le mobile, pour idempotence sync
  variety_id UUID REFERENCES varieties(id) NOT NULL,
  partie_plante TEXT CHECK (partie_plante IN ('feuille', 'fleur', 'graine', 'racine', 'fruit', 'plante_entiere')) NOT NULL,
  date DATE NOT NULL,
  etat_plante TEXT CHECK (etat_plante IN ('frais', 'tronconnee', 'sechee', 'tronconnee_sechee', 'sechee_triee', 'tronconnee_sechee_triee')) NOT NULL,
  poids_g DECIMAL NOT NULL,
  destinataire TEXT,
  commentaire TEXT,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- → La route API génère le stock_movement de type 'vente_directe' en SORTIE (dans une transaction SQL)
-- → Vérifier que le stock est suffisant AVANT validation
-- CREATE INDEX idx_stock_direct_sales_farm ON stock_direct_sales(farm_id);
```

#### `stock_adjustments` — Ajustements manuels de stock
Pour corriger les écarts d'inventaire. Le motif est obligatoire pour traçabilité.
```sql
CREATE TABLE stock_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id),
  uuid_client UUID UNIQUE,                   -- UUID généré par le mobile, pour idempotence sync
  variety_id UUID REFERENCES varieties(id) NOT NULL,
  partie_plante TEXT CHECK (partie_plante IN ('feuille', 'fleur', 'graine', 'racine', 'fruit', 'plante_entiere')) NOT NULL,
  date DATE NOT NULL,
  type_mouvement TEXT CHECK (type_mouvement IN ('entree', 'sortie')) NOT NULL,
  etat_plante TEXT CHECK (etat_plante IN ('frais', 'tronconnee', 'sechee', 'tronconnee_sechee', 'sechee_triee', 'tronconnee_sechee_triee')) NOT NULL,
  poids_g DECIMAL NOT NULL,
  motif TEXT NOT NULL,                        -- Obligatoire : pourquoi cet ajustement
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- → Génère automatiquement un stock_movement avec source_type = 'ajustement'
-- CREATE INDEX idx_stock_adjustments_farm ON stock_adjustments(farm_id);
```

**Vue stock SQL de base** `v_stock` (le stock est toujours calculé, jamais stocké directement) :
```sql
CREATE VIEW v_stock WITH (security_invoker = true) AS
SELECT
  farm_id,
  variety_id,
  partie_plante,
  etat_plante,
  SUM(CASE WHEN type_mouvement = 'entree' THEN poids_g ELSE -poids_g END) as stock_g
FROM stock_movements
WHERE deleted_at IS NULL
GROUP BY farm_id, variety_id, partie_plante, etat_plante;
```
Voir section 5.9 pour la page Vue Stock complète.

### 5.6 Module Produits (étape 11)

#### `product_categories` — Catégories de produits (catalogue partagé plateforme)
Même règles que `varieties` : catalogue partagé, visible par tous.
```sql
CREATE TABLE product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL UNIQUE,                  -- "Tisane", "Mélange aromate", "Sel", "Sucre", "Vinaigre", "Sirop"
  created_by_farm_id UUID REFERENCES farms(id),
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### `recipes` — Recettes de base (privées par ferme)
Les recettes sont privées : chaque ferme a ses propres recettes.
```sql
CREATE TABLE recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id),
  category_id UUID REFERENCES product_categories(id),
  nom TEXT NOT NULL,                        -- "La Balade Digestive", "Nuit Étoilée"
  numero_tisane TEXT,
  poids_sachet_g DECIMAL NOT NULL,         -- fixe pour la recette
  description TEXT,
  actif BOOLEAN DEFAULT true,
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMPTZ DEFAULT NULL,       -- Soft delete
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(farm_id, nom)                     -- Nom unique par ferme
);
-- CREATE INDEX idx_recipes_farm ON recipes(farm_id);
```

#### `recipe_ingredients` — Composition de base de la recette
Les pourcentages doivent totaliser 1.0 (100%). La recette peut être modifiée au moment de la production.
```sql
CREATE TABLE recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
  variety_id UUID REFERENCES varieties(id),            -- Pour les plantes
  external_material_id UUID REFERENCES external_materials(id),  -- Pour sel, sucre...
  etat_plante TEXT CHECK (etat_plante IN ('frais', 'tronconnee', 'sechee', 'tronconnee_sechee', 'sechee_triee', 'tronconnee_sechee_triee')),  -- État du stock à utiliser (NULL pour external_materials)
  partie_plante TEXT CHECK (partie_plante IN ('feuille', 'fleur', 'graine', 'racine', 'fruit', 'plante_entiere')),  -- NULL pour external_materials
  -- NULL pour les matériaux externes (sel, sucre, vinaigre). Obligatoire pour les plantes.
  pourcentage DECIMAL NOT NULL,            -- 0.24 = 24%
  ordre INTEGER,                            -- Ordre d'affichage
  CHECK (
    (variety_id IS NOT NULL AND external_material_id IS NULL) OR
    (variety_id IS NULL AND external_material_id IS NOT NULL)
  ),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### `production_lots` — Lots de production
```sql
CREATE TABLE production_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id),
  uuid_client UUID UNIQUE,                 -- UUID généré par le mobile, pour idempotence sync
  recipe_id UUID REFERENCES recipes(id),
  numero_lot TEXT NOT NULL,                -- "BD 20250604", généré : [CODE_RECETTE][DATE]
  mode TEXT CHECK (mode IN ('produit', 'melange')) NOT NULL DEFAULT 'produit',
  date_production DATE NOT NULL,
  ddm DATE NOT NULL,
  nb_unites INTEGER,
  poids_total_g DECIMAL,
  temps_min INTEGER,
  commentaire TEXT,
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMPTZ DEFAULT NULL,       -- Soft delete
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(farm_id, numero_lot)              -- Numérotation unique par ferme
);
-- CREATE INDEX idx_production_lots_farm ON production_lots(farm_id);
```

#### `production_lot_ingredients` — Composition RÉELLE du lot
Copie de la recette de base, modifiable. C'est cette table qui fait foi pour la traçabilité et la déduction de stock.
```sql
CREATE TABLE production_lot_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_lot_id UUID REFERENCES production_lots(id) ON DELETE CASCADE,
  variety_id UUID REFERENCES varieties(id),
  external_material_id UUID REFERENCES external_materials(id),
  etat_plante TEXT CHECK (etat_plante IN ('frais', 'tronconnee', 'sechee', 'tronconnee_sechee', 'sechee_triee', 'tronconnee_sechee_triee')),  -- État réel du stock utilisé (NULL pour external_materials)
  partie_plante TEXT CHECK (partie_plante IN ('feuille', 'fleur', 'graine', 'racine', 'fruit', 'plante_entiere')),  -- NULL pour external_materials
  -- Copié depuis recipe_ingredients. Identifie précisément la dimension stock variété × partie × état.
  pourcentage DECIMAL NOT NULL,
  poids_g DECIMAL NOT NULL,                -- Poids réel utilisé = poids_total * pourcentage
  annee_recolte INTEGER,                    -- "2024", "2025" — l'année de la plante utilisée
  fournisseur TEXT,                          -- Obligatoire si external_material_id IS NOT NULL (fournisseur du matériau pour ce lot)
  CHECK (
    (variety_id IS NOT NULL AND external_material_id IS NULL) OR
    (variety_id IS NULL AND external_material_id IS NOT NULL)
  ),
  created_at TIMESTAMPTZ DEFAULT now()
);
-- → Validation applicative : fournisseur obligatoire quand external_material_id IS NOT NULL
```

**Processus de création de lot — deux modes, choisis au lancement du wizard** :

**Mode "produit"** (défaut) — partir du nombre de sachets :
1. Choix recette + nombre de sachets/pots + date
2. Le système copie les `recipe_ingredients` dans `production_lot_ingredients` (`etat_plante` et `partie_plante` inclus)
3. L'utilisateur peut ajuster : modifier les pourcentages (somme = 1.0), changer une plante, changer l'état d'un ingrédient
4. Le système calcule les poids réels (`poids_total_g = nb_unites × poids_sachet`, puis poids par ingrédient = poids_total × pourcentage)
5. Vérification stock **dans l'état ET la partie spécifiés pour chaque ingrédient** (les 3 dimensions : variété × partie × état)
6. À la validation : `stock_movements` SORTIE par ingrédient plante + lot créé (`nb_unites` renseigné, `mode = 'produit'`)

**Mode "mélange"** — partir des poids réels :
1. Choix recette + date (les % de la recette s'affichent comme guide non-contraignant)
2. Le système copie les `recipe_ingredients` dans `production_lot_ingredients`
3. L'utilisateur saisit les **poids réels par ingrédient** ; les % se recalculent automatiquement (informatif, somme non forcée à 1.0)
4. `poids_total_g` = somme des poids saisis ; `nb_unites` = NULL (pas encore conditionné)
5. Vérification stock (mêmes 3 dimensions)
6. À la validation : `stock_movements` SORTIE par ingrédient plante + lot créé (`nb_unites = NULL`, `mode = 'melange'`)
7. **Conditionnement ultérieur** : mise à jour du lot (`nb_unites`) une fois les sachets/pots remplis

**Exemple** — Lot "Sel Ail des Ours" :
```
Ail des ours    12%  état: frais   → SORTIE stock frais 36g
Sel de Guérande 88%  état: -       → matériau externe, pas de mouvement stock plante
```
**Exemple** — Lot "Balade Digestive" :
```
Menthe marocaine  24%  état: triée  → SORTIE stock triée 300g
Agastache anisée  20%  état: triée  → SORTIE stock triée 250g
...
```

#### `product_stock` — Stock de produits finis
Également event-sourced, mais plus simple.
```sql
CREATE TABLE product_stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id),
  production_lot_id UUID REFERENCES production_lots(id),
  date DATE NOT NULL,
  type_mouvement TEXT CHECK (type_mouvement IN ('entree', 'sortie')),
  quantite INTEGER NOT NULL,               -- Nombre de sachets/pots
  commentaire TEXT,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- CREATE INDEX idx_product_stock_movements_farm ON product_stock_movements(farm_id);
```

### 5.7 Module Prévisionnel

#### `forecasts` — Prévisionnel par variété
```sql
CREATE TABLE forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id),
  annee INTEGER NOT NULL,
  variety_id UUID REFERENCES varieties(id) NOT NULL,
  etat_plante TEXT CHECK (etat_plante IN ('frais', 'tronconnee', 'sechee', 'tronconnee_sechee', 'sechee_triee', 'tronconnee_sechee_triee')),
  partie_plante TEXT CHECK (partie_plante IN ('feuille', 'fleur', 'graine', 'racine', 'fruit', 'plante_entiere')),  -- NULL = toutes parties confondues
  quantite_prevue_g DECIMAL,
  commentaire TEXT,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(farm_id, annee, variety_id, etat_plante, partie_plante)
);
-- CREATE INDEX idx_forecasts_farm ON forecasts(farm_id);
```

### 5.8 Table `production_summary` — Cumuls d'activité

Table matérialisée, mise à jour automatiquement par trigger à chaque opération. Contient les cumuls de volumes et de temps par variété, par année et par mois. **Ne contient PAS le stock** (voir 5.9).

**Fonction de recalcul** : une fonction admin `recalculate_production_summary()` tronque et reconstruit entièrement cette table depuis les tables sources (`harvests`, `cuttings`, `dryings`, `sortings`, `production_lot_ingredients`, `stock_direct_sales`, `stock_purchases`). Accessible via un bouton dans l'espace admin bureau. À utiliser en cas de doute sur l'intégrité des cumuls.

```sql
CREATE TABLE production_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id),
  variety_id UUID REFERENCES varieties(id) NOT NULL,
  annee INTEGER NOT NULL,
  mois INTEGER,                              -- NULL = cumul annuel, 1-12 = cumul mensuel
  -- Volumes par étape (en grammes)
  total_cueilli_g DECIMAL DEFAULT 0,
  total_tronconnee_g DECIMAL DEFAULT 0,
  total_sechee_g DECIMAL DEFAULT 0,          -- sechee + tronconnee_sechee
  total_triee_g DECIMAL DEFAULT 0,           -- sechee_triee + tronconnee_sechee_triee
  total_utilise_production_g DECIMAL DEFAULT 0,
  total_vendu_direct_g DECIMAL DEFAULT 0,
  total_achete_g DECIMAL DEFAULT 0,
  -- Temps de travail cumulés (en minutes)
  temps_cueillette_min INTEGER DEFAULT 0,
  temps_tronconnage_min INTEGER DEFAULT 0,
  temps_sechage_min INTEGER DEFAULT 0,
  temps_triage_min INTEGER DEFAULT 0,
  temps_production_min INTEGER DEFAULT 0,
  -- Metadata
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(farm_id, variety_id, annee, mois)
);
-- CREATE INDEX idx_production_summary_farm ON production_summary(farm_id);
```

**Mise à jour** : chaque trigger d'opération met à jour à la fois la ligne mensuelle (mois = M) et la ligne annuelle (mois = NULL) pour la variété concernée. Ex : une cueillette de 800g de Menthe en juin 2025 incrémente `total_cueilli_g` sur les lignes (Menthe, 2025, 6) ET (Menthe, 2025, NULL).

### 5.9 Page Vue Stock — Temps réel

Page dédiée dans le bureau. Le stock est **calculé en temps réel** à partir de `stock_movements` (pas de table matérialisée — il doit toujours être juste). C'est une vue opérationnelle : qu'est-ce que j'ai sous la main ?

**Tableau principal** (3 dimensions : variété × partie × état) :
```
Variété         | Partie  | Frais  | Tronç. | Séchée | Tronç.Séch. | Séch.Triée | Tronç.Séch.Triée | TOTAL
────────────────┼─────────┼────────┼────────┼────────┼─────────────┼────────────┼──────────────────┼───────
Menthe poivrée  | feuille | 2.4 kg | 0.8 kg | —      | 0.3 kg      | —          | 1.2 kg           | 4.7 kg
Menthe poivrée  | fleur   | —      | —      | —      | —           | 0.2 kg     | —                | 0.2 kg
Mauve           | fleur   | 1.1 kg | —      | —      | —           | 0.4 kg     | —                | 1.5 kg
Fenouil         | graine  | —      | —      | 0.2 kg | —           | —          | —                | 0.2 kg
Lavande vraie   | fleur   | —      | —      | —      | 0.2 kg      | —          | 3.1 kg           | 3.3 kg
```

**Fonctionnalités** :
- Filtres : variété, état, année
- Export CSV / XLSX du tableau
- Graphique barres par variété (empilées par état, colorées)
- Alertes stock bas : seuil configurable par ferme via `farm_variety_settings.seuil_alerte_g`. Notification visuelle quand le stock total passe sous le seuil (stockée dans `notifications`).

### 5.10 Page Vue Production totale — Cumuls d'activité + Prévisionnel

Page dédiée dans le bureau. Lit directement la table `production_summary` + `forecasts`. C'est une vue rétrospective et prévisionnelle : combien j'ai produit vs combien je voulais produire ?

**Tableau principal** (filtrable par année, mois, variété) :
```
Variété          | Cueilli | Tronç.  | Séché  | Trié   | Produit | Vendu  | Acheté | Temps  | Prévu  | Avancement
─────────────────┼─────────┼─────────┼────────┼────────┼─────────┼────────┼────────┼────────┼────────┼────────────
Menthe poivrée   | 45.0 kg | 38.0 kg | 8.2 kg | 7.5 kg | 6.8 kg  | 0.4 kg | 0 kg   | 48h12  | 50 kg  | █████████░ 90%
Mauve            | 12.0 kg | —       | 2.1 kg | 1.9 kg | 1.5 kg  | 0.2 kg | 0 kg   | 15h30  | 15 kg  | ████████░░ 80%
Lavande vraie    | 28.0 kg | 25.0 kg | 5.8 kg | 5.2 kg | 4.9 kg  | 0 kg   | 0 kg   | 36h45  | 25 kg  | ██████████ 112%
─────────────────┼─────────┼─────────┼────────┼────────┼─────────┼────────┼────────┼────────┼────────┼────────────
TOTAL            | 85.0 kg | 63.0 kg | 16.1kg | 14.6kg | 13.2 kg | 0.6 kg | 0 kg   | 100h27 | 90 kg  |
```

- **Colonne "Prévu"** : vient de la table `forecasts` pour l'année en cours
- **Barre d'avancement** : total cueilli / prévisionnel de récolte — visuel immédiat de l'avancement de la saison
  - Vert si ≥ 80%
  - Orange si 40-80%
  - Rouge si < 40%
  - Bleu si > 100% (objectif dépassé)

**Détail temps de travail** (clic sur une variété) :
```
Menthe poivrée — 2025 — Détail temps :
  Cueillette    22h30  (46%)
  Tronçonnage    8h00  (17%)
  Séchage        5h45  (12%)
  Triage         4h15  (9%)
  Production     7h42  (16%)
  ─────────────────────────
  Total         48h12
```

**Fonctionnalités** :
- Filtres : année, mois (ou période personnalisée), variété
- Export CSV / XLSX du tableau
- Graphique barres empilées par variété (volume à chaque étape — visuel du parcours de la plante)
- Cumul des temps de travail par étape (tableau + graphique camembert)
- Barres d'avancement prévu vs réalisé par variété
- Ligne de totaux en bas du tableau

---

## 6. RECETTES IDENTIFIÉES (à migrer)

### 6.1 Tisanes (11 recettes)

| # | Nom | Poids sachet | Plantes |
|---|-----|-------------|---------|
| 1 | La Balade Digestive | 25g | Menthe marocaine, Agastache anisée, Romarin, Matricaire, Basilic thaï, Calendula |
| 2 | Nuit Étoilée | 20g | Verveine citronnée, Mélisse, Aubépine, Mauve, Coucou |
| 3 | Lever de Soleil | 30g | Menthe bergamote, Sarriette, Thym citron, Agastache rugosa/Angélique, Calendula, Verveine Argentine/Angélique |
| 4 | Feu de Camp | 20g | Agastache anisée, Sureau, Basilic cannelle, Mauve, Pavot de Californie |
| 5 | La Montagne au Féminin | 20g | Achillée, Framboisier, Marjolaine/Mélisse, Alchemille, Aubépine, Ortie, Rose, (Camomille romaine) |
| 6 | L'Équilibre | 25g | Basilic tulsi, Mélisse, Marjolaine, Aubépine, Achillée, Camomille romaine |
| 7 | Le Chant des Rivières | 25g | Thym citron, Basilic citron, Frêne, Bruyère, Sureau, Menthe poivrée/bergamote, Bleuets, (Pensée sauvage, Rose) |
| 8 | Plein Air | 25g | Reine des prés, Sauge off./Agastache rugosa, Serpolet, Lierre terrestre/Géranium rosat, Hysope, Coucou/Bouillon blanc, Menthe africaine |
| 10 | L'Hivernal | 25g | Jeune Pousse Sapin, Cassis, Sureau, Serpolet, Ronce, Géranium rosat, Coucou/Bouillon Blanc |
| 11 | Tisane de Noël | 25g | Géranium rosat, Romarin, Menthe poivrée, Monarde, Coquelicot |
| 12 | Douceur Maternelle | 25g | Verveine citronnée, Fenouil (semences), Aneth (semences), Anis vert (semences), Mélisse |

### 6.2 Mélanges aromates (5 recettes)

| Nom | Poids | Plantes |
|-----|-------|---------|
| Aromate volaille | 12g | Estragon, Sarriette, Serpolet, Hysope, Bleuet |
| Aromate potage | 15g | Thym vulgaire, Serpolet, Ortie, Sauge, Livèche |
| Aromate grillades | 12g | Romarin, Serpolet, Origan, Hysope, Sarriette, Thym vulgaire |
| Pique-nique | 12g | (composition à confirmer) |
| Les Lacs | 12g | Origan, Fenouil, Basilic citron, Menthe bergamote |

### 6.3 Sels (3 recettes)

| Nom | Poids pot | Composition |
|-----|-----------|-------------|
| Sel Ortie Calendula | 35g | Ortie (43%), Calendula (2%), Sel de Guérande (55%) |
| Sel aux herbes | 40g | Romarin, Origan, Thym, Serpolet, Sarriette, Hysope, Sauge, Menthe (25%) + Sel de Guérande (75%) |
| Sel Ail des ours | 30-50g | Ail des ours (12%) + Sel de Guérande (88%) |

### 6.4 Sucres (1 recette)

| Nom | Poids pot | Composition |
|-----|-----------|-------------|
| Sucre Reine des prés | 60g | Reine des prés (7%) + Sucre blond de canne (93%) |

---

## 7. MIGRATION DES DONNÉES EXCEL

### 7.1 Fichiers source
Les fichiers Excel suivants contiennent l'historique à migrer :

1. **Plan_culture_2024_La_Sauge.xlsx** — Parcelle La Sauge
   - Feuilles "Rang 1 à 17", "Rang 18 à 34", "Rangs proches Serre" → Données visuelles du plan de culture
   - Feuilles "Traçabilité Rang 1 à 17", "Traçabilité Rang 18 à 34", "Traçabilité Rangs proches Serre" → Données structurées avec colonnes : Nom vernaculaire, Nom latin, Famille, Type cycle, N° rang, Date plantation, Nb plants, Origine (plants/semis/bouturage/division/marcottage), Provenance, Date commande, Facture, Certif AB, Commentaires

2. **Plan_de_culture_2024_Le_Combet.xlsx** — Parcelle Le Combet
   - Feuilles par jardin : "PC Jardin 1" à "PC J5" → Vues visuelles
   - Feuilles "Jardin 1" à "Jardin 5" → Données structurées (même format que La Sauge)
   - Feuille "Semis et repiquage PAM" → Données de semis (colonnes: nom, fournisseur, date facture, poids sachet, date semis, nb caissettes/godets, etc.)

3. **Transfo_tisanes_2025.xlsx** — Production tisanes 2025
   - 1 feuille par recette avec tous les lots produits
   - Feuilles "Transfo DD-MM-YYYY" = journées de transformation
   - Feuilles "Simulation" = prévisionnel

4. **Me_langes_aromates_2025.xlsx** — Production aromates 2025
5. **Sels_2025.xlsx** — Production sels 2025
6. **Sucres_2025.xlsx** — Production sucres 2025

### 7.2 Stratégie de migration — HORS SCOPE
**Décision** : la migration des données Excel historiques est **hors scope**. Le référentiel (variétés, parcelles, rangs) sera saisi manuellement via l'interface de l'application (~70 variétés, faisable en quelques heures). L'application démarre à zéro.

Les fichiers Excel ci-dessus sont conservés comme **référence** pour s'assurer que le modèle de données couvre bien tous les cas. Si un import historique est souhaité ultérieurement, un script dédié pourra être développé après stabilisation de l'application.

---

## 8. FONCTIONNALITÉS DÉTAILLÉES

### 8.1 Capteurs et validations — CRITIQUE

Pour garantir l'intégrité des données, chaque formulaire doit avoir des validations strictes :

| Champ | Validation |
|-------|-----------|
| Date | Ne peut pas être dans le futur (sauf DDM) |
| Poids | > 0, décimal avec max 2 décimales |
| Temps | > 0, en minutes, entier |
| Nombre de plants | > 0, entier |
| Pourcentage recette | Somme des % = 100% exactement |
| Parcelle → Rang | Le rang doit appartenir à la parcelle sélectionnée |
| Cueillette / Suivi de rang | **Logique adaptative** : rang → requête plantings actifs → 1 variété = auto-remplie, plusieurs = dropdown |
| Production → Stock | Vérifier que le stock est suffisant **dans l'état spécifié** pour chaque ingrédient AVANT de valider |
| Plantation → Dimensions | Pré-remplies depuis le rang (`longueur_m` et `largeur_m`), modifiables. Avertissement si la somme des `longueur_m` des plantings actifs dépasse la longueur du rang. |
| Plantation → Rang | Avertissement si le rang a déjà un planting actif. Pas de blocage. |
| Plantation → Semis | Si `seedling_id` choisi, vérifier que `nb_plants ≤ plants_restants`. Bloquer si dépassement. |
| Semis → Statut | Recalculé automatiquement à chaque mutation (pas de saisie manuelle du statut). |
| Plantation → Rang occulté | Avertissement si le rang a une occultation active (`date_fin IS NULL`). Pas de blocage. |
| Occultation → Engrais vert | `engrais_vert_nom` et `engrais_vert_fournisseur` obligatoires si méthode = engrais_vert |
| Occultation → Paille/Foin | `fournisseur` obligatoire si méthode = paille ou foin |
| Vente directe → Stock | Vérifier que le stock est suffisant AVANT de valider |
| Achat stock | Fournisseur obligatoire, état plante obligatoire |
| Numéro de lot | Unique, format imposé, auto-généré |

### 8.2 Numérotation automatique des lots

| Type | Format | Exemple |
|------|--------|---------|
| Sachet de graines | SL-AAAA-NNN | SL-2025-001 |
| Lot semis | SM-AAAA-NNN | SM-2025-001 |
| Lot tisane | [CODE]AAAAMMJJ | BD20250604 |
| Lot aromate | [CODE]AAAAMMJJ | AV20250731 |
| Lot sel | [CODE]AAAAMMJJ | SAH20250922 |
| Lot sucre | [CODE]AAAAMMJJ | SU20250425 |
| Lot sirop | SI[CODE]AAAAMMJJ | SIAV20250604 |

Les codes recettes : BD (Balade Digestive), NE (Nuit Étoilée), LS (Lever de Soleil), FC (Feu de Camp), MF (Montagne au Féminin), EQ (Équilibre), CR (Chant des Rivières), PA (Plein Air), HI (Hivernal), NO (Noël), DM (Douceur Maternelle)

### 8.3 Dashboard Bureau

Le dashboard est la page d'accueil bureau. Il montre un résumé avec des liens vers les pages dédiées.

**Widgets résumé** :
1. **Vue Parcelles** : Plan visuel des parcelles avec le contenu de chaque rang (quelle variété, état actif/arraché)
2. **Stocks** : Aperçu rapide des stocks par variété et les 6 états cumulatifs, avec alertes stock bas → lien vers **Page Vue Stock** (section 5.9)
3. **Production** : Volumes cumulés par étape avec graphique barres empilées + barres d'avancement prévu vs réalisé → lien vers **Page Vue Production totale** (section 5.10)
4. **Temps de travail** : Résumé des temps par étape et par variété (données de `production_summary`) → lien vers Page Vue Production totale pour le détail
5. **Traçabilité** : Recherche par lot produit → remonte : lot → ingrédients → stock → cueillette → rang → plantation → semis → sachet de graines
6. **Prévisionnel** : Avancement par rapport aux objectifs annuels (barres d'avancement comme dans la Vue Production totale)

### 8.4 Export de données
- Tous les tableaux de données doivent pouvoir être exportés en CSV et/ou XLSX
- Filtres par année, parcelle, variété, période

### 8.5 Sélecteur de ferme (multi-tenant)

**Emplacement** : en haut du layout bureau, au-dessus de la sidebar. Visible uniquement si l'utilisateur a accès à plusieurs fermes.

**Comportement** :
- La ferme active est stockée dans un cookie `active_farm_id`
- Toutes les données affichées et saisies concernent la ferme active
- Au switch de ferme, le cookie est mis à jour et la page rechargée
- Le helper `getContext()` (`src/lib/context.ts`) retourne `{ userId, farmId, organizationId }` pour toutes les Server Actions

**Catalogue variétés partagé** : dans les sélecteurs de variétés, toutes les variétés du catalogue sont proposées (pas seulement celles de la ferme active). Les variétés masquées via `farm_variety_settings.hidden = true` n'apparaissent pas.

**Déduplication variétés** :
- À la création d'une variété : recherche fuzzy en temps réel sur `nom_vernaculaire` + `nom_latin` + `aliases`. Affiche les variétés proches et propose de sélectionner l'existante.
- Si le nom existe déjà (contrainte UNIQUE insensible casse/accents) : message « Cette variété existe déjà » + proposition de sélection directe.
- Outil de merge super admin (Phase B6) : fusionner un doublon vers une cible (UPDATE toutes les FK + soft delete + log audit).

### 8.5b Sélection des variétés actives par ferme ("Mes variétés")

La table `farm_variety_settings` permet de masquer des variétés pour une ferme (`hidden = true`). Plutôt que de masquer les indésirables une par une (fastidieux si le catalogue grandit), l'approche est inversée :

**Page bureau "Mes variétés"** (Référentiel → Mes variétés) :
- Affiche le catalogue complet avec des checkboxes
- L'utilisateur coche les variétés qu'il utilise
- Les variétés non cochées sont automatiquement masquées (`hidden = true` dans `farm_variety_settings`)
- Recherche et filtres par famille pour faciliter la sélection
- Compteur "X variétés sélectionnées sur Y"

**Onboarding première ferme** : à la première visite de cette page (aucun `farm_variety_settings` pour cette ferme), proposer un mode "Cochez les variétés que vous cultivez" pour initialiser en une fois.

**Impact mobile** : le cache IndexedDB ne charge que les variétés non masquées (filtrage server-side). Le mobile ne voit que les variétés pertinentes dans les dropdowns, ce qui améliore l'ergonomie terrain.

**Impact technique** : aucun changement de modèle de données. `farm_variety_settings` existe déjà. C'est uniquement une page UI bureau.

**Planification** : Phase A7 (polish) ou B5. Pas dans A6.

### 8.6 Notifications

Les alertes sont stockées dans la table `notifications` et affichées dans l'UI :
- **Stock bas** : quand `stock_g < farm_variety_settings.seuil_alerte_g` pour une variété de la ferme active
- **Erreurs de sync** : échecs persistants dans la file d'attente mobile
- **Backup échoué** : erreur lors du cron de backup
- Accessible depuis une cloche de notification dans le header du bureau et depuis la barre de sync sur mobile

---

## 9. PLAN DE DÉVELOPPEMENT — DÉCOUPAGE A/B

Voir `plan-action.md` pour le détail complet. Résumé ci-dessous.

### PHASE A — Socle de données (~24-35 jours)
Toute la saisie fonctionne, le stock est juste, l'appli est utilisable au quotidien.

| Phase | Ensemble | Durée |
|-------|----------|-------|
| A0 | Fondations + Référentiel | 2-3j |
| **A0.9** | **Migration multi-tenant (⚠️ à faire MAINTENANT)** | **2j** |
| A1 | 🌱 Semis (sachets + suivi + pertes) | 2-3j |
| A2 | 🌿 Suivi parcelle (sol, plantation, suivi rang, cueillette, arrachage) | 5-7j |
| A3 | 🔄 Transformation (tronçonnage, séchage, triage + triggers stock) | 4-5j |
| A4 | 🧪 Création de produit (recettes, lots, wizard production) | 4-5j |
| A5 | 📦 Affinage du stock (achats, ventes directes, ajustements) | 2-3j |
| A6 | 📱 Mobile offline + Sync (PWA, protocole zéro perte) | 5-7j |
| A7 | Polish Phase A | 2-3j |

**✅ Fin Phase A** : utilisable au quotidien sur le terrain.

### PHASE B — Vues & Analyse (~12-18 jours)
Exposition des données collectées. Phases indépendantes, ordre flexible.

| Phase | Contenu | Durée |
|-------|---------|-------|
| B1 | 📊 Vue Stock (tableau temps réel × 6 états, alertes, graphique, export) | 2-3j |
| B2 | 📈 Vue Production totale (cumuls, prévisionnel, barres avancement, temps, export) | 3-4j |
| B3 | 🏠 Dashboard (widgets résumé, vue parcellaire) | 2-3j |
| B4 | 🔍 Traçabilité + Prévisionnel (remontée lot→graine, objectifs annuels) | 2-3j |
| B5 | Export & Polish final | 1-2j |
| B6 | 🔧 Interface super admin (impersonation, merge variétés, super data, logs) | 2-3j |

**Estimation totale : ~35-50 jours de développement**

### PHASE C — Module Miel (temps 3, après stabilisation A+B)
Le miel sera un **module autonome** intégré dans le même projet, **activable par ferme** via `farm_modules (module = 'apiculture')`. Tables entièrement séparées des tables PAM, nativement multi-tenant avec `farm_id` dès leur création.

**Ce qui est partagé** : l'environnement technique (Next.js, Supabase, auth, PWA, sync offline) et l'interface (sidebar, charte graphique).

**Ce qui est séparé** : tout le reste. Le module Miel aura son propre schéma de données, son propre workflow, ses propres vues. Les tables PAM et Miel ne se mélangent pas.

**Préparation dès Phase A** : prévoir un 6ème emplacement dans la sidebar (🍯 Miel) et s'assurer que le routage de l'application est extensible. Le schéma Miel sera conçu intégralement en Phase C.

---

## 10. POINTS DE VIGILANCE TECHNIQUES

### 10.1 Intégrité des données
- Utiliser des **transactions SQL** pour toute opération qui génère des mouvements de stock (production de lot = déduction stock + création lot, atomiquement)
- **Mouvements de stock en logique applicative** : les `stock_movements` sont créés explicitement par les routes API Next.js (dans des fonctions SQL transactionnelles), PAS par des triggers PostgreSQL. Cela rend le code plus traçable, plus facile à débugger et à tester.
- **Triggers uniquement pour `production_summary`** : la table d'agrégation `production_summary` est maintenue par des triggers SQL (c'est un cache de confort). Une **fonction admin `recalculate_production_summary()`** permet de tronquer et reconstruire entièrement cette table depuis les données sources en cas de dérive.
- **Soft delete** (colonne `deleted_at TIMESTAMPTZ DEFAULT NULL`) sur les tables critiques : `varieties`, `seed_lots`, `seedlings`, `plantings`, `harvests`, `recipes`, `production_lots`, `stock_movements`. Les tables secondaires (`soil_works`, `row_care`, `uprootings`, `cuttings`, `dryings`, `sortings`) n'ont PAS de soft delete. **Note** : `harvests` a bien un `deleted_at` (présent dans le CREATE TABLE).
- **Convention soft delete** : toutes les requêtes sur les tables avec soft delete doivent inclure `WHERE deleted_at IS NULL`. Créer des vues SQL ou un helper applicatif pour centraliser ce filtre.

**`partie_plante` — dimension plante obligatoire** :
- **Valeurs** : `'feuille'`, `'fleur'`, `'graine'`, `'racine'`, `'fruit'`, `'plante_entiere'`
- **Choix à la cueillette** : seule étape où la partie est saisie. Héritée ensuite dans tout le flux (tronçonnage, séchage, triage, production).
- **Logique adaptative** : si `varieties.parties_utilisees` a 1 seule valeur → auto-rempli sans action. Si plusieurs → dropdown obligatoire.
- **`varieties.parties_utilisees`** : `TEXT[]` avec au moins 1 valeur. Exemples : Menthe = `{'feuille'}`, Calendula = `{'fleur', 'feuille'}`, Fenouil = `{'feuille', 'graine'}`.
- **Obligatoire (NOT NULL)** sur : `harvests`, `cuttings`, `dryings`, `sortings`, `stock_movements`, `stock_purchases`, `stock_direct_sales`, `stock_adjustments`.
- **Nullable (NULL pour matériaux externes)** sur : `recipe_ingredients`, `production_lot_ingredients`, `forecasts`.
- **Stock = 3 dimensions** : `variété × partie_plante × etat_plante`. Un mouvement de stock sans `partie_plante` est impossible pour les plantes.
- **Contraintes d'intégrité** au niveau SQL (CHECK, UNIQUE, FK) en plus de la validation applicative
- **Associations polymorphiques** : `stock_movements.source_type` (texte) + `source_id` (UUID) pointent vers différentes tables sources sans FK. La traçabilité complète (B4) sera implémentée en code applicatif, pas en SQL pur.

### 10.2 Performances Supabase gratuit
- Indexer les colonnes fréquemment filtrées : `variety_id`, `row_id`, `date`, `annee`, `etat_plante`, `partie_plante`
- Index spécifique sur `stock_movements(partie_plante)` pour les requêtes de calcul de stock (filtre sur les 3 dimensions)
- Utiliser des vues SQL pour les calculs de stock plutôt que des requêtes N+1
- Mettre en cache côté client les données de référence (variétés, parcelles, rangs) qui changent rarement
- **Estimation stockage** : ~5 Mo/an pour une activité soutenue (70 variétés, ~3000 mouvements de stock/an). Les 500 Mo du plan gratuit couvrent largement >50 ans d'utilisation.
- **Estimation bandwidth Vercel** : bundle PWA ~2-3 Mo, cache Service Worker après premier chargement. 2-3 users = <1% des 100 Go gratuits.

### 10.3 Sécurité Supabase — RLS multi-tenant
- Activer RLS (Row Level Security) sur toutes les tables.
- **La politique `authenticated_full_access` est remplacée par des politiques différenciées** selon le type de table.

**Pour le catalogue partagé** (`varieties`, `external_materials`, `product_categories`) :
```sql
-- Lecture : tous les authentifiés
CREATE POLICY catalog_select ON varieties FOR SELECT USING (auth.role() = 'authenticated');
-- Création : tous les authentifiés (enrichissement collectif du catalogue)
CREATE POLICY catalog_insert ON varieties FOR INSERT WITH CHECK (auth.role() = 'authenticated');
-- Modification : ferme créatrice ou super admin
CREATE POLICY catalog_update ON varieties FOR UPDATE USING (
  created_by_farm_id IN (SELECT user_farm_ids())
  OR auth.uid() IN (SELECT user_id FROM platform_admins)
);
-- Suppression (soft delete) : ferme créatrice ou super admin
CREATE POLICY catalog_delete ON varieties FOR DELETE USING (
  created_by_farm_id IN (SELECT user_farm_ids())
  OR auth.uid() IN (SELECT user_id FROM platform_admins)
);
```

**Pour les tables métier** (toutes les tables avec `farm_id`) :
```sql
CREATE POLICY tenant_isolation ON [table_name] FOR ALL
  USING (farm_id IN (SELECT user_farm_ids()));
```

**Pour les tables plateforme** (`organizations`, `memberships`, `farms`, `farm_access`) :
```sql
-- Organisations : visible si membre
CREATE POLICY org_isolation ON organizations FOR ALL
  USING (id IN (SELECT organization_id FROM memberships WHERE user_id = auth.uid()));
-- Fermes : visible si accès (via user_farm_ids)
CREATE POLICY farm_isolation ON farms FOR ALL
  USING (id IN (SELECT user_farm_ids()));
-- Memberships : visible si même organisation
CREATE POLICY membership_isolation ON memberships FOR ALL
  USING (organization_id IN (SELECT organization_id FROM memberships WHERE user_id = auth.uid()));
```

**Pour `app_logs`** : super admin uniquement.
```sql
CREATE POLICY logs_super_admin ON app_logs FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM platform_admins));
```

**Index RLS critiques** (pour les performances de `user_farm_ids()`) :
```sql
CREATE INDEX idx_farm_access_user ON farm_access(user_id);
CREATE INDEX idx_memberships_user ON memberships(user_id);
CREATE INDEX idx_farms_org ON farms(organization_id);
```

### 10.4 Offline — OBJECTIF ZÉRO PERTE DE DONNÉES
- iOS Safari limite IndexedDB à ~50MB en PWA. Largement suffisant pour ce projet, mais ne pas stocker de fichiers lourds
- iOS peut purger IndexedDB si l'espace disque est faible. D'où l'archivage local 7 jours + la fonction d'audit qui permet de vérifier à tout moment
- La sync doit être **idempotente** : renvoyer la même donnée deux fois ne doit pas créer de doublon (UPSERT sur `uuid_client` côté serveur)
- Tester systématiquement : mode avion → saisie → retour réseau → sync → audit
- **RÈGLE ABSOLUE** : une donnée locale n'est supprimée que 7 jours après confirmation POST OK. En cas de doute, la donnée reste en local.
- La fonction d'audit batch (bouton "Tout vérifier" 🔍) est le filet de sécurité ultime : elle compare les données locales et serveur et re-pousse tout ce qui manque. Elle remplace la vérification unitaire GET verify.
- **Pas de création de variété en offline** : si l'utilisateur a besoin d'une variété absente du cache, il note le nom en commentaire et crée la variété au retour en Wi-Fi. Message clair dans l'UI : "Variété manquante ? Notez le nom en commentaire et ajoutez-la quand vous serez connecté."

### 10.5 Gestion des temps
- Tous les temps sont en **minutes** dans la base
- L'UI propose une saisie en heures:minutes (ex: "1h30" → 90 minutes) ou en minutes directes
- Le timer mobile peut proposer un chronomètre start/stop pour les opérations terrain

### 10.6 Backup quotidien — CRITIQUE
Supabase gratuit ne fournit pas de backup automatique. Solution : **cron Vercel quotidien** qui exporte les données.

**Implémentation** :
- Route API `/api/backup` qui exporte les données par organisation (un fichier JSON par organisation, isolé)
- Cron Vercel quotidien (ex: `0 3 * * *` = 3h du matin)
- Le backup est poussé vers un **repo GitHub privé dédié** (ex: `ljs-backup`) via l'API GitHub, dans un sous-dossier par organisation : `/orgs/{org_slug}/backup.json`
- Le fichier JSON est écrasé à chaque exécution, mais l'**historique Git conserve toutes les versions** (rétention naturelle)
- Cela décorrèle le backup de l'infrastructure Supabase (si Supabase tombe, le backup est sur GitHub)
- Le super admin a accès à tous les backups ; chaque organisation ne voit que le sien (si export manuel mis en place)

```json
{
  "crons": [
    { "path": "/api/keep-alive", "schedule": "0 6 * * *" },
    { "path": "/api/backup", "schedule": "0 3 * * *" }
  ]
}
```

### 10.7 Logging applicatif
Pour tracer les erreurs et événements critiques :

**Côté serveur** :
- **Vercel Logs** (gratuit, rétention 1h) pour le debug en temps réel des routes API
- **Table `app_logs` dans Supabase** pour les événements persistants :
```sql
CREATE TABLE app_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level TEXT CHECK (level IN ('info', 'warn', 'error')) NOT NULL,
  source TEXT NOT NULL,                      -- 'sync', 'stock', 'production', 'backup', etc.
  message TEXT NOT NULL,
  metadata JSONB,                            -- Détails supplémentaires (payload, erreur, etc.)
  created_at TIMESTAMPTZ DEFAULT now()
);
```
- Cron de purge automatique : supprimer les logs de plus de **90 jours** pour ne pas gonfler le stockage
- Événements loggés : erreurs de sync, échecs de transaction stock, résultats d'audit, exécutions de backup, recalculs de production_summary

**Côté client mobile** :
- Log des erreurs de sync dans IndexedDB (table locale `client_logs`)
- Accessible via un **écran debug** caché (geste spécial ou menu développeur)
- Utile pour diagnostiquer les problèmes terrain sans accès au serveur

### 10.8 Stratégie de tests
- **Tests unitaires** (Vitest) : logique de calcul de stock, validation Zod, génération numéros de lot, calcul des taux de perte semis, conversions temps
- **Tests d'intégration** : les routes API critiques — création cueillette + mouvement stock en transaction, production de lot + déduction stock + vérification solde, sync mobile avec idempotence
- **Tests E2E manuels scriptés** (checklist) : flux "mode avion → saisie → retour réseau → sync → audit → vérifier donnée en base"
- **Budget temps** : ~20% du temps de chaque phase A1-A6 est consacré aux tests. Pas de phase test séparée — les tests sont écrits au fur et à mesure.
- **Scénarios critiques à couvrir** :
  1. Flux stock complet : cueillette → tronçonnage → séchage → triage → production → vérifier stock à chaque étape
  2. Flux sans tronçonnage : cueillette → séchage direct → triage → vérifier
  3. Sync offline : saisie hors connexion → retry → sync → audit → intégrité base
  4. Idempotence : renvoyer 2x la même saisie → pas de doublon
  5. Soft delete : supprimer une cueillette → le stock_movement associé est marqué deleted → le stock recalculé est juste

### 10.9 Clôture de saison (gestion annuelle)
La gestion est par année calendaire. Les vivaces survivent d'une année sur l'autre, les annuelles non.

**Flux de clôture au 31 décembre** :
1. **Bouton "Clôturer la saison [année]"** accessible depuis le bureau (section admin/référentiel)
2. L'app affiche tous les `plantings` actifs (`actif = true`) groupés par parcelle/rang
3. Pour chaque rang avec une **vivace** : l'utilisateur confirme "Toujours actif en [année+1] ?" → Oui (reste actif) / Non (arraché)
4. Les "Non" passent `plantings.actif = false` + création automatique d'un `uprooting` daté du 31/12
5. Les **annuelles** encore marquées actives sont signalées avec un avertissement : "Cette annuelle est encore active — confirmer l'arrachage ?"
6. Récap affiché : "X rangs confirmés actifs, Y rangs clôturés"

Ce mécanisme garantit que le référentiel parcellaire reste propre d'une année sur l'autre.

### 10.10 Lieux de cueillette sauvage
Le champ `lieu_sauvage` dans `harvests` est un **texte libre avec autocomplétion** basée sur les valeurs déjà saisies (type HTML datalist ou équivalent React). Cela normalise naturellement sans contraindre : l'utilisateur voit les lieux existants mais peut en saisir un nouveau librement.

---

## 11. ARBORESCENCE PROJET SUGGÉRÉE

```
app-ljs/
├── public/
│   ├── manifest.json
│   ├── sw.js                    # Service Worker
│   └── icons/                   # Icônes PWA
├── src/
│   ├── app/                     # Next.js App Router
│   │   ├── layout.tsx           # Layout racine (html, body, polices)
│   │   ├── page.tsx             # Redirect → /[orgSlug]/dashboard
│   │   ├── login/               # Page login générique (branding plateforme)
│   │   │   ├── page.tsx
│   │   │   └── actions.ts
│   │   ├── [orgSlug]/           # Segment dynamique — résout l'organisation
│   │   │   ├── layout.tsx       # Charge l'orga par slug, injecte branding CSS variables
│   │   │   ├── (dashboard)/     # Routes métier (bureau + saisie)
│   │   │   │   ├── layout.tsx   # Sidebar + MobileHeader + sélecteur ferme
│   │   │   │   ├── dashboard/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── semis/       # 🌱 Sachets graines + suivi semis
│   │   │   │   │   ├── sachets/
│   │   │   │   │   └── suivi/
│   │   │   │   ├── parcelles/   # 🌿 Travail sol, plantation, suivi rang, cueillette, arrachage, occultation
│   │   │   │   │   ├── travail-sol/
│   │   │   │   │   ├── plantations/
│   │   │   │   │   ├── suivi-rang/
│   │   │   │   │   ├── cueillette/
│   │   │   │   │   ├── arrachage/
│   │   │   │   │   └── occultation/
│   │   │   │   ├── transformation/ # 🔄 Tronçonnage + séchage + triage
│   │   │   │   ├── produits/    # 🧪 Recettes + production lots + stock produits finis
│   │   │   │   ├── affinage-stock/ # 📦 Achats + ventes directes + ajustements
│   │   │   │   ├── stock/       # 📊 Vue Stock (Phase B)
│   │   │   │   ├── production-totale/ # 📈 Vue Production totale (Phase B)
│   │   │   │   ├── tracabilite/ # 🔍 Traçabilité (Phase B)
│   │   │   │   ├── previsionnel/ # Objectifs + avancement (Phase B)
│   │   │   │   └── referentiel/ # ⚙️ Variétés, Sites/Parcelles/Rangs, Matériaux
│   │   │   │       ├── varietes/
│   │   │   │       ├── sites/
│   │   │   │       └── materiaux/
│   │   │   └── admin/           # 🔧 Super admin (Phase B6, accès platform_admins)
│   │   │   └── (mobile)/        # Routes mobile — ULTRA-MINIMAL (sous [orgSlug])
│   │   │       ├── layout.tsx   # Layout mobile : barre sync permanente, pas de sidebar
│   │   │       └── saisie/
│   │   │           ├── page.tsx # Grille 5 tuiles d'actions
│   │   │           └── [action]/
│   │   │               └── page.tsx # Formulaire de saisie
│   │   └── api/
│   │       ├── keep-alive/
│   │       ├── backup/          # Backup quotidien → GitHub (par organisation)
│   │       └── sync/            # Endpoint de synchronisation + audit
│   ├── components/
│   │   ├── ui/                  # Composants de base (Button, Input, Card, etc.)
│   │   ├── forms/               # Formulaires réutilisables
│   │   ├── dashboard/           # Widgets dashboard
│   │   └── layout/              # Navigation, Header, FarmSelector, etc.
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts
│   │   │   ├── server.ts
│   │   │   └── types.ts         # Types générés depuis Supabase
│   │   ├── context.ts           # getContext() → { userId, farmId, organizationId, orgSlug }
│   │   ├── offline/
│   │   │   ├── db.ts            # IndexedDB setup (Dexie.js)
│   │   │   ├── sync.ts          # Logique de synchronisation (scopée farm_id)
│   │   │   └── queue.ts         # File d'attente des saisies
│   │   └── utils/
│   │       ├── dates.ts
│   │       ├── lots.ts          # Génération numéros de lot (scopée farm_id)
│   │       ├── path.ts          # buildPath(orgSlug, path) pour revalidatePath
│   │       └── validation.ts
│   ├── hooks/
│   │   ├── useOnlineStatus.ts
│   │   ├── useSyncQueue.ts
│   │   └── useStock.ts
│   ├── middleware.ts             # Auth + résolution org slug + vérification membership
│   └── types/
│       └── index.ts
├── supabase/
│   └── migrations/              # Migrations SQL (001 à 011+)
├── vercel.json
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 12. DÉPENDANCES RECOMMANDÉES

```json
{
  "dependencies": {
    "next": "latest",
    "@supabase/supabase-js": "latest",
    "@supabase/ssr": "latest",
    "dexie": "latest",                     // IndexedDB wrapper pour offline
    "react-hook-form": "latest",           // Formulaires
    "zod": "latest",                       // Validation
    "date-fns": "latest",                  // Manipulation dates
    "recharts": "latest",                  // Graphiques dashboard
    "lucide-react": "latest",              // Icônes
    "tailwindcss": "latest",               // CSS
    "xlsx": "latest"                       // Export Excel
  }
}
```

---

## 13. RÉSUMÉ DES DÉCISIONS PRISES

| Question | Décision |
|----------|----------|
| Utilisateurs | 2-3 personnes |
| Process sels/sucres/aromates | Identique aux tisanes |
| Évolution recettes entre lots | Recette de base copiée et modifiable à chaque lot |
| Numérotation des rangs | Harmoniser (anciens numéros conservés en référence) |
| Migration historique | **Hors scope**. Référentiel saisi manuellement. Import historique possible ultérieurement. |
| Clients/canaux de distribution | Hors scope |
| Photos mobile | Pas dans le MVP |
| Durée offline | Quelques heures (sync le soir en Wi-Fi) |
| Lieux cueillette sauvage | Champ texte libre **avec autocomplétion** sur valeurs existantes |
| Archivage local post-sync | 7 jours (avec garde-fou anti-saturation à 80%) |
| GitHub | Plan gratuit |
| Bureau vs Mobile | Bureau = expérience complète, Mobile = terminal de saisie uniquement |
| Traçabilité au séchage | Par variété + année (perte de lien cueillette→lot acceptée) |
| Modèle transformation | Entrées/sorties individuelles simples (pas de session) |
| Ratio séchage/triage | Calculé par variété par an (acceptable) |
| États du stock | 6 cumulatifs : frais, tronconnee, sechee, tronconnee_sechee, sechee_triee, tronconnee_sechee_triee |
| **`partie_plante`** | **Stock à 3 dimensions : variété × partie × état. Valeurs : feuille, fleur, graine, racine, fruit, plante_entiere. Choisi à la cueillette (auto si 1 seule valeur dans varieties.parties_utilisees, dropdown sinon), hérité dans tout le flux. Obligatoire (NOT NULL) sur toutes les tables de stock et transformation. Nullable sur recipe_ingredients, production_lot_ingredients, forecasts (NULL = matériaux externes ou toutes parties confondues).** |
| Tronçonnage = hachage | Même opération, génère un mouvement de stock |
| Toutes les plantes tronçonnées ? | Non, certaines sautent des étapes (flux flexible) |
| Séchage — état d'entrée | Sélecteur : frais OU tronconnee → sortie : sechee OU tronconnee_sechee |
| Triage — état d'entrée | Sélecteur : sechee OU tronconnee_sechee → sortie : sechee_triee OU tronconnee_sechee_triee |
| Production — état des ingrédients | Par ingrédient (ex: frais pour sels, tronconnee_sechee_triee pour tisanes) |
| Vue Stock | Page dédiée : tableau temps réel × 6 états + alertes stock bas + graphique + export |
| Vue Production totale | Page dédiée : table `production_summary` + tableau cumuls + prévisionnel + barres avancement + temps travail + graphiques + export |
| Cumuls de production | Table matérialisée `production_summary` mise à jour par triggers + **fonction de recalcul complet admin** |
| Dimensions rangs | `longueur_m` + `largeur_m` sur `rows` (référentiel) et `plantings` (opérationnel, modifiable). Surface et rendement calculés, pas stockés. Avertissement si somme des longueurs plantings actifs > longueur du rang. |
| Sachet → Semis | 1 sachet peut donner N semis (on sème en plusieurs fois) |
| Semis → Plantation | 1 semis peut être réparti sur N rangs |
| Variétés par rang | Plusieurs variétés possibles (rare mais supporté) |
| Sélection variété terrain | Logique adaptative : mono-variété = auto, multi = dropdown. Basé sur plantings actifs |
| Pertes aux semis | Mortes vs données, par étape (caissette puis godet pour process 2). Taux calculé automatiquement |
| Identification mini-mottes | Par numéro de caisse (identifiant terrain physique) |
| Organisation | 5 ensembles métier : Semis, Suivi parcelle, Transformation, Création produit, Affinage stock |
| Découpage projet | Phase A (socle données + saisie + mobile) → Phase B (vues + analyse, second temps) |
| Vues Phase B | Indépendantes entre elles, ordre flexible selon priorités |
| Catégorie Sirop | Ajoutée aux catégories produits. Contient plantes fraîches ou séchées + Eau (mL) + Sucre blond de canne bio (g). Conditionnement en bouteille (770mL ou 520mL). Poids en grammes en base, UI affiche mL pour les matériaux liquides. |
| Occultation de rangs | 4 méthodes (paille, foin, bâche, engrais vert). L'engrais vert est tracé en champs texte directement sur la table (pas de lien variétés). Formulaire adaptatif par méthode. Avertissement non-bloquant si plantation sur rang occulté. Le retravail du sol après occultation passe par `soil_works`. |
| Plants achetés | Plantation avec fournisseur (seedling_id NULL + fournisseur rempli). Pas besoin de semis. |
| Charte graphique | Palette officielle LJS : Vert Sauge #3A5A40/#588157, Fond Crème #F9F8F6/#FAF5E9, Texte #2C3E2D/#333, Accent Ocre #DDA15E/#BC6C25 |
| Extension Miel (Phase C) | Module autonome dans le même projet, tables 100% séparées des tables PAM. Seuls l'environnement technique (Next.js, Supabase, auth, PWA) et l'interface (sidebar, charte) sont partagés. |
| **Sync offline** | **Protocole simplifié : POST OK suffit, pas de GET verify unitaire. Audit batch "Tout vérifier" conservé comme filet de sécurité.** |
| **Mouvements de stock** | **Logique applicative (routes API + transactions SQL), pas de triggers. Triggers uniquement pour production_summary.** |
| **Soft delete** | **`deleted_at` sur tables critiques : varieties, seed_lots, seedlings, plantings, harvests, recipes, production_lots, stock_movements. Pas sur les tables secondaires.** |
| **uuid_client semis** | **Ajouté sur seed_lots et seedlings (saisie mobile possible).** |
| **Ajustements stock** | **Table dédiée `stock_adjustments` avec motif obligatoire.** |
| **Backup** | **Cron quotidien Vercel → export JSON → repo GitHub privé. Historique Git = rétention naturelle.** |
| **Logging** | **Vercel Logs (temps réel) + table `app_logs` Supabase (persistant, purge 90j) + logs client IndexedDB.** |
| **Tests** | **Unitaires (Vitest) + intégration routes API. ~20% du temps par phase. Pas de phase test séparée.** |
| **Variétés offline** | **Pas de création en offline. Message "notez en commentaire, ajoutez au retour en Wi-Fi".** |
| **Clôture de saison** | **Bouton admin 31/12, confirmation rang par rang (vivaces actives ? annuelles à clôturer ?), arrachage auto des non-confirmés.** |
| **Année sur tables transfo** | **Pas de champ dédié. Utiliser `EXTRACT(year FROM date)` dans les requêtes.** |
| **Associations polymorphiques** | **`stock_movements.source_type` + `source_id` sans FK. Traçabilité en code applicatif (B4).** |
| **Fournisseur matériaux externes** | **Saisi au moment de la production du lot (dans `production_lot_ingredients`), pas dans le référentiel. Obligatoire pour les matériaux externes.** |
| **Mode production** | **Deux modes coexistent : "produit" (partir du nombre de sachets, poids calculés depuis les %) et "melange" (partir des poids réels, conditionnement nb_unites saisi plus tard). Choix au début du wizard. La recette reste le point de départ dans les deux cas. Colonne `mode` sur `production_lots`, `nb_unites` et `poids_total_g` deviennent nullable.** |
| **Multi-tenant** | **Base unique Supabase, cloisonnement logique par `farm_id` + RLS PostgreSQL. Pas de base séparée par tenant.** |
| **Hiérarchie** | **organization → farm → user. Une organisation peut avoir plusieurs fermes. Un user peut appartenir à plusieurs organisations/fermes.** |
| **Catalogue variétés** | **Partagé sur toute la plateforme. Créable par tous les authentifiés. Modifiable uniquement par la ferme créatrice ou un super admin. Masquable par ferme via `farm_variety_settings`.** |
| **Recettes** | **Privées par ferme (`farm_id` sur `recipes`). Chaque ferme a ses propres recettes.** |
| **Variétés — déduplication** | **Contrainte UNIQUE insensible casse/accents sur `nom_vernaculaire` + `nom_latin`. Recherche fuzzy à la création. Outil de merge super admin (Phase B6).** |
| **Modules métier** | **Activables par ferme via `farm_modules` : 'pam', 'apiculture', 'maraichage'. La sidebar s'adapte aux modules actifs.** |
| **Navigation** | **Sélecteur de ferme en haut du layout bureau (visible si ≥ 2 fermes). Ferme active dans cookie `active_farm_id`. `getContext()` retourne `{ userId, farmId, organizationId }`.** |
| **Facturation** | **Par organisation : `max_farms`, `max_users`, `plan`. Onboarding manuel (super admin crée les comptes).** |
| **Export RGPD** | **Par organisation. Accessible depuis les settings de l'organisation.** |
| **Backup multi-tenant** | **Un fichier JSON par organisation, dans `/orgs/{slug}/backup.json` sur le repo GitHub privé.** |
| **Offline multi-tenant** | **Cache IndexedDB scopé par ferme active. Au switch de ferme, rechargement complet du cache. `farm_id` dans le payload sync.** |
| **Logs** | **`app_logs` global, accessible au super admin uniquement (RLS). Pas de `farm_id` sur `app_logs`.** |
| **Notifications** | **Table `notifications` avec scope ferme + user. Alertes : stock bas, erreurs sync, backup échoué.** |
| **Audit trail** | **Table `audit_log` + `created_by`/`updated_by` sur toutes les tables métier. Rempli par les Server Actions (logique applicative, pas de trigger).** |
| **Rétention données** | **On garde tout — l'historique est la valeur du produit. Pas de purge des données métier.** |
| **Multi-langue** | **Français uniquement pour l'instant.** |
| **API externe** | **Pas maintenant. Architecture REST standard Next.js, extensible si besoin.** |
| **Auth offline** | **Session Supabase 30 jours (refresh token). Pas de fallback local (PIN, cache userId). Si session expirée + offline → app inaccessible (cas irréaliste avec usage quotidien). Config : REFRESH_TOKEN_REUSE_INTERVAL = 2592000s dans Supabase Dashboard.** |
| **Service Worker** | **Serwist (successeur de next-pwa, basé sur Workbox). Précache automatique du build Next.js. Pas de SW custom.** |
| **Détection mobile** | **User-Agent dans le proxy au login → redirection vers /{orgSlug}/m/saisie si mobile. Lien de bascule "Mode terrain" / "Mode bureau" dans les deux layouts. Pas de blocage — l'utilisateur peut accéder manuellement à l'autre version.** |
| **Stockage offline — indicateur** | **Écran "État sync" accessible depuis la barre de sync mobile : espace utilisé/quota (navigator.storage.estimate()), nb saisies en attente, nb archives en rétention, bouton "Purger les archives".** |
| **Stockage offline — garde-fou** | **Purge auto des archives confirmées > 7j quand usage > 80% du quota (~40 Mo iOS). La saisie n'est jamais bloquée.** |
| **Cache variétés mobile** | **Filtrage server-side au chargement du cache : exclure hidden (farm_variety_settings) + merged_into_id NOT NULL + deleted_at NOT NULL. Le mobile ne reçoit que les variétés pertinentes pour sa ferme.** |
| **Audit batch — pagination** | **Paginer l'envoi des uuid_client par lots de 200 pour éviter les clauses IN() trop longues en SQL. Transparent pour l'UX (barre de progression).** |
| **Cache au switch de ferme** | **Rechargement complet (vider IndexedDB + recharger). Acceptable pour 2-3 fermes. Cache multi-ferme possible plus tard si besoin.** |
| **Sécurité multi-tenant offline** | **farm_id dans chaque payload sync, validé server-side via getContext(). Cache IndexedDB scopé par ferme active. Aucune donnée cross-tenant en local.** |
| **Super admin** | **Interface `/admin` séparée. Auto-membership owner sur toutes les organisations (trigger SQL `AFTER INSERT ON organizations`). Sélecteur d'organisation dans la sidebar (visible uniquement pour les platform_admins). Impersonation (`impersonate_farm_id` + bandeau rouge) conservée pour le debug. Merge variétés. Super data cross-tenant via `service_role`. Consultation `app_logs`.** |
| **Super data** | **Agrégation à la volée via `service_role` (bypass RLS). Pas de table d'agrégation dédiée pour le cross-tenant.** |
| **Statut semis** | **6 valeurs : semis, leve, repiquage, pret, en_plantation, epuise. Calculé en logique applicative (`computeSeedlingStatut`), pas de trigger. Le statut avance automatiquement quand les champs sont remplis (date_levee, date_repiquage, nb_plants_obtenus) et quand des plantings sont créés/supprimés.** |
| **Plants restants (semis)** | **Calculé : `nb_plants_obtenus - somme des nb_plants des plantings liés actifs`. Jamais stocké. Affiché dans le sélecteur de semis du formulaire plantation. Bloquant si dépassement.** |
| **UX Suivi semis** | **Fiches avec timeline/stepper visuel (4 étapes mini-motte, 5 étapes caissette/godet). Formulaire progressif en accordéon ouvert sur l'étape courante. Remplace le tableau plat.** |
| **Lien semis → plantation** | **Le sélecteur de semis dans le formulaire plantation affiche les plants disponibles par semis. Filtré par variété. Les semis épuisés sont grisés. Le statut du semis est mis à jour automatiquement après chaque plantation.** |
| **Numérotation lots** | **Scopée par `farm_id` : `UNIQUE(farm_id, lot_interne)`, `UNIQUE(farm_id, numero_lot)`. Chaque ferme a sa propre séquence.** |
| **Phase A0.9** | **Migration multi-tenant à exécuter AVANT de continuer A2.4. 2 jours : SQL + refactoring Server Actions existantes + bootstrap orga LJS.** |
| **Branding par organisation** | **Couleur primaire + secondaire + logo + nom affiché. Stocké sur la table `organizations`. Palette LJS par défaut si non personnalisé.** |
| **Stockage logos** | **Supabase Storage, bucket `org-logos`, accès public en lecture. Chemin : `{org_id}/logo.png`. Upload par le super admin lors de l'onboarding.** |
| **URL personnalisée** | **Par path (`/[orgSlug]/dashboard`), pas de sous-domaine. Résolution via `SELECT * FROM organizations WHERE slug = :slug` dans le layout.** |
| **Thème dynamique** | **CSS variables `--color-primary` et `--color-primary-light` injectées par `[orgSlug]/layout.tsx` depuis les couleurs de l'organisation. Composants utilisent `var(--color-primary)` au lieu de hex hardcodés.** |
| **revalidatePath multi-tenant** | **Chaque Server Action met à jour `revalidatePath('/[orgSlug]/...')` via un helper `buildPath(slug, path)`. Le slug est résolu depuis `getContext()`.** |