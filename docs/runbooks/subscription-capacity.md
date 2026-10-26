# Capacités des abonnements

## Catalogue validé

| Ressource par agence | Starter, 119 USD/mois | Pro, 229 USD/mois | Business, 799 USD/mois |
|---|---:|---:|---:|
| Nouveaux colis par mois civil | 500 | 2 500 | 15 000 |
| Membres et invitations en attente | 3 | 10 | 40 |
| Bureaux | 1 | 3 | 10 |
| Entrepôts | 1 | 3 | 10 |
| Numéros WhatsApp | 1 | 5 | 15 |

La période mensuelle utilise le fuseau du compte agence principal. Tous ses
bureaux et entrepôts descendants partagent les plafonds, sans multiplication
du quota par bureau. Business conserve le code interne ENTERPRISE.

Les tarifs proviennent de pricing_plans, les plafonds de plan_entitlements.
Les cartes et les compteurs lisent ces valeurs au serveur, sans catalogue de
quotas parallèle dans le navigateur. Aucun supplément automatique n'est facturé.

## Déploiement

1. Exécuter d'abord les tests PostgreSQL ci-dessous sur une base de test isolée.
2. Appliquer 158_subscription_capacity_limits.sql après les migrations précédentes.
3. Déployer l'API et le worker, puis le dashboard.
4. Faire une recette Starter / Pro / Business dans deux bureaux d'une même agence.

L'API dépend des fonctions SQL de cette migration : ne pas la déployer avant SQL.
La première application accorde 30 jours de transition aux agences existantes.
La réexécution de la migration ne prolonge pas cette transition et ne l'accorde
pas à de nouveaux comptes. Les nouveaux comptes ont toujours leur essai gratuit
de 30 jours, avec les capacités Starter.

## Application des plafonds

Des triggers vérifient les insertions et réactivations concernées, y compris
les imports, webhooks d'adhésion et API directes. Une limite atteinte annule la
transaction de création et renvoie une erreur lisible. Les mises à jour ordinaires,
consultations, paiements, suivi et remises de colis existants ne sont pas bloqués.

Le registre billing_parcel_usage conserve la consommation même après suppression
d'un colis. Les transactions échouées ne consomment pas de quota. Les tentatives
simultanées sont sérialisées par compte et par ressource, pas pour toute la plateforme.

Les invitations réservent une place avant l'appel Clerk ; le contrôle et
l'enregistrement local utilisent le même verrou et la même transaction. Les
invitations locales PENDING continuent de réserver une place jusqu'à acceptation
ou révocation. Réconcilier/révoquer les invitations expirées chez Clerk si elles
n'ont pas été mises à jour localement.

Les connexions QR en préparation réservent une place ; la liaison de leur numéro
ne doit pas être comptée une seconde fois. Les représentations d'un entrepôt dans
organizations, organization_locations et warehouses ne sont pas additionnées.

Les confirmations opérationnelles et les documents restent inclus dans toutes les
offres. Après transition, les nouvelles relances répétées et annonces de départ
sont réservées à Pro/Business. Les tentatives de relance Starter restent en attente
dans le worker, sans être envoyées. Les messages déjà acceptés dans l'outbox ne
sont pas effacés par une baisse d'offre ; les contrôles existants de consentement
et de validité métier restent appliqués avant envoi.

## Tests PostgreSQL obligatoires avant activation

Configurer TEST_POSTGRES_URL uniquement avec une base PostgreSQL de test jetable,
jamais avec la base de production. Le test crée son propre schéma temporaire et
le supprime à la fin. Aucun message ni paiement externe n'est déclenché.

Depuis apps/api :

```powershell
python -m pytest tests/test_capacity_postgres.py -q
```

Sans TEST_POSTGRES_URL, ces tests sont explicitement ignorés ; les tests unitaires
ne constituent pas une validation d'exécution de la migration PostgreSQL.

Recette manuelle complémentaire : limite exacte puis création supplémentaire,
deux créations simultanées sur la dernière place, invitation en parallèle d'une
adhésion, connexion QR puis liaison du numéro, changement d'offre payé, passage
au mois suivant, transition historique et fonctionnement des retraits existants.

Les plafonds et l'automatisation premium changent sans suppression de données.
Ne pas retirer les triggers seulement pour afficher des offres prétendument limitées.
