-- ============================================================
-- Migration 004 — Ajout de la dimension partie_plante
-- ============================================================
-- Le stock est désormais à 3 dimensions : variété × partie_plante × etat_plante.
-- partie_plante est choisi à la cueillette et hérité dans toute la chaîne
-- de transformation (tronçonnage → séchage → triage → production).
--
-- Valeurs autorisées : 'feuille', 'fleur', 'graine', 'racine', 'fruit', 'plante_entiere'
--
-- Les tables sont vides en développement : le DEFAULT 'plante_entiere' permet
-- d'ajouter la colonne NOT NULL sans erreur. Il peut être retiré ultérieurement.
-- ============================================================


-- ============================================================
-- 1. RÉFÉRENTIEL — varieties
-- ============================================================

-- Liste des parties récoltables pour chaque variété.
-- Au moins 1 valeur obligatoire. Exemples :
--   Menthe        → '{"feuille"}'
--   Calendula     → '{"fleur","feuille"}'
--   Fenouil       → '{"feuille","graine"}'
ALTER TABLE varieties
  ADD COLUMN IF NOT EXISTS parties_utilisees TEXT[] NOT NULL DEFAULT '{"plante_entiere"}';


-- ============================================================
-- 2. SUIVI PARCELLE — harvests
-- ============================================================

-- Correction : deleted_at était absent du CREATE TABLE initial (déjà dans 001, mais ajouté en sécurité).
ALTER TABLE harvests
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Partie choisie à la cueillette. Logique adaptative :
--   - 1 seule valeur dans varieties.parties_utilisees → auto-rempli
--   - Plusieurs valeurs → dropdown obligatoire
ALTER TABLE harvests
  ADD COLUMN IF NOT EXISTS partie_plante TEXT
    CHECK (partie_plante IN ('feuille', 'fleur', 'graine', 'racine', 'fruit', 'plante_entiere'))
    NOT NULL DEFAULT 'plante_entiere';


-- ============================================================
-- 3. TRANSFORMATION — partie_plante héritée, jamais re-saisie
-- ============================================================

-- cuttings : hérité du stock frais en entrée
ALTER TABLE cuttings
  ADD COLUMN IF NOT EXISTS partie_plante TEXT
    CHECK (partie_plante IN ('feuille', 'fleur', 'graine', 'racine', 'fruit', 'plante_entiere'))
    NOT NULL DEFAULT 'plante_entiere';

-- dryings : hérité du stock en entrée (frais ou tronconnee)
ALTER TABLE dryings
  ADD COLUMN IF NOT EXISTS partie_plante TEXT
    CHECK (partie_plante IN ('feuille', 'fleur', 'graine', 'racine', 'fruit', 'plante_entiere'))
    NOT NULL DEFAULT 'plante_entiere';

-- sortings : hérité du stock en entrée (sechee ou tronconnee_sechee)
ALTER TABLE sortings
  ADD COLUMN IF NOT EXISTS partie_plante TEXT
    CHECK (partie_plante IN ('feuille', 'fleur', 'graine', 'racine', 'fruit', 'plante_entiere'))
    NOT NULL DEFAULT 'plante_entiere';


-- ============================================================
-- 4. STOCK (event-sourced) — partie_plante obligatoire partout
-- ============================================================

-- stock_movements : dimension centrale du stock
ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS partie_plante TEXT
    CHECK (partie_plante IN ('feuille', 'fleur', 'graine', 'racine', 'fruit', 'plante_entiere'))
    NOT NULL DEFAULT 'plante_entiere';

-- stock_purchases : saisi obligatoirement à l'achat
ALTER TABLE stock_purchases
  ADD COLUMN IF NOT EXISTS partie_plante TEXT
    CHECK (partie_plante IN ('feuille', 'fleur', 'graine', 'racine', 'fruit', 'plante_entiere'))
    NOT NULL DEFAULT 'plante_entiere';

-- stock_direct_sales : saisi obligatoirement à la vente
ALTER TABLE stock_direct_sales
  ADD COLUMN IF NOT EXISTS partie_plante TEXT
    CHECK (partie_plante IN ('feuille', 'fleur', 'graine', 'racine', 'fruit', 'plante_entiere'))
    NOT NULL DEFAULT 'plante_entiere';

-- stock_adjustments : saisi obligatoirement à l'ajustement
ALTER TABLE stock_adjustments
  ADD COLUMN IF NOT EXISTS partie_plante TEXT
    CHECK (partie_plante IN ('feuille', 'fleur', 'graine', 'racine', 'fruit', 'plante_entiere'))
    NOT NULL DEFAULT 'plante_entiere';


-- ============================================================
-- 5. PRODUITS — partie_plante nullable (NULL = matériau externe)
-- ============================================================

-- recipe_ingredients : NULL pour sel, sucre, vinaigre...
ALTER TABLE recipe_ingredients
  ADD COLUMN IF NOT EXISTS partie_plante TEXT
    CHECK (partie_plante IN ('feuille', 'fleur', 'graine', 'racine', 'fruit', 'plante_entiere'));

-- production_lot_ingredients : copié depuis recipe_ingredients
ALTER TABLE production_lot_ingredients
  ADD COLUMN IF NOT EXISTS partie_plante TEXT
    CHECK (partie_plante IN ('feuille', 'fleur', 'graine', 'racine', 'fruit', 'plante_entiere'));


-- ============================================================
-- 6. PRÉVISIONNEL — partie_plante nullable + nouvelle contrainte UNIQUE
-- ============================================================

ALTER TABLE forecasts
  ADD COLUMN IF NOT EXISTS partie_plante TEXT
    CHECK (partie_plante IN ('feuille', 'fleur', 'graine', 'racine', 'fruit', 'plante_entiere'));

-- Suppression de l'ancienne contrainte UNIQUE (annee, variety_id, etat_plante)
-- Le nom est généré automatiquement par Postgres lors de la migration 001.
ALTER TABLE forecasts
  DROP CONSTRAINT IF EXISTS forecasts_annee_variety_id_etat_plante_key;

-- Nouvelle contrainte UNIQUE cohérente avec les 3 dimensions du stock.
-- NULLS NOT DISTINCT : deux lignes avec partie_plante NULL sur la même
-- (annee, variety_id, etat_plante) seraient considérées comme dupliquées.
ALTER TABLE forecasts
  ADD CONSTRAINT forecasts_annee_variety_id_etat_plante_partie_key
    UNIQUE NULLS NOT DISTINCT (annee, variety_id, etat_plante, partie_plante);


-- ============================================================
-- 7. VUE v_stock — mise à jour avec la 3ème dimension
-- ============================================================

-- DROP obligatoire car CREATE OR REPLACE ne peut pas insérer une colonne
-- au milieu d'une vue existante (Postgres l'interpréterait comme un renommage).
DROP VIEW IF EXISTS v_stock;

CREATE VIEW v_stock AS
SELECT
  v.id                                                AS variety_id,
  v.nom_vernaculaire,
  sm.partie_plante,
  sm.etat_plante,
  SUM(
    CASE WHEN sm.type_mouvement = 'entree' THEN sm.poids_g
         ELSE -sm.poids_g
    END
  )                                                   AS stock_g
FROM stock_movements sm
JOIN varieties v ON v.id = sm.variety_id
WHERE sm.deleted_at IS NULL
  AND v.deleted_at  IS NULL
GROUP BY v.id, v.nom_vernaculaire, sm.partie_plante, sm.etat_plante;

-- Utilisation : SELECT * FROM v_stock WHERE variety_id = '...' ORDER BY partie_plante, etat_plante;
-- Pour le tableau complet bureau (colonnes par état, lignes par variété+partie) : pivoter côté applicatif.


-- ============================================================
-- 8. INDEX
-- ============================================================

-- Index sur partie_plante pour accélérer les calculs de stock sur les 3 dimensions.
CREATE INDEX IF NOT EXISTS idx_stock_movements_partie_plante
  ON stock_movements (partie_plante);

-- Index composite couvrant les 3 dimensions fréquemment filtrées ensemble.
CREATE INDEX IF NOT EXISTS idx_stock_movements_variety_partie_etat
  ON stock_movements (variety_id, partie_plante, etat_plante)
  WHERE deleted_at IS NULL;
