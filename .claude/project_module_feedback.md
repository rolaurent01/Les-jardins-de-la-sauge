---
name: Module Feedback — conception validée
description: Plan du module feedback utilisateur (bug/suggestion) avec votes, dashboard admin, notifications in-app — en attente d'implémentation
type: project
---

Module feedback conçu pour scaler jusqu'à ~100 utilisateurs.

**Périmètre retenu :**
- 1 table `feedbacks` (type bug/suggestion/question, statut open/in_progress/done/dismissed, priorité, réponse admin, métadonnées auto : user_agent, screen_width, page_url, app_version)
- 1 table `feedback_votes` (upvote unique par user par suggestion)
- Bouton flottant sur toutes les pages → modal de soumission
- Page user : "Mes feedbacks" + suggestions publiques avec votes
- Page admin : dashboard filtrable, changement statut, réponse inline
- Badge compteur dans la sidebar (tickets open non lus)
- Bugs = privés (auteur + admin), suggestions = publiques avec votes

**Exclus volontairement (pour l'instant) :**
- Pas de pièces jointes / Storage
- Pas de notifications email / Edge Functions
- Pas de commentaires/threads
- Pas de tags/catégories libres
- Pas d'assignation

**Why:** besoin de boucle de feedback structurée quand le nombre d'utilisateurs augmente, sans over-engineering.

**How to apply:** quand l'utilisateur demande d'implémenter le module feedback, reprendre ce plan directement.
