-- 013_fix_membership_rls.sql
-- Corrige la politique RLS auto-referente sur memberships qui bloquait
-- toutes les requetes dependantes (organizations, farms, proxy, layouts).
--
-- Avant : organization_id IN (SELECT organization_id FROM memberships WHERE user_id = auth.uid())
--   -> sous-requete sur memberships soumise a la MEME politique -> zero ligne retournee
--
-- Apres : user_id = auth.uid()
--   -> un utilisateur voit ses propres memberships (pas d'auto-reference)
--   -> les policies sur organizations et farms (qui sous-requetent memberships) fonctionnent

DROP POLICY IF EXISTS membership_isolation ON memberships;

CREATE POLICY membership_isolation ON memberships FOR ALL
  USING (user_id = auth.uid());
