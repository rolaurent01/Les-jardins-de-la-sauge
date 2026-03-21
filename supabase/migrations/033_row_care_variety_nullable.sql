-- Migration 033 : Rendre variety_id nullable sur row_care
-- Permet d'enregistrer un suivi de rang (ex: désherbage) sur un rang sans plantation active.

ALTER TABLE row_care ALTER COLUMN variety_id DROP NOT NULL;
