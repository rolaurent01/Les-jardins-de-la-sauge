-- Migration 023 : Bootstrap du super admin plateforme
-- Insère rolaurent01@hotmail.com comme platform_admin

-- Insérer le super admin (l'utilisateur doit déjà exister dans auth.users)
INSERT INTO platform_admins (user_id)
SELECT id FROM auth.users WHERE email = 'rolaurent01@hotmail.com'
ON CONFLICT DO NOTHING;
