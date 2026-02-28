-- ============================================================
-- APPLI LJS — Migration 002
-- Soft delete sur les tables de référence topographique et matériaux
-- À exécuter dans l'éditeur SQL Supabase après la migration 001
-- ============================================================

-- Ajout de la colonne deleted_at pour l'archivage (soft delete)
ALTER TABLE sites              ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE parcels            ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE rows               ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE external_materials ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
