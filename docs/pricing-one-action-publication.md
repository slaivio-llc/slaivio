# Création et publication d’un tarif

Le formulaire propose par défaut « Créer et activer le tarif » aux membres disposant de `pricing.approve`. L’option « Conserver en brouillon » reste volontaire. Un membre autorisé à créer mais pas à publier enregistre uniquement un brouillon ; le contrôle de publication est aussi vérifié par l’API, indépendamment de l’interface.

La demande `POST /pricing/grids` accepte `publish_on_create` (faux par défaut pour préserver les anciens consommateurs). Avec cette option, la création de la grille, du prix et des paliers, la validation et la publication utilisent la même transaction. Un prix manquant ou un conflit de période annule l’opération complète. Sans cette option, le comportement de création en brouillon reste inchangé.

Pour les brouillons existants, « Publier le tarif » effectue validation et publication dans une seule transaction via l’endpoint existant, déjà protégé par `pricing.approve`. L’ancien endpoint de validation reste disponible pour compatibilité, mais n’est plus nécessaire dans le parcours courant. Les contrôles de prix et de chevauchement restent actifs ; publier de nouveau une grille déjà active ne crée pas une seconde validation.

Les dates d’application et la visibilité interne/publique choisies sont conservées. L’historique garde les deux événements de validation et de publication, avec l’auteur réel ; aucune donnée historique ni opération facturée n’est réécrite.

Les erreurs de prix manquant, de dates en conflit ou d’état modifié sont présentées en français compréhensible dans la fiche et les notifications. Aucun changement de schéma n’est nécessaire : déployer l’API et le dashboard ensemble. Tester ensuite un tarif neuf, un ancien brouillon, une création volontairement en brouillon et un utilisateur sans droit de publication.

Les tests locaux couvrent les appels et les frontières transactionnelles avec des simulations ; une vérification sur PostgreSQL en recette reste nécessaire avant validation de production.
