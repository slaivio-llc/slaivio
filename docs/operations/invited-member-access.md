# Invitations et accès des collaborateurs

## Déploiement

Appliquer `infra/sql/161_invited_member_access.sql` avant de déployer l’API et le
dashboard correspondants. La migration ne supprime aucun colis, client ou document.
Elle retire les permissions transversales du rôle système Finance et révoque les
anciennes affectations de rôle qui ne correspondent plus à une appartenance active.
Les rôles personnalisés sont conservés ; les droits de plateforme ne peuvent pas
être délégués à travers un rôle d’agence. Le bootstrap super administrateur est distinct.

## Parcours attendu

1. Dans Paramètres → Équipe, choisir l’adresse, le rôle et les bureaux physiques.
2. Le collaborateur ouvre son email et accepte l’invitation avec le compte invité.
3. La page `/join` vérifie côté serveur son appartenance confirmée dans Clerk.
4. L’agence est sélectionnée seulement après cette vérification. Le rôle Finance
   arrive dans Finance, sans charger le tableau de bord opérationnel.

Le rôle système Finance autorise la consultation, la préparation et l’émission
des factures, l’enregistrement des paiements et les exports financiers. Il ne donne
pas les réglages de paiement, l’abonnement SLAIVIO, l’administration de l’équipe,
les modules Clients/Colis ou les droits super administrateur. Les listes nécessaires
à la facturation sont accessibles séparément, avec les restrictions de bureau.

Un rôle personnalisé peut être créé pour une consultation seule ou d’autres
combinaisons. Un responsable ne peut pas attribuer des permissions qu’il ne possède
pas, ni remplacer un rôle système via l’éditeur de rôles personnalisés.

« Tous les bureaux » inclut les futurs bureaux physiques de l’agence : ce choix
doit être explicite. « Bureaux sélectionnés » ne donne aucun accès aux autres sites.
Les espaces/agences du réseau sont des appartenances distinctes, pas des bureaux
physiques internes à une même agence.

## Vérification avant livraison

- Tester avec un deuxième compte, jamais avec le compte propriétaire connecté.
- Inviter Finance sur un seul bureau ; vérifier les factures, soldes et exports.
- Vérifier qu’une URL directe vers Clients/Colis/Paramètres est refusée et que leurs
  API répondent 403. Masquer un menu n’est pas une autorisation serveur.
- Vérifier que `/me/permissions` indique Finance et seulement ses permissions.
- Changer le rôle, recharger la page et vérifier la disparition des anciens droits.
- Suspendre le membre puis rouvrir son invitation : elle ne doit pas le réactiver.
- Tester une inscription depuis l’invitation et un compte déjà existant.
- Tester un mauvais compte et un lien expiré. Révoquer puis renvoyer une invitation
  si nécessaire ; ne pas désactiver la validation des jetons.

Les anciens liens `/app` portant les paramètres d’invitation Clerk sont redirigés
vers `/join`. Cela ne prolonge pas leur validité. Sans agence dans le lien, le serveur
propose uniquement les appartenances qu’il a pu vérifier auprès de Clerk.

L’API doit disposer de sa clé Clerk serveur configurée normalement. Une panne de
vérification ne doit jamais accorder un accès par défaut ni contourner une suspension.
L’acceptation locale, le rôle et les restrictions de bureau sont enregistrés dans une
seule transaction afin qu’un échec ne consomme pas une invitation partiellement.

Référence du protocole d’invitation :
[documentation officielle Clerk](https://clerk.com/docs/guides/development/custom-flows/organizations/accept-organization-invitations).

Les tests locaux ne constituent pas un envoi réel d’email ni une validation en
production. Les tests PostgreSQL utilisent exclusivement `TEST_POSTGRES_URL`, une
base jetable dédiée ; ils sont ignorés si elle n’est pas configurée.
