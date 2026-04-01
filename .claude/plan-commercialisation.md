# Plan d'action — Commercialisation LJS

> **Contexte** : ~100 utilisateurs, 1-2 par organisation, ~30-50 fermes artisanales PAM.
> **Date** : 2026-03-21

## Légende

| Risque | Signification |
|--------|---------------|
| **BLOQUANT** | Empêche la commercialisation (légal, fuite de données) |
| **MAJEUR** | Perte de confiance client, support ingérable |
| **MODÉRÉ** | Dégradation UX, dette technique qui s'accumule |
| **MINEUR** | Améliorations souhaitables, pas urgentes |

---

## Sprint 1 — Sécurité (BLOQUANT) — ~5 jours

Sans ça, un seul incident = fin de la crédibilité commerciale.

| # | Tâche | Risque | Impact si non fait | Effort |
|---|-------|--------|-------------------|--------|
| 1.1 | **Auth sur `/api/backup`** — vérifier header `X-Vercel-Cron` ou token secret | BLOQUANT | N'importe qui peut télécharger les données de TOUS vos clients | 1h |
| 1.2 | **Fix injection SQL** dans `/api/offline/reference-data` — remplacer string interpolation par `.not('id', 'in', array)` | BLOQUANT | Faille exploitable en production | 30min |
| 1.3 | **Validation org membership** dans `[orgSlug]/layout.tsx` — vérifier que l'user est membre de l'org dans l'URL | BLOQUANT | Client A accède aux pages de Client B en changeant l'URL | 2h |
| 1.4 | **Validation `farm_id` ↔ `organization_id`** dans `getContext()` — vérifier que le cookie `active_farm_id` appartient bien à l'org courante | BLOQUANT | Accès cross-org via manipulation de cookie | 2h |
| 1.5 | **Headers sécurité** dans `next.config.ts` — CSP, X-Frame-Options, X-Content-Type-Options, HSTS | MAJEUR | Échec immédiat d'un audit sécurité par un prospect, vulnérabilité clickjacking | 1h |
| 1.6 | **Flag `secure` sur tous les cookies** — `active_farm_id`, `impersonate_farm_id`, `force_desktop` | MAJEUR | Cookies interceptables en clair sur réseau non-HTTPS | 1h |
| 1.7 | **Validation Zod sur le login** — email + password validés avant envoi à Supabase | MAJEUR | Input malformé passé directement à l'API auth | 30min |
| 1.8 | **Sanitisation des erreurs** — ne plus renvoyer les messages Supabase/PostgreSQL bruts au client | MODÉRÉ | Fuite de noms de tables, structure SQL dans les messages d'erreur | 3h |

---

## Sprint 2 — Rôles & Permissions (BLOQUANT) — ~5 jours

Matrice Super Admin / Org Admin / Membre.

### Matrice des droits

| Fonction | Super Admin | Org Admin | Membre |
|----------|:-----------:|:---------:|:------:|
| **Plateforme** | | | |
| Voir toutes les organisations | oui | non | non |
| Impersonner une ferme | oui | non | non |
| Merger des variétés globales | oui | non | non |
| Gérer plans/quotas | oui | non | non |
| **Organisation** | | | |
| Gérer les fermes (créer/renommer/supprimer) | oui | oui (sa propre org) | non |
| Inviter/supprimer un membre | oui | oui (sa propre org) | non |
| Modifier infos org (nom, etc.) | oui | oui (sa propre org) | non |
| Gérer le référentiel (CRUD variétés, sites, parcelles, rangs) | oui | oui (sa propre org) | lecture seule |
| Voir les logs de sa ferme | oui | oui (sa propre org) | non |
| **Usage quotidien** | | | |
| Saisie mobile (formulaires) | oui | oui | oui |
| Consulter le dashboard | oui | oui | oui |
| Consulter la traçabilité | oui | oui | oui |
| Consulter le référentiel (lecture) | oui | oui | oui |

### Tâches

| # | Tâche | Risque | Impact si non fait | Effort |
|---|-------|--------|-------------------|--------|
| 2.1 | **Helper `requireOrgAdmin(ctx)`** — vérifie `memberships.role IN ('owner','admin')` pour l'org courante | BLOQUANT | Aucune différenciation de droits, un membre peut tout modifier | 2h |
| 2.2 | **Ajouter `role` dans `AppContext`** — enrichir `getContext()` avec le rôle de l'utilisateur dans l'org | BLOQUANT | Pré-requis pour toute logique de permission | 2h |
| 2.3 | **Protéger les Server Actions du référentiel** — variétés, sites, parcelles, rangs : CRUD réservé à Org Admin, lecture pour Membre | BLOQUANT | Un employé peut supprimer des variétés ou des sites | 4h |
| 2.4 | **Routes `/[orgSlug]/settings/*`** — espace Org Admin : membres, infos org, fermes | MAJEUR | L'artisan n'a aucun moyen de gérer son organisation seul | 2-3j |
| 2.5 | **Sidebar conditionnelle** — Super Admin voit "Administration plateforme", Org Admin voit "Paramètres", Membre ne voit ni l'un ni l'autre | MODÉRÉ | Confusion UX, liens visibles mais inaccessibles | 3h |
| 2.6 | **Protéger les actions d'invitation/suppression de membres** par `requireOrgAdmin()` | BLOQUANT | Un membre pourrait s'inviter des droits ou supprimer d'autres membres | 2h |

---

## Sprint 3 — Observabilité (MAJEUR) — ~3 jours

Tracking de bugs gratuit via `app_logs` (pas de Sentry).

| # | Tâche | Risque | Impact si non fait | Effort |
|---|-------|--------|-------------------|--------|
| 3.1 | **Endpoint `POST /api/log-error`** — reçoit les erreurs JS client, les insère dans `app_logs` avec user_id, farm_id, page, stack, user-agent | MAJEUR | Vous ne saurez jamais qu'un client a un bug tant qu'il ne vous appelle pas | 3h |
| 3.2 | **React Error Boundaries** — sur `MobileShell`, layout dashboard, formulaires. Catchent les crashes et appellent `/api/log-error` | MAJEUR | Écran blanc chez un artisan en plein champ = appel support + perte de confiance | 3h |
| 3.3 | **Enrichir `logToAppLogs()`** — l'utiliser dans toutes les Server Actions (catch global) et API routes | MODÉRÉ | Erreurs serveur invisibles | 3h |
| 3.4 | **Dashboard admin logs amélioré** — filtres par level/source/date/farm, compteur d'erreurs récentes, recherche | MODÉRÉ | Données de logs existent mais inexploitables | 4h |
| 3.5 | **Audit d'impersonation** — logger début/fin dans `app_logs` avec `source: 'impersonation'`, metadata: `{ admin_id, farm_id, action }` | MODÉRÉ | Impossible de prouver qui a fait quoi si un client conteste une modification | 2h |
| 3.6 | **Expiration cookie impersonation** — `maxAge: 3600` (1h) + bannière rouge visible "Mode support — Ferme X" | MODÉRÉ | Vous oubliez que vous impersonnez → modification accidentelle des données d'un client | 1h |

---

## Sprint 4 — Onboarding & Self-service (BLOQUANT) — ~8 jours

> **Dépend de** : Sprint 2 (rôles) + Sprint 7 (email)

Sans ça, chaque nouveau client = intervention manuelle de votre part.

| # | Tâche | Risque | Impact si non fait | Effort |
|---|-------|--------|-------------------|--------|
| 4.1 | **Flux d'inscription** — page publique : email + mdp → création org + premier user (role owner) + première ferme | BLOQUANT | Vous devez créer chaque client manuellement en base | 2-3j |
| 4.2 | **Onboarding guidé post-inscription** — wizard : nom de l'org, nom de la ferme, premiers sites/parcelles/rangs, import variétés depuis le catalogue partagé | MAJEUR | L'artisan arrive sur un dashboard vide, ne sait pas quoi faire, abandonne | 2-3j |
| 4.3 | **Invitation de membres** — Org Admin entre un email, le système crée le compte (ou envoie un lien) et assigne le rôle | MAJEUR | L'artisan doit vous demander d'ajouter son employé | 1-2j |
| 4.4 | **Reset mot de passe self-service** — lien "Mot de passe oublié" sur la page login → email avec lien de reset | MAJEUR | Chaque oubli de mdp = ticket support pour vous | 4h |
| 4.5 | **Page "Mon compte"** — changer email, mot de passe, voir son rôle | MODÉRÉ | L'utilisateur ne peut rien gérer seul | 4h |

---

## Sprint 5 — Légal & Conformité (BLOQUANT) — ~2 jours

Obligatoire en France/UE pour vendre un service en ligne.

| # | Tâche | Risque | Impact si non fait | Effort |
|---|-------|--------|-------------------|--------|
| 5.1 | **CGU** (Conditions Générales d'Utilisation) — page `/cgu` + checkbox à l'inscription | BLOQUANT | Pas de cadre juridique, responsabilité illimitée en cas de litige | 4h |
| 5.2 | **Politique de confidentialité** — page `/confidentialite`, détail des données collectées, durée, droits RGPD | BLOQUANT | Amende CNIL possible (jusqu'à 4% du CA) | 4h |
| 5.3 | **Mentions légales** — page `/mentions-legales` (identité éditeur, hébergeur) | BLOQUANT | Obligation légale article 6 LCEN | 1h |
| 5.4 | **Droit de suppression RGPD** — mécanisme pour supprimer toutes les données d'un utilisateur/org sur demande | MAJEUR | Non-conformité RGPD | 3h |

---

## Sprint 6 — Robustesse UX (MODÉRÉ) — ~3 jours

Ce qui fait la différence entre "ça marche" et "c'est un vrai produit".

| # | Tâche | Risque | Impact si non fait | Effort |
|---|-------|--------|-------------------|--------|
| 6.1 | **Pages d'erreur custom** — 404 et 500 en français, avec bouton "retour" | MODÉRÉ | Page d'erreur Next.js en anglais = impression de produit non fini | 2h |
| 6.2 | **Loading states** — `loading.tsx` sur les pages principales + skeletons | MODÉRÉ | Impression de lenteur, clics multiples par impatience | 3h |
| 6.3 | **Validation Zod sur tous les formulaires serveur** — referentiel, transformation, stock | MODÉRÉ | Données invalides en base, messages d'erreur incompréhensibles | 4h |
| 6.4 | **Validation des env vars au démarrage** — crash explicite si `SUPABASE_SERVICE_ROLE_KEY` manquant | MODÉRÉ | Déploiement cassé silencieusement, erreurs incompréhensibles en runtime | 1h |
| 6.5 | **Rate limiting sur login** — 5 tentatives / 15 min par IP | MODÉRÉ | Brute force sur les comptes clients | 2h |

---

## Sprint 7 — Email transactionnel (MAJEUR) — ~2 jours

Pré-requis pour reset mdp, invitations, et notifications futures.

| # | Tâche | Risque | Impact si non fait | Effort |
|---|-------|--------|-------------------|--------|
| 7.1 | **Intégrer Resend** (gratuit jusqu'à 3000 emails/mois, largement suffisant pour 100 users) | MAJEUR | Pas de reset mdp, pas d'invitations par email | 3h |
| 7.2 | **Template email "Reset mot de passe"** | MAJEUR | Pré-requis pour 4.4 | 2h |
| 7.3 | **Template email "Invitation"** | MAJEUR | Pré-requis pour 4.3 | 2h |
| 7.4 | **Template email "Bienvenue"** | MINEUR | Onboarding plus professionnel | 1h |

---

## Sprint 8 — CI/CD & Déploiement (MODÉRÉ) — ~2 jours

| # | Tâche | Risque | Impact si non fait | Effort |
|---|-------|--------|-------------------|--------|
| 8.1 | **GitHub Actions** — lint + type-check + tests unitaires sur chaque push | MODÉRÉ | Régression non détectée avant mise en prod | 3h |
| 8.2 | **Preview deployments Vercel** — chaque PR = URL de preview | MINEUR | Pas de review visuelle avant merge | 1h |
| 8.3 | **Notification échec backup** — si `/api/backup` échoue, log `error` dans `app_logs` + alerte visible dans le dashboard admin | MODÉRÉ | Perte de backup pendant des semaines sans le savoir | 2h |

---

## Récapitulatif

| Sprint | Thème | Durée | Niveau de risque |
|--------|-------|-------|-----------------|
| 1 | Sécurité | ~5j | BLOQUANT |
| 2 | Rôles & Permissions | ~5j | BLOQUANT |
| 3 | Observabilité | ~3j | MAJEUR |
| 4 | Onboarding & Self-service | ~8j | BLOQUANT |
| 5 | Légal & Conformité | ~2j | BLOQUANT |
| 6 | Robustesse UX | ~3j | MODÉRÉ |
| 7 | Email transactionnel | ~2j | MAJEUR |
| 8 | CI/CD | ~2j | MODÉRÉ |
| **Total** | | **~30 jours** | |

---

## Ordre optimal (dépendances)

```
Sprint 1 (Sécurité)
    ↓
Sprint 2 (Rôles)     Sprint 7 (Email)     Sprint 5 (Légal)
    ↓                      ↓
Sprint 3 (Observabilité)   Sprint 4 (Onboarding) ← dépend de 2 + 7
    ↓
Sprint 6 (Robustesse UX)
    ↓
Sprint 8 (CI/CD)
```

**Sprints 1, 5 et 7 peuvent démarrer en parallèle.**
Le Sprint 4 (onboarding) dépend de 2 (rôles) et 7 (email).

---

## Ce qui n'est PAS dans le plan (et pourquoi)

| Écarté | Raison |
|--------|--------|
| Pagination / optimisation N+1 | Petits volumes par ferme artisanale |
| Sync delta / batch sync | 1-2 users par ferme, conflits quasi impossibles |
| Code splitting | Bundle acceptable pour PWA |
| Vue matérialisée | Quelques centaines de mouvements max |
| i18n | Marché français uniquement pour le moment |
| Billing / Stripe | À traiter quand le modèle de prix est défini |
| Accessibilité WCAG complète | Souhaitable mais pas bloquant au lancement |
