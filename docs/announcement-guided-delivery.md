# Parcours d'envoi guidé des annonces

L'agence ne manipule plus les notions d'audience figée, d'approbation séparée
ou de lancement technique. La fiche présente deux étapes :

1. **Préparer l'envoi** : vérification des destinataires choisis à la création,
   affichage du nombre de contacts retenus/exclus et du message. Aucun envoi.
2. **Confirmer l'envoi** ou **Confirmer la programmation** : validation explicite
   du responsable. Une transaction approuve et met en attente la campagne et
   ses destinataires, ou la programme à une date future.

L'API `/broadcasts/{id}/launch` exige `broadcasts.send` et `broadcasts.approve`.
La préparation conserve `broadcasts.audiences`. Le numéro de version est contrôlé,
les modifications concurrentes ne sont pas rejouées automatiquement. Une annonce
déjà lancée/terminée ne peut pas être lancée de nouveau par ce parcours. Les
consentements, exclusions, modèles autorisés et variables à compléter restent
vérifiés. Le nombre total de destinataires ne dépend pas de la limite de 500
lignes d'aperçu. Les annonces déjà confirmées ne peuvent plus être recalculées.

Les anciens endpoints restent compatibles. Le contrôle du nouveau parcours ne
remplace pas un audit de toutes les transitions des anciens endpoints.

## Déploiement et limite importante

Déployer l'API et le dashboard ensemble. Aucune nouvelle migration SQL.
Ce changement ne crée ni ne démarre un service Render et n'envoie aucun message
de production lors des tests. L'état « En attente d'envoi » n'est pas une preuve
d'envoi ni de réception.

L'exploitation doit vérifier les tâches périodiques, leurs variables privées
et leurs logs :

```sh
python -m app.jobs.broadcast_campaigns
python -m app.jobs.followup_recovery
```

Ces commandes peuvent envoyer de vrais messages déjà confirmés. Avant de les
activer en production, contrôler et annuler les annonces/relances de test en
double. Ne jamais marquer artificiellement une ligne comme envoyée pour la
sortir de la file. Les relances conservent leur parcours actuel ; cette livraison
modifie la fiche annonce uniquement.
