-- Migration 037 : Stock de graines (seed stock)
--
-- Ajoute un systeme de suivi de stock par sachet de graines, aligne sur le
-- pattern existant stock_movements / stock_adjustments :
--
--   1. seed_stock_movements  — mouvements entree/sortie par sachet
--   2. seed_stock_adjustments — inventaires manuels (poids constata)
--   3. v_seed_stock — vue stock restant par sachet
--   4. v_seed_cost_per_seedling — vue poids graines estime par semis
--   5. Trigger sur seed_lots INSERT → mouvement entree auto
--   6. Trigger sur seedlings INSERT/UPDATE/DELETE → mouvement sortie auto
--      (si poids_graines_utilise_g renseigne)
--   7. RPCs transactionnelles pour ajustements
--   8. Trigger archivage auto du sachet quand stock = 0
--   9. Backfill des sachets existants
--
-- A executer manuellement dans Supabase SQL Editor.

-- =============================================================================
-- 1. TABLE seed_stock_movements
-- =============================================================================

CREATE TABLE IF NOT EXISTS seed_stock_movements (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id        UUID NOT NULL REFERENCES farms(id),
  seed_lot_id    UUID NOT NULL REFERENCES seed_lots(id),
  variety_id     UUID REFERENCES varieties(id),
  date           DATE NOT NULL,
  type_mouvement TEXT CHECK (type_mouvement IN ('entree', 'sortie')) NOT NULL,
  poids_g        DECIMAL NOT NULL CHECK (poids_g > 0),
  source_type    TEXT NOT NULL,  -- 'achat' | 'semis' | 'ajustement'
  source_id      UUID,           -- ID de l'enregistrement source
  commentaire    TEXT,
  deleted_at     TIMESTAMPTZ DEFAULT NULL,
  created_at     TIMESTAMPTZ DEFAULT now(),
  created_by     UUID,
  updated_by     UUID
);

-- Index
CREATE INDEX IF NOT EXISTS idx_seed_stock_movements_seed_lot ON seed_stock_movements (seed_lot_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_seed_stock_movements_source   ON seed_stock_movements (source_type, source_id);

-- RLS
ALTER TABLE seed_stock_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON seed_stock_movements;
CREATE POLICY tenant_isolation ON seed_stock_movements
  FOR ALL USING (farm_id IN (SELECT user_farm_ids()));


-- =============================================================================
-- 2. TABLE seed_stock_adjustments
-- =============================================================================

CREATE TABLE IF NOT EXISTS seed_stock_adjustments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uuid_client     UUID UNIQUE,
  farm_id         UUID NOT NULL REFERENCES farms(id),
  seed_lot_id     UUID NOT NULL REFERENCES seed_lots(id),
  date            DATE NOT NULL,
  poids_constate_g DECIMAL NOT NULL CHECK (poids_constate_g >= 0),
  commentaire     TEXT,
  deleted_at      TIMESTAMPTZ DEFAULT NULL,
  created_at      TIMESTAMPTZ DEFAULT now(),
  created_by      UUID,
  updated_by      UUID
);

CREATE INDEX IF NOT EXISTS idx_seed_stock_adjustments_seed_lot ON seed_stock_adjustments (seed_lot_id) WHERE deleted_at IS NULL;

-- RLS
ALTER TABLE seed_stock_adjustments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON seed_stock_adjustments;
CREATE POLICY tenant_isolation ON seed_stock_adjustments
  FOR ALL USING (farm_id IN (SELECT user_farm_ids()));


-- =============================================================================
-- 3. VUE v_seed_stock — stock restant par sachet
-- =============================================================================

DROP VIEW IF EXISTS v_seed_cost_per_seedling;
DROP VIEW IF EXISTS v_seed_stock;
CREATE VIEW v_seed_stock WITH (security_invoker = true) AS
SELECT
  ssm.farm_id,
  ssm.seed_lot_id,
  sl.variety_id,
  sl.lot_interne,
  sl.poids_sachet_g AS poids_initial_g,
  SUM(CASE WHEN ssm.type_mouvement = 'entree' THEN ssm.poids_g ELSE -ssm.poids_g END) AS stock_g
FROM seed_stock_movements ssm
JOIN seed_lots sl ON sl.id = ssm.seed_lot_id
WHERE ssm.deleted_at IS NULL
  AND sl.deleted_at IS NULL
GROUP BY ssm.farm_id, ssm.seed_lot_id, sl.variety_id, sl.lot_interne, sl.poids_sachet_g;


-- =============================================================================
-- 4. VUE v_seed_cost_per_seedling — poids graines estime par semis
--    Repartition egale : poids_consomme / nb_semis lies au sachet
-- =============================================================================

DROP VIEW IF EXISTS v_seed_cost_per_seedling;
CREATE VIEW v_seed_cost_per_seedling WITH (security_invoker = true) AS
SELECT
  s.id AS seedling_id,
  s.farm_id,
  s.seed_lot_id,
  s.variety_id,
  s.nb_plants_obtenus,
  -- Poids reel si renseigne, sinon estimation par repartition egale
  CASE
    WHEN COALESCE(s.poids_graines_utilise_g, 0) > 0 THEN s.poids_graines_utilise_g
    ELSE
      CASE
        WHEN (SELECT COUNT(*) FROM seedlings s2
              WHERE s2.seed_lot_id = s.seed_lot_id AND s2.deleted_at IS NULL AND s2.farm_id = s.farm_id) > 0
        THEN (
          COALESCE((SELECT poids_initial_g FROM v_seed_stock vs WHERE vs.seed_lot_id = s.seed_lot_id AND vs.farm_id = s.farm_id), 0)
          - COALESCE((SELECT stock_g FROM v_seed_stock vs WHERE vs.seed_lot_id = s.seed_lot_id AND vs.farm_id = s.farm_id), 0)
        ) / (SELECT COUNT(*) FROM seedlings s2
             WHERE s2.seed_lot_id = s.seed_lot_id AND s2.deleted_at IS NULL AND s2.farm_id = s.farm_id)
        ELSE 0
      END
  END AS poids_graines_estime_g,
  -- Poids par plant
  CASE
    WHEN COALESCE(s.nb_plants_obtenus, 0) > 0 THEN
      CASE
        WHEN COALESCE(s.poids_graines_utilise_g, 0) > 0
          THEN s.poids_graines_utilise_g / s.nb_plants_obtenus
        ELSE
          CASE
            WHEN (SELECT COUNT(*) FROM seedlings s2
                  WHERE s2.seed_lot_id = s.seed_lot_id AND s2.deleted_at IS NULL AND s2.farm_id = s.farm_id) > 0
            THEN (
              COALESCE((SELECT poids_initial_g FROM v_seed_stock vs WHERE vs.seed_lot_id = s.seed_lot_id AND vs.farm_id = s.farm_id), 0)
              - COALESCE((SELECT stock_g FROM v_seed_stock vs WHERE vs.seed_lot_id = s.seed_lot_id AND vs.farm_id = s.farm_id), 0)
            ) / (SELECT COUNT(*) FROM seedlings s2
                 WHERE s2.seed_lot_id = s.seed_lot_id AND s2.deleted_at IS NULL AND s2.farm_id = s.farm_id)
              / s.nb_plants_obtenus
            ELSE 0
          END
      END
    ELSE NULL
  END AS poids_par_plant_g
FROM seedlings s
WHERE s.deleted_at IS NULL
  AND s.seed_lot_id IS NOT NULL;


-- =============================================================================
-- 5. TRIGGER fn_seed_stock_on_seed_lot — entree auto a la creation du sachet
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_seed_stock_on_seed_lot() RETURNS TRIGGER AS $$
BEGIN
  -- Uniquement si poids_sachet_g renseigne et > 0
  IF NEW.poids_sachet_g IS NOT NULL AND NEW.poids_sachet_g > 0 THEN
    INSERT INTO seed_stock_movements (
      farm_id, seed_lot_id, variety_id, date, type_mouvement,
      poids_g, source_type, source_id, created_by
    ) VALUES (
      NEW.farm_id, NEW.id, NEW.variety_id,
      COALESCE(NEW.date_achat, CURRENT_DATE),
      'entree', NEW.poids_sachet_g, 'achat', NEW.id, NEW.created_by
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_seed_stock_on_seed_lot ON seed_lots;
CREATE TRIGGER trg_seed_stock_on_seed_lot
  AFTER INSERT ON seed_lots
  FOR EACH ROW EXECUTE FUNCTION fn_seed_stock_on_seed_lot();


-- =============================================================================
-- 6. TRIGGER fn_seed_stock_on_seedling — sortie auto si poids_graines_utilise_g
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_seed_stock_on_seedling() RETURNS TRIGGER AS $$
DECLARE
  v_seed_lot_farm_id UUID;
  v_seed_lot_variety_id UUID;
BEGIN
  -- INSERT : creer sortie si poids renseigne
  IF TG_OP = 'INSERT' THEN
    IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;
    IF NEW.seed_lot_id IS NOT NULL
       AND COALESCE(NEW.poids_graines_utilise_g, 0) > 0 THEN
      SELECT farm_id, variety_id INTO v_seed_lot_farm_id, v_seed_lot_variety_id
      FROM seed_lots WHERE id = NEW.seed_lot_id;

      INSERT INTO seed_stock_movements (
        farm_id, seed_lot_id, variety_id, date, type_mouvement,
        poids_g, source_type, source_id, created_by
      ) VALUES (
        NEW.farm_id, NEW.seed_lot_id, COALESCE(NEW.variety_id, v_seed_lot_variety_id),
        COALESCE(NEW.date_semis, CURRENT_DATE),
        'sortie', NEW.poids_graines_utilise_g, 'semis', NEW.id, NEW.created_by
      );
    END IF;
    RETURN NEW;
  END IF;

  -- DELETE : annuler la sortie
  IF TG_OP = 'DELETE' THEN
    DELETE FROM seed_stock_movements
    WHERE source_type = 'semis' AND source_id = OLD.id;
    RETURN OLD;
  END IF;

  -- UPDATE
  IF TG_OP = 'UPDATE' THEN
    -- Soft delete : annuler la sortie
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      DELETE FROM seed_stock_movements
      WHERE source_type = 'semis' AND source_id = OLD.id;
      RETURN NEW;
    END IF;

    -- Restore : recreer la sortie
    IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
      IF NEW.seed_lot_id IS NOT NULL
         AND COALESCE(NEW.poids_graines_utilise_g, 0) > 0 THEN
        INSERT INTO seed_stock_movements (
          farm_id, seed_lot_id, variety_id, date, type_mouvement,
          poids_g, source_type, source_id, created_by
        ) VALUES (
          NEW.farm_id, NEW.seed_lot_id, NEW.variety_id,
          COALESCE(NEW.date_semis, CURRENT_DATE),
          'sortie', NEW.poids_graines_utilise_g, 'semis', NEW.id, NEW.created_by
        );
      END IF;
      RETURN NEW;
    END IF;

    -- Modification classique : mettre a jour le mouvement
    IF COALESCE(OLD.poids_graines_utilise_g, 0) != COALESCE(NEW.poids_graines_utilise_g, 0)
       OR OLD.seed_lot_id IS DISTINCT FROM NEW.seed_lot_id THEN
      -- Supprimer ancien mouvement
      DELETE FROM seed_stock_movements
      WHERE source_type = 'semis' AND source_id = OLD.id;

      -- Creer nouveau si poids > 0
      IF NEW.seed_lot_id IS NOT NULL
         AND COALESCE(NEW.poids_graines_utilise_g, 0) > 0 THEN
        INSERT INTO seed_stock_movements (
          farm_id, seed_lot_id, variety_id, date, type_mouvement,
          poids_g, source_type, source_id, created_by
        ) VALUES (
          NEW.farm_id, NEW.seed_lot_id, NEW.variety_id,
          COALESCE(NEW.date_semis, CURRENT_DATE),
          'sortie', NEW.poids_graines_utilise_g, 'semis', NEW.id, NEW.created_by
        );
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_seed_stock_on_seedling ON seedlings;
CREATE TRIGGER trg_seed_stock_on_seedling
  AFTER INSERT OR UPDATE OR DELETE ON seedlings
  FOR EACH ROW EXECUTE FUNCTION fn_seed_stock_on_seedling();


-- =============================================================================
-- 7. RPCs TRANSACTIONNELLES — ajustements stock graines
-- =============================================================================

-- 7.1 create_seed_adjustment
-- L'utilisateur saisit le poids constate → le systeme calcule le delta
CREATE OR REPLACE FUNCTION create_seed_adjustment(
  p_farm_id         UUID,
  p_seed_lot_id     UUID,
  p_date            DATE,
  p_poids_constate_g NUMERIC,
  p_commentaire     TEXT,
  p_created_by      UUID,
  p_uuid_client     UUID
) RETURNS UUID AS $$
DECLARE
  v_adjustment_id UUID;
  v_stock_actuel  NUMERIC;
  v_delta         NUMERIC;
  v_type          TEXT;
BEGIN
  -- Calculer le stock actuel du sachet
  SELECT COALESCE(stock_g, 0) INTO v_stock_actuel
  FROM v_seed_stock
  WHERE farm_id = p_farm_id AND seed_lot_id = p_seed_lot_id;

  -- Si pas de mouvement existant, stock = 0
  IF v_stock_actuel IS NULL THEN
    v_stock_actuel := 0;
  END IF;

  v_delta := v_stock_actuel - p_poids_constate_g;

  -- Pas de mouvement si delta = 0
  IF v_delta = 0 THEN
    -- Creer quand meme l'ajustement pour historique
    INSERT INTO seed_stock_adjustments (
      farm_id, uuid_client, seed_lot_id, date, poids_constate_g,
      commentaire, created_by
    ) VALUES (
      p_farm_id, p_uuid_client, p_seed_lot_id, p_date, p_poids_constate_g,
      p_commentaire, p_created_by
    )
    ON CONFLICT (uuid_client) DO NOTHING
    RETURNING id INTO v_adjustment_id;

    IF v_adjustment_id IS NULL AND p_uuid_client IS NOT NULL THEN
      SELECT id INTO v_adjustment_id FROM seed_stock_adjustments WHERE uuid_client = p_uuid_client;
    END IF;

    RETURN v_adjustment_id;
  END IF;

  -- Determiner le type de mouvement
  IF v_delta > 0 THEN
    v_type := 'sortie';   -- stock actuel > constate → on a consomme
  ELSE
    v_type := 'entree';   -- stock actuel < constate → correction a la hausse
    v_delta := -v_delta;   -- poids_g doit etre positif
  END IF;

  -- 1. Creer l'ajustement
  INSERT INTO seed_stock_adjustments (
    farm_id, uuid_client, seed_lot_id, date, poids_constate_g,
    commentaire, created_by
  ) VALUES (
    p_farm_id, p_uuid_client, p_seed_lot_id, p_date, p_poids_constate_g,
    p_commentaire, p_created_by
  )
  ON CONFLICT (uuid_client) DO NOTHING
  RETURNING id INTO v_adjustment_id;

  -- Idempotence
  IF v_adjustment_id IS NULL AND p_uuid_client IS NOT NULL THEN
    SELECT id INTO v_adjustment_id FROM seed_stock_adjustments WHERE uuid_client = p_uuid_client;
    RETURN v_adjustment_id;
  END IF;

  -- 2. Creer le mouvement de stock
  INSERT INTO seed_stock_movements (
    farm_id, seed_lot_id, variety_id, date, type_mouvement,
    poids_g, source_type, source_id, created_by
  ) VALUES (
    p_farm_id, p_seed_lot_id,
    (SELECT variety_id FROM seed_lots WHERE id = p_seed_lot_id),
    p_date, v_type, v_delta, 'ajustement', v_adjustment_id, p_created_by
  );

  RETURN v_adjustment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 7.2 update_seed_adjustment
CREATE OR REPLACE FUNCTION update_seed_adjustment(
  p_adjustment_id    UUID,
  p_date             DATE,
  p_poids_constate_g NUMERIC,
  p_commentaire      TEXT,
  p_updated_by       UUID
) RETURNS VOID AS $$
DECLARE
  v_farm_id        UUID;
  v_seed_lot_id    UUID;
  v_old_movement   RECORD;
  v_stock_sans_adj NUMERIC;
  v_delta          NUMERIC;
  v_type           TEXT;
BEGIN
  -- Recuperer les infos de l'ajustement
  SELECT farm_id, seed_lot_id INTO v_farm_id, v_seed_lot_id
  FROM seed_stock_adjustments WHERE id = p_adjustment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'seed_stock_adjustment not found: %', p_adjustment_id;
  END IF;

  -- Recuperer l'ancien mouvement (peut ne pas exister si delta etait 0)
  SELECT id, type_mouvement, poids_g INTO v_old_movement
  FROM seed_stock_movements
  WHERE source_type = 'ajustement' AND source_id = p_adjustment_id AND farm_id = v_farm_id;

  -- Calculer le stock SANS cet ajustement
  IF v_old_movement.id IS NOT NULL THEN
    IF v_old_movement.type_mouvement = 'sortie' THEN
      v_stock_sans_adj := COALESCE((SELECT stock_g FROM v_seed_stock WHERE farm_id = v_farm_id AND seed_lot_id = v_seed_lot_id), 0)
                          + v_old_movement.poids_g;
    ELSE
      v_stock_sans_adj := COALESCE((SELECT stock_g FROM v_seed_stock WHERE farm_id = v_farm_id AND seed_lot_id = v_seed_lot_id), 0)
                          - v_old_movement.poids_g;
    END IF;
    -- Supprimer ancien mouvement
    DELETE FROM seed_stock_movements WHERE id = v_old_movement.id;
  ELSE
    v_stock_sans_adj := COALESCE((SELECT stock_g FROM v_seed_stock WHERE farm_id = v_farm_id AND seed_lot_id = v_seed_lot_id), 0);
  END IF;

  -- Mettre a jour l'ajustement
  UPDATE seed_stock_adjustments SET
    date = p_date,
    poids_constate_g = p_poids_constate_g,
    commentaire = p_commentaire,
    updated_by = p_updated_by
  WHERE id = p_adjustment_id;

  -- Calculer nouveau delta
  v_delta := v_stock_sans_adj - p_poids_constate_g;

  -- Creer le nouveau mouvement si delta != 0
  IF v_delta != 0 THEN
    IF v_delta > 0 THEN
      v_type := 'sortie';
    ELSE
      v_type := 'entree';
      v_delta := -v_delta;
    END IF;

    INSERT INTO seed_stock_movements (
      farm_id, seed_lot_id, variety_id, date, type_mouvement,
      poids_g, source_type, source_id, created_by
    ) VALUES (
      v_farm_id, v_seed_lot_id,
      (SELECT variety_id FROM seed_lots WHERE id = v_seed_lot_id),
      p_date, v_type, v_delta, 'ajustement', p_adjustment_id, p_updated_by
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 7.3 delete_seed_adjustment
CREATE OR REPLACE FUNCTION delete_seed_adjustment(
  p_adjustment_id UUID,
  p_farm_id       UUID
) RETURNS VOID AS $$
BEGIN
  -- 1. Supprimer le mouvement associe
  DELETE FROM seed_stock_movements
  WHERE source_type = 'ajustement' AND source_id = p_adjustment_id AND farm_id = p_farm_id;

  -- 2. Supprimer l'ajustement
  DELETE FROM seed_stock_adjustments
  WHERE id = p_adjustment_id AND farm_id = p_farm_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- =============================================================================
-- 8. TRIGGER archivage auto du sachet quand stock = 0
--    Se declenche apres chaque mouvement de stock
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_seed_lot_auto_archive() RETURNS TRIGGER AS $$
DECLARE
  v_stock NUMERIC;
  v_poids_initial NUMERIC;
BEGIN
  -- Ne traiter que les sachets avec poids_sachet_g renseigne
  SELECT poids_sachet_g INTO v_poids_initial
  FROM seed_lots WHERE id = NEW.seed_lot_id;

  IF v_poids_initial IS NULL OR v_poids_initial = 0 THEN
    RETURN NEW;
  END IF;

  -- Calculer le stock actuel
  SELECT COALESCE(SUM(
    CASE WHEN type_mouvement = 'entree' THEN poids_g ELSE -poids_g END
  ), 0) INTO v_stock
  FROM seed_stock_movements
  WHERE seed_lot_id = NEW.seed_lot_id AND deleted_at IS NULL;

  -- Archiver si stock <= 0
  IF v_stock <= 0 THEN
    UPDATE seed_lots SET deleted_at = now()
    WHERE id = NEW.seed_lot_id AND deleted_at IS NULL;
  END IF;

  -- Desarchiver si stock > 0 (correction d'inventaire)
  IF v_stock > 0 THEN
    UPDATE seed_lots SET deleted_at = NULL
    WHERE id = NEW.seed_lot_id AND deleted_at IS NOT NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_seed_lot_auto_archive ON seed_stock_movements;
CREATE TRIGGER trg_seed_lot_auto_archive
  AFTER INSERT OR UPDATE ON seed_stock_movements
  FOR EACH ROW EXECUTE FUNCTION fn_seed_lot_auto_archive();


-- =============================================================================
-- 9. BACKFILL — Creer les mouvements d'entree pour les sachets existants
-- =============================================================================

-- Backfill entrees (seulement si pas deja fait)
INSERT INTO seed_stock_movements (farm_id, seed_lot_id, variety_id, date, type_mouvement, poids_g, source_type, source_id, created_by)
SELECT
  sl.farm_id,
  sl.id,
  sl.variety_id,
  COALESCE(sl.date_achat, sl.created_at::DATE),
  'entree',
  sl.poids_sachet_g,
  'achat',
  sl.id,
  sl.created_by
FROM seed_lots sl
WHERE sl.poids_sachet_g IS NOT NULL
  AND sl.poids_sachet_g > 0
  AND NOT EXISTS (
    SELECT 1 FROM seed_stock_movements ssm
    WHERE ssm.source_type = 'achat' AND ssm.source_id = sl.id
  );

-- Backfill sorties (seulement si pas deja fait)
INSERT INTO seed_stock_movements (farm_id, seed_lot_id, variety_id, date, type_mouvement, poids_g, source_type, source_id, created_by)
SELECT
  s.farm_id,
  s.seed_lot_id,
  s.variety_id,
  COALESCE(s.date_semis, s.created_at::DATE),
  'sortie',
  s.poids_graines_utilise_g,
  'semis',
  s.id,
  s.created_by
FROM seedlings s
WHERE s.deleted_at IS NULL
  AND s.seed_lot_id IS NOT NULL
  AND s.poids_graines_utilise_g IS NOT NULL
  AND s.poids_graines_utilise_g > 0
  AND NOT EXISTS (
    SELECT 1 FROM seed_stock_movements ssm
    WHERE ssm.source_type = 'semis' AND ssm.source_id = s.id
  );
