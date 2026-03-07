-- Migration 015 : Politique RLS memberships — permettre de voir les membres de ses organisations
-- Corrige P8 (review A0-A2) : membership_isolation trop restrictive (user_id = auth.uid() seulement)

-- Supprimer l'ancienne politique (creee par 013)
DROP POLICY IF EXISTS membership_isolation ON memberships;

-- SELECT : voir ses propres memberships + ceux des organisations dont on est membre
-- La premiere condition (user_id = auth.uid()) est evaluee sans sous-requete,
-- ce qui evite le probleme d'auto-reference de la migration 011.
CREATE POLICY membership_select ON memberships FOR SELECT USING (
  user_id = auth.uid()
  OR
  organization_id IN (
    SELECT m.organization_id FROM memberships m WHERE m.user_id = auth.uid()
  )
);

-- INSERT : seuls les owner/admin de l'organisation
CREATE POLICY membership_insert ON memberships FOR INSERT WITH CHECK (
  organization_id IN (
    SELECT m.organization_id FROM memberships m
    WHERE m.user_id = auth.uid() AND m.role IN ('owner', 'admin')
  )
);

-- UPDATE : seuls les owner/admin de l'organisation
CREATE POLICY membership_update ON memberships FOR UPDATE USING (
  organization_id IN (
    SELECT m.organization_id FROM memberships m
    WHERE m.user_id = auth.uid() AND m.role IN ('owner', 'admin')
  )
);

-- DELETE : seuls les owner/admin de l'organisation
CREATE POLICY membership_delete ON memberships FOR DELETE USING (
  organization_id IN (
    SELECT m.organization_id FROM memberships m
    WHERE m.user_id = auth.uid() AND m.role IN ('owner', 'admin')
  )
);
