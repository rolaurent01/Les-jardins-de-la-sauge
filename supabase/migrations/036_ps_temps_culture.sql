-- Migration 036 : Ajout des temps de culture dans production_summary
--
-- Actuellement, seuls 5 types de temps sont agrégés (cueillette, tronçonnage,
-- séchage, triage, production). Cette migration ajoute les temps de culture :
--   - semis (seedlings.temps_semis_min)
--   - repiquage (seedlings.temps_repiquage_min)
--   - plantation (plantings.temps_min)
--   - suivi de rang (row_care.temps_min)
--   - arrachage (uprootings.temps_min)
--
-- Les temps de travail de sol (soil_works) et occultation (occultations) ne sont
-- pas inclus car ces tables n'ont pas de variety_id — ils seront requêtés
-- directement côté applicatif.
--
-- ⚠️ A exécuter manuellement dans Supabase SQL Editor.

-- =============================================================================
-- 1. NOUVELLES COLONNES sur production_summary
-- =============================================================================

ALTER TABLE production_summary
  ADD COLUMN IF NOT EXISTS temps_semis_min       INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS temps_repiquage_min   INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS temps_plantation_min  INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS temps_suivi_rang_min  INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS temps_arrachage_min   INTEGER DEFAULT 0;


-- =============================================================================
-- 2. MISE A JOUR de _ps_upsert — ajout des 5 nouveaux paramètres temps
-- =============================================================================

CREATE OR REPLACE FUNCTION _ps_upsert(
  p_farm_id                  UUID,
  p_variety_id               UUID,
  p_annee                    INTEGER,
  p_mois                     INTEGER,
  p_delta_cueilli            DECIMAL  DEFAULT 0,
  p_delta_tronconnee         DECIMAL  DEFAULT 0,
  p_delta_sechee             DECIMAL  DEFAULT 0,
  p_delta_triee              DECIMAL  DEFAULT 0,
  p_delta_utilise_prod       DECIMAL  DEFAULT 0,
  p_delta_vendu_direct       DECIMAL  DEFAULT 0,
  p_delta_achete             DECIMAL  DEFAULT 0,
  p_delta_temps_cueillette   INTEGER  DEFAULT 0,
  p_delta_temps_tronconnage  INTEGER  DEFAULT 0,
  p_delta_temps_sechage      INTEGER  DEFAULT 0,
  p_delta_temps_triage       INTEGER  DEFAULT 0,
  p_delta_temps_production   INTEGER  DEFAULT 0,
  -- Nouveaux paramètres temps culture
  p_delta_temps_semis        INTEGER  DEFAULT 0,
  p_delta_temps_repiquage    INTEGER  DEFAULT 0,
  p_delta_temps_plantation   INTEGER  DEFAULT 0,
  p_delta_temps_suivi_rang   INTEGER  DEFAULT 0,
  p_delta_temps_arrachage    INTEGER  DEFAULT 0
) RETURNS VOID AS $$
DECLARE
  v_months INTEGER[];
  m        INTEGER;
BEGIN
  IF p_mois IS NOT NULL THEN
    v_months := ARRAY[p_mois, NULL::INTEGER];
  ELSE
    v_months := ARRAY[NULL::INTEGER];
  END IF;

  FOREACH m IN ARRAY v_months LOOP
    INSERT INTO production_summary (
      farm_id, variety_id, annee, mois,
      total_cueilli_g, total_tronconnee_g, total_sechee_g, total_triee_g,
      total_utilise_production_g, total_vendu_direct_g, total_achete_g,
      temps_cueillette_min, temps_tronconnage_min, temps_sechage_min,
      temps_triage_min, temps_production_min,
      temps_semis_min, temps_repiquage_min, temps_plantation_min,
      temps_suivi_rang_min, temps_arrachage_min
    ) VALUES (
      p_farm_id, p_variety_id, p_annee, m,
      GREATEST(p_delta_cueilli, 0),           GREATEST(p_delta_tronconnee, 0),
      GREATEST(p_delta_sechee, 0),            GREATEST(p_delta_triee, 0),
      GREATEST(p_delta_utilise_prod, 0),      GREATEST(p_delta_vendu_direct, 0),
      GREATEST(p_delta_achete, 0),
      GREATEST(p_delta_temps_cueillette, 0),  GREATEST(p_delta_temps_tronconnage, 0),
      GREATEST(p_delta_temps_sechage, 0),     GREATEST(p_delta_temps_triage, 0),
      GREATEST(p_delta_temps_production, 0),
      GREATEST(p_delta_temps_semis, 0),       GREATEST(p_delta_temps_repiquage, 0),
      GREATEST(p_delta_temps_plantation, 0),  GREATEST(p_delta_temps_suivi_rang, 0),
      GREATEST(p_delta_temps_arrachage, 0)
    )
    ON CONFLICT ON CONSTRAINT production_summary_farm_unique DO UPDATE SET
      total_cueilli_g            = production_summary.total_cueilli_g            + p_delta_cueilli,
      total_tronconnee_g         = production_summary.total_tronconnee_g         + p_delta_tronconnee,
      total_sechee_g             = production_summary.total_sechee_g             + p_delta_sechee,
      total_triee_g              = production_summary.total_triee_g              + p_delta_triee,
      total_utilise_production_g = production_summary.total_utilise_production_g + p_delta_utilise_prod,
      total_vendu_direct_g       = production_summary.total_vendu_direct_g       + p_delta_vendu_direct,
      total_achete_g             = production_summary.total_achete_g             + p_delta_achete,
      temps_cueillette_min       = production_summary.temps_cueillette_min       + p_delta_temps_cueillette,
      temps_tronconnage_min      = production_summary.temps_tronconnage_min      + p_delta_temps_tronconnage,
      temps_sechage_min          = production_summary.temps_sechage_min          + p_delta_temps_sechage,
      temps_triage_min           = production_summary.temps_triage_min           + p_delta_temps_triage,
      temps_production_min       = production_summary.temps_production_min       + p_delta_temps_production,
      temps_semis_min            = production_summary.temps_semis_min            + p_delta_temps_semis,
      temps_repiquage_min        = production_summary.temps_repiquage_min        + p_delta_temps_repiquage,
      temps_plantation_min       = production_summary.temps_plantation_min       + p_delta_temps_plantation,
      temps_suivi_rang_min       = production_summary.temps_suivi_rang_min       + p_delta_temps_suivi_rang,
      temps_arrachage_min        = production_summary.temps_arrachage_min        + p_delta_temps_arrachage,
      updated_at                 = now();
  END LOOP;
END;
$$ LANGUAGE plpgsql SET search_path = public;


-- =============================================================================
-- 3. TRIGGER fn_ps_seedlings — seedlings (soft delete)
--    Propage temps_semis_min (sur date_semis) et temps_repiquage_min (sur date_repiquage)
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_ps_seedlings() RETURNS TRIGGER AS $$
DECLARE
  v_row  RECORD;
  v_sign INTEGER;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_row  := OLD;
    v_sign := -1;
  ELSIF TG_OP = 'INSERT' THEN
    IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;
    v_row  := NEW;
    v_sign := 1;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Soft delete
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      v_row  := OLD;
      v_sign := -1;
    -- Restore
    ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
      v_row  := NEW;
      v_sign := 1;
    ELSE
      -- Modification classique : annuler OLD + ajouter NEW
      -- Annuler OLD semis
      IF OLD.variety_id IS NOT NULL AND OLD.date_semis IS NOT NULL
         AND (COALESCE(OLD.temps_semis_min, 0) > 0) THEN
        PERFORM _ps_upsert(
          OLD.farm_id, OLD.variety_id,
          EXTRACT(YEAR FROM OLD.date_semis)::INTEGER,
          EXTRACT(MONTH FROM OLD.date_semis)::INTEGER,
          p_delta_temps_semis => -(COALESCE(OLD.temps_semis_min, 0))
        );
      END IF;
      -- Annuler OLD repiquage
      IF OLD.variety_id IS NOT NULL AND OLD.date_repiquage IS NOT NULL
         AND (COALESCE(OLD.temps_repiquage_min, 0) > 0) THEN
        PERFORM _ps_upsert(
          OLD.farm_id, OLD.variety_id,
          EXTRACT(YEAR FROM OLD.date_repiquage)::INTEGER,
          EXTRACT(MONTH FROM OLD.date_repiquage)::INTEGER,
          p_delta_temps_repiquage => -(COALESCE(OLD.temps_repiquage_min, 0))
        );
      END IF;
      v_row  := NEW;
      v_sign := 1;
    END IF;
  END IF;

  IF v_row.variety_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Temps semis
  IF v_row.date_semis IS NOT NULL AND COALESCE(v_row.temps_semis_min, 0) > 0 THEN
    PERFORM _ps_upsert(
      v_row.farm_id, v_row.variety_id,
      EXTRACT(YEAR FROM v_row.date_semis)::INTEGER,
      EXTRACT(MONTH FROM v_row.date_semis)::INTEGER,
      p_delta_temps_semis => v_sign * COALESCE(v_row.temps_semis_min, 0)
    );
  END IF;

  -- Temps repiquage
  IF v_row.date_repiquage IS NOT NULL AND COALESCE(v_row.temps_repiquage_min, 0) > 0 THEN
    PERFORM _ps_upsert(
      v_row.farm_id, v_row.variety_id,
      EXTRACT(YEAR FROM v_row.date_repiquage)::INTEGER,
      EXTRACT(MONTH FROM v_row.date_repiquage)::INTEGER,
      p_delta_temps_repiquage => v_sign * COALESCE(v_row.temps_repiquage_min, 0)
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_ps_seedlings ON seedlings;
CREATE TRIGGER trg_ps_seedlings
  AFTER INSERT OR DELETE OR UPDATE ON seedlings
  FOR EACH ROW EXECUTE FUNCTION fn_ps_seedlings();


-- =============================================================================
-- 4. TRIGGER fn_ps_plantings — plantings (soft delete)
--    Propage temps_plantation_min. Utilise date_plantation pour le mois,
--    ou annee seul si date_plantation est NULL.
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_ps_plantings() RETURNS TRIGGER AS $$
DECLARE
  v_row    RECORD;
  v_sign   INTEGER;
  v_annee  INTEGER;
  v_mois   INTEGER;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_row  := OLD;
    v_sign := -1;
  ELSIF TG_OP = 'INSERT' THEN
    IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;
    v_row  := NEW;
    v_sign := 1;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      v_row  := OLD;
      v_sign := -1;
    ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
      v_row  := NEW;
      v_sign := 1;
    ELSE
      -- Annuler OLD
      IF OLD.variety_id IS NOT NULL AND COALESCE(OLD.temps_min, 0) > 0 THEN
        IF OLD.date_plantation IS NOT NULL THEN
          PERFORM _ps_upsert(
            OLD.farm_id, OLD.variety_id,
            EXTRACT(YEAR FROM OLD.date_plantation)::INTEGER,
            EXTRACT(MONTH FROM OLD.date_plantation)::INTEGER,
            p_delta_temps_plantation => -(COALESCE(OLD.temps_min, 0))
          );
        ELSE
          PERFORM _ps_upsert(
            OLD.farm_id, OLD.variety_id,
            OLD.annee, NULL,
            p_delta_temps_plantation => -(COALESCE(OLD.temps_min, 0))
          );
        END IF;
      END IF;
      v_row  := NEW;
      v_sign := 1;
    END IF;
  END IF;

  IF v_row.variety_id IS NULL OR COALESCE(v_row.temps_min, 0) = 0 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF v_row.date_plantation IS NOT NULL THEN
    v_annee := EXTRACT(YEAR FROM v_row.date_plantation)::INTEGER;
    v_mois  := EXTRACT(MONTH FROM v_row.date_plantation)::INTEGER;
  ELSE
    v_annee := v_row.annee;
    v_mois  := NULL;
  END IF;

  PERFORM _ps_upsert(
    v_row.farm_id, v_row.variety_id,
    v_annee, v_mois,
    p_delta_temps_plantation => v_sign * COALESCE(v_row.temps_min, 0)
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_ps_plantings ON plantings;
CREATE TRIGGER trg_ps_plantings
  AFTER INSERT OR DELETE OR UPDATE ON plantings
  FOR EACH ROW EXECUTE FUNCTION fn_ps_plantings();


-- =============================================================================
-- 5. TRIGGER fn_ps_row_care — row_care (hard delete)
--    Propage temps_suivi_rang_min. Ignore si variety_id IS NULL.
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_ps_row_care() RETURNS TRIGGER AS $$
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
    -- Annuler OLD
    IF OLD.variety_id IS NOT NULL AND COALESCE(OLD.temps_min, 0) > 0 THEN
      PERFORM _ps_upsert(
        OLD.farm_id, OLD.variety_id,
        EXTRACT(YEAR FROM OLD.date)::INTEGER,
        EXTRACT(MONTH FROM OLD.date)::INTEGER,
        p_delta_temps_suivi_rang => -(COALESCE(OLD.temps_min, 0))
      );
    END IF;
    v_row  := NEW;
    v_sign := 1;
  END IF;

  IF v_row.variety_id IS NULL OR COALESCE(v_row.temps_min, 0) = 0 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  PERFORM _ps_upsert(
    v_row.farm_id, v_row.variety_id,
    EXTRACT(YEAR FROM v_row.date)::INTEGER,
    EXTRACT(MONTH FROM v_row.date)::INTEGER,
    p_delta_temps_suivi_rang => v_sign * COALESCE(v_row.temps_min, 0)
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_ps_row_care ON row_care;
CREATE TRIGGER trg_ps_row_care
  AFTER INSERT OR DELETE OR UPDATE ON row_care
  FOR EACH ROW EXECUTE FUNCTION fn_ps_row_care();


-- =============================================================================
-- 6. TRIGGER fn_ps_uprootings — uprootings (hard delete)
--    Propage temps_arrachage_min. Ignore si variety_id IS NULL.
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_ps_uprootings() RETURNS TRIGGER AS $$
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
    IF OLD.variety_id IS NOT NULL AND COALESCE(OLD.temps_min, 0) > 0 THEN
      PERFORM _ps_upsert(
        OLD.farm_id, OLD.variety_id,
        EXTRACT(YEAR FROM OLD.date)::INTEGER,
        EXTRACT(MONTH FROM OLD.date)::INTEGER,
        p_delta_temps_arrachage => -(COALESCE(OLD.temps_min, 0))
      );
    END IF;
    v_row  := NEW;
    v_sign := 1;
  END IF;

  IF v_row.variety_id IS NULL OR COALESCE(v_row.temps_min, 0) = 0 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  PERFORM _ps_upsert(
    v_row.farm_id, v_row.variety_id,
    EXTRACT(YEAR FROM v_row.date)::INTEGER,
    EXTRACT(MONTH FROM v_row.date)::INTEGER,
    p_delta_temps_arrachage => v_sign * COALESCE(v_row.temps_min, 0)
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_ps_uprootings ON uprootings;
CREATE TRIGGER trg_ps_uprootings
  AFTER INSERT OR DELETE OR UPDATE ON uprootings
  FOR EACH ROW EXECUTE FUNCTION fn_ps_uprootings();


-- =============================================================================
-- 7. MISE A JOUR de recalculate_production_summary()
--    Ajout des sections semis, repiquage, plantation, suivi de rang, arrachage.
-- =============================================================================

CREATE OR REPLACE FUNCTION recalculate_production_summary()
RETURNS TEXT AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  TRUNCATE production_summary;

  -- 2. Cueillettes — mensuel
  INSERT INTO production_summary (farm_id, variety_id, annee, mois, total_cueilli_g, temps_cueillette_min)
  SELECT
    farm_id, variety_id,
    EXTRACT(YEAR FROM date)::INTEGER  AS annee,
    EXTRACT(MONTH FROM date)::INTEGER AS mois,
    SUM(poids_g), SUM(COALESCE(temps_min, 0))
  FROM harvests WHERE deleted_at IS NULL
  GROUP BY farm_id, variety_id, annee, mois
  ON CONFLICT ON CONSTRAINT production_summary_farm_unique DO UPDATE SET
    total_cueilli_g      = production_summary.total_cueilli_g      + EXCLUDED.total_cueilli_g,
    temps_cueillette_min = production_summary.temps_cueillette_min + EXCLUDED.temps_cueillette_min,
    updated_at = now();

  -- Cueillettes — annuel
  INSERT INTO production_summary (farm_id, variety_id, annee, mois, total_cueilli_g, temps_cueillette_min)
  SELECT
    farm_id, variety_id,
    EXTRACT(YEAR FROM date)::INTEGER AS annee,
    NULL AS mois,
    SUM(poids_g), SUM(COALESCE(temps_min, 0))
  FROM harvests WHERE deleted_at IS NULL
  GROUP BY farm_id, variety_id, annee
  ON CONFLICT ON CONSTRAINT production_summary_farm_unique DO UPDATE SET
    total_cueilli_g      = production_summary.total_cueilli_g      + EXCLUDED.total_cueilli_g,
    temps_cueillette_min = production_summary.temps_cueillette_min + EXCLUDED.temps_cueillette_min,
    updated_at = now();

  -- 3. Tronçonnage — mensuel
  INSERT INTO production_summary (farm_id, variety_id, annee, mois, total_tronconnee_g, temps_tronconnage_min)
  SELECT farm_id, variety_id,
    EXTRACT(YEAR FROM date)::INTEGER, EXTRACT(MONTH FROM date)::INTEGER,
    SUM(poids_g), SUM(COALESCE(temps_min, 0))
  FROM cuttings WHERE type = 'sortie'
  GROUP BY farm_id, variety_id, EXTRACT(YEAR FROM date)::INTEGER, EXTRACT(MONTH FROM date)::INTEGER
  ON CONFLICT ON CONSTRAINT production_summary_farm_unique DO UPDATE SET
    total_tronconnee_g    = production_summary.total_tronconnee_g    + EXCLUDED.total_tronconnee_g,
    temps_tronconnage_min = production_summary.temps_tronconnage_min + EXCLUDED.temps_tronconnage_min,
    updated_at = now();

  -- Tronçonnage — annuel
  INSERT INTO production_summary (farm_id, variety_id, annee, mois, total_tronconnee_g, temps_tronconnage_min)
  SELECT farm_id, variety_id, EXTRACT(YEAR FROM date)::INTEGER, NULL,
    SUM(poids_g), SUM(COALESCE(temps_min, 0))
  FROM cuttings WHERE type = 'sortie'
  GROUP BY farm_id, variety_id, EXTRACT(YEAR FROM date)::INTEGER
  ON CONFLICT ON CONSTRAINT production_summary_farm_unique DO UPDATE SET
    total_tronconnee_g    = production_summary.total_tronconnee_g    + EXCLUDED.total_tronconnee_g,
    temps_tronconnage_min = production_summary.temps_tronconnage_min + EXCLUDED.temps_tronconnage_min,
    updated_at = now();

  -- 4. Séchage — mensuel
  INSERT INTO production_summary (farm_id, variety_id, annee, mois, total_sechee_g, temps_sechage_min)
  SELECT farm_id, variety_id,
    EXTRACT(YEAR FROM date)::INTEGER, EXTRACT(MONTH FROM date)::INTEGER,
    SUM(poids_g), SUM(COALESCE(temps_min, 0))
  FROM dryings WHERE type = 'sortie'
  GROUP BY farm_id, variety_id, EXTRACT(YEAR FROM date)::INTEGER, EXTRACT(MONTH FROM date)::INTEGER
  ON CONFLICT ON CONSTRAINT production_summary_farm_unique DO UPDATE SET
    total_sechee_g    = production_summary.total_sechee_g    + EXCLUDED.total_sechee_g,
    temps_sechage_min = production_summary.temps_sechage_min + EXCLUDED.temps_sechage_min,
    updated_at = now();

  -- Séchage — annuel
  INSERT INTO production_summary (farm_id, variety_id, annee, mois, total_sechee_g, temps_sechage_min)
  SELECT farm_id, variety_id, EXTRACT(YEAR FROM date)::INTEGER, NULL,
    SUM(poids_g), SUM(COALESCE(temps_min, 0))
  FROM dryings WHERE type = 'sortie'
  GROUP BY farm_id, variety_id, EXTRACT(YEAR FROM date)::INTEGER
  ON CONFLICT ON CONSTRAINT production_summary_farm_unique DO UPDATE SET
    total_sechee_g    = production_summary.total_sechee_g    + EXCLUDED.total_sechee_g,
    temps_sechage_min = production_summary.temps_sechage_min + EXCLUDED.temps_sechage_min,
    updated_at = now();

  -- 5. Triage — mensuel
  INSERT INTO production_summary (farm_id, variety_id, annee, mois, total_triee_g, temps_triage_min)
  SELECT farm_id, variety_id,
    EXTRACT(YEAR FROM date)::INTEGER, EXTRACT(MONTH FROM date)::INTEGER,
    SUM(poids_g), SUM(COALESCE(temps_min, 0))
  FROM sortings WHERE type = 'sortie'
  GROUP BY farm_id, variety_id, EXTRACT(YEAR FROM date)::INTEGER, EXTRACT(MONTH FROM date)::INTEGER
  ON CONFLICT ON CONSTRAINT production_summary_farm_unique DO UPDATE SET
    total_triee_g    = production_summary.total_triee_g    + EXCLUDED.total_triee_g,
    temps_triage_min = production_summary.temps_triage_min + EXCLUDED.temps_triage_min,
    updated_at = now();

  -- Triage — annuel
  INSERT INTO production_summary (farm_id, variety_id, annee, mois, total_triee_g, temps_triage_min)
  SELECT farm_id, variety_id, EXTRACT(YEAR FROM date)::INTEGER, NULL,
    SUM(poids_g), SUM(COALESCE(temps_min, 0))
  FROM sortings WHERE type = 'sortie'
  GROUP BY farm_id, variety_id, EXTRACT(YEAR FROM date)::INTEGER
  ON CONFLICT ON CONSTRAINT production_summary_farm_unique DO UPDATE SET
    total_triee_g    = production_summary.total_triee_g    + EXCLUDED.total_triee_g,
    temps_triage_min = production_summary.temps_triage_min + EXCLUDED.temps_triage_min,
    updated_at = now();

  -- 6. Production (ingrédients plantes) — mensuel
  INSERT INTO production_summary (farm_id, variety_id, annee, mois, total_utilise_production_g)
  SELECT
    pl.farm_id, pli.variety_id,
    EXTRACT(YEAR FROM pl.date_production)::INTEGER,
    EXTRACT(MONTH FROM pl.date_production)::INTEGER,
    SUM(pli.poids_g)
  FROM production_lot_ingredients pli
  JOIN production_lots pl ON pl.id = pli.production_lot_id
  WHERE pli.variety_id IS NOT NULL AND pl.deleted_at IS NULL
  GROUP BY pl.farm_id, pli.variety_id,
    EXTRACT(YEAR FROM pl.date_production)::INTEGER,
    EXTRACT(MONTH FROM pl.date_production)::INTEGER
  ON CONFLICT ON CONSTRAINT production_summary_farm_unique DO UPDATE SET
    total_utilise_production_g = production_summary.total_utilise_production_g + EXCLUDED.total_utilise_production_g,
    updated_at = now();

  -- Production — annuel
  INSERT INTO production_summary (farm_id, variety_id, annee, mois, total_utilise_production_g)
  SELECT
    pl.farm_id, pli.variety_id,
    EXTRACT(YEAR FROM pl.date_production)::INTEGER,
    NULL,
    SUM(pli.poids_g)
  FROM production_lot_ingredients pli
  JOIN production_lots pl ON pl.id = pli.production_lot_id
  WHERE pli.variety_id IS NOT NULL AND pl.deleted_at IS NULL
  GROUP BY pl.farm_id, pli.variety_id, EXTRACT(YEAR FROM pl.date_production)::INTEGER
  ON CONFLICT ON CONSTRAINT production_summary_farm_unique DO UPDATE SET
    total_utilise_production_g = production_summary.total_utilise_production_g + EXCLUDED.total_utilise_production_g,
    updated_at = now();

  -- 7. Ventes directes — mensuel
  INSERT INTO production_summary (farm_id, variety_id, annee, mois, total_vendu_direct_g)
  SELECT farm_id, variety_id,
    EXTRACT(YEAR FROM date)::INTEGER, EXTRACT(MONTH FROM date)::INTEGER,
    SUM(poids_g)
  FROM stock_direct_sales
  GROUP BY farm_id, variety_id, EXTRACT(YEAR FROM date)::INTEGER, EXTRACT(MONTH FROM date)::INTEGER
  ON CONFLICT ON CONSTRAINT production_summary_farm_unique DO UPDATE SET
    total_vendu_direct_g = production_summary.total_vendu_direct_g + EXCLUDED.total_vendu_direct_g,
    updated_at = now();

  -- Ventes directes — annuel
  INSERT INTO production_summary (farm_id, variety_id, annee, mois, total_vendu_direct_g)
  SELECT farm_id, variety_id, EXTRACT(YEAR FROM date)::INTEGER, NULL, SUM(poids_g)
  FROM stock_direct_sales
  GROUP BY farm_id, variety_id, EXTRACT(YEAR FROM date)::INTEGER
  ON CONFLICT ON CONSTRAINT production_summary_farm_unique DO UPDATE SET
    total_vendu_direct_g = production_summary.total_vendu_direct_g + EXCLUDED.total_vendu_direct_g,
    updated_at = now();

  -- 8. Achats — mensuel
  INSERT INTO production_summary (farm_id, variety_id, annee, mois, total_achete_g)
  SELECT farm_id, variety_id,
    EXTRACT(YEAR FROM date)::INTEGER, EXTRACT(MONTH FROM date)::INTEGER,
    SUM(poids_g)
  FROM stock_purchases
  GROUP BY farm_id, variety_id, EXTRACT(YEAR FROM date)::INTEGER, EXTRACT(MONTH FROM date)::INTEGER
  ON CONFLICT ON CONSTRAINT production_summary_farm_unique DO UPDATE SET
    total_achete_g = production_summary.total_achete_g + EXCLUDED.total_achete_g,
    updated_at = now();

  -- Achats — annuel
  INSERT INTO production_summary (farm_id, variety_id, annee, mois, total_achete_g)
  SELECT farm_id, variety_id, EXTRACT(YEAR FROM date)::INTEGER, NULL, SUM(poids_g)
  FROM stock_purchases
  GROUP BY farm_id, variety_id, EXTRACT(YEAR FROM date)::INTEGER
  ON CONFLICT ON CONSTRAINT production_summary_farm_unique DO UPDATE SET
    total_achete_g = production_summary.total_achete_g + EXCLUDED.total_achete_g,
    updated_at = now();

  -- =============================================
  -- NOUVEAUX : Temps de culture
  -- =============================================

  -- 9. Semis (temps_semis_min) — mensuel (basé sur date_semis)
  INSERT INTO production_summary (farm_id, variety_id, annee, mois, temps_semis_min)
  SELECT farm_id, variety_id,
    EXTRACT(YEAR FROM date_semis)::INTEGER,
    EXTRACT(MONTH FROM date_semis)::INTEGER,
    SUM(COALESCE(temps_semis_min, 0))
  FROM seedlings
  WHERE deleted_at IS NULL AND variety_id IS NOT NULL AND date_semis IS NOT NULL
    AND temps_semis_min IS NOT NULL AND temps_semis_min > 0
  GROUP BY farm_id, variety_id, EXTRACT(YEAR FROM date_semis)::INTEGER, EXTRACT(MONTH FROM date_semis)::INTEGER
  ON CONFLICT ON CONSTRAINT production_summary_farm_unique DO UPDATE SET
    temps_semis_min = production_summary.temps_semis_min + EXCLUDED.temps_semis_min,
    updated_at = now();

  -- Semis — annuel
  INSERT INTO production_summary (farm_id, variety_id, annee, mois, temps_semis_min)
  SELECT farm_id, variety_id,
    EXTRACT(YEAR FROM date_semis)::INTEGER, NULL,
    SUM(COALESCE(temps_semis_min, 0))
  FROM seedlings
  WHERE deleted_at IS NULL AND variety_id IS NOT NULL AND date_semis IS NOT NULL
    AND temps_semis_min IS NOT NULL AND temps_semis_min > 0
  GROUP BY farm_id, variety_id, EXTRACT(YEAR FROM date_semis)::INTEGER
  ON CONFLICT ON CONSTRAINT production_summary_farm_unique DO UPDATE SET
    temps_semis_min = production_summary.temps_semis_min + EXCLUDED.temps_semis_min,
    updated_at = now();

  -- 10. Repiquage (temps_repiquage_min) — mensuel (basé sur date_repiquage)
  INSERT INTO production_summary (farm_id, variety_id, annee, mois, temps_repiquage_min)
  SELECT farm_id, variety_id,
    EXTRACT(YEAR FROM date_repiquage)::INTEGER,
    EXTRACT(MONTH FROM date_repiquage)::INTEGER,
    SUM(COALESCE(temps_repiquage_min, 0))
  FROM seedlings
  WHERE deleted_at IS NULL AND variety_id IS NOT NULL AND date_repiquage IS NOT NULL
    AND temps_repiquage_min IS NOT NULL AND temps_repiquage_min > 0
  GROUP BY farm_id, variety_id, EXTRACT(YEAR FROM date_repiquage)::INTEGER, EXTRACT(MONTH FROM date_repiquage)::INTEGER
  ON CONFLICT ON CONSTRAINT production_summary_farm_unique DO UPDATE SET
    temps_repiquage_min = production_summary.temps_repiquage_min + EXCLUDED.temps_repiquage_min,
    updated_at = now();

  -- Repiquage — annuel
  INSERT INTO production_summary (farm_id, variety_id, annee, mois, temps_repiquage_min)
  SELECT farm_id, variety_id,
    EXTRACT(YEAR FROM date_repiquage)::INTEGER, NULL,
    SUM(COALESCE(temps_repiquage_min, 0))
  FROM seedlings
  WHERE deleted_at IS NULL AND variety_id IS NOT NULL AND date_repiquage IS NOT NULL
    AND temps_repiquage_min IS NOT NULL AND temps_repiquage_min > 0
  GROUP BY farm_id, variety_id, EXTRACT(YEAR FROM date_repiquage)::INTEGER
  ON CONFLICT ON CONSTRAINT production_summary_farm_unique DO UPDATE SET
    temps_repiquage_min = production_summary.temps_repiquage_min + EXCLUDED.temps_repiquage_min,
    updated_at = now();

  -- 11. Plantation (temps_plantation_min) — mensuel (basé sur date_plantation)
  INSERT INTO production_summary (farm_id, variety_id, annee, mois, temps_plantation_min)
  SELECT farm_id, variety_id,
    COALESCE(EXTRACT(YEAR FROM date_plantation)::INTEGER, annee),
    EXTRACT(MONTH FROM date_plantation)::INTEGER,
    SUM(COALESCE(temps_min, 0))
  FROM plantings
  WHERE deleted_at IS NULL AND variety_id IS NOT NULL
    AND temps_min IS NOT NULL AND temps_min > 0
    AND date_plantation IS NOT NULL
  GROUP BY farm_id, variety_id,
    COALESCE(EXTRACT(YEAR FROM date_plantation)::INTEGER, annee),
    EXTRACT(MONTH FROM date_plantation)::INTEGER
  ON CONFLICT ON CONSTRAINT production_summary_farm_unique DO UPDATE SET
    temps_plantation_min = production_summary.temps_plantation_min + EXCLUDED.temps_plantation_min,
    updated_at = now();

  -- Plantation — annuel (inclut celles sans date_plantation via annee)
  INSERT INTO production_summary (farm_id, variety_id, annee, mois, temps_plantation_min)
  SELECT farm_id, variety_id,
    COALESCE(EXTRACT(YEAR FROM date_plantation)::INTEGER, annee),
    NULL,
    SUM(COALESCE(temps_min, 0))
  FROM plantings
  WHERE deleted_at IS NULL AND variety_id IS NOT NULL
    AND temps_min IS NOT NULL AND temps_min > 0
  GROUP BY farm_id, variety_id,
    COALESCE(EXTRACT(YEAR FROM date_plantation)::INTEGER, annee)
  ON CONFLICT ON CONSTRAINT production_summary_farm_unique DO UPDATE SET
    temps_plantation_min = production_summary.temps_plantation_min + EXCLUDED.temps_plantation_min,
    updated_at = now();

  -- 12. Suivi de rang (temps_suivi_rang_min) — mensuel
  INSERT INTO production_summary (farm_id, variety_id, annee, mois, temps_suivi_rang_min)
  SELECT farm_id, variety_id,
    EXTRACT(YEAR FROM date)::INTEGER,
    EXTRACT(MONTH FROM date)::INTEGER,
    SUM(COALESCE(temps_min, 0))
  FROM row_care
  WHERE variety_id IS NOT NULL
    AND temps_min IS NOT NULL AND temps_min > 0
  GROUP BY farm_id, variety_id, EXTRACT(YEAR FROM date)::INTEGER, EXTRACT(MONTH FROM date)::INTEGER
  ON CONFLICT ON CONSTRAINT production_summary_farm_unique DO UPDATE SET
    temps_suivi_rang_min = production_summary.temps_suivi_rang_min + EXCLUDED.temps_suivi_rang_min,
    updated_at = now();

  -- Suivi de rang — annuel
  INSERT INTO production_summary (farm_id, variety_id, annee, mois, temps_suivi_rang_min)
  SELECT farm_id, variety_id,
    EXTRACT(YEAR FROM date)::INTEGER, NULL,
    SUM(COALESCE(temps_min, 0))
  FROM row_care
  WHERE variety_id IS NOT NULL
    AND temps_min IS NOT NULL AND temps_min > 0
  GROUP BY farm_id, variety_id, EXTRACT(YEAR FROM date)::INTEGER
  ON CONFLICT ON CONSTRAINT production_summary_farm_unique DO UPDATE SET
    temps_suivi_rang_min = production_summary.temps_suivi_rang_min + EXCLUDED.temps_suivi_rang_min,
    updated_at = now();

  -- 13. Arrachage (temps_arrachage_min) — mensuel
  INSERT INTO production_summary (farm_id, variety_id, annee, mois, temps_arrachage_min)
  SELECT farm_id, variety_id,
    EXTRACT(YEAR FROM date)::INTEGER,
    EXTRACT(MONTH FROM date)::INTEGER,
    SUM(COALESCE(temps_min, 0))
  FROM uprootings
  WHERE variety_id IS NOT NULL
    AND temps_min IS NOT NULL AND temps_min > 0
  GROUP BY farm_id, variety_id, EXTRACT(YEAR FROM date)::INTEGER, EXTRACT(MONTH FROM date)::INTEGER
  ON CONFLICT ON CONSTRAINT production_summary_farm_unique DO UPDATE SET
    temps_arrachage_min = production_summary.temps_arrachage_min + EXCLUDED.temps_arrachage_min,
    updated_at = now();

  -- Arrachage — annuel
  INSERT INTO production_summary (farm_id, variety_id, annee, mois, temps_arrachage_min)
  SELECT farm_id, variety_id,
    EXTRACT(YEAR FROM date)::INTEGER, NULL,
    SUM(COALESCE(temps_min, 0))
  FROM uprootings
  WHERE variety_id IS NOT NULL
    AND temps_min IS NOT NULL AND temps_min > 0
  GROUP BY farm_id, variety_id, EXTRACT(YEAR FROM date)::INTEGER
  ON CONFLICT ON CONSTRAINT production_summary_farm_unique DO UPDATE SET
    temps_arrachage_min = production_summary.temps_arrachage_min + EXCLUDED.temps_arrachage_min,
    updated_at = now();

  SELECT COUNT(*) INTO v_count FROM production_summary;
  RETURN format('production_summary reconstruite : %s lignes', v_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- =============================================================================
-- 8. BACKFILL — Recalculer production_summary avec les nouvelles colonnes
-- =============================================================================

SELECT recalculate_production_summary();
