-- 035 : Fonction stock_at_date + table season_closures
-- Permet de calculer le stock à n'importe quelle date
-- et de tracer les clôtures de saison.

-- ══════════════════════════════════════════════════════
-- 1. Fonction stock_at_date
-- ══════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION stock_at_date(p_farm_id UUID, p_date DATE)
RETURNS TABLE(
  variety_id UUID,
  partie_plante TEXT,
  etat_plante TEXT,
  stock_g DECIMAL
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    sm.variety_id,
    sm.partie_plante,
    sm.etat_plante,
    SUM(CASE WHEN sm.type_mouvement = 'entree' THEN sm.poids_g ELSE -sm.poids_g END) AS stock_g
  FROM stock_movements sm
  WHERE sm.farm_id = p_farm_id
    AND sm.date <= p_date
    AND sm.deleted_at IS NULL
  GROUP BY sm.variety_id, sm.partie_plante, sm.etat_plante
  HAVING SUM(CASE WHEN sm.type_mouvement = 'entree' THEN sm.poids_g ELSE -sm.poids_g END) != 0
$$;

COMMENT ON FUNCTION stock_at_date IS 'Calcule le stock par variété × partie × état à une date donnée (cumul des mouvements jusqu''à cette date)';

-- ══════════════════════════════════════════════════════
-- 2. Table season_closures
-- ══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS season_closures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id),
  annee INTEGER NOT NULL,
  closed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_by UUID REFERENCES auth.users(id),
  plantings_kept INTEGER DEFAULT 0,
  plantings_uprooted INTEGER DEFAULT 0,
  commentaire TEXT,
  UNIQUE(farm_id, annee)
);

-- RLS
ALTER TABLE season_closures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "season_closures_farm_member" ON season_closures
  FOR ALL
  USING (
    farm_id IN (
      SELECT f.id FROM farms f
      JOIN memberships m ON m.organization_id = f.organization_id
      JOIN auth.users u ON u.id = m.user_id
      WHERE u.id = auth.uid()
    )
  );

CREATE INDEX idx_season_closures_farm_annee ON season_closures (farm_id, annee);
