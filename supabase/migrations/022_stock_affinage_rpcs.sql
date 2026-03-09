-- 022_stock_affinage_rpcs.sql
-- RPCs transactionnelles pour le module Affinage du stock (A5).
-- Couvre 3 sous-modules : Achats externes, Ventes directes, Ajustements manuels.
-- Chaque operation cree/modifie/supprime l'enregistrement + son stock_movement atomiquement.
-- SECURITY DEFINER : les RLS ne s'appliquent pas a l'interieur.
--
-- ⚠️ A executer manuellement dans Supabase SQL Editor.

-- =============================================================================
-- 0. SCHEMA — ajout colonnes manquantes (partie_plante + commentaire)
-- =============================================================================

-- stock_purchases : ajout partie_plante (context.md)
ALTER TABLE stock_purchases
  ADD COLUMN IF NOT EXISTS partie_plante TEXT CHECK (partie_plante IN (
    'feuille', 'fleur', 'graine', 'racine', 'fruit', 'plante_entiere'
  ));

-- stock_direct_sales : ajout partie_plante (context.md)
ALTER TABLE stock_direct_sales
  ADD COLUMN IF NOT EXISTS partie_plante TEXT CHECK (partie_plante IN (
    'feuille', 'fleur', 'graine', 'racine', 'fruit', 'plante_entiere'
  ));

-- stock_adjustments : ajout partie_plante + commentaire (context.md)
ALTER TABLE stock_adjustments
  ADD COLUMN IF NOT EXISTS partie_plante TEXT CHECK (partie_plante IN (
    'feuille', 'fleur', 'graine', 'racine', 'fruit', 'plante_entiere'
  )),
  ADD COLUMN IF NOT EXISTS commentaire TEXT;


-- =============================================================================
-- 1. RPC — create_purchase_with_stock
-- Achat = ENTREE de stock
-- =============================================================================

CREATE OR REPLACE FUNCTION create_purchase_with_stock(
  p_farm_id                UUID,
  p_variety_id             UUID,
  p_partie_plante          TEXT,
  p_date                   DATE,
  p_etat_plante            TEXT,
  p_poids_g                NUMERIC,
  p_fournisseur            TEXT,
  p_numero_lot_fournisseur TEXT,
  p_certif_ab              BOOLEAN,
  p_prix                   NUMERIC,
  p_commentaire            TEXT,
  p_created_by             UUID,
  p_uuid_client            UUID
) RETURNS UUID AS $$
DECLARE
  v_purchase_id UUID;
BEGIN
  -- 1. Inserer l'achat
  INSERT INTO stock_purchases (
    farm_id, uuid_client, variety_id, partie_plante, date, etat_plante,
    poids_g, fournisseur, numero_lot_fournisseur, certif_ab, prix,
    commentaire, created_by
  ) VALUES (
    p_farm_id, p_uuid_client, p_variety_id, p_partie_plante, p_date, p_etat_plante,
    p_poids_g, p_fournisseur, p_numero_lot_fournisseur, p_certif_ab, p_prix,
    p_commentaire, p_created_by
  )
  ON CONFLICT (uuid_client) DO NOTHING
  RETURNING id INTO v_purchase_id;

  -- Idempotence : si uuid_client deja present, retourner l'id existant
  IF v_purchase_id IS NULL AND p_uuid_client IS NOT NULL THEN
    SELECT id INTO v_purchase_id FROM stock_purchases WHERE uuid_client = p_uuid_client;
    RETURN v_purchase_id;
  END IF;

  -- 2. Creer le mouvement de stock ENTREE
  INSERT INTO stock_movements (
    farm_id, variety_id, partie_plante, date, type_mouvement,
    etat_plante, poids_g, source_type, source_id, created_by
  ) VALUES (
    p_farm_id, p_variety_id, p_partie_plante, p_date, 'entree',
    p_etat_plante, p_poids_g, 'achat', v_purchase_id, p_created_by
  );

  RETURN v_purchase_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- =============================================================================
-- 2. RPC — update_purchase_with_stock
-- =============================================================================

CREATE OR REPLACE FUNCTION update_purchase_with_stock(
  p_purchase_id            UUID,
  p_variety_id             UUID,
  p_partie_plante          TEXT,
  p_date                   DATE,
  p_etat_plante            TEXT,
  p_poids_g                NUMERIC,
  p_fournisseur            TEXT,
  p_numero_lot_fournisseur TEXT,
  p_certif_ab              BOOLEAN,
  p_prix                   NUMERIC,
  p_commentaire            TEXT,
  p_updated_by             UUID
) RETURNS VOID AS $$
DECLARE
  v_farm_id UUID;
BEGIN
  -- Recuperer le farm_id pour filtrage multi-tenant
  SELECT farm_id INTO v_farm_id FROM stock_purchases WHERE id = p_purchase_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'purchase not found: %', p_purchase_id;
  END IF;

  -- 1. Mettre a jour l'achat
  UPDATE stock_purchases SET
    variety_id             = p_variety_id,
    partie_plante          = p_partie_plante,
    date                   = p_date,
    etat_plante            = p_etat_plante,
    poids_g                = p_poids_g,
    fournisseur            = p_fournisseur,
    numero_lot_fournisseur = p_numero_lot_fournisseur,
    certif_ab              = p_certif_ab,
    prix                   = p_prix,
    commentaire            = p_commentaire,
    updated_by             = p_updated_by
  WHERE id = p_purchase_id AND farm_id = v_farm_id;

  -- 2. Mettre a jour le stock_movement associe
  UPDATE stock_movements SET
    variety_id    = p_variety_id,
    partie_plante = p_partie_plante,
    date          = p_date,
    etat_plante   = p_etat_plante,
    poids_g       = p_poids_g
  WHERE source_type = 'achat' AND source_id = p_purchase_id AND farm_id = v_farm_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- =============================================================================
-- 3. RPC — delete_purchase_with_stock
-- =============================================================================

CREATE OR REPLACE FUNCTION delete_purchase_with_stock(
  p_purchase_id UUID,
  p_farm_id     UUID
) RETURNS VOID AS $$
BEGIN
  -- 1. Supprimer le stock_movement associe
  DELETE FROM stock_movements
  WHERE source_type = 'achat' AND source_id = p_purchase_id AND farm_id = p_farm_id;

  -- 2. Supprimer l'achat
  DELETE FROM stock_purchases
  WHERE id = p_purchase_id AND farm_id = p_farm_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- =============================================================================
-- 4. RPC — create_direct_sale_with_stock
-- Vente directe = SORTIE de stock (verification stock suffisant)
-- =============================================================================

CREATE OR REPLACE FUNCTION create_direct_sale_with_stock(
  p_farm_id       UUID,
  p_variety_id    UUID,
  p_partie_plante TEXT,
  p_date          DATE,
  p_etat_plante   TEXT,
  p_poids_g       NUMERIC,
  p_destinataire  TEXT,
  p_commentaire   TEXT,
  p_created_by    UUID,
  p_uuid_client   UUID
) RETURNS UUID AS $$
DECLARE
  v_sale_id    UUID;
  v_stock_dispo NUMERIC;
BEGIN
  -- Verification stock suffisant (3 dimensions + farm_id)
  SELECT COALESCE(stock_g, 0) INTO v_stock_dispo
  FROM v_stock
  WHERE farm_id = p_farm_id
    AND variety_id = p_variety_id
    AND partie_plante = p_partie_plante
    AND etat_plante = p_etat_plante;

  IF v_stock_dispo IS NULL OR v_stock_dispo < p_poids_g THEN
    RAISE EXCEPTION 'Stock insuffisant pour % (% / %) : disponible % g, requis % g',
      (SELECT nom_vernaculaire FROM varieties WHERE id = p_variety_id),
      p_partie_plante, p_etat_plante,
      COALESCE(v_stock_dispo, 0), p_poids_g;
  END IF;

  -- 1. Inserer la vente
  INSERT INTO stock_direct_sales (
    farm_id, uuid_client, variety_id, partie_plante, date, etat_plante,
    poids_g, destinataire, commentaire, created_by
  ) VALUES (
    p_farm_id, p_uuid_client, p_variety_id, p_partie_plante, p_date, p_etat_plante,
    p_poids_g, p_destinataire, p_commentaire, p_created_by
  )
  ON CONFLICT (uuid_client) DO NOTHING
  RETURNING id INTO v_sale_id;

  -- Idempotence
  IF v_sale_id IS NULL AND p_uuid_client IS NOT NULL THEN
    SELECT id INTO v_sale_id FROM stock_direct_sales WHERE uuid_client = p_uuid_client;
    RETURN v_sale_id;
  END IF;

  -- 2. Creer le mouvement de stock SORTIE
  INSERT INTO stock_movements (
    farm_id, variety_id, partie_plante, date, type_mouvement,
    etat_plante, poids_g, source_type, source_id, created_by
  ) VALUES (
    p_farm_id, p_variety_id, p_partie_plante, p_date, 'sortie',
    p_etat_plante, p_poids_g, 'vente_directe', v_sale_id, p_created_by
  );

  RETURN v_sale_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- =============================================================================
-- 5. RPC — update_direct_sale_with_stock
-- Re-verifie le stock si le nouveau poids > ancien
-- =============================================================================

CREATE OR REPLACE FUNCTION update_direct_sale_with_stock(
  p_sale_id       UUID,
  p_variety_id    UUID,
  p_partie_plante TEXT,
  p_date          DATE,
  p_etat_plante   TEXT,
  p_poids_g       NUMERIC,
  p_destinataire  TEXT,
  p_commentaire   TEXT,
  p_updated_by    UUID
) RETURNS VOID AS $$
DECLARE
  v_farm_id      UUID;
  v_old_poids    NUMERIC;
  v_stock_dispo  NUMERIC;
  v_delta        NUMERIC;
BEGIN
  -- Recuperer farm_id
  SELECT farm_id INTO v_farm_id FROM stock_direct_sales WHERE id = p_sale_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'direct_sale not found: %', p_sale_id;
  END IF;

  -- Recuperer l'ancien poids du stock_movement
  SELECT poids_g INTO v_old_poids
  FROM stock_movements
  WHERE source_type = 'vente_directe' AND source_id = p_sale_id AND farm_id = v_farm_id;

  -- Si le nouveau poids > ancien, verifier que le stock couvre la difference
  v_delta := p_poids_g - COALESCE(v_old_poids, 0);
  IF v_delta > 0 THEN
    SELECT COALESCE(stock_g, 0) INTO v_stock_dispo
    FROM v_stock
    WHERE farm_id = v_farm_id
      AND variety_id = p_variety_id
      AND partie_plante = p_partie_plante
      AND etat_plante = p_etat_plante;

    IF v_stock_dispo IS NULL OR v_stock_dispo < v_delta THEN
      RAISE EXCEPTION 'Stock insuffisant pour % (% / %) : disponible % g, delta requis % g',
        (SELECT nom_vernaculaire FROM varieties WHERE id = p_variety_id),
        p_partie_plante, p_etat_plante,
        COALESCE(v_stock_dispo, 0), v_delta;
    END IF;
  END IF;

  -- 1. Mettre a jour la vente
  UPDATE stock_direct_sales SET
    variety_id    = p_variety_id,
    partie_plante = p_partie_plante,
    date          = p_date,
    etat_plante   = p_etat_plante,
    poids_g       = p_poids_g,
    destinataire  = p_destinataire,
    commentaire   = p_commentaire,
    updated_by    = p_updated_by
  WHERE id = p_sale_id AND farm_id = v_farm_id;

  -- 2. Mettre a jour le stock_movement associe
  UPDATE stock_movements SET
    variety_id    = p_variety_id,
    partie_plante = p_partie_plante,
    date          = p_date,
    etat_plante   = p_etat_plante,
    poids_g       = p_poids_g
  WHERE source_type = 'vente_directe' AND source_id = p_sale_id AND farm_id = v_farm_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- =============================================================================
-- 6. RPC — delete_direct_sale_with_stock
-- =============================================================================

CREATE OR REPLACE FUNCTION delete_direct_sale_with_stock(
  p_sale_id UUID,
  p_farm_id UUID
) RETURNS VOID AS $$
BEGIN
  -- 1. Supprimer le stock_movement associe (restaure le stock)
  DELETE FROM stock_movements
  WHERE source_type = 'vente_directe' AND source_id = p_sale_id AND farm_id = p_farm_id;

  -- 2. Supprimer la vente
  DELETE FROM stock_direct_sales
  WHERE id = p_sale_id AND farm_id = p_farm_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- =============================================================================
-- 7. RPC — create_adjustment_with_stock
-- Ajustement = ENTREE ou SORTIE selon p_type_mouvement
-- =============================================================================

CREATE OR REPLACE FUNCTION create_adjustment_with_stock(
  p_farm_id        UUID,
  p_variety_id     UUID,
  p_partie_plante  TEXT,
  p_date           DATE,
  p_type_mouvement TEXT,
  p_etat_plante    TEXT,
  p_poids_g        NUMERIC,
  p_motif          TEXT,
  p_commentaire    TEXT,
  p_created_by     UUID,
  p_uuid_client    UUID
) RETURNS UUID AS $$
DECLARE
  v_adjustment_id UUID;
  v_stock_dispo   NUMERIC;
BEGIN
  -- Validation type_mouvement
  IF p_type_mouvement NOT IN ('entree', 'sortie') THEN
    RAISE EXCEPTION 'type_mouvement invalide: %. Attendu: entree ou sortie', p_type_mouvement;
  END IF;

  -- Si sortie, verifier stock suffisant
  IF p_type_mouvement = 'sortie' THEN
    SELECT COALESCE(stock_g, 0) INTO v_stock_dispo
    FROM v_stock
    WHERE farm_id = p_farm_id
      AND variety_id = p_variety_id
      AND partie_plante = p_partie_plante
      AND etat_plante = p_etat_plante;

    IF v_stock_dispo IS NULL OR v_stock_dispo < p_poids_g THEN
      RAISE EXCEPTION 'Stock insuffisant pour % (% / %) : disponible % g, requis % g',
        (SELECT nom_vernaculaire FROM varieties WHERE id = p_variety_id),
        p_partie_plante, p_etat_plante,
        COALESCE(v_stock_dispo, 0), p_poids_g;
    END IF;
  END IF;

  -- 1. Inserer l'ajustement
  INSERT INTO stock_adjustments (
    farm_id, uuid_client, variety_id, partie_plante, date, type_mouvement,
    etat_plante, poids_g, motif, commentaire, created_by
  ) VALUES (
    p_farm_id, p_uuid_client, p_variety_id, p_partie_plante, p_date, p_type_mouvement,
    p_etat_plante, p_poids_g, p_motif, p_commentaire, p_created_by
  )
  ON CONFLICT (uuid_client) DO NOTHING
  RETURNING id INTO v_adjustment_id;

  -- Idempotence
  IF v_adjustment_id IS NULL AND p_uuid_client IS NOT NULL THEN
    SELECT id INTO v_adjustment_id FROM stock_adjustments WHERE uuid_client = p_uuid_client;
    RETURN v_adjustment_id;
  END IF;

  -- 2. Creer le mouvement de stock
  INSERT INTO stock_movements (
    farm_id, variety_id, partie_plante, date, type_mouvement,
    etat_plante, poids_g, source_type, source_id, created_by
  ) VALUES (
    p_farm_id, p_variety_id, p_partie_plante, p_date, p_type_mouvement,
    p_etat_plante, p_poids_g, 'ajustement', v_adjustment_id, p_created_by
  );

  RETURN v_adjustment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- =============================================================================
-- 8. RPC — update_adjustment_with_stock
-- Si sortie et nouveau poids > ancien, re-verifier le stock
-- =============================================================================

CREATE OR REPLACE FUNCTION update_adjustment_with_stock(
  p_adjustment_id  UUID,
  p_variety_id     UUID,
  p_partie_plante  TEXT,
  p_date           DATE,
  p_type_mouvement TEXT,
  p_etat_plante    TEXT,
  p_poids_g        NUMERIC,
  p_motif          TEXT,
  p_commentaire    TEXT,
  p_updated_by     UUID
) RETURNS VOID AS $$
DECLARE
  v_farm_id      UUID;
  v_old_poids    NUMERIC;
  v_old_type     TEXT;
  v_stock_dispo  NUMERIC;
  v_delta        NUMERIC;
BEGIN
  -- Validation type_mouvement
  IF p_type_mouvement NOT IN ('entree', 'sortie') THEN
    RAISE EXCEPTION 'type_mouvement invalide: %. Attendu: entree ou sortie', p_type_mouvement;
  END IF;

  -- Recuperer farm_id
  SELECT farm_id INTO v_farm_id FROM stock_adjustments WHERE id = p_adjustment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'adjustment not found: %', p_adjustment_id;
  END IF;

  -- Recuperer l'ancien mouvement
  SELECT poids_g, type_mouvement INTO v_old_poids, v_old_type
  FROM stock_movements
  WHERE source_type = 'ajustement' AND source_id = p_adjustment_id AND farm_id = v_farm_id;

  -- Si c'est une sortie, verifier le stock
  IF p_type_mouvement = 'sortie' THEN
    -- Calculer le delta reel de sortie supplementaire
    -- Si ancien etait aussi sortie : delta = nouveau - ancien
    -- Si ancien etait entree : delta = nouveau + ancien (on perd l'entree + on ajoute sortie)
    IF v_old_type = 'sortie' THEN
      v_delta := p_poids_g - COALESCE(v_old_poids, 0);
    ELSE
      v_delta := p_poids_g + COALESCE(v_old_poids, 0);
    END IF;

    IF v_delta > 0 THEN
      SELECT COALESCE(stock_g, 0) INTO v_stock_dispo
      FROM v_stock
      WHERE farm_id = v_farm_id
        AND variety_id = p_variety_id
        AND partie_plante = p_partie_plante
        AND etat_plante = p_etat_plante;

      IF v_stock_dispo IS NULL OR v_stock_dispo < v_delta THEN
        RAISE EXCEPTION 'Stock insuffisant pour % (% / %) : disponible % g, delta requis % g',
          (SELECT nom_vernaculaire FROM varieties WHERE id = p_variety_id),
          p_partie_plante, p_etat_plante,
          COALESCE(v_stock_dispo, 0), v_delta;
      END IF;
    END IF;
  END IF;

  -- 1. Mettre a jour l'ajustement
  UPDATE stock_adjustments SET
    variety_id     = p_variety_id,
    partie_plante  = p_partie_plante,
    date           = p_date,
    type_mouvement = p_type_mouvement,
    etat_plante    = p_etat_plante,
    poids_g        = p_poids_g,
    motif          = p_motif,
    commentaire    = p_commentaire,
    updated_by     = p_updated_by
  WHERE id = p_adjustment_id AND farm_id = v_farm_id;

  -- 2. Mettre a jour le stock_movement associe
  UPDATE stock_movements SET
    variety_id     = p_variety_id,
    partie_plante  = p_partie_plante,
    date           = p_date,
    type_mouvement = p_type_mouvement,
    etat_plante    = p_etat_plante,
    poids_g        = p_poids_g
  WHERE source_type = 'ajustement' AND source_id = p_adjustment_id AND farm_id = v_farm_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- =============================================================================
-- 9. RPC — delete_adjustment_with_stock
-- =============================================================================

CREATE OR REPLACE FUNCTION delete_adjustment_with_stock(
  p_adjustment_id UUID,
  p_farm_id       UUID
) RETURNS VOID AS $$
BEGIN
  -- 1. Supprimer le stock_movement associe
  DELETE FROM stock_movements
  WHERE source_type = 'ajustement' AND source_id = p_adjustment_id AND farm_id = p_farm_id;

  -- 2. Supprimer l'ajustement
  DELETE FROM stock_adjustments
  WHERE id = p_adjustment_id AND farm_id = p_farm_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
