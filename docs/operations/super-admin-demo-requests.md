# Demandes de démo dans le Super Admin

Les demandes du formulaire public sont enregistrées dans `landing_demo_requests` et consultables dans **Super Admin SLAIVIO → Demandes de démo**. Le lien figure dans le menu du compte uniquement pour les opérateurs autorisés. Accès direct : `/app/platform`.

## Déploiement et accès

1. Appliquer `infra/sql/159_platform_demo_requests_privacy.sql`, après les migrations 019 et 058 déjà existantes.
2. Déployer l’API et le dashboard correspondants.
3. Utiliser un compte Clerk disposant de droits actifs dans `platform_operator_permissions` : `platform.admin.read` pour consulter la console, et `platform.agencies.manage` pour modifier le suivi des demandes. Les autres onglets sensibles nécessitent leurs droits dédiés.

Aucun droit n’est accordé automatiquement. Être propriétaire d’une agence ne donne pas accès au Super Admin. L’attribution initiale doit suivre la procédure d’administration de confiance de la migration 058 ; ne pas donner ces droits à tous les comptes d’agence.

La migration 159 protège les coordonnées et les notes internes par RLS et retire l’accès direct des rôles navigateur Supabase `anon` et `authenticated`. L’API doit utiliser sa connexion SQL serveur de confiance, avec les privilèges nécessaires (propriétaire des tables ou rôle serveur adapté à la RLS). Ne pas contourner cette protection en accordant des droits aux navigateurs. Les demandes déjà reçues restent conservées et apparaissent sans import.

## Suivi commercial

Recherche, filtres, pagination et fiche complète sont disponibles. Les étapes sont : Nouvelle, Contactée, Démo planifiée, Démo réalisée et Clôturée. Les notes internes et changements de statut sont historisés dans le journal d’audit.

Changer le statut ne contacte pas automatiquement le prospect et ne crée pas de rendez-vous dans un calendrier. Aucun envoi d’email à l’équipe n’est ajouté : la console est le point de consultation. Deux opérateurs ne peuvent pas écraser silencieusement leurs modifications : en cas de conflit, recharger la fiche avant d’enregistrer à nouveau.

## Définition des indicateurs

- Agences : organisations racines, sans compter leurs bureaux comme des agences supplémentaires.
- Espaces rattachés actifs : organisations enfants actives, bureaux et entrepôts compris.
- Membres : identifiants Clerk distincts avec une adhésion active.
- Essais et forfaits payants : abonnements racines en cours, selon leur statut et leur échéance.
- Activité : colis non supprimés et expéditions créés pendant le mois civil UTC en cours.
- Acquisition : demandes reçues et répartition par statut, avec volume des 30 derniers jours.
- Encaissements : factures d’abonnement SLAIVIO marquées payées, séparées par devise. Les montants suivent la convention de stockage du module de facturation (centièmes). Ils ne représentent ni les encaissements des clients des agences, ni une prévision de revenu récurrent.

Le bouton Actualiser recharge les données. Aucun indicateur de disponibilité technique ni taux de conversion non mesuré n’est présenté comme une mesure réelle.

## Vérification PostgreSQL isolée

`apps/api/tests/test_platform_demo_postgres.py` valide le verrouillage optimiste et le retour arrière si l’audit échoue. Ces tests nécessitent `TEST_POSTGRES_URL` sur une base de test jetable ; ils utilisent un schéma unique puis le suppriment. Ne jamais pointer cette variable vers la production. Sans cette variable, les tests sont explicitement ignorés.
