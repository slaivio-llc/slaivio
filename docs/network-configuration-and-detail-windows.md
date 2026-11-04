# Implantations réseau et fenêtres de détail

## Périmètre commun

Le sélecteur change l’organisation active. Les implantations créées par ce sélecteur appartiennent à des organisations distinctes au sein du même réseau ; les anciennes statistiques de Gestion ne lisaient que les adresses de l’organisation courante.

Le module `organization_network/operational_points.py` fournit les adresses actives du réseau autorisées au membre connecté. La page Gestion et le catalogue des formulaires utilisent ce même périmètre. Un membre doit appartenir à l’organisation source et avoir soit un accès réseau à tous les bureaux, soit une appartenance active à l’organisation cible. Les restrictions locales par bureau restent appliquées. Une agence d’un autre réseau n’est jamais proposée.

Les bureaux responsables conservent leur identifiant `organization_locations`. Les bureaux de destination utilisent leur véritable identifiant `agency_offices` et les entrepôts leur identifiant `warehouses`. Les créations et modifications de routes déduisent l’organisation destinataire du bureau choisi ; les sélections sont aussi vérifiées lors de l’enregistrement, pas seulement dans les menus. Les services et leurs associations valident le même périmètre.

Il s’agit de partager les points de configuration opérationnels autorisés, pas les clients, finances, colis ou paramètres privés d’un autre bureau. Aucun enregistrement existant n’est déplacé ou dupliqué. Le contexte local de filtrage des opérations n’est pas élargi.

## Fiches

La fiche client Cargo utilise désormais `OperationDrawer`, avec fermeture par croix, Échap ou arrière-plan, sans bouton retour et sans masquer le répertoire en arrière-plan. Une réponse tardive ne rouvre pas une fiche client fermée. Le composant de détail commun réserve sa hauteur dès l’ouverture et n’utilise plus d’animation de changement d’échelle ; son contenu reste défilable sur petit écran. Les formulaires conservent leur dimensionnement propre.

L’historique tarifaire traduit les événements enregistrés : `GRID_ACTIVE` devient « Tarif publié », `GRID_APPROVED` « Tarif vérifié », `GRID_CREATED` « Tarif créé » et `RULE_CREATED` « Règle de calcul ajoutée ». Les événements inconnus utilisent un libellé neutre ; les dates, auteurs, motifs et données d’audit ne sont pas réécrits.

## Déploiement

Déployer l’API et le dashboard ensemble ; aucune nouvelle migration SQL n’est nécessaire. Les migrations précédentes, notamment 129 pour le lien entre bureau physique et bureau opérationnel, doivent déjà être appliquées.

Vérifier après déploiement : une agence principale avec un bureau secondaire et un entrepôt, leurs compteurs dans Gestion, leurs sélections dans les services/routes, puis un membre limité à un bureau. Vérifier aussi une fermeture de fiche pendant une réponse lente et les onglets d’historique. Les tests de périmètre exécutent les requêtes sur SQLite en traduisant uniquement les casts PostgreSQL `::text` ; cela ne remplace pas une vérification sur PostgreSQL en environnement de recette.
