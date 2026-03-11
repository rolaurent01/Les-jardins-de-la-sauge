-- Migration 025 : Auto-membership super admin sur toutes les organisations
-- Quand une organisation est créée, un membership 'owner' est automatiquement
-- créé pour chaque platform_admin. Le super admin peut ainsi naviguer librement
-- entre toutes les organisations sans impersonation.

-- 1. Fonction trigger : crée un membership owner pour chaque platform_admin
CREATE OR REPLACE FUNCTION fn_auto_admin_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO memberships (organization_id, user_id, role)
  SELECT NEW.id, pa.user_id, 'owner'
  FROM platform_admins pa
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 2. Trigger AFTER INSERT sur organizations
CREATE TRIGGER trg_auto_admin_membership
  AFTER INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION fn_auto_admin_membership();

-- 3. Rattrapage : créer les memberships manquants pour les orgs existantes
INSERT INTO memberships (organization_id, user_id, role)
SELECT o.id, pa.user_id, 'owner'
FROM organizations o
CROSS JOIN platform_admins pa
ON CONFLICT (organization_id, user_id) DO NOTHING;
