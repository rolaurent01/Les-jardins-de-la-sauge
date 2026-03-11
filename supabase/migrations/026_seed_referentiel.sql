-- ============================================================
-- Migration 026 : Seed référentiel LJS
-- Données de référence pour la ferme Les Jardins de la Sauge
-- Sources : Import/referentiel_plantes.csv, referentiel_terrains.csv, referentiel_recettes.csv
-- ============================================================


-- ============================================================
-- 0. CATÉGORIES PRODUIT (compléter si nécessaire)
-- ============================================================

INSERT INTO product_categories (nom) VALUES ('Aromate')
ON CONFLICT (nom) DO NOTHING;


-- ============================================================
-- 1. VARIÉTÉS (90 variétés après fusions et nettoyage)
-- ============================================================
-- Fusions appliquées :
--   Menthe marocaine + Menthe verte → Menthe verte
--   Estragon + Estragon russe → Estragon
--   Camomille matricaire absorbe Matricaire
--   Aneth + Aneth semences → Aneth (parties_utilisees étendu)
--   Anis vert + Anis vert semences → Anis vert
--   Fenouil + Fenouil semences → Fenouil
--   Origan renommé → Origan vulgaire ; Origan grec ajouté
--   Framboisier (feuille) ajouté pour les recettes tisane
-- ============================================================

INSERT INTO varieties (nom_vernaculaire, nom_latin, famille, type_cycle, parties_utilisees, created_by_farm_id, notes)
VALUES
  -- A
  ('Absinthe', 'Artemisia absinthium', 'Astéracées', 'vivace', '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', NULL),
  ('Achillée', 'Achillea millefolium', 'Astéracées', 'vivace', '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', NULL),
  ('Agastache anisée', 'Agastache foeniculum', 'Lamiacées', 'perenne', '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', NULL),
  ('Agastache rugosa', 'Agastache rugosa', 'Lamiacées', 'perenne', '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', 'Aussi appelée ''Menthe coréenne'' dans les Excel'),
  ('Ail des ours', 'Allium ursinum', 'Amaryllidacées', 'vivace', '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', 'Cueillette sauvage'),
  ('Alchémille', 'Alchemilla vulgaris', 'Rosacées', 'vivace', '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', NULL),
  ('Aneth', 'Anethum graveolens', 'Apiacées', 'annuelle', '{"feuille","graine"}', '00000000-0000-0000-0000-000000000002', NULL),
  ('Angélique', 'Angelica archangelica', 'Apiacées', 'bisannuelle', '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', 'Doublon Excel : ''Angéliques'''),
  ('Anis vert', 'Pimpinella anisum', 'Apiacées', 'annuelle', '{"feuille","graine"}', '00000000-0000-0000-0000-000000000002', NULL),
  ('Arnica', 'Arnica acaulis', 'Astéracées', 'vivace', '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', NULL),
  ('Artémisia annua', 'Artemisia annua', 'Astéracées', 'annuelle', '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', NULL),
  ('Aubépine', 'Crataegus monogyna', 'Rosacées', 'perenne', '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', NULL),
  -- B
  ('Basilic cannelle', 'Ocimum basilicum Cinnamon', 'Lamiacées', 'annuelle', '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', NULL),
  ('Basilic citron', 'Ocimum basilicum var. citriodorum', 'Lamiacées', 'annuelle', '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', NULL),
  ('Basilic grand vert', 'Ocimum basilicum var. genovese', 'Lamiacées', 'annuelle', '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', 'Doublons Excel : ''Basilic grd vert'', ''Basilic Grand vert genovese'', ''Basilic loki'''),
  ('Basilic thaï', 'Ocimum basilicum var. thyrsiflora', 'Lamiacées', 'annuelle', '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', NULL),
  ('Basilic tulsi', 'Ocimum sanctum', 'Lamiacées', 'annuelle', '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', NULL),
  ('Bleuet', 'Centaurea cyanus', 'Astéracées', 'annuelle', '{"fleur"}', '00000000-0000-0000-0000-000000000002', 'Doublon Excel : ''Bleuets'''),
  ('Bouillon blanc', 'Verbascum thapsus', 'Scrophulariacées', 'bisannuelle', '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', NULL),
  ('Bourrache', 'Borago officinalis', 'Boraginacées', 'annuelle', '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', NULL),
  ('Bruyère', 'Calluna vulgaris', 'Éricacées', NULL, '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', NULL),
  -- C
  ('Calendula', 'Calendula officinalis', 'Astéracées', 'annuelle', '{"fleur","feuille"}', '00000000-0000-0000-0000-000000000002', 'Doublons Excel : ''Souci des jardins'', ''Soucis des jardins'', ''Calendulas'''),
  ('Camomille matricaire', 'Matricaria recutita', 'Astéracées', 'annuelle', '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', 'Absorbe ''Matricaire'' (doublon Excel)'),
  ('Camomille romaine', 'Chamaemelum nobile', 'Astéracées', 'perenne', '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', 'Latin Excel ''Anthemis nobilis'' = synonyme'),
  ('Capucine', NULL, 'Tropaéolacées', 'annuelle', '{"fleur"}', '00000000-0000-0000-0000-000000000002', NULL),
  ('Carvi', 'Carum carvi', 'Apiacées', 'vivace', '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', NULL),
  ('Cassis Andega', 'Ribes nigrum Andega', 'Grossulariacées', 'perenne', '{"fruit","feuille"}', '00000000-0000-0000-0000-000000000002', NULL),
  ('Cassis Noir de Bourgogne', 'Ribes nigrum Noir de Bourgogne', 'Grossulariacées', 'perenne', '{"fruit","feuille"}', '00000000-0000-0000-0000-000000000002', NULL),
  ('Chardon marie', 'Silybum marianum', 'Astéracées', 'annuelle', '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', NULL),
  ('Chicorée', 'Cichorium intybus', 'Astéracées', 'vivace', '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', NULL),
  ('Coquelicot', 'Papaver rhoeas', 'Papavéracées', 'annuelle', '{"fleur"}', '00000000-0000-0000-0000-000000000002', NULL),
  ('Coriandre', 'Coriandrum sativum', 'Apiacées', 'annuelle', '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', NULL),
  ('Coucou', 'Primula veris', 'Primulacées', 'vivace', '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', NULL),
  -- E
  ('Estragon', 'Artemisia dracunculus', 'Lamiacées', 'perenne', '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', 'Absorbe ''Estragon russe'' (var. inodora) du Excel'),
  -- F
  ('Fenouil', 'Foeniculum vulgare', 'Apiacées', 'annuelle', '{"feuille","graine"}', '00000000-0000-0000-0000-000000000002', NULL),
  ('Fraisier Charlotte', 'Fragaria × Charlotte', 'Rosacées', 'vivace', '{"fruit"}', '00000000-0000-0000-0000-000000000002', NULL),
  ('Fraisier Cirafine', 'Fragaria × Cirafine', 'Rosacées', 'vivace', '{"fruit"}', '00000000-0000-0000-0000-000000000002', NULL),
  ('Fraisier Gariguette', 'Fragaria × Gariguette', 'Rosacées', 'vivace', '{"fruit"}', '00000000-0000-0000-0000-000000000002', NULL),
  ('Framboisier', 'Rubus idaeus', 'Rosacées', 'perenne', '{"feuille"}', '00000000-0000-0000-0000-000000000002', 'Variété générique — feuilles utilisées en tisane'),
  ('Framboisier Héritage', 'Rubus idaeus Heritage', 'Rosacées', 'perenne', '{"fruit"}', '00000000-0000-0000-0000-000000000002', 'Remontant'),
  ('Framboisier Meco', 'Rubus idaeus Meco', 'Rosacées', 'perenne', '{"fruit"}', '00000000-0000-0000-0000-000000000002', 'Non remontant'),
  ('Framboisier Schoenemann', 'Rubus idaeus Schoenemann', 'Rosacées', 'perenne', '{"fruit"}', '00000000-0000-0000-0000-000000000002', 'Non remontant'),
  ('Framboisier Topla', 'Rubus idaeus Topla', 'Rosacées', 'perenne', '{"fruit"}', '00000000-0000-0000-0000-000000000002', 'Non remontant'),
  ('Frêne', 'Fraxinus excelsior', 'Oléacées', NULL, '{"feuille"}', '00000000-0000-0000-0000-000000000002', NULL),
  -- G
  ('Groseillier Junifer', 'Ribes rubrum Junifer', 'Grossulariacées', 'perenne', '{"fruit"}', '00000000-0000-0000-0000-000000000002', NULL),
  ('Guimauve', 'Althaea officinalis', 'Malvacées', 'bisannuelle', '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', NULL),
  ('Géranium rosat', 'Pelargonium graveolens', 'Géraniacées', 'perenne', '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', NULL),
  -- H
  ('Hysope', 'Hyssopus officinalis', 'Lamiacées', 'perenne', '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', NULL),
  ('Hélichryse', 'Helichrysum italicum', 'Astéracées', 'vivace', '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', 'Doublon Excel : ''Hélychrise'''),
  -- J
  ('Jeune pousse de sapin', NULL, NULL, NULL, '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', 'Cueillette sauvage — pas cultivé'),
  -- L
  ('Lavande vraie', 'Lavandula angustifolia', 'Lamiacées', 'perenne', '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', 'Doublon Excel : ''Lavande'''),
  ('Lierre terrestre', 'Glechoma hederacea', 'Lamiacées', 'vivace', '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', NULL),
  ('Livèche', 'Levisticum officinale', 'Apiacées', 'perenne', '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', NULL),
  ('Lotier corniculé', 'Lotus corniculatus', 'Fabacées', 'annuelle', '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', NULL),
  -- M
  ('Marjolaine', 'Origanum majorana', 'Lamiacées', 'vivace', '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', NULL),
  ('Mauve', 'Malva sylvestris var. mauritania', 'Malvacées', 'annuelle', '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', 'Doublons Excel : ''Mauve de Mauritanie'', ''Mauve Mauritanie'''),
  ('Menthe africaine', NULL, 'Lamiacées', 'perenne', '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', NULL),
  ('Menthe bergamote', 'Mentha piperita ssp. citrata', 'Lamiacées', 'vivace', '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', NULL),
  ('Menthe gingembre', NULL, 'Lamiacées', 'vivace', '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', NULL),
  ('Menthe poivrée', 'Mentha piperita', 'Lamiacées', 'vivace', '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', NULL),
  ('Menthe verte', 'Mentha spicata', 'Lamiacées', 'vivace', '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', 'Absorbe ''Menthe marocaine'' (même Mentha spicata)'),
  ('Monarde', 'Monarda didyma', 'Lamiacées', 'vivace', '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', NULL),
  ('Mélilot', 'Melilotus officinalis', 'Fabacées', 'annuelle', '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', NULL),
  ('Mélisse', 'Melissa officinalis', 'Lamiacées', 'vivace', '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', NULL),
  -- O
  ('Origan vulgaire', 'Origanum vulgare', 'Lamiacées', 'vivace', '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', 'Renommé depuis ''Origan'' du Excel'),
  ('Origan grec', 'Origanum vulgare subsp. hirtum', 'Lamiacées', 'vivace', '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', NULL),
  ('Ortie', 'Urtica dioica', 'Urticacées', 'vivace', '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', NULL),
  -- P
  ('Pavot de Californie', 'Eschscholzia californica', 'Papavéracées', 'annuelle', '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', NULL),
  ('Pensée sauvage', 'Viola tricolor', 'Violacées', 'annuelle', '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', NULL),
  ('Perilla pourpre', 'Perilla frutescens', 'Lamiacées', 'annuelle', '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', NULL),
  -- R
  ('Reine des prés', 'Filipendula ulmaria', 'Rosacées', 'vivace', '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', NULL),
  ('Romarin', 'Rosmarinus officinalis', 'Lamiacées', 'perenne', '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', NULL),
  ('Ronce', 'Rubus sp.', 'Rosacées', 'vivace', '{"feuille"}', '00000000-0000-0000-0000-000000000002', NULL),
  ('Rose', NULL, 'Rosacées', 'perenne', '{"fleur"}', '00000000-0000-0000-0000-000000000002', NULL),
  -- S
  ('Sarriette', 'Satureja montana', 'Lamiacées', 'perenne', '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', 'Doublons Excel : ''Sariette'', ''Sarriette annuelle'''),
  ('Sauge officinale', 'Salvia officinalis', 'Lamiacées', 'perenne', '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', 'Doublons Excel : ''Sauge'', ''Sauge off'', ''Sauge officinala'''),
  ('Sauge sclarée', 'Salvia sclarea', 'Lamiacées', 'perenne', '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', NULL),
  ('Serpolet', 'Thymus serpyllum', 'Lamiacées', 'perenne', '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', NULL),
  ('Sureau', 'Sambucus nigra', 'Adoxacées', 'perenne', '{"fleur"}', '00000000-0000-0000-0000-000000000002', NULL),
  -- T
  ('Tagète Lucida', 'Tagetes lucida', 'Astéracées', 'annuelle', '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', NULL),
  ('Tagète citron', 'Tagetes tenuifolia', 'Astéracées', 'annuelle', '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', NULL),
  ('Tagète minuta', 'Tagetes minuta', 'Astéracées', 'annuelle', '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', NULL),
  ('Thym citron', 'Thymus citriodorus', 'Lamiacées', 'perenne', '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', 'Doublon Excel : ''Thym citronné'''),
  ('Thym vulgaire', 'Thymus vulgaris', 'Lamiacées', 'vivace', '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', 'Doublon Excel : ''Thym'''),
  -- V
  ('Valériane officinale', 'Valeriana officinalis', 'Valérianacées', 'vivace', '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', NULL),
  ('Verveine Argentine', 'Aloysia polystachya', 'Verbénacées', 'perenne', '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', NULL),
  ('Verveine citronnée', 'Aloysia citrodora', 'Verbénacées', 'perenne', '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', 'Doublons Excel : ''Verveine'', ''Verveine odorante'''),
  ('Verveine officinale', 'Verbena officinalis', 'Verbénacées', 'annuelle', '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', NULL),
  -- É / Œ
  ('Échinacée pourpre', 'Echinacea purpurea', 'Astéracées', 'bisannuelle', '{"plante_entiere"}', '00000000-0000-0000-0000-000000000002', NULL),
  ('Œillet de poète', 'Dianthus barbatus', 'Caryophyllacées', 'annuelle', '{"fleur"}', '00000000-0000-0000-0000-000000000002', NULL)
ON CONFLICT (nom_vernaculaire) DO NOTHING;


-- ============================================================
-- 2. MATÉRIAUX EXTERNES
-- ============================================================

INSERT INTO external_materials (nom, unite, created_by_farm_id) VALUES
  ('Sel de Guérande', 'g', '00000000-0000-0000-0000-000000000002'),
  ('Sucre blond de canne', 'g', '00000000-0000-0000-0000-000000000002')
ON CONFLICT (nom) DO NOTHING;


-- ============================================================
-- 3. SITES
-- ============================================================

INSERT INTO sites (farm_id, nom) VALUES
  ('00000000-0000-0000-0000-000000000002', 'La Sauge'),
  ('00000000-0000-0000-0000-000000000002', 'Le Combet')
ON CONFLICT (farm_id, nom) DO NOTHING;


-- ============================================================
-- 4. PARCELLES
-- ============================================================

-- La Sauge
INSERT INTO parcels (farm_id, site_id, nom, code)
SELECT '00000000-0000-0000-0000-000000000002', s.id, v.nom, v.code
FROM sites s
CROSS JOIN (VALUES
  ('Principal', 'SAU-P'),
  ('Serre', 'SAU-S')
) AS v(nom, code)
WHERE s.farm_id = '00000000-0000-0000-0000-000000000002' AND s.nom = 'La Sauge'
ON CONFLICT (farm_id, code) DO NOTHING;

-- Le Combet
INSERT INTO parcels (farm_id, site_id, nom, code)
SELECT '00000000-0000-0000-0000-000000000002', s.id, v.nom, v.code
FROM sites s
CROSS JOIN (VALUES
  ('Jardin 1', 'COM-J1'),
  ('Jardin 2', 'COM-J2'),
  ('Jardin 3', 'COM-J3'),
  ('Jardin 4', 'COM-J4'),
  ('Jardin 5', 'COM-J5')
) AS v(nom, code)
WHERE s.farm_id = '00000000-0000-0000-0000-000000000002' AND s.nom = 'Le Combet'
ON CONFLICT (farm_id, code) DO NOTHING;


-- ============================================================
-- 5. RANGS (tous 20m × 0.8m)
-- ============================================================

-- La Sauge / Principal — rangs 1 à 33
INSERT INTO rows (farm_id, parcel_id, numero, ancien_numero, longueur_m, largeur_m, position_ordre)
SELECT '00000000-0000-0000-0000-000000000002', p.id, v.numero, v.ancien, 20, 0.8, v.pos
FROM parcels p
CROSS JOIN (VALUES
  ('1',  '1',  1),  ('2',  '2',  2),  ('3',  '3',  3),  ('4',  '4',  4),
  ('5',  '5',  5),  ('6',  '6',  6),  ('7',  '7',  7),  ('8',  '8',  8),
  ('9',  '9',  9),  ('10', '10', 10), ('11', '11', 11), ('12', '12', 12),
  ('13', '13', 13), ('14', '14', 14), ('15', '15', 15), ('16', '16', 16),
  ('17', '17', 17), ('18', '18', 18), ('19', '19', 19), ('20', '20', 20),
  ('21', '21', 21), ('22', '22', 22), ('23', '23', 23), ('24', '24', 24),
  ('25', '25', 25), ('26', '26', 26), ('27', '27', 27), ('28', '28', 28),
  ('29', '29', 29), ('30', '30', 30), ('31', '31', 31), ('32', '32', 32),
  ('33', '33', 33)
) AS v(numero, ancien, pos)
WHERE p.farm_id = '00000000-0000-0000-0000-000000000002' AND p.code = 'SAU-P'
ON CONFLICT (parcel_id, numero) DO NOTHING;

-- La Sauge / Serre — rangs 1 à 4
INSERT INTO rows (farm_id, parcel_id, numero, ancien_numero, longueur_m, largeur_m, position_ordre)
SELECT '00000000-0000-0000-0000-000000000002', p.id, v.numero, v.ancien, 20, 0.8, v.pos
FROM parcels p
CROSS JOIN (VALUES
  ('1', '1', 1), ('2', '2', 2), ('3', '3', 3), ('4', '4', 4)
) AS v(numero, ancien, pos)
WHERE p.farm_id = '00000000-0000-0000-0000-000000000002' AND p.code = 'SAU-S'
ON CONFLICT (parcel_id, numero) DO NOTHING;

-- Le Combet / Jardin 1 — 14 rangs (renumérotés)
INSERT INTO rows (farm_id, parcel_id, numero, ancien_numero, longueur_m, largeur_m, position_ordre)
SELECT '00000000-0000-0000-0000-000000000002', p.id, v.numero, v.ancien, 20, 0.8, v.pos
FROM parcels p
CROSS JOIN (VALUES
  ('1',  '1',  1),  ('2',  '2',  2),  ('3',  '7',  3),  ('4',  '8',  4),
  ('5',  '9',  5),  ('6',  '11', 6),  ('7',  '12', 7),  ('8',  '14', 8),
  ('9',  '15', 9),  ('10', '16', 10), ('11', '17', 11), ('12', '18', 12),
  ('13', '19', 13), ('14', '20', 14)
) AS v(numero, ancien, pos)
WHERE p.farm_id = '00000000-0000-0000-0000-000000000002' AND p.code = 'COM-J1'
ON CONFLICT (parcel_id, numero) DO NOTHING;

-- Le Combet / Jardin 2 — 18 rangs (renumérotés, lignes '—' ignorées)
INSERT INTO rows (farm_id, parcel_id, numero, ancien_numero, longueur_m, largeur_m, position_ordre)
SELECT '00000000-0000-0000-0000-000000000002', p.id, v.numero, v.ancien, 20, 0.8, v.pos
FROM parcels p
CROSS JOIN (VALUES
  ('1',  '1a',  1),  ('2',  '1b',  2),  ('3',  '1',   3),  ('4',  '2',   4),
  ('5',  '3',   5),  ('6',  '4',   6),  ('7',  '5',   7),  ('8',  '6',   8),
  ('9',  '7',   9),  ('10', '8',   10), ('11', '9',   11), ('12', '10',  12),
  ('13', '10a', 13), ('14', '11',  14), ('15', '11a', 15), ('16', '12',  16),
  ('17', '13',  17), ('18', '14',  18)
) AS v(numero, ancien, pos)
WHERE p.farm_id = '00000000-0000-0000-0000-000000000002' AND p.code = 'COM-J2'
ON CONFLICT (parcel_id, numero) DO NOTHING;

-- Le Combet / Jardin 3 — 13 rangs
INSERT INTO rows (farm_id, parcel_id, numero, ancien_numero, longueur_m, largeur_m, position_ordre)
SELECT '00000000-0000-0000-0000-000000000002', p.id, v.numero, v.ancien, 20, 0.8, v.pos
FROM parcels p
CROSS JOIN (VALUES
  ('1',  '1',  1),  ('2',  '1B', 2),  ('3',  '1C', 3),  ('4',  '2',  4),
  ('5',  '2B', 5),  ('6',  '3',  6),  ('7',  '4',  7),  ('8',  '5',  8),
  ('9',  '6',  9),  ('10', '7',  10), ('11', '8',  11), ('12', '9',  12),
  ('13', '10', 13)
) AS v(numero, ancien, pos)
WHERE p.farm_id = '00000000-0000-0000-0000-000000000002' AND p.code = 'COM-J3'
ON CONFLICT (parcel_id, numero) DO NOTHING;

-- Le Combet / Jardin 4 — 16 rangs
INSERT INTO rows (farm_id, parcel_id, numero, ancien_numero, longueur_m, largeur_m, position_ordre)
SELECT '00000000-0000-0000-0000-000000000002', p.id, v.numero, v.ancien, 20, 0.8, v.pos
FROM parcels p
CROSS JOIN (VALUES
  ('1',  '1',  1),  ('2',  '1a', 2),  ('3',  '1b', 3),  ('4',  '1c', 4),
  ('5',  '2',  5),  ('6',  '3',  6),  ('7',  '4',  7),  ('8',  '5',  8),
  ('9',  '6',  9),  ('10', '7',  10), ('11', '8',  11), ('12', '9',  12),
  ('13', '10', 13), ('14', '11', 14), ('15', '12', 15), ('16', '13', 16)
) AS v(numero, ancien, pos)
WHERE p.farm_id = '00000000-0000-0000-0000-000000000002' AND p.code = 'COM-J4'
ON CONFLICT (parcel_id, numero) DO NOTHING;

-- Le Combet / Jardin 5 — 20 rangs (lignes '—' ignorées)
INSERT INTO rows (farm_id, parcel_id, numero, ancien_numero, longueur_m, largeur_m, position_ordre)
SELECT '00000000-0000-0000-0000-000000000002', p.id, v.numero, v.ancien, 20, 0.8, v.pos
FROM parcels p
CROSS JOIN (VALUES
  ('1',  '1',  1),  ('2',  '1b', 2),  ('3',  '1c', 3),  ('4',  '2',  4),
  ('5',  '3',  5),  ('6',  '4',  6),  ('7',  '5',  7),  ('8',  '6',  8),
  ('9',  '7',  9),  ('10', '7B', 10), ('11', '8',  11), ('12', '9',  12),
  ('13', '10', 13), ('14', '11', 14), ('15', '12', 15), ('16', '13', 16),
  ('17', '14', 17), ('18', '15', 18), ('19', '16', 19), ('20', '17', 20)
) AS v(numero, ancien, pos)
WHERE p.farm_id = '00000000-0000-0000-0000-000000000002' AND p.code = 'COM-J5'
ON CONFLICT (parcel_id, numero) DO NOTHING;


-- ============================================================
-- 6. RECETTES + INGRÉDIENTS (21 recettes)
-- ============================================================
-- etat_plante par défaut :
--   Tisanes / Aromates → 'tronconnee_sechee_triee'
--   Sels (plantes) → 'sechee_triee' sauf Ail des ours → 'frais'
--   Sucre (plante) → 'sechee_triee'
-- partie_plante par défaut : 'plante_entiere' sauf exceptions listées
-- ============================================================

DO $$
DECLARE
  _farm    CONSTANT UUID := '00000000-0000-0000-0000-000000000002';
  _cat_tis UUID;
  _cat_aro UUID;
  _cat_sel UUID;
  _cat_suc UUID;
  _em_sel  UUID;
  _em_suc  UUID;
  _r       UUID;  -- recipe id courant
BEGIN
  -- Récupération des FK
  SELECT id INTO _cat_tis FROM product_categories WHERE nom = 'Tisane';
  SELECT id INTO _cat_aro FROM product_categories WHERE nom = 'Aromate';
  -- Fallback sur 'Mélange aromate' si 'Aromate' n'existe pas encore
  IF _cat_aro IS NULL THEN
    SELECT id INTO _cat_aro FROM product_categories WHERE nom = 'Mélange aromate';
  END IF;
  SELECT id INTO _cat_sel FROM product_categories WHERE nom = 'Sel';
  SELECT id INTO _cat_suc FROM product_categories WHERE nom = 'Sucre';
  SELECT id INTO _em_sel  FROM external_materials  WHERE nom = 'Sel de Guérande';
  SELECT id INTO _em_suc  FROM external_materials  WHERE nom = 'Sucre blond de canne';

  -- --------------------------------------------------------
  -- T1 : La Balade Digestive (BD, 25g, Tisane)
  -- --------------------------------------------------------
  INSERT INTO recipes (farm_id, nom, numero_tisane, poids_sachet_g, category_id)
  VALUES (_farm, 'La Balade Digestive', 'BD', 25, _cat_tis)
  ON CONFLICT (farm_id, nom) DO NOTHING
  RETURNING id INTO _r;
  IF _r IS NOT NULL THEN
    INSERT INTO recipe_ingredients (recipe_id, variety_id, external_material_id, pourcentage, partie_plante, etat_plante, ordre) VALUES
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Menthe verte'),          NULL, 0.24, 'plante_entiere', 'tronconnee_sechee_triee', 1),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Agastache anisée'),      NULL, 0.23, 'plante_entiere', 'tronconnee_sechee_triee', 2),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Romarin'),               NULL, 0.18, 'plante_entiere', 'tronconnee_sechee_triee', 3),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Camomille matricaire'),  NULL, 0.12, 'plante_entiere', 'tronconnee_sechee_triee', 4),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Basilic thaï'),          NULL, 0.12, 'plante_entiere', 'tronconnee_sechee_triee', 5),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Calendula'),             NULL, 0.11, 'fleur',          'tronconnee_sechee_triee', 6);
  END IF;

  -- --------------------------------------------------------
  -- T2 : Nuit Étoilée (NE, 20g, Tisane)
  -- --------------------------------------------------------
  INSERT INTO recipes (farm_id, nom, numero_tisane, poids_sachet_g, category_id)
  VALUES (_farm, 'Nuit Étoilée', 'NE', 20, _cat_tis)
  ON CONFLICT (farm_id, nom) DO NOTHING
  RETURNING id INTO _r;
  IF _r IS NOT NULL THEN
    INSERT INTO recipe_ingredients (recipe_id, variety_id, external_material_id, pourcentage, partie_plante, etat_plante, ordre) VALUES
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Verveine citronnée'), NULL, 0.33, 'plante_entiere', 'tronconnee_sechee_triee', 1),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Mélisse'),            NULL, 0.25, 'plante_entiere', 'tronconnee_sechee_triee', 2),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Aubépine'),           NULL, 0.25, 'plante_entiere', 'tronconnee_sechee_triee', 3),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Mauve'),              NULL, 0.09, 'plante_entiere', 'tronconnee_sechee_triee', 4),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Coucou'),             NULL, 0.08, 'plante_entiere', 'tronconnee_sechee_triee', 5);
  END IF;

  -- --------------------------------------------------------
  -- T3 : Lever de Soleil (LS, 30g, Tisane)
  -- --------------------------------------------------------
  INSERT INTO recipes (farm_id, nom, numero_tisane, poids_sachet_g, category_id)
  VALUES (_farm, 'Lever de Soleil', 'LS', 30, _cat_tis)
  ON CONFLICT (farm_id, nom) DO NOTHING
  RETURNING id INTO _r;
  IF _r IS NOT NULL THEN
    INSERT INTO recipe_ingredients (recipe_id, variety_id, external_material_id, pourcentage, partie_plante, etat_plante, ordre) VALUES
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Menthe bergamote'),    NULL, 0.30, 'plante_entiere', 'tronconnee_sechee_triee', 1),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Sarriette'),           NULL, 0.20, 'plante_entiere', 'tronconnee_sechee_triee', 2),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Thym citron'),         NULL, 0.20, 'plante_entiere', 'tronconnee_sechee_triee', 3),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Angélique'),           NULL, 0.15, 'plante_entiere', 'tronconnee_sechee_triee', 4),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Calendula'),           NULL, 0.10, 'fleur',          'tronconnee_sechee_triee', 5),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Verveine Argentine'),  NULL, 0.05, 'plante_entiere', 'tronconnee_sechee_triee', 6);
  END IF;

  -- --------------------------------------------------------
  -- T4 : Feu de Camp (FC, 20g, Tisane)
  -- --------------------------------------------------------
  INSERT INTO recipes (farm_id, nom, numero_tisane, poids_sachet_g, category_id)
  VALUES (_farm, 'Feu de Camp', 'FC', 20, _cat_tis)
  ON CONFLICT (farm_id, nom) DO NOTHING
  RETURNING id INTO _r;
  IF _r IS NOT NULL THEN
    INSERT INTO recipe_ingredients (recipe_id, variety_id, external_material_id, pourcentage, partie_plante, etat_plante, ordre) VALUES
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Agastache anisée'),    NULL, 0.35, 'plante_entiere', 'tronconnee_sechee_triee', 1),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Sureau'),              NULL, 0.30, 'fleur',          'tronconnee_sechee_triee', 2),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Basilic cannelle'),    NULL, 0.25, 'plante_entiere', 'tronconnee_sechee_triee', 3),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Mauve'),               NULL, 0.05, 'plante_entiere', 'tronconnee_sechee_triee', 4),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Pavot de Californie'), NULL, 0.05, 'plante_entiere', 'tronconnee_sechee_triee', 5);
  END IF;

  -- --------------------------------------------------------
  -- T5 : La Montagne au Féminin (MF, 20g, Tisane)
  -- --------------------------------------------------------
  INSERT INTO recipes (farm_id, nom, numero_tisane, poids_sachet_g, category_id)
  VALUES (_farm, 'La Montagne au Féminin', 'MF', 20, _cat_tis)
  ON CONFLICT (farm_id, nom) DO NOTHING
  RETURNING id INTO _r;
  IF _r IS NOT NULL THEN
    INSERT INTO recipe_ingredients (recipe_id, variety_id, external_material_id, pourcentage, partie_plante, etat_plante, ordre) VALUES
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Achillée'),    NULL, 0.20, 'plante_entiere', 'tronconnee_sechee_triee', 1),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Framboisier'), NULL, 0.20, 'feuille',        'tronconnee_sechee_triee', 2),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Aubépine'),    NULL, 0.20, 'plante_entiere', 'tronconnee_sechee_triee', 3),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Marjolaine'),  NULL, 0.10, 'plante_entiere', 'tronconnee_sechee_triee', 4),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Alchémille'),  NULL, 0.10, 'plante_entiere', 'tronconnee_sechee_triee', 5),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Ortie'),       NULL, 0.10, 'plante_entiere', 'tronconnee_sechee_triee', 6),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Rose'),        NULL, 0.10, 'fleur',          'tronconnee_sechee_triee', 7);
  END IF;

  -- --------------------------------------------------------
  -- T6 : L'Équilibre (EQ, 25g, Tisane)
  -- --------------------------------------------------------
  INSERT INTO recipes (farm_id, nom, numero_tisane, poids_sachet_g, category_id)
  VALUES (_farm, 'L''Équilibre', 'EQ', 25, _cat_tis)
  ON CONFLICT (farm_id, nom) DO NOTHING
  RETURNING id INTO _r;
  IF _r IS NOT NULL THEN
    INSERT INTO recipe_ingredients (recipe_id, variety_id, external_material_id, pourcentage, partie_plante, etat_plante, ordre) VALUES
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Basilic tulsi'),      NULL, 0.30, 'plante_entiere', 'tronconnee_sechee_triee', 1),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Mélisse'),            NULL, 0.30, 'plante_entiere', 'tronconnee_sechee_triee', 2),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Marjolaine'),         NULL, 0.12, 'plante_entiere', 'tronconnee_sechee_triee', 3),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Aubépine'),           NULL, 0.12, 'plante_entiere', 'tronconnee_sechee_triee', 4),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Achillée'),           NULL, 0.12, 'plante_entiere', 'tronconnee_sechee_triee', 5),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Camomille romaine'),  NULL, 0.04, 'plante_entiere', 'tronconnee_sechee_triee', 6);
  END IF;

  -- --------------------------------------------------------
  -- T7 : Le Chant des Rivières (CR, 25g, Tisane)
  -- --------------------------------------------------------
  INSERT INTO recipes (farm_id, nom, numero_tisane, poids_sachet_g, category_id)
  VALUES (_farm, 'Le Chant des Rivières', 'CR', 25, _cat_tis)
  ON CONFLICT (farm_id, nom) DO NOTHING
  RETURNING id INTO _r;
  IF _r IS NOT NULL THEN
    INSERT INTO recipe_ingredients (recipe_id, variety_id, external_material_id, pourcentage, partie_plante, etat_plante, ordre) VALUES
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Thym citron'),     NULL, 0.20, 'plante_entiere', 'tronconnee_sechee_triee', 1),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Basilic citron'),  NULL, 0.16, 'plante_entiere', 'tronconnee_sechee_triee', 2),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Frêne'),           NULL, 0.16, 'feuille',        'tronconnee_sechee_triee', 3),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Bruyère'),         NULL, 0.16, 'plante_entiere', 'tronconnee_sechee_triee', 4),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Sureau'),          NULL, 0.16, 'fleur',          'tronconnee_sechee_triee', 5),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Menthe poivrée'),  NULL, 0.08, 'plante_entiere', 'tronconnee_sechee_triee', 6),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Bleuet'),          NULL, 0.08, 'fleur',          'tronconnee_sechee_triee', 7);
  END IF;

  -- --------------------------------------------------------
  -- T8 : Plein Air (PA, 25g, Tisane)
  -- --------------------------------------------------------
  INSERT INTO recipes (farm_id, nom, numero_tisane, poids_sachet_g, category_id)
  VALUES (_farm, 'Plein Air', 'PA', 25, _cat_tis)
  ON CONFLICT (farm_id, nom) DO NOTHING
  RETURNING id INTO _r;
  IF _r IS NOT NULL THEN
    INSERT INTO recipe_ingredients (recipe_id, variety_id, external_material_id, pourcentage, partie_plante, etat_plante, ordre) VALUES
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Reine des prés'),    NULL, 0.17, 'plante_entiere', 'tronconnee_sechee_triee', 1),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Sauge officinale'),  NULL, 0.17, 'plante_entiere', 'tronconnee_sechee_triee', 2),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Serpolet'),          NULL, 0.17, 'plante_entiere', 'tronconnee_sechee_triee', 3),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Lierre terrestre'),  NULL, 0.17, 'plante_entiere', 'tronconnee_sechee_triee', 4),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Hysope'),            NULL, 0.17, 'plante_entiere', 'tronconnee_sechee_triee', 5),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Coucou'),            NULL, 0.08, 'plante_entiere', 'tronconnee_sechee_triee', 6),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Menthe africaine'),  NULL, 0.07, 'plante_entiere', 'tronconnee_sechee_triee', 7);
  END IF;

  -- --------------------------------------------------------
  -- T9 : L'Hivernale (HI, 25g, Tisane)
  -- --------------------------------------------------------
  INSERT INTO recipes (farm_id, nom, numero_tisane, poids_sachet_g, category_id)
  VALUES (_farm, 'L''Hivernale', 'HI', 25, _cat_tis)
  ON CONFLICT (farm_id, nom) DO NOTHING
  RETURNING id INTO _r;
  IF _r IS NOT NULL THEN
    INSERT INTO recipe_ingredients (recipe_id, variety_id, external_material_id, pourcentage, partie_plante, etat_plante, ordre) VALUES
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Jeune pousse de sapin'), NULL, 0.25, 'plante_entiere', 'tronconnee_sechee_triee', 1),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Cassis Andega'),         NULL, 0.15, 'feuille',        'tronconnee_sechee_triee', 2),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Sureau'),                NULL, 0.15, 'fleur',          'tronconnee_sechee_triee', 3),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Serpolet'),              NULL, 0.15, 'plante_entiere', 'tronconnee_sechee_triee', 4),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Ronce'),                 NULL, 0.10, 'feuille',        'tronconnee_sechee_triee', 5),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Géranium rosat'),        NULL, 0.10, 'plante_entiere', 'tronconnee_sechee_triee', 6),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Coucou'),                NULL, 0.10, 'plante_entiere', 'tronconnee_sechee_triee', 7);
  END IF;

  -- --------------------------------------------------------
  -- T10 : Tisane de Noël (NO, 25g, Tisane)
  -- --------------------------------------------------------
  INSERT INTO recipes (farm_id, nom, numero_tisane, poids_sachet_g, category_id)
  VALUES (_farm, 'Tisane de Noël', 'NO', 25, _cat_tis)
  ON CONFLICT (farm_id, nom) DO NOTHING
  RETURNING id INTO _r;
  IF _r IS NOT NULL THEN
    INSERT INTO recipe_ingredients (recipe_id, variety_id, external_material_id, pourcentage, partie_plante, etat_plante, ordre) VALUES
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Géranium rosat'),  NULL, 0.32, 'plante_entiere', 'tronconnee_sechee_triee', 1),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Romarin'),         NULL, 0.24, 'plante_entiere', 'tronconnee_sechee_triee', 2),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Menthe poivrée'),  NULL, 0.20, 'plante_entiere', 'tronconnee_sechee_triee', 3),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Monarde'),         NULL, 0.20, 'plante_entiere', 'tronconnee_sechee_triee', 4),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Coquelicot'),      NULL, 0.04, 'fleur',          'tronconnee_sechee_triee', 5);
  END IF;

  -- --------------------------------------------------------
  -- T11 : Douceur Maternelle (DM, 25g, Tisane)
  -- --------------------------------------------------------
  INSERT INTO recipes (farm_id, nom, numero_tisane, poids_sachet_g, category_id)
  VALUES (_farm, 'Douceur Maternelle', 'DM', 25, _cat_tis)
  ON CONFLICT (farm_id, nom) DO NOTHING
  RETURNING id INTO _r;
  IF _r IS NOT NULL THEN
    INSERT INTO recipe_ingredients (recipe_id, variety_id, external_material_id, pourcentage, partie_plante, etat_plante, ordre) VALUES
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Verveine citronnée'), NULL, 0.30, 'plante_entiere', 'tronconnee_sechee_triee', 1),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Fenouil'),            NULL, 0.30, 'graine',         'tronconnee_sechee_triee', 2),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Aneth'),              NULL, 0.15, 'graine',         'tronconnee_sechee_triee', 3),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Anis vert'),          NULL, 0.15, 'graine',         'tronconnee_sechee_triee', 4),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Mélisse'),            NULL, 0.10, 'plante_entiere', 'tronconnee_sechee_triee', 5);
  END IF;

  -- --------------------------------------------------------
  -- A1 : Aromate Volaille (AV, 12g, Aromate)
  -- --------------------------------------------------------
  INSERT INTO recipes (farm_id, nom, numero_tisane, poids_sachet_g, category_id)
  VALUES (_farm, 'Aromate Volaille', 'AV', 12, _cat_aro)
  ON CONFLICT (farm_id, nom) DO NOTHING
  RETURNING id INTO _r;
  IF _r IS NOT NULL THEN
    INSERT INTO recipe_ingredients (recipe_id, variety_id, external_material_id, pourcentage, partie_plante, etat_plante, ordre) VALUES
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Estragon'),  NULL, 0.50, 'plante_entiere', 'tronconnee_sechee_triee', 1),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Sarriette'), NULL, 0.25, 'plante_entiere', 'tronconnee_sechee_triee', 2),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Serpolet'),  NULL, 0.14, 'plante_entiere', 'tronconnee_sechee_triee', 3),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Hysope'),    NULL, 0.09, 'plante_entiere', 'tronconnee_sechee_triee', 4),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Bleuet'),    NULL, 0.02, 'fleur',          'tronconnee_sechee_triee', 5);
  END IF;

  -- --------------------------------------------------------
  -- A2 : Aromate Potage (AP, 15g, Aromate)
  -- --------------------------------------------------------
  INSERT INTO recipes (farm_id, nom, numero_tisane, poids_sachet_g, category_id)
  VALUES (_farm, 'Aromate Potage', 'AP', 15, _cat_aro)
  ON CONFLICT (farm_id, nom) DO NOTHING
  RETURNING id INTO _r;
  IF _r IS NOT NULL THEN
    INSERT INTO recipe_ingredients (recipe_id, variety_id, external_material_id, pourcentage, partie_plante, etat_plante, ordre) VALUES
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Ortie'),           NULL, 0.45, 'plante_entiere', 'tronconnee_sechee_triee', 1),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Thym vulgaire'),   NULL, 0.15, 'plante_entiere', 'tronconnee_sechee_triee', 2),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Serpolet'),        NULL, 0.15, 'plante_entiere', 'tronconnee_sechee_triee', 3),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Sauge officinale'),NULL, 0.15, 'plante_entiere', 'tronconnee_sechee_triee', 4),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Livèche'),         NULL, 0.10, 'plante_entiere', 'tronconnee_sechee_triee', 5);
  END IF;

  -- --------------------------------------------------------
  -- A3 : Aromate Grillades (AG, 12g, Aromate)
  -- --------------------------------------------------------
  INSERT INTO recipes (farm_id, nom, numero_tisane, poids_sachet_g, category_id)
  VALUES (_farm, 'Aromate Grillades', 'AG', 12, _cat_aro)
  ON CONFLICT (farm_id, nom) DO NOTHING
  RETURNING id INTO _r;
  IF _r IS NOT NULL THEN
    INSERT INTO recipe_ingredients (recipe_id, variety_id, external_material_id, pourcentage, partie_plante, etat_plante, ordre) VALUES
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Serpolet'),        NULL, 0.20, 'plante_entiere', 'tronconnee_sechee_triee', 1),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Origan vulgaire'), NULL, 0.20, 'plante_entiere', 'tronconnee_sechee_triee', 2),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Romarin'),         NULL, 0.15, 'plante_entiere', 'tronconnee_sechee_triee', 3),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Hysope'),          NULL, 0.15, 'plante_entiere', 'tronconnee_sechee_triee', 4),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Sarriette'),       NULL, 0.15, 'plante_entiere', 'tronconnee_sechee_triee', 5),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Thym vulgaire'),   NULL, 0.15, 'plante_entiere', 'tronconnee_sechee_triee', 6);
  END IF;

  -- --------------------------------------------------------
  -- A4 : Pique-nique (PQ, 12g, Aromate)
  -- --------------------------------------------------------
  INSERT INTO recipes (farm_id, nom, numero_tisane, poids_sachet_g, category_id)
  VALUES (_farm, 'Pique-nique', 'PQ', 12, _cat_aro)
  ON CONFLICT (farm_id, nom) DO NOTHING
  RETURNING id INTO _r;
  IF _r IS NOT NULL THEN
    INSERT INTO recipe_ingredients (recipe_id, variety_id, external_material_id, pourcentage, partie_plante, etat_plante, ordre) VALUES
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Menthe verte'),    NULL, 0.44, 'plante_entiere', 'tronconnee_sechee_triee', 1),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Basilic citron'),  NULL, 0.24, 'plante_entiere', 'tronconnee_sechee_triee', 2),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Origan vulgaire'), NULL, 0.20, 'plante_entiere', 'tronconnee_sechee_triee', 3),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Thym citron'),     NULL, 0.12, 'plante_entiere', 'tronconnee_sechee_triee', 4);
  END IF;

  -- --------------------------------------------------------
  -- A5 : Les Lacs (LC, 12g, Aromate)
  -- --------------------------------------------------------
  INSERT INTO recipes (farm_id, nom, numero_tisane, poids_sachet_g, category_id)
  VALUES (_farm, 'Les Lacs', 'LC', 12, _cat_aro)
  ON CONFLICT (farm_id, nom) DO NOTHING
  RETURNING id INTO _r;
  IF _r IS NOT NULL THEN
    INSERT INTO recipe_ingredients (recipe_id, variety_id, external_material_id, pourcentage, partie_plante, etat_plante, ordre) VALUES
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Origan vulgaire'),  NULL, 0.40, 'plante_entiere', 'tronconnee_sechee_triee', 1),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Fenouil'),          NULL, 0.20, 'plante_entiere', 'tronconnee_sechee_triee', 2),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Basilic citron'),   NULL, 0.20, 'plante_entiere', 'tronconnee_sechee_triee', 3),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Menthe bergamote'), NULL, 0.20, 'plante_entiere', 'tronconnee_sechee_triee', 4);
  END IF;

  -- --------------------------------------------------------
  -- S1 : Sel aux Herbes (SAH, 40g, Sel)
  -- --------------------------------------------------------
  INSERT INTO recipes (farm_id, nom, numero_tisane, poids_sachet_g, category_id)
  VALUES (_farm, 'Sel aux Herbes', 'SAH', 40, _cat_sel)
  ON CONFLICT (farm_id, nom) DO NOTHING
  RETURNING id INTO _r;
  IF _r IS NOT NULL THEN
    INSERT INTO recipe_ingredients (recipe_id, variety_id, external_material_id, pourcentage, partie_plante, etat_plante, ordre) VALUES
      (_r, NULL,                                                                    _em_sel, 0.75, NULL,             NULL,           1),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Romarin'),           NULL,    0.04, 'plante_entiere', 'sechee_triee', 2),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Origan vulgaire'),   NULL,    0.04, 'plante_entiere', 'sechee_triee', 3),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Thym vulgaire'),     NULL,    0.04, 'plante_entiere', 'sechee_triee', 4),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Serpolet'),          NULL,    0.03, 'plante_entiere', 'sechee_triee', 5),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Sarriette'),         NULL,    0.03, 'plante_entiere', 'sechee_triee', 6),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Hysope'),            NULL,    0.03, 'plante_entiere', 'sechee_triee', 7),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Sauge officinale'),  NULL,    0.02, 'plante_entiere', 'sechee_triee', 8),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Menthe verte'),      NULL,    0.02, 'plante_entiere', 'sechee_triee', 9);
  END IF;

  -- --------------------------------------------------------
  -- S2 : Sel Ortie Calendula (SOC, 35g, Sel)
  -- --------------------------------------------------------
  INSERT INTO recipes (farm_id, nom, numero_tisane, poids_sachet_g, category_id)
  VALUES (_farm, 'Sel Ortie Calendula', 'SOC', 35, _cat_sel)
  ON CONFLICT (farm_id, nom) DO NOTHING
  RETURNING id INTO _r;
  IF _r IS NOT NULL THEN
    INSERT INTO recipe_ingredients (recipe_id, variety_id, external_material_id, pourcentage, partie_plante, etat_plante, ordre) VALUES
      (_r, NULL,                                                                _em_sel, 0.55, NULL,             NULL,           1),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Ortie'),         NULL,    0.43, 'plante_entiere', 'sechee_triee', 2),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Calendula'),     NULL,    0.02, 'fleur',          'sechee_triee', 3);
  END IF;

  -- --------------------------------------------------------
  -- S3 : Sel Ail des Ours 20g (SAO20, 20g, Sel)
  -- --------------------------------------------------------
  INSERT INTO recipes (farm_id, nom, numero_tisane, poids_sachet_g, category_id)
  VALUES (_farm, 'Sel Ail des Ours 20g', 'SAO20', 20, _cat_sel)
  ON CONFLICT (farm_id, nom) DO NOTHING
  RETURNING id INTO _r;
  IF _r IS NOT NULL THEN
    INSERT INTO recipe_ingredients (recipe_id, variety_id, external_material_id, pourcentage, partie_plante, etat_plante, ordre) VALUES
      (_r, NULL,                                                                    _em_sel, 0.88, NULL,             NULL,    1),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Ail des ours'),      NULL,    0.12, 'plante_entiere', 'frais', 2);
  END IF;

  -- --------------------------------------------------------
  -- S4 : Sel Ail des Ours 50g (SAO50, 50g, Sel)
  -- --------------------------------------------------------
  INSERT INTO recipes (farm_id, nom, numero_tisane, poids_sachet_g, category_id)
  VALUES (_farm, 'Sel Ail des Ours 50g', 'SAO50', 50, _cat_sel)
  ON CONFLICT (farm_id, nom) DO NOTHING
  RETURNING id INTO _r;
  IF _r IS NOT NULL THEN
    INSERT INTO recipe_ingredients (recipe_id, variety_id, external_material_id, pourcentage, partie_plante, etat_plante, ordre) VALUES
      (_r, NULL,                                                                    _em_sel, 0.88, NULL,             NULL,    1),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Ail des ours'),      NULL,    0.12, 'plante_entiere', 'frais', 2);
  END IF;

  -- --------------------------------------------------------
  -- SU1 : Sucre Reine des Prés (SU, 60g, Sucre)
  -- --------------------------------------------------------
  INSERT INTO recipes (farm_id, nom, numero_tisane, poids_sachet_g, category_id)
  VALUES (_farm, 'Sucre Reine des Prés', 'SU', 60, _cat_suc)
  ON CONFLICT (farm_id, nom) DO NOTHING
  RETURNING id INTO _r;
  IF _r IS NOT NULL THEN
    INSERT INTO recipe_ingredients (recipe_id, variety_id, external_material_id, pourcentage, partie_plante, etat_plante, ordre) VALUES
      (_r, NULL,                                                                        _em_suc, 0.93, NULL,             NULL,           1),
      (_r, (SELECT id FROM varieties WHERE nom_vernaculaire = 'Reine des prés'),        NULL,    0.07, 'plante_entiere', 'sechee_triee', 2);
  END IF;

END $$;
