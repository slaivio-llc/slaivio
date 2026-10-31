# Accès des collaborateurs

Les nouvelles invitations et attributions proposent uniquement Responsable du
bureau, Opérations, Entrepôt, Service client et Finance, dans le dashboard et
dans l’API. Les profils spécialisés ci-dessous sont conservés pour les accès
historiques ; ils ne sont plus attribuables. Les droits du propriétaire restent
distincts et ne s’accordent pas via une invitation de collaborateur.

Appliquer `infra/sql/164_operational_member_access.sql` avant de déployer l’API
et le dashboard. La migration et le provisionnement des nouvelles agences
utilisent la même liste explicite de droits. Seuls les rôles standard sont
réconciliés ; les rôles personnalisés et les bureaux attribués ne changent pas.

| Profil | Arrivée | Périmètre |
| --- | --- | --- |
| Opérations | Opérations | Colis, tarification du colis, dossiers et expéditions |
| Agent entrepôt | Entrepôts | Réception, pesage, stock, qualité et remise physique |
| Superviseur entrepôt | Entrepôts | Opérations et configuration des sites de stockage internes |
| Réceptionnaire | Entrepôts | Réception, identification, déplacement et étiquettes |
| Peseur | Entrepôts | Pesage et dimensions |
| Contrôleur qualité | Entrepôts | Contrôles et anomalies |
| Agent guichet | Retraits | Préparation, notification, vérification et remise |
| Caissier | Retraits | Vérification des paiements avant retrait, sans remise ni dérogation |
| Service client | Messagerie | Conversations, contacts et consultation du suivi |

Ces profils ne donnent pas accès à la gestion financière générale, aux rôles,
à l’équipe, à l’abonnement ou à l’administration du réseau. Le rôle Finance
reste le profil pour enregistrer les encaissements dans la finance.
La vérification de paiement du retrait n’est pas un nouveau moyen de paiement.

## Recette avant livraison

Avec des adresses distinctes de celle du propriétaire : envoyer une invitation,
créer ou connecter le compte invité, accepter puis ouvrir l’espace. Vérifier
la page d’arrivée et les actions permises. Répéter une connexion normale sans
le lien. Tester un bureau non attribué et une URL Finance/Paramètres directe :
l’accès doit être refusé. Contrôler aussi un rôle personnalisé existant.

Les tests locaux de permissions et de redirection ne remplacent pas cette
recette Clerk réelle. Ne pas communiquer les identifiants du propriétaire.
