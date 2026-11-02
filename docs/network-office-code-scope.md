# Codes des bureaux et entrepôts

## Déploiement

1. Appliquer `infra/sql/166_network_office_code_scope.sql` dans la base cible.
2. Déployer l’API puis le dashboard.
3. Vérifier la création d’un bureau ou entrepôt avec un code déjà présent dans
   un autre réseau, puis le refus explicite du même code dans son propre réseau.

La migration installe les deux index de remplacement avant de retirer l’ancien
index global, dans une transaction. Aucun code existant, organisation, membre,
clé WhatsApp ou donnée métier n’est supprimé ou renommé. Les identifiants `id`
des organisations restent uniques globalement.

Un code métier comme `KIN-01` peut être utilisé dans deux réseaux distincts. Dans
un même réseau, bureaux et entrepôts partagent le même espace de codes. Les codes
des organisations sans réseau conservent leur unicité entre organisations sans
réseau. Les nouveaux codes sont normalisés en majuscules par l’API.

L’API vérifie les conflits après autorisation et avant le provisionnement, puis
revérifie sous verrou réseau lors de l’affectation finale. Les collisions connues
sont renvoyées en 409, sans détails SQL ni indication sur un autre client.

Les anciennes tentatives en échec peuvent avoir créé une organisation technique
avant l’affectation du code, car le provisionnement existant utilise plusieurs
transactions. Ce correctif ne supprime pas ces éventuels enregistrements : toute
remise en état de données déjà créées doit être précédée d’un audit dédié.
