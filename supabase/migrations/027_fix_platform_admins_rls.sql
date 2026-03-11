-- 027_fix_platform_admins_rls.sql
-- Corrige "infinite recursion detected in policy for relation platform_admins"
--
-- Problème (migration 011, ligne 640) :
--   CREATE POLICY admin_only ON platform_admins FOR ALL
--     USING (auth.uid() IN (SELECT user_id FROM platform_admins));
-- → La sous-requête sur platform_admins re-déclenche la même politique RLS = boucle infinie.
--
-- Solution : chaque user peut lire uniquement sa propre ligne (user_id = auth.uid()),
-- sans sous-requête sur platform_admins. Les écritures sont bloquées via RLS
-- (seul service_role peut modifier cette table).

-- Supprime la politique récursive existante
DROP POLICY IF EXISTS admin_only ON platform_admins;

-- Lecture : un user ne voit que sa propre entrée (pas de récursion)
CREATE POLICY platform_admins_select ON platform_admins
  FOR SELECT USING (user_id = auth.uid());

-- Écriture bloquée via RLS — seul service_role peut modifier
CREATE POLICY platform_admins_insert ON platform_admins
  FOR INSERT WITH CHECK (false);

CREATE POLICY platform_admins_update ON platform_admins
  FOR UPDATE USING (false);

CREATE POLICY platform_admins_delete ON platform_admins
  FOR DELETE USING (false);
