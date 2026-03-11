-- Migration 024 : Ajout du statut de cycle de vie sur seedlings
-- Spec : Évolution Semis → Plantation — traçabilité sachet → semis → plantation → rang

-- Ajout de la colonne statut avec les 6 états du cycle de vie
ALTER TABLE seedlings ADD COLUMN IF NOT EXISTS statut TEXT NOT NULL DEFAULT 'semis'
  CHECK (statut IN ('semis', 'leve', 'repiquage', 'pret', 'en_plantation', 'epuise'));

-- Note : le statut est recalculé en logique applicative (pas en trigger) dans 3 situations :
-- 1. Mise à jour d'un seedling (date_levee, date_repiquage, nb_plants_obtenus)
-- 2. Création d'un planting avec seedling_id
-- 3. Suppression/archivage d'un planting avec seedling_id
--
-- La valeur "plants_restants" est calculée à la volée :
--   seedlings.nb_plants_obtenus - SUM(plantings.nb_plants WHERE seedling_id = X AND deleted_at IS NULL AND actif = true)
