-- Migration 005 : Ajout catégorie Sirop + matériaux externes associés
-- À exécuter dans Supabase Dashboard → SQL Editor

-- Catégorie produit Sirop
INSERT INTO product_categories (nom) VALUES ('Sirop')
ON CONFLICT (nom) DO NOTHING;

-- Matériaux externes pour les sirops
-- Note : le sucre blond de canne bio sera ajouté si absent (peut déjà exister via saisie manuelle)
INSERT INTO external_materials (nom, unite) VALUES
  ('Sucre blond de canne bio', 'g'),
  ('Eau', 'mL')
ON CONFLICT (nom) DO NOTHING;
