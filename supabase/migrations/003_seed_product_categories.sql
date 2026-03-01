-- Migration 003 : Données initiales — catégories de produits
-- À exécuter dans Supabase Dashboard → SQL Editor

INSERT INTO product_categories (nom) VALUES
  ('Tisane'),
  ('Mélange aromate'),
  ('Sel'),
  ('Sucre'),
  ('Vinaigre')
ON CONFLICT (nom) DO NOTHING;
