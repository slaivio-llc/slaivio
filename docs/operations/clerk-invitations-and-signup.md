# Invitations et inscription SLAIVIO

## Réglage nécessaire dans Clerk

SLAIVIO crée déjà un espace d’agence et applique ses propres permissions côté API.
Pour éviter une seconde création d’organisation dans le parcours Clerk :

1. Dans l’instance Clerk utilisée par le frontend **et** l’API, ouvrir **Organizations → Settings**.
2. Garder Organizations activé pour les invitations.
   Activer également **Organization slugs** dans ces paramètres. La liaison
   initiale utilise un slug stable pour retrouver une création interrompue sans
   créer une agence en double. Si Clerk retourne `organization_slugs_disabled`,
   l’envoi est bloqué jusqu’à l’activation de ce réglage dans la même instance.
3. Activer **Allow Personal Accounts / Membership optional** afin que Clerk n’impose pas la tâche `choose-organization` avant l’accès à l’onboarding SLAIVIO.
4. Vérifier que `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` côté frontend et `CLERK_SECRET_KEY` côté API désignent la même instance (test ou production).
5. Vérifier le webhook signé `/webhooks/clerk` : `user.created`, `organization.created`, `organization.updated`, `organizationMembership.created`, `organizationMembership.updated`.

Ce réglage ne désactive ni l’authentification ni l’autorisation des agences : l’API
vérifie toujours les appartenances SLAIVIO, le bureau et les permissions.
Ne pas désactiver les contrôles de session ou la MFA pour supprimer cet écran.

## Corrections applicatives

- Les invitations Clerk utilisent `org:member`, pas le rôle local SLAIVIO.
- Les rôles SLAIVIO sont enregistrés dans l’invitation locale, puis appliqués lors de l’acceptation.
- Les identifiants historiques `personal_*` et `org_<uuid hex>` sont des identifiants locaux, pas des organisations Clerk réelles. Leur liaison est provisionnée à la première invitation, avec verrou par agence et slug stable pour permettre une reprise.
- Le propriétaire actif de l’agence, et non le collaborateur qui invite, est le créateur de l’organisation Clerk.
- Les webhooks signés utilisent la métadonnée privée de liaison pour ne pas créer une agence en double. Ils conservent les rôles locaux et ne réactivent pas les membres suspendus.
- Aucune invitation n’est annoncée comme envoyée si le secret Clerk manque ou si Clerk refuse l’envoi.
- Les réponses publiques contiennent un code métier traduit ; les logs API ne consignent que le statut et les codes d’erreur Clerk, sans secret ni corps de réponse.
- L’inscription conserve `/onboarding` comme destination de repli, sans écraser la destination fournie par une invitation.

## Validation après déploiement

Tester une nouvelle inscription sans écran Clerk de création d’organisation, puis
une invitation vers un nouvel utilisateur et un utilisateur existant. Contrôler la
réception du mail, son acceptation, le rôle SLAIVIO et les bureaux accessibles.
Tester aussi une invitation déjà en attente et un refus du service de connexion.

Références officielles :
- https://clerk.com/docs/guides/organizations/configure
- https://clerk.com/docs/guides/configure/session-tasks
- https://clerk.com/docs/reference/backend/organization/create-organization-invitation
