# Checklist E2E — Mobile Offline + Sync

## Prérequis
- [ ] Compte utilisateur actif avec accès à une ferme
- [ ] Données de référence en base (variétés, parcelles, rangs)
- [ ] Navigateur mobile (Safari iOS ou Chrome Android) ou DevTools mobile

## 1. Installation PWA
- [ ] Ouvrir l'app sur mobile → proposition "Ajouter à l'écran d'accueil"
- [ ] L'app s'ouvre en mode standalone (pas de barre d'adresse)
- [ ] L'icône sur l'écran d'accueil affiche le bon logo

## 2. Login + Cache
- [ ] Se connecter via /login
- [ ] Redirection automatique vers /m/saisie (détection mobile)
- [ ] La barre de sync affiche "Tout synchronisé"
- [ ] Les dropdowns des formulaires contiennent les données (variétés, rangs)

## 3. Saisie online
- [ ] Saisir une cueillette (parcelle) → "Enregistré"
- [ ] La barre de sync passe à "1 saisie en cours d'envoi"
- [ ] Après quelques secondes → "Tout synchronisé"
- [ ] Vérifier dans le bureau que la cueillette apparaît
- [ ] Vérifier que le stock a été mis à jour (mouvement entree frais)

## 4. Saisie offline
- [ ] Passer en mode avion
- [ ] La barre affiche "Hors ligne"
- [ ] Saisir un travail de sol → "Enregistré"
- [ ] Saisir une cueillette → "Enregistré"
- [ ] Saisir un tronçonnage (entrée) → "Enregistré"
- [ ] La barre affiche "Hors ligne — 3 saisies en attente"
- [ ] Ouvrir le panneau sync → 3 pending, 0 synced

## 5. Retour online + Sync
- [ ] Désactiver le mode avion
- [ ] La barre passe à "3 saisies en cours d'envoi"
- [ ] Après sync → "Tout synchronisé"
- [ ] Ouvrir le panneau → 0 pending, 3 synced
- [ ] Vérifier sur le bureau que les 3 saisies sont là
- [ ] Vérifier les mouvements de stock (cueillette + tronçonnage)

## 6. Audit "Tout vérifier"
- [ ] Taper "Forcer la sync" dans le panneau
- [ ] L'audit s'exécute (barre bleue "Vérification en cours")
- [ ] Résultat : "X saisies vérifiées — tout est en ordre"

## 7. Idempotence
- [ ] Passer en mode avion
- [ ] Saisir une cueillette
- [ ] Repasser online → la saisie est envoyée
- [ ] Forcer un 2e envoi (réessayer manuellement dans le panneau)
- [ ] Vérifier qu'il n'y a PAS de doublon en base (1 seul enregistrement)

## 8. Gestion des erreurs
- [ ] Saisir une vente directe avec un poids supérieur au stock disponible
- [ ] Sync → l'entrée passe en status 'error'
- [ ] La barre affiche "1 erreur de sync"
- [ ] Le panneau affiche le détail de l'erreur
- [ ] Bouton "Réessayer" disponible

## 9. Timer
- [ ] Démarrer le timer (bouton flottant)
- [ ] Naviguer entre les pages → le timer continue
- [ ] Ouvrir un formulaire avec champ "Temps" → bouton "⏱️ X min" visible
- [ ] Taper sur le bouton → la valeur du timer est insérée dans le champ
- [ ] Arrêter le timer → affiche le temps en minutes

## 10. Stockage
- [ ] Ouvrir le panneau → section stockage visible
- [ ] L'espace utilisé est affiché (X Mo / Y Mo)

## 11. Switch de ferme (si multi-ferme)
- [ ] Sur le bureau, changer de ferme
- [ ] Retourner sur le mobile → le cache se recharge
- [ ] Les dropdowns contiennent les données de la nouvelle ferme
- [ ] Les saisies pending de l'ancienne ferme sont toujours dans la queue

## 12. Lien de bascule
- [ ] Sur mobile : lien "Mode bureau" → ouvre le dashboard
- [ ] Sur bureau : lien "Mode terrain" → ouvre /m/saisie
