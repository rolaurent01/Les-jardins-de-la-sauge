-- 018_fix_ps_triggers_delete_update.sql
-- Corrige les triggers production_summary pour gerer INSERT, DELETE et UPDATE.
--
-- Avant cette migration, 7 triggers ne se declenchaient que sur INSERT.
-- Consequence : production_summary devenait stale apres suppression ou modification.
-- Le stock reel (stock_movements) n'etait PAS affecte (gere par les RPCs transactionnelles).
--
-- Triggers corriges :
--   1. fn_ps_cuttings      (cuttings)                    — hard delete
--   2. fn_ps_dryings       (dryings)                     — hard delete
--   3. fn_ps_sortings      (sortings)                    — hard delete
--   4. fn_ps_production_lot_ingredients (production_lot_ingredients) — hard delete
--   5. fn_ps_production_lots_time      (production_lots)  — soft delete
--   6. fn_ps_direct_sales  (stock_direct_sales)          — hard delete
--   7. fn_ps_purchases     (stock_purchases)             — hard delete
--
-- NON modifie :
--   fn_ps_harvests — deja AFTER INSERT OR UPDATE avec gestion soft delete (migration 001)
--
-- ⚠️ A executer manuellement dans Supabase SQL Editor.

-- =============================================================================
-- 1. fn_ps_cuttings — cuttings (hard delete, seul type='sortie' compte)
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_ps_cuttings() RETURNS TRIGGER AS $$
DECLARE
  v_row  RECORD;
  v_sign INTEGER;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_row  := OLD;
    v_sign := -1;
  ELSIF TG_OP = 'INSERT' THEN
    v_row  := NEW;
    v_sign := 1;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Annuler OLD puis ajouter NEW
    IF OLD.type = 'sortie' THEN
      PERFORM _ps_upsert(
        OLD.farm_id, OLD.variety_id,
        EXTRACT(YEAR FROM OLD.date)::INTEGER,
        EXTRACT(MONTH FROM OLD.date)::INTEGER,
        p_delta_tronconnee        => -(OLD.poids_g),
        p_delta_temps_tronconnage => -(COALESCE(OLD.temps_min, 0))
      );
    END IF;
    v_row  := NEW;
    v_sign := 1;
  END IF;

  -- Seules les sorties incrementent les cumuls
  IF v_row.type <> 'sortie' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  PERFORM _ps_upsert(
    v_row.farm_id, v_row.variety_id,
    EXTRACT(YEAR FROM v_row.date)::INTEGER,
    EXTRACT(MONTH FROM v_row.date)::INTEGER,
    p_delta_tronconnee        => v_sign * v_row.poids_g,
    p_delta_temps_tronconnage => v_sign * COALESCE(v_row.temps_min, 0)
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_ps_cuttings ON cuttings;
CREATE TRIGGER trg_ps_cuttings
  AFTER INSERT OR DELETE OR UPDATE ON cuttings
  FOR EACH ROW EXECUTE FUNCTION fn_ps_cuttings();


-- =============================================================================
-- 2. fn_ps_dryings — dryings (hard delete, seul type='sortie' compte)
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_ps_dryings() RETURNS TRIGGER AS $$
DECLARE
  v_row  RECORD;
  v_sign INTEGER;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_row  := OLD;
    v_sign := -1;
  ELSIF TG_OP = 'INSERT' THEN
    v_row  := NEW;
    v_sign := 1;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.type = 'sortie' THEN
      PERFORM _ps_upsert(
        OLD.farm_id, OLD.variety_id,
        EXTRACT(YEAR FROM OLD.date)::INTEGER,
        EXTRACT(MONTH FROM OLD.date)::INTEGER,
        p_delta_sechee        => -(OLD.poids_g),
        p_delta_temps_sechage => -(COALESCE(OLD.temps_min, 0))
      );
    END IF;
    v_row  := NEW;
    v_sign := 1;
  END IF;

  IF v_row.type <> 'sortie' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  PERFORM _ps_upsert(
    v_row.farm_id, v_row.variety_id,
    EXTRACT(YEAR FROM v_row.date)::INTEGER,
    EXTRACT(MONTH FROM v_row.date)::INTEGER,
    p_delta_sechee        => v_sign * v_row.poids_g,
    p_delta_temps_sechage => v_sign * COALESCE(v_row.temps_min, 0)
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_ps_dryings ON dryings;
CREATE TRIGGER trg_ps_dryings
  AFTER INSERT OR DELETE OR UPDATE ON dryings
  FOR EACH ROW EXECUTE FUNCTION fn_ps_dryings();


-- =============================================================================
-- 3. fn_ps_sortings — sortings (hard delete, seul type='sortie' compte)
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_ps_sortings() RETURNS TRIGGER AS $$
DECLARE
  v_row  RECORD;
  v_sign INTEGER;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_row  := OLD;
    v_sign := -1;
  ELSIF TG_OP = 'INSERT' THEN
    v_row  := NEW;
    v_sign := 1;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.type = 'sortie' THEN
      PERFORM _ps_upsert(
        OLD.farm_id, OLD.variety_id,
        EXTRACT(YEAR FROM OLD.date)::INTEGER,
        EXTRACT(MONTH FROM OLD.date)::INTEGER,
        p_delta_triee        => -(OLD.poids_g),
        p_delta_temps_triage => -(COALESCE(OLD.temps_min, 0))
      );
    END IF;
    v_row  := NEW;
    v_sign := 1;
  END IF;

  IF v_row.type <> 'sortie' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  PERFORM _ps_upsert(
    v_row.farm_id, v_row.variety_id,
    EXTRACT(YEAR FROM v_row.date)::INTEGER,
    EXTRACT(MONTH FROM v_row.date)::INTEGER,
    p_delta_triee        => v_sign * v_row.poids_g,
    p_delta_temps_triage => v_sign * COALESCE(v_row.temps_min, 0)
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_ps_sortings ON sortings;
CREATE TRIGGER trg_ps_sortings
  AFTER INSERT OR DELETE OR UPDATE ON sortings
  FOR EACH ROW EXECUTE FUNCTION fn_ps_sortings();


-- =============================================================================
-- 4. fn_ps_production_lot_ingredients — production_lot_ingredients (hard delete)
--    Incremente total_utilise_production_g. Ignore si variety_id IS NULL (materiaux).
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_ps_production_lot_ingredients() RETURNS TRIGGER AS $$
DECLARE
  v_row  RECORD;
  v_sign INTEGER;
  v_lot  production_lots%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_row  := OLD;
    v_sign := -1;
  ELSIF TG_OP = 'INSERT' THEN
    v_row  := NEW;
    v_sign := 1;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Annuler OLD si variety_id non null
    IF OLD.variety_id IS NOT NULL THEN
      SELECT * INTO v_lot FROM production_lots WHERE id = OLD.production_lot_id;
      PERFORM _ps_upsert(
        v_lot.farm_id, OLD.variety_id,
        EXTRACT(YEAR FROM v_lot.date_production)::INTEGER,
        EXTRACT(MONTH FROM v_lot.date_production)::INTEGER,
        p_delta_utilise_prod => -(OLD.poids_g)
      );
    END IF;
    v_row  := NEW;
    v_sign := 1;
  END IF;

  IF v_row.variety_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT * INTO v_lot FROM production_lots WHERE id = v_row.production_lot_id;

  PERFORM _ps_upsert(
    v_lot.farm_id, v_row.variety_id,
    EXTRACT(YEAR FROM v_lot.date_production)::INTEGER,
    EXTRACT(MONTH FROM v_lot.date_production)::INTEGER,
    p_delta_utilise_prod => v_sign * v_row.poids_g
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_ps_production_lot_ingredients ON production_lot_ingredients;
CREATE TRIGGER trg_ps_production_lot_ingredients
  AFTER INSERT OR DELETE OR UPDATE ON production_lot_ingredients
  FOR EACH ROW EXECUTE FUNCTION fn_ps_production_lot_ingredients();


-- =============================================================================
-- 5. fn_ps_production_lots_time — production_lots (soft delete)
--    Incremente temps_production_min. Utilise le premier ingredient avec variety_id.
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_ps_production_lots_time() RETURNS TRIGGER AS $$
DECLARE
  v_row        RECORD;
  v_sign       INTEGER;
  v_variety_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_row  := OLD;
    v_sign := -1;
  ELSIF TG_OP = 'INSERT' THEN
    v_row  := NEW;
    v_sign := 1;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Gestion soft delete : archive → -1, restore → +1
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      v_row  := OLD;
      v_sign := -1;
    ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
      v_row  := NEW;
      v_sign := 1;
    ELSE
      -- Annuler OLD + ajouter NEW pour les autres modifications
      IF OLD.temps_min IS NOT NULL AND OLD.temps_min > 0 THEN
        SELECT variety_id INTO v_variety_id
        FROM production_lot_ingredients
        WHERE production_lot_id = OLD.id AND variety_id IS NOT NULL
        LIMIT 1;
        IF v_variety_id IS NOT NULL THEN
          PERFORM _ps_upsert(
            OLD.farm_id, v_variety_id,
            EXTRACT(YEAR FROM OLD.date_production)::INTEGER,
            EXTRACT(MONTH FROM OLD.date_production)::INTEGER,
            p_delta_temps_production => -(OLD.temps_min)
          );
        END IF;
      END IF;
      v_row  := NEW;
      v_sign := 1;
    END IF;
  END IF;

  IF v_row.temps_min IS NULL OR v_row.temps_min = 0 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT variety_id INTO v_variety_id
  FROM production_lot_ingredients
  WHERE production_lot_id = v_row.id AND variety_id IS NOT NULL
  LIMIT 1;

  IF v_variety_id IS NOT NULL THEN
    PERFORM _ps_upsert(
      v_row.farm_id, v_variety_id,
      EXTRACT(YEAR FROM v_row.date_production)::INTEGER,
      EXTRACT(MONTH FROM v_row.date_production)::INTEGER,
      p_delta_temps_production => v_sign * v_row.temps_min
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_ps_production_lots_time ON production_lots;
CREATE TRIGGER trg_ps_production_lots_time
  AFTER INSERT OR DELETE OR UPDATE ON production_lots
  FOR EACH ROW EXECUTE FUNCTION fn_ps_production_lots_time();


-- =============================================================================
-- 6. fn_ps_direct_sales — stock_direct_sales (hard delete)
--    Incremente total_vendu_direct_g.
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_ps_direct_sales() RETURNS TRIGGER AS $$
DECLARE
  v_row  RECORD;
  v_sign INTEGER;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_row  := OLD;
    v_sign := -1;
  ELSIF TG_OP = 'INSERT' THEN
    v_row  := NEW;
    v_sign := 1;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM _ps_upsert(
      OLD.farm_id, OLD.variety_id,
      EXTRACT(YEAR FROM OLD.date)::INTEGER,
      EXTRACT(MONTH FROM OLD.date)::INTEGER,
      p_delta_vendu_direct => -(OLD.poids_g)
    );
    v_row  := NEW;
    v_sign := 1;
  END IF;

  PERFORM _ps_upsert(
    v_row.farm_id, v_row.variety_id,
    EXTRACT(YEAR FROM v_row.date)::INTEGER,
    EXTRACT(MONTH FROM v_row.date)::INTEGER,
    p_delta_vendu_direct => v_sign * v_row.poids_g
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_ps_direct_sales ON stock_direct_sales;
CREATE TRIGGER trg_ps_direct_sales
  AFTER INSERT OR DELETE OR UPDATE ON stock_direct_sales
  FOR EACH ROW EXECUTE FUNCTION fn_ps_direct_sales();


-- =============================================================================
-- 7. fn_ps_purchases — stock_purchases (hard delete)
--    Incremente total_achete_g.
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_ps_purchases() RETURNS TRIGGER AS $$
DECLARE
  v_row  RECORD;
  v_sign INTEGER;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_row  := OLD;
    v_sign := -1;
  ELSIF TG_OP = 'INSERT' THEN
    v_row  := NEW;
    v_sign := 1;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM _ps_upsert(
      OLD.farm_id, OLD.variety_id,
      EXTRACT(YEAR FROM OLD.date)::INTEGER,
      EXTRACT(MONTH FROM OLD.date)::INTEGER,
      p_delta_achete => -(OLD.poids_g)
    );
    v_row  := NEW;
    v_sign := 1;
  END IF;

  PERFORM _ps_upsert(
    v_row.farm_id, v_row.variety_id,
    EXTRACT(YEAR FROM v_row.date)::INTEGER,
    EXTRACT(MONTH FROM v_row.date)::INTEGER,
    p_delta_achete => v_sign * v_row.poids_g
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_ps_purchases ON stock_purchases;
CREATE TRIGGER trg_ps_purchases
  AFTER INSERT OR DELETE OR UPDATE ON stock_purchases
  FOR EACH ROW EXECUTE FUNCTION fn_ps_purchases();
