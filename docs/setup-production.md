# Configuration production — Supabase Dashboard

## 1. Refresh token 30 jours
Settings → Auth → JWT Settings :
- `REFRESH_TOKEN_REUSE_INTERVAL` : 10 (secondes, valeur par défaut OK)

Settings → Auth → Sessions :
- Session expiry : 2592000 (30 jours en secondes)

## 2. Exécuter les migrations non appliquées
SQL Editor → coller et exécuter dans l'ordre :
- 023_bootstrap_platform_admin.sql (si pas encore fait)
- 024_seedling_statut.sql
- 025_auto_admin_membership.sql

## 3. Bucket Supabase Storage pour les logos
Storage → Create bucket :
- Nom : `org-logos`
- Public : oui (lecture publique pour afficher les logos sans auth)

## 4. Variables d'environnement Vercel
Vérifier que ces variables sont configurées :
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- GITHUB_BACKUP_TOKEN
- GITHUB_BACKUP_REPO

## 5. Crons Vercel
Vérifier dans vercel.json :
- /api/keep-alive → tous les jours 6h UTC
- /api/backup → tous les jours 3h UTC

## 6. Premier utilisateur
- Se connecter avec rolaurent01@hotmail.com
- Aller dans Admin → vérifier que l'espace admin est accessible
- Créer les organisations et fermes nécessaires
