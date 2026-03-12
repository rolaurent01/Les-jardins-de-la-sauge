# Guide utilisateur — Les Jardins de la Sauge

## Accès

- **URL** : à communiquer par l'administratrice
- **Connexion** : email + mot de passe
- **Mobile** : l'application détecte automatiquement l'écran et bascule en mode terrain

---

## Navigation bureau

La **sidebar** à gauche donne accès à 7 sections principales :

| Section | Contenu |
|---------|---------|
| **Semis** | Sachets de graines, Suivi des semis |
| **Parcelle** | Travail de sol, Plantations, Suivi de rang, Cueillette, Arrachage, Occultation |
| **Transformation** | Tronçonnage, Séchage, Triage |
| **Produits** | Recettes, Production de lots, Stock produits finis |
| **Stock** | Achats, Ventes directes, Ajustements, Vue Stock |
| **Analyse** | Vue Production totale, Traçabilité, Prévisionnel |
| **Référentiel** | Variétés, Sites & Parcelles, Matériaux externes |

Le **Dashboard** (page d'accueil) affiche une vue d'ensemble : widgets stock, production, parcelles, activité récente et avancement du prévisionnel.

---

## Saisie bureau

Chaque module de saisie fonctionne de la même manière :

1. **Tableau principal** : liste les enregistrements avec recherche et filtres
2. **Bouton "+"** (en haut à droite) : ouvre le panneau de saisie (slide-over à droite)
3. **Cliquer sur une ligne** : ouvre la fiche en modification
4. **Archiver** : masque l'enregistrement (récupérable via le bouton "Archivés")
5. **Supprimer** : suppression définitive (avec confirmation)

### Filtres et recherche

- La **barre de recherche** filtre en temps réel (insensible aux accents et à la casse)
- Les **boutons filtres** permettent de restreindre par type, état, catégorie, etc.
- Les filtres se cumulent entre eux

---

## Mode terrain (mobile)

Sur un écran mobile, l'application bascule automatiquement en **mode terrain** :

1. **5 tuiles d'action** : Semis, Parcelle, Transformation, Stock, Produits
2. Chaque tuile mène à des **sous-actions** (ex : Parcelle → Cueillette)
3. Le **formulaire** s'ouvre directement — remplir et valider
4. Message **"Enregistré"** une fois la saisie confirmée

### Timer intégré

Le champ **Temps** dispose d'un bouton chronomètre pour mesurer le temps de travail directement sur le terrain.

### Synchronisation

- **Barre de sync** en haut de l'écran :
  - Vert : toutes les données sont envoyées
  - Orange : synchronisation en cours
  - Rouge : erreur de synchronisation
- Les saisies faites hors connexion sont stockées localement et envoyées automatiquement au retour en Wi-Fi
- Un bouton **"Forcer la sync"** est disponible en cas de besoin

---

## Stock

Le stock de plantes est **calculé automatiquement** à partir des mouvements :

- **Cueillette** → ajoute du stock "Frais"
- **Tronçonnage** → transforme Frais en Tronçonné
- **Séchage** → transforme en Séché
- **Triage** → transforme en Trié

Les 6 états possibles sont : **Frais**, **Tronçonné**, **Séché**, **Tronç. séché**, **Séch. trié**, **Tronç. séch. trié**.

### Vue Stock

La page **Vue Stock** (Stock → Vue Stock) affiche un tableau pivot avec le stock temps réel par variété, partie de plante et état. Des alertes de stock bas apparaissent en haut si un seuil est configuré.

### Affinage du stock

- **Achats** : enregistrer un achat externe de plantes (ajoute au stock)
- **Ventes directes** : vente de plantes en l'état (retire du stock)
- **Ajustements** : corriger le stock manuellement (inventaire, perte, etc.)

---

## Recettes & Production

### Créer une recette

1. Aller dans **Produits → Recettes**
2. Cliquer **"+ Nouvelle recette"**
3. Remplir le nom, la catégorie, le poids sachet
4. Ajouter les ingrédients avec leurs pourcentages (doivent totaliser 100%)
5. Enregistrer

### Produire un lot

1. Aller dans **Produits → Production**
2. Cliquer **"+ Produire un lot"**
3. L'assistant guide en 4 étapes :
   - Choix de la recette
   - Vérification des ingrédients disponibles en stock
   - Saisie du nombre d'unités et du poids
   - Confirmation
4. Le stock est **automatiquement déduit** à la validation

### Stock produits finis

La page **Produits → Stock** affiche les mouvements d'entrée/sortie de sachets par lot de production.

---

## Prévisionnel

La page **Prévisionnel** (Analyse → Prévisionnel) permet de :

1. **Définir des objectifs** de récolte par variété, état et année
2. **Suivre l'avancement** en temps réel (barre de progression)
3. **Copier les objectifs** d'une année à l'autre

L'avancement est calculé automatiquement à partir des cueillettes et du stock réel.

---

## Export

Chaque tableau de saisie dispose d'un bouton **"Exporter"** dans l'en-tête (à côté du bouton de création).

- **Export CSV** : fichier texte avec séparateur `;`, compatible Excel (encodage UTF-8 avec BOM)
- **Export XLSX** : fichier Excel natif

Les données exportées sont celles **après filtrage** : ce que vous voyez à l'écran est ce qui sera exporté.

Les pages d'analyse (Vue Stock, Vue Production) disposent également de leur propre export.

---

## Traçabilité

La page **Traçabilité** (Analyse → Traçabilité) permet de remonter toute la chaîne pour un lot de production :

1. Rechercher un lot par numéro ou nom de recette
2. Voir la chaîne complète : **lot → ingrédients → cueillettes → plantations → semis → sachet de graines**
3. Exporter la traçabilité en fichier texte

Cette fonctionnalité est essentielle pour la **certification AB** et les contrôles qualité.

---

## Mode hors ligne

L'application fonctionne hors connexion sur mobile :

1. **Ouvrir l'app une première fois** en Wi-Fi (les pages sont mises en cache)
2. **Sur le terrain** : saisir normalement, les données sont stockées localement
3. **Au retour en Wi-Fi** : synchronisation automatique
4. En cas de problème, utiliser le bouton **"Forcer la sync"**

---

## Référentiel

Le référentiel contient les données de base de l'application :

- **Variétés** : catalogue des plantes avec nom vernaculaire, nom latin, famille, parties utilisées
- **Sites & Parcelles** : structure géographique (site → parcelle → rang)
- **Matériaux externes** : matériaux non-plante utilisés dans les recettes (sachets, étiquettes, etc.)

Ces données sont partagées par tous les modules de saisie.
