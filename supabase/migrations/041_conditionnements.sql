-- Migration 041 : Table conditionnements (mise en bouteille / conditionnement)
-- Permet de tracer les mises en bouteille depuis un lot de production en vrac (mode melange).
-- Un lot melange peut avoir 0..N conditionnements, chacun avec son numero de lot,
-- date, nombre d'unites, temps de travail et DDM.
--
-- Le mode "produit" (tisanes) n'est pas impacte : numero_lot + nb_unites restent sur le lot.

BEGIN;

-- ============================================================
-- 1. Table conditionnements
-- ============================================================

CREATE TABLE conditionnements (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id                UUID NOT NULL REFERENCES farms(id),
  production_lot_id      UUID NOT NULL REFERENCES production_lots(id),
  numero_lot             TEXT NOT NULL,
  date_conditionnement   DATE NOT NULL,
  nb_unites              INTEGER NOT NULL CHECK (nb_unites > 0),
  temps_min              INTEGER,
  ddm                    DATE,
  commentaire            TEXT,
  deleted_at             TIMESTAMPTZ DEFAULT NULL,
  created_by             UUID,
  updated_by             UUID,
  created_at             TIMESTAMPTZ DEFAULT now()
);

-- Index
CREATE INDEX idx_conditionnements_farm ON conditionnements(farm_id);
CREATE INDEX idx_conditionnements_lot ON conditionnements(production_lot_id);
CREATE INDEX idx_conditionnements_numero ON conditionnements(farm_id, numero_lot);

-- RLS
ALTER TABLE conditionnements ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON conditionnements
  FOR ALL USING (farm_id IN (SELECT user_farm_ids()));

-- ============================================================
-- 2. production_lots : numero_lot nullable pour mode melange
-- ============================================================

-- Retirer la contrainte UNIQUE et NOT NULL sur numero_lot
-- pour permettre NULL en mode melange (le lot n'a pas de numero tant que pas conditionne)
ALTER TABLE production_lots ALTER COLUMN numero_lot DROP NOT NULL;

-- L'ancien UNIQUE doit etre remplace par un UNIQUE partiel (non-null seulement)
-- D'abord trouver et supprimer l'ancienne contrainte
DO $$
DECLARE
  v_constraint TEXT;
BEGIN
  SELECT conname INTO v_constraint
  FROM pg_constraint
  WHERE conrelid = 'production_lots'::regclass
    AND contype = 'u'
    AND EXISTS (
      SELECT 1
      FROM unnest(conkey) AS k
      JOIN pg_attribute a ON a.attrelid = conrelid AND a.attnum = k
      WHERE a.attname = 'numero_lot'
    )
  LIMIT 1;

  IF v_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE production_lots DROP CONSTRAINT %I', v_constraint);
  END IF;
END $$;

-- Recreer un index unique partiel : unicite seulement quand numero_lot IS NOT NULL
CREATE UNIQUE INDEX IF NOT EXISTS uq_production_lots_numero_lot
  ON production_lots(farm_id, numero_lot)
  WHERE numero_lot IS NOT NULL AND deleted_at IS NULL;

-- ============================================================
-- 3. product_stock_movements : ajout conditionnement_id
-- ============================================================

ALTER TABLE product_stock_movements
  ADD COLUMN IF NOT EXISTS conditionnement_id UUID REFERENCES conditionnements(id);

CREATE INDEX idx_product_stock_movements_conditionnement
  ON product_stock_movements(conditionnement_id)
  WHERE conditionnement_id IS NOT NULL;

-- Contrainte : production_lot_id OU conditionnement_id, pas les deux
ALTER TABLE product_stock_movements
  ADD CONSTRAINT chk_stock_movement_source
  CHECK (NOT (production_lot_id IS NOT NULL AND conditionnement_id IS NOT NULL));

-- ============================================================
-- 4. RPC : creer un conditionnement
-- ============================================================

CREATE OR REPLACE FUNCTION create_conditionnement(
  p_farm_id              UUID,
  p_production_lot_id    UUID,
  p_numero_lot           TEXT,
  p_date_conditionnement DATE,
  p_nb_unites            INTEGER,
  p_temps_min            INTEGER,
  p_ddm                  DATE,
  p_commentaire          TEXT,
  p_created_by           UUID
) RETURNS UUID AS $$
DECLARE
  v_cond_id UUID;
BEGIN
  -- Validation
  IF p_nb_unites IS NULL OR p_nb_unites <= 0 THEN
    RAISE EXCEPTION 'nb_unites invalide: %. Doit etre > 0', p_nb_unites;
  END IF;

  -- Verifier que le lot existe, appartient a la ferme, est en mode melange, et pas supprime
  IF NOT EXISTS (
    SELECT 1 FROM production_lots
    WHERE id = p_production_lot_id
      AND farm_id = p_farm_id
      AND mode = 'melange'
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Lot introuvable, supprime, ou pas en mode melange: %', p_production_lot_id;
  END IF;

  -- Creer le conditionnement
  INSERT INTO conditionnements (
    farm_id, production_lot_id, numero_lot, date_conditionnement,
    nb_unites, temps_min, ddm, commentaire, created_by
  ) VALUES (
    p_farm_id, p_production_lot_id, p_numero_lot, p_date_conditionnement,
    p_nb_unites, p_temps_min, p_ddm, p_commentaire, p_created_by
  ) RETURNING id INTO v_cond_id;

  RETURN v_cond_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- 5. RPC : supprimer un conditionnement (soft delete)
-- ============================================================

CREATE OR REPLACE FUNCTION delete_conditionnement(
  p_cond_id    UUID,
  p_farm_id    UUID,
  p_updated_by UUID
) RETURNS VOID AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM conditionnements
    WHERE id = p_cond_id AND farm_id = p_farm_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Conditionnement introuvable ou deja supprime: %', p_cond_id;
  END IF;

  -- Soft delete du conditionnement
  UPDATE conditionnements
  SET deleted_at = NOW(), updated_by = p_updated_by
  WHERE id = p_cond_id AND farm_id = p_farm_id;

  -- Soft delete des mouvements de stock associes
  UPDATE product_stock_movements
  SET deleted_at = NOW()
  WHERE conditionnement_id = p_cond_id AND farm_id = p_farm_id AND deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMIT;
