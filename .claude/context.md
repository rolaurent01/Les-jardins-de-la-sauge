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

### 4.2 UX Bureau — EXPÉRIENCE COMPLÈTE
Le bureau est le centre de commande. C'est ici que tout se passe : saisie, consultation, analyse, gestion.

- **Dashboard** avec widgets personnalisables : état des parcelles, stocks, avancement prévisionnel, temps de travail
- **Navigation claire** par les 5 ensembles métier dans une sidebar :
  - 🌱 Semis : Sachets de graines, Suivi semis
  - 🌿 Suivi parcelle : Travail sol, Plantation, Suivi rang, Cueillette, Arrachage
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
   - 🌿 Parcelle → Travail sol, Plantation, Suivi rang, Cueillette, Arrachage
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

#### `varieties` — Référentiel plantes
C'est LA table centrale. Chaque plante cultivée ou récoltée à l'état sauvage y est référencée.
```sql
CREATE TABLE varieties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom_vernaculaire TEXT NOT NULL UNIQUE,    -- "Lavande vraie", "Menthe marocaine" — UNIQUE pour éviter les doublons
  nom_latin TEXT,                           -- "Lavandula angustifolia"
  famille TEXT,                             -- "Lamiacées", "Astéracées"
  type_cycle TEXT CHECK (type_cycle IN ('annuelle', 'bisannuelle', 'perenne', 'vivace')),
  duree_peremption_mois INTEGER DEFAULT 24, -- Durée après séchage en mois
  parties_utilisees TEXT[] NOT NULL DEFAULT '{"plante_entiere"}', -- Parties récoltables (au moins 1 obligatoire) : 'feuille', 'fleur', 'graine', 'racine', 'fruit', 'plante_entiere'
  notes TEXT,
  deleted_at TIMESTAMPTZ DEFAULT NULL,       -- Soft delete (NULL = actif)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**IMPORTANT — Nettoyage des noms** : Dans les Excel historiques, la même plante peut apparaître sous plusieurs noms (ex: "Matricaire" / "Camomille matricaire" / "Camomille romaine" sont des plantes différentes). La saisie manuelle du référentiel devra créer un référentiel propre et dédoublonné. Liste des variétés identifiées dans les fichiers (non exhaustive) :

Lamiacées : Lavande vraie, Romarin, Sarriette, Serpolet, Thym citron, Thym vulgaire, Marjolaine, Hysope, Sauge officinale, Sauge sclarée, Mélisse, Menthe marocaine, Menthe poivrée, Menthe bergamote, Menthe gingembre, Menthe africaine, Menthe verte, Basilic grand vert, Basilic citron, Basilic thaï, Basilic tulsi, Basilic cannelle, Basilic loki, Origan, Origan grec, Agastache anisée, Agastache rugosa, Estragon, Géranium rosat, Perilla pourpre, Lierre terrestre

Astéracées : Matricaire (Camomille matricaire), Camomille romaine, Calendula (Souci des jardins), Achillée, Hélichryse, Echinacée pourpre, Artemesia annua, Bleuet, Chardon marie, Tanaisie, Chicorée

Malvacées : Mauve (de Mauritanie), Guimauve

Autres familles : Verveine citronnée (Verbénacées), Verveine argentine, Pavot de Californie (Papavéracées), Coquelicot, Fenouil (Apiacées), Aneth, Angélique, Livèche, Carvi, Monarde (Lamiacées), Bouillon blanc (Scrophulariacées), Valériane (Valérianacées), Alchemille (Rosacées), Bourrache (Boraginacées), Pensée sauvage, Œillet de poète

Sauvages (non cultivées) : Sureau, Frêne, Bruyère, Ronce, Coucou, Ortie, Rose, Aubépine, Reine des prés, Ail des ours, Jeune pousse de sapin, Lotier, Cassis (feuille)

#### `external_materials` — Matières premières non-plantes
Pour les ingrédients qui ne sont pas des plantes (sel, sucre, etc.)
```sql
CREATE TABLE external_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,                       -- "Sel de Guérande", "Sucre blond de canne"
  unite TEXT DEFAULT 'g',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### `sites` — Sites de culture
```sql
CREATE TABLE sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL UNIQUE,                 -- "La Sauge", "Le Combet"
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### `parcels` — Parcelles
```sql
CREATE TABLE parcels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES sites(id),
  nom TEXT NOT NULL,                       -- "Parcelle principale", "Jardin 1", "Jardin 2", etc.
  code TEXT NOT NULL UNIQUE,               -- "SAU", "COM-J1", "COM-J2", etc.
  orientation TEXT,                         -- "EST-OUEST", "NORD-SUD"
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(site_id, nom)
);
```

Parcelles à créer :
- **La Sauge** : "Rang 1 à 17" (code SAU-A), "Rang 18 à 34" (code SAU-B), "Rangs proches serre" (code SAU-S)
- **Le Combet** : "Jardin 1" (COM-J1), "Jardin 2" (COM-J2), "Jardin 3 Petits fruits" (COM-J3), "Jardin 4" (COM-J4), "Jardin 5" (COM-J5)

#### `rows` — Rangs (harmonisés)
```sql
CREATE TABLE rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id UUID REFERENCES parcels(id),
  numero TEXT NOT NULL,                    -- "1", "2", "3"... harmonisé
  ancien_numero TEXT,                      -- Pour garder la trace de l'ancien "1a", "1b"
  longueur_m DECIMAL,                      -- Longueur du rang en mètres si connue
  position_ordre INTEGER,                  -- Ordre d'affichage (1, 2, 3...)
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(parcel_id, numero)
);
```

**Harmonisation des rangs** : Les anciens sous-rangs (1a, 1b, 1c) deviennent des rangs à part entière avec une numérotation séquentielle. L'ancien numéro est conservé dans `ancien_numero` pour la traçabilité. Exemple pour Le Combet J2 : ancien "1a" → rang 1, ancien "1b" → rang 2, ancien "1" → rang 3, etc.

### 5.2 Module Semis (étape 1)

#### `seed_lots` — Sachets de graines
Un sachet peut donner **plusieurs semis** (on sème une partie, puis une autre plus tard).
Relation : `seed_lots (1) ←── (N) seedlings`
```sql
CREATE TABLE seed_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uuid_client UUID UNIQUE,                   -- UUID généré par le mobile, pour idempotence sync
  lot_interne TEXT NOT NULL UNIQUE,        -- N° auto-attribué par le système : "SL-2025-001"
  variety_id UUID REFERENCES varieties(id),
  fournisseur TEXT,                         -- "Agrosemens", "Sativa", etc.
  numero_lot_fournisseur TEXT,             -- Lot du fournisseur
  date_achat DATE,
  date_facture DATE,
  numero_facture TEXT,
  poids_sachet_g DECIMAL,
  certif_ab BOOLEAN DEFAULT false,
  commentaire TEXT,
  deleted_at TIMESTAMPTZ DEFAULT NULL,       -- Soft delete
  created_at TIMESTAMPTZ DEFAULT now()
);
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
  uuid_client UUID UNIQUE,                   -- UUID généré par le mobile, pour idempotence sync
  seed_lot_id UUID REFERENCES seed_lots(id),
  variety_id UUID REFERENCES varieties(id),
  processus TEXT CHECK (processus IN ('caissette_godet', 'mini_motte')),

  -- ===== PROCESS 1 : MINI-MOTTES =====
  -- La caisse est l'identifiant physique terrain (ex: "Caisse A", "Caisse B")
  numero_caisse TEXT,                      -- "A", "B"... identifiant terrain
  nb_mottes INTEGER,                       -- Nombre de mottes au départ (ex: 98)
  nb_mortes_mottes INTEGER DEFAULT 0,      -- Mortes avant plantation
  -- nb_donnees (champ commun ci-dessous)

  -- ===== PROCESS 2 : CAISSETTE/GODET (2 étapes de perte) =====
  -- Étape 1 : Caissette
  nb_caissettes INTEGER,                   -- Nombre de caissettes (ex: 1)
  nb_plants_caissette INTEGER,             -- Nombre de plants dans la caissette au départ (ex: 50)
  nb_mortes_caissette INTEGER DEFAULT 0,   -- Mortes en caissette avant repiquage (ex: 5)
  -- Étape 2 : Repiquage en godets
  nb_godets INTEGER,                       -- Nombre repiqués en godets (ex: 45)
  nb_mortes_godet INTEGER DEFAULT 0,       -- Mortes en godet avant plantation (ex: 5)
  -- nb_donnees (champ commun ci-dessous)

  -- ===== COMMUN AUX 2 PROCESSUS =====
  nb_donnees INTEGER DEFAULT 0,            -- Plants donnés (pas morts mais pas plantés)
  nb_plants_obtenus INTEGER,               -- Plants effectivement plantés (résultat final)
  -- Dates
  date_semis DATE,
  poids_graines_utilise_g DECIMAL,
  date_levee DATE,
  date_repiquage DATE,                     -- Date du repiquage caissette → godet (process 2 uniquement)
  -- Temps de travail (en minutes)
  temps_semis_min INTEGER,
  temps_repiquage_min INTEGER,
  commentaire TEXT,
  deleted_at TIMESTAMPTZ DEFAULT NULL,       -- Soft delete
  created_at TIMESTAMPTZ DEFAULT now()
);
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

### 5.3 Module Parcelles (étapes 2 à 6)

#### `soil_works` — Travail de sol (étape 2)
```sql
CREATE TABLE soil_works (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uuid_client UUID UNIQUE,                 -- UUID généré par le mobile, pour idempotence sync
  row_id UUID REFERENCES rows(id),
  date DATE NOT NULL,
  type_travail TEXT CHECK (type_travail IN ('depaillage', 'motoculteur', 'amendement', 'autre')),
  detail TEXT,                              -- Précisions (type d'amendement, etc.)
  temps_min INTEGER,
  commentaire TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### `plantings` — Plan de culture / Plantation (étape 3)
Un rang peut avoir **plusieurs variétés** (rare mais possible). Plusieurs `plantings` peuvent pointer vers le même `row_id`.
Relation : `rows (1) ←── (N) plantings`
```sql
CREATE TABLE plantings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uuid_client UUID UNIQUE,                 -- UUID généré par le mobile, pour idempotence sync
  row_id UUID REFERENCES rows(id),
  variety_id UUID REFERENCES varieties(id),
  seedling_id UUID REFERENCES seedlings(id),  -- Lien vers semis d'origine (NULL si plant acheté)
  fournisseur TEXT,                          -- Nom du fournisseur si plant acheté (ex: "Les Tilleuls", "Serres du Lycée")
  -- Logique : seedling_id rempli = issu de mes semis, fournisseur rempli = plant acheté
  annee INTEGER NOT NULL,                       -- Année de culture
  date_plantation DATE,
  nb_plants INTEGER,
  type_plant TEXT CHECK (type_plant IN ('godet', 'caissette', 'mini_motte', 'plant_achete', 'division', 'bouture', 'marcottage', 'stolon', 'rhizome', 'semis_direct')),
  espacement_cm INTEGER,
  certif_ab BOOLEAN DEFAULT false,
  date_commande DATE,
  numero_facture TEXT,
  temps_min INTEGER,
  commentaire TEXT,
  actif BOOLEAN DEFAULT true,               -- false si rang détruit/arraché
  deleted_at TIMESTAMPTZ DEFAULT NULL,       -- Soft delete
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### `row_care` — Suivi de rang (étape 4)

**Logique adaptative variété** : à la sélection du rang, le système requête les variétés actives (`plantings WHERE row_id = X AND actif = true`). Si 1 seule → auto-remplie. Si plusieurs → dropdown pour choisir. Cela permet d'imputer le temps de travail par variété.

```sql
CREATE TABLE row_care (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uuid_client UUID UNIQUE,                 -- UUID généré par le mobile, pour idempotence sync
  row_id UUID REFERENCES rows(id),
  variety_id UUID REFERENCES varieties(id) NOT NULL,  -- Auto-rempli si mono-variété, choisi si multi
  date DATE NOT NULL,
  type_soin TEXT CHECK (type_soin IN ('desherbage', 'paillage', 'arrosage', 'autre')),
  temps_min INTEGER,
  commentaire TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- Si un rang a 2 variétés, l'utilisateur saisit 2 lignes (une par variété)
-- pour imputer correctement le temps de travail
```

#### `harvests` — Cueillette (étape 5) ⭐ CRÉE DU STOCK FRAIS

**Logique adaptative variété** : même logique que le suivi de rang. Sélection du rang → si 1 variété active → auto-remplie. Si plusieurs → dropdown.

```sql
CREATE TABLE harvests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uuid_client UUID UNIQUE,                 -- UUID généré par le mobile, pour idempotence sync
  type_cueillette TEXT CHECK (type_cueillette IN ('parcelle', 'sauvage')) NOT NULL,
  -- Si parcelle
  row_id UUID REFERENCES rows(id),          -- NULL si sauvage
  -- Si sauvage
  lieu_sauvage TEXT,                         -- Texte libre : "Bord de la rivière", "Forêt du Combet"
  -- Commun
  variety_id UUID REFERENCES varieties(id) NOT NULL,  -- Auto-rempli si mono-variété, choisi si multi
  partie_plante TEXT CHECK (partie_plante IN ('feuille', 'fleur', 'graine', 'racine', 'fruit', 'plante_entiere')) NOT NULL,
  -- Logique adaptative partie_plante : si varieties.parties_utilisees a 1 seule valeur → auto-rempli.
  -- Si plusieurs valeurs → dropdown obligatoire. La partie est choisie ici et héritée dans toute la chaîne.
  date DATE NOT NULL,
  poids_g DECIMAL NOT NULL,
  temps_min INTEGER,
  commentaire TEXT,
  deleted_at TIMESTAMPTZ DEFAULT NULL,       -- Soft delete
  created_at TIMESTAMPTZ DEFAULT now()
);
-- → La route API crée le stock_movement ENTRÉE frais en logique applicative (dans une transaction SQL)
```

#### `uprootings` — Arrachage (étape 6)

**Logique adaptative** : même logique. Si le rang a plusieurs variétés, on précise laquelle est arrachée. L'arrachage passe `plantings.actif = false` pour la plantation correspondante (pas forcément toutes les variétés du rang).

```sql
CREATE TABLE uprootings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uuid_client UUID UNIQUE,                 -- UUID généré par le mobile, pour idempotence sync
  row_id UUID REFERENCES rows(id) NOT NULL,
  variety_id UUID REFERENCES varieties(id),  -- Auto-rempli si mono, choisi si multi. NULL = tout le rang
  date DATE NOT NULL,
  temps_min INTEGER,
  commentaire TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- → Passe plantings.actif = false pour la variété arrachée sur ce rang
```

### 5.4 Module Transformation (étapes 7 à 9)

#### `cuttings` — Tronçonnage (étape 7) ⭐ GÉNÈRE DU STOCK
Même modèle simplifié que séchage et triage : entrées et sorties individuelles.
```sql
CREATE TABLE cuttings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uuid_client UUID UNIQUE,                 -- UUID généré par le mobile, pour idempotence sync
  variety_id UUID REFERENCES varieties(id) NOT NULL,
  partie_plante TEXT CHECK (partie_plante IN ('feuille', 'fleur', 'graine', 'racine', 'fruit', 'plante_entiere')) NOT NULL,
  -- Hérité du stock frais en entrée — jamais re-saisi par l'utilisateur
  type TEXT CHECK (type IN ('entree', 'sortie')) NOT NULL,  -- entrée = charge, sortie = décharge
  date DATE NOT NULL,
  poids_g DECIMAL NOT NULL,
  temps_min INTEGER,
  commentaire TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- → La route API crée les stock_movements en logique applicative (dans une transaction SQL) :
-- → Si type = entree : stock_movement SORTIE frais
-- → Si type = sortie : stock_movement ENTRÉE tronçonnée
```

#### `dryings` — Séchage (étape 8) ⭐ GÉNÈRE DU STOCK
Même modèle simplifié : entrées et sorties individuelles. L'utilisateur choisit l'état de la plante via un sélecteur.
```sql
CREATE TABLE dryings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uuid_client UUID UNIQUE,                 -- UUID généré par le mobile, pour idempotence sync
  variety_id UUID REFERENCES varieties(id) NOT NULL,
  partie_plante TEXT CHECK (partie_plante IN ('feuille', 'fleur', 'graine', 'racine', 'fruit', 'plante_entiere')) NOT NULL,
  -- Hérité du stock en entrée — jamais re-saisi par l'utilisateur
  type TEXT CHECK (type IN ('entree', 'sortie')) NOT NULL,
  etat_plante TEXT NOT NULL,
  -- Si type = 'entree' : sélecteur → 'frais' | 'tronconnee'
  -- Si type = 'sortie' : sélecteur → 'sechee' | 'tronconnee_sechee'
  date DATE NOT NULL,
  poids_g DECIMAL NOT NULL,
  temps_min INTEGER,                        -- Temps de travail (chargement ou déchargement)
  commentaire TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- → La route API crée les stock_movements en logique applicative (dans une transaction SQL) :
-- → Si type = entree : stock_movement SORTIE de etat_plante (frais ou tronconnee)
-- → Si type = sortie : stock_movement ENTRÉE dans etat_plante (sechee ou tronconnee_sechee)
-- → Validation : entree ne peut être que 'frais' ou 'tronconnee'
-- → Validation : sortie ne peut être que 'sechee' ou 'tronconnee_sechee'
```

#### `sortings` — Triage (étape 9) ⭐ GÉNÈRE DU STOCK
Même modèle simplifié. L'utilisateur choisit l'état de la plante via un sélecteur.
```sql
CREATE TABLE sortings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uuid_client UUID UNIQUE,                 -- UUID généré par le mobile, pour idempotence sync
  variety_id UUID REFERENCES varieties(id) NOT NULL,
  partie_plante TEXT CHECK (partie_plante IN ('feuille', 'fleur', 'graine', 'racine', 'fruit', 'plante_entiere')) NOT NULL,
  -- Hérité du stock en entrée — jamais re-saisi par l'utilisateur
  type TEXT CHECK (type IN ('entree', 'sortie')) NOT NULL,
  etat_plante TEXT NOT NULL,
  -- Si type = 'entree' : sélecteur → 'sechee' | 'tronconnee_sechee'
  -- Si type = 'sortie' : sélecteur → 'sechee_triee' | 'tronconnee_sechee_triee'
  date DATE NOT NULL,
  poids_g DECIMAL NOT NULL,
  temps_min INTEGER,
  commentaire TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- → La route API crée les stock_movements en logique applicative (dans une transaction SQL) :
-- → Si type = entree : stock_movement SORTIE de etat_plante (sechee ou tronconnee_sechee)
-- → Si type = sortie : stock_movement ENTRÉE dans etat_plante (sechee_triee ou tronconnee_sechee_triee)
-- → Validation : entree ne peut être que 'sechee' ou 'tronconnee_sechee'
-- → Validation : sortie ne peut être que 'sechee_triee' ou 'tronconnee_sechee_triee'
```

### 5.5 Module Stock (étape 10) — EVENT-SOURCED

Le stock n'est JAMAIS stocké directement. Il est **calculé** à partir de tous les mouvements. C'est un principe fondamental pour la traçabilité.

#### `stock_movements` — Mouvements de stock
```sql
CREATE TABLE stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variety_id UUID REFERENCES varieties(id) NOT NULL,
  partie_plante TEXT CHECK (partie_plante IN ('feuille', 'fleur', 'graine', 'racine', 'fruit', 'plante_entiere')) NOT NULL,
  -- Dimension du stock : variété × partie × état. Hérité de la cueillette, jamais modifié.
  date DATE NOT NULL,
  type_mouvement TEXT CHECK (type_mouvement IN ('entree', 'sortie')) NOT NULL,
  etat_plante TEXT CHECK (etat_plante IN ('frais', 'tronconnee', 'sechee', 'tronconnee_sechee', 'sechee_triee', 'tronconnee_sechee_triee')) NOT NULL,
  poids_g DECIMAL NOT NULL,
  -- Traçabilité : d'où vient ce mouvement ?
  source_type TEXT NOT NULL,                -- 'cueillette', 'tronconnage_entree', 'tronconnage_sortie', 'sechage_entree', 'sechage_sortie', 'triage_entree', 'triage_sortie', 'production', 'achat', 'vente_directe', 'ajustement'
  source_id UUID,                           -- ID de l'enregistrement source (NULL pour achat/vente/ajustement)
  commentaire TEXT,
  deleted_at TIMESTAMPTZ DEFAULT NULL,       -- Soft delete
  created_at TIMESTAMPTZ DEFAULT now()
);
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
  uuid_client UUID UNIQUE,                 -- UUID généré par le mobile, pour idempotence sync
  variety_id UUID REFERENCES varieties(id) NOT NULL,
  partie_plante TEXT CHECK (partie_plante IN ('feuille', 'fleur', 'graine', 'racine', 'fruit', 'plante_entiere')) NOT NULL,
  -- Saisi obligatoirement à l'achat : quelle partie de la plante est achetée
  date DATE NOT NULL,
  etat_plante TEXT CHECK (etat_plante IN ('frais', 'tronconnee', 'sechee', 'tronconnee_sechee', 'sechee_triee', 'tronconnee_sechee_triee')) NOT NULL,
  poids_g DECIMAL NOT NULL,
  fournisseur TEXT,                         -- Nom du producteur / fournisseur
  numero_lot_fournisseur TEXT,
  certif_ab BOOLEAN DEFAULT false,
  prix DECIMAL,                             -- Prix d'achat (optionnel, pour suivi coûts)
  commentaire TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- → La route API génère le stock_movement de type 'achat' en ENTRÉE (dans une transaction SQL)
```

#### `stock_direct_sales` — Ventes directes de plantes (sans recette)
Pour vendre du vrac ou des plantes en l'état, sans passer par la production d'un lot.
```sql
CREATE TABLE stock_direct_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uuid_client UUID UNIQUE,                 -- UUID généré par le mobile, pour idempotence sync
  variety_id UUID REFERENCES varieties(id) NOT NULL,
  partie_plante TEXT CHECK (partie_plante IN ('feuille', 'fleur', 'graine', 'racine', 'fruit', 'plante_entiere')) NOT NULL,
  -- Saisi obligatoirement à la vente : quelle partie de la plante est vendue
  date DATE NOT NULL,
  etat_plante TEXT CHECK (etat_plante IN ('frais', 'tronconnee', 'sechee', 'tronconnee_sechee', 'sechee_triee', 'tronconnee_sechee_triee')) NOT NULL,
  poids_g DECIMAL NOT NULL,
  destinataire TEXT,                        -- Qui achète (optionnel)
  commentaire TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- → La route API génère le stock_movement de type 'vente_directe' en SORTIE (dans une transaction SQL)
-- → Vérifier que le stock est suffisant AVANT validation
```

#### `stock_adjustments` — Ajustements manuels de stock
Pour corriger les écarts d'inventaire. Le motif est obligatoire pour traçabilité.
```sql
CREATE TABLE stock_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uuid_client UUID UNIQUE,                   -- UUID généré par le mobile, pour idempotence sync
  variety_id UUID REFERENCES varieties(id) NOT NULL,
  partie_plante TEXT CHECK (partie_plante IN ('feuille', 'fleur', 'graine', 'racine', 'fruit', 'plante_entiere')) NOT NULL,
  -- Saisi obligatoirement : quelle partie de la plante est ajustée
  date DATE NOT NULL,
  type_mouvement TEXT CHECK (type_mouvement IN ('entree', 'sortie')) NOT NULL,
  etat_plante TEXT CHECK (etat_plante IN ('frais', 'tronconnee', 'sechee', 'tronconnee_sechee', 'sechee_triee', 'tronconnee_sechee_triee')) NOT NULL,
  poids_g DECIMAL NOT NULL,
  motif TEXT NOT NULL,                        -- Obligatoire : pourquoi cet ajustement
  created_at TIMESTAMPTZ DEFAULT now()
);
-- → Génère automatiquement un stock_movement avec source_type = 'ajustement'
```

**Vue stock SQL de base** (le stock est toujours calculé, jamais stocké directement) :
```sql
-- Stock par variété, partie et état — 3 dimensions
SELECT
  variety_id,
  partie_plante,
  etat_plante,
  SUM(CASE WHEN type_mouvement = 'entree' THEN poids_g ELSE -poids_g END) as stock_g
FROM stock_movements
WHERE deleted_at IS NULL
GROUP BY variety_id, partie_plante, etat_plante;
```
Voir section 5.9 pour la page Vue Stock complète.

### 5.6 Module Produits (étape 11)

#### `product_categories` — Catégories de produits
```sql
CREATE TABLE product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL UNIQUE,                  -- "Tisane", "Mélange aromate", "Sel", "Sucre", "Vinaigre", "Sirop"
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### `recipes` — Recettes de base
```sql
CREATE TABLE recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES product_categories(id),
  nom TEXT NOT NULL UNIQUE,                  -- "La Balade Digestive", "Nuit Étoilée"
  numero_tisane TEXT,                       -- "Tisane 1", "Tisane 2"... si applicable
  poids_sachet_g DECIMAL NOT NULL,         -- 20g, 25g, 30g — fixe pour la recette ; pour les vinaigres, valeur en grammes (250g ≈ 250mL, affiché en mL dans l'UI)
  description TEXT,
  actif BOOLEAN DEFAULT true,
  deleted_at TIMESTAMPTZ DEFAULT NULL,       -- Soft delete
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
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
  uuid_client UUID UNIQUE,                 -- UUID généré par le mobile, pour idempotence sync
  recipe_id UUID REFERENCES recipes(id),
  numero_lot TEXT NOT NULL UNIQUE,         -- "BD 20250604", généré : [CODE_RECETTE][DATE]
  date_production DATE NOT NULL,
  ddm DATE NOT NULL,                        -- Date de Durabilité Minimale
  nb_unites INTEGER NOT NULL,              -- Nombre de sachets/pots
  poids_total_g DECIMAL NOT NULL,          -- = nb_unites * poids_sachet
  temps_min INTEGER,
  commentaire TEXT,
  deleted_at TIMESTAMPTZ DEFAULT NULL,       -- Soft delete
  created_at TIMESTAMPTZ DEFAULT now()
);
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

**Processus de création de lot** :
1. L'utilisateur choisit une recette et un nombre de sachets
2. Le système copie les `recipe_ingredients` dans `production_lot_ingredients` (y compris `etat_plante` et `partie_plante` par ingrédient)
3. L'utilisateur peut modifier les pourcentages (la somme doit rester = 1.0)
4. L'utilisateur peut changer des plantes (remplacer une variété par une autre)
5. L'utilisateur peut changer l'état d'un ingrédient (ex: utiliser du frais au lieu de trié)
6. Le système calcule les poids réels et vérifie le stock disponible **dans l'état ET la partie spécifiés pour chaque ingrédient** (les 3 dimensions : variété × partie × état)
7. À la validation, le système crée les `stock_movements` de sortie pour chaque ingrédient plante, **dans l'état ET la partie correspondants**
8. Le lot est créé avec son numéro et sa DDM

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
  production_lot_id UUID REFERENCES production_lots(id),
  date DATE NOT NULL,
  type_mouvement TEXT CHECK (type_mouvement IN ('entree', 'sortie')),
  quantite INTEGER NOT NULL,               -- Nombre de sachets/pots
  commentaire TEXT,                         -- "Vente marché", "Livraison Aintimiste"
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 5.7 Module Prévisionnel

#### `forecasts` — Prévisionnel par variété
```sql
CREATE TABLE forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  annee INTEGER NOT NULL,
  variety_id UUID REFERENCES varieties(id) NOT NULL,
  etat_plante TEXT CHECK (etat_plante IN ('frais', 'tronconnee', 'sechee', 'tronconnee_sechee', 'sechee_triee', 'tronconnee_sechee_triee')),
  partie_plante TEXT CHECK (partie_plante IN ('feuille', 'fleur', 'graine', 'racine', 'fruit', 'plante_entiere')),  -- NULL = toutes parties confondues
  -- Le prévisionnel doit être cohérent avec les 3 dimensions du stock : variété × partie × état
  quantite_prevue_g DECIMAL,
  commentaire TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(annee, variety_id, etat_plante, partie_plante)
);
```

### 5.8 Table `production_summary` — Cumuls d'activité

Table matérialisée, mise à jour automatiquement par trigger à chaque opération. Contient les cumuls de volumes et de temps par variété, par année et par mois. **Ne contient PAS le stock** (voir 5.9).

**Fonction de recalcul** : une fonction admin `recalculate_production_summary()` tronque et reconstruit entièrement cette table depuis les tables sources (`harvests`, `cuttings`, `dryings`, `sortings`, `production_lot_ingredients`, `stock_direct_sales`, `stock_purchases`). Accessible via un bouton dans l'espace admin bureau. À utiliser en cas de doute sur l'intégrité des cumuls.

```sql
CREATE TABLE production_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
  UNIQUE(variety_id, annee, mois)
);
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
- Alertes stock bas : seuil configurable par variété (champ `seuil_alerte_g` dans `varieties`). Notification visuelle quand le stock total passe sous le seuil.

**Alerte stock bas** — ajouter dans `varieties` :
```sql
ALTER TABLE varieties ADD COLUMN seuil_alerte_g DECIMAL;  -- NULL = pas d'alerte
```

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

---

## 9. PLAN DE DÉVELOPPEMENT — DÉCOUPAGE A/B

Voir `plan-action.md` pour le détail complet. Résumé ci-dessous.

### PHASE A — Socle de données (~25-35 jours)
Toute la saisie fonctionne, le stock est juste, l'appli est utilisable au quotidien.

| Phase | Ensemble | Durée |
|-------|----------|-------|
| A0 | Fondations + Référentiel | 2-3j |
| A1 | 🌱 Semis (sachets + suivi + pertes) | 2-3j |
| A2 | 🌿 Suivi parcelle (sol, plantation, suivi rang, cueillette, arrachage) | 5-7j |
| A3 | 🔄 Transformation (tronçonnage, séchage, triage + triggers stock) | 4-5j |
| A4 | 🧪 Création de produit (recettes, lots, wizard production) | 4-5j |
| A5 | 📦 Affinage du stock (achats, ventes directes, ajustements) | 2-3j |
| A6 | 📱 Mobile offline + Sync (PWA, protocole zéro perte) | 5-7j |
| A7 | Polish Phase A | 2-3j |

**✅ Fin Phase A** : utilisable au quotidien sur le terrain.

### PHASE B — Vues & Analyse (~10-15 jours)
Exposition des données collectées. Phases indépendantes, ordre flexible.

| Phase | Contenu | Durée |
|-------|---------|-------|
| B1 | 📊 Vue Stock (tableau temps réel × 6 états, alertes, graphique, export) | 2-3j |
| B2 | 📈 Vue Production totale (cumuls, prévisionnel, barres avancement, temps, export) | 3-4j |
| B3 | 🏠 Dashboard (widgets résumé, vue parcellaire) | 2-3j |
| B4 | 🔍 Traçabilité + Prévisionnel (remontée lot→graine, objectifs annuels) | 2-3j |
| B5 | Export & Polish final | 1-2j |

**Estimation totale : ~30-45 jours de développement**

### PHASE C — Module Miel (temps 3, après stabilisation A+B)
Le miel sera un **module autonome** intégré dans le même projet, avec des **tables entièrement séparées** des tables PAM. Aucune réutilisation de `varieties`, `recipes`, `stock_movements`, etc.

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

### 10.3 Sécurité Supabase
- Activer RLS (Row Level Security) sur toutes les tables
- Politique simple : tous les utilisateurs authentifiés ont accès à tout (petite équipe de confiance)
```sql
CREATE POLICY "Authenticated users can do everything"
ON [table_name]
FOR ALL
USING (auth.role() = 'authenticated');
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
- Route API `/api/backup` qui exporte toutes les tables en JSON
- Cron Vercel quotidien (ex: `0 3 * * *` = 3h du matin)
- Le backup est poussé vers un **repo GitHub privé dédié** (ex: `ljs-backup`) via l'API GitHub
- Le fichier JSON est écrasé à chaque exécution, mais l'**historique Git conserve toutes les versions** (rétention naturelle)
- Cela décorrèle le backup de l'infrastructure Supabase (si Supabase tombe, le backup est sur GitHub)

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
│   │   ├── layout.tsx
│   │   ├── page.tsx             # Dashboard bureau
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   └── ...
│   │   ├── (desktop)/           # Routes bureau — EXPÉRIENCE COMPLÈTE
│   │   │   │
│   │   │   │── # ═══ PHASE A — Saisie ═══
│   │   │   ├── semis/          # 🌱 Sachets graines + suivi semis
│   │   │   ├── parcelle/       # 🌿 Travail sol, plantation, suivi rang, cueillette, arrachage
│   │   │   ├── transformation/ # 🔄 Tronçonnage + séchage + triage
│   │   │   ├── produits/       # 🧪 Recettes + production lots + stock produits finis
│   │   │   ├── affinage-stock/ # 📦 Achats + ventes directes + ajustements
│   │   │   │
│   │   │   │── # ═══ PHASE B — Vues ═══
│   │   │   ├── stock/          # 📊 Vue Stock (temps réel + alertes)
│   │   │   ├── production-totale/ # 📈 Vue Production totale (cumuls + prévisionnel)
│   │   │   ├── dashboard/      # 🏠 Dashboard (widgets résumé)
│   │   │   ├── tracabilite/    # 🔍 Recherche lot → remontée complète
│   │   │   ├── previsionnel/   # Objectifs + avancement
│   │   │   │
│   │   │   │── # ═══ Référentiel ═══
│   │   │   ├── varietes/       # ⚙️ CRUD variétés
│   │   │   ├── parcelles/      # ⚙️ CRUD sites/parcelles/rangs
│   │   │   └── materiaux/      # ⚙️ CRUD matériaux externes
│   │   │   └── dashboard/      # Dashboard complet avec widgets résumé
│   │   ├── (mobile)/            # Routes mobile — ULTRA-MINIMAL
│   │   │   ├── layout.tsx       # Layout mobile : barre sync + pas de navigation
│   │   │   └── saisie/
│   │   │       ├── page.tsx     # Grille de tuiles d'actions (SEUL écran de navigation)
│   │   │       └── [action]/    # Route dynamique : formulaire de saisie
│   │   │           └── page.tsx # 1 formulaire par action, retour auto après enregistrement
│   │   └── api/
│   │       ├── keep-alive/
│   │       ├── backup/              # Backup quotidien → GitHub
│   │       └── sync/                # Endpoint de synchronisation + audit
│   ├── components/
│   │   ├── ui/                  # Composants de base (Button, Input, Card, etc.)
│   │   ├── forms/               # Formulaires réutilisables
│   │   ├── dashboard/           # Widgets dashboard
│   │   └── layout/              # Navigation, Header, etc.
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts
│   │   │   ├── server.ts
│   │   │   └── types.ts         # Types générés depuis Supabase
│   │   ├── offline/
│   │   │   ├── db.ts            # IndexedDB setup (Dexie.js)
│   │   │   ├── sync.ts          # Logique de synchronisation
│   │   │   └── queue.ts         # File d'attente des saisies
│   │   └── utils/
│   │       ├── dates.ts
│   │       ├── lots.ts          # Génération numéros de lot
│   │       └── validation.ts
│   ├── hooks/
│   │   ├── useOnlineStatus.ts
│   │   ├── useSyncQueue.ts
│   │   └── useStock.ts
│   └── types/
│       └── index.ts
├── scripts/                     # Scripts utilitaires éventuels
├── supabase/
│   └── migrations/              # Migrations SQL
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