# Console interne SLAIVIO

## Faire apparaître le Super Admin pour votre compte

1. Appliquer les migrations 159 et 160 avec le propriétaire de la base, puis déployer l’API et le dashboard correspondants. Les migrations antérieures, notamment 025, 058, 155, 157 et 158, sont nécessaires.
2. Dans **Clerk → Users**, ouvrir votre propre utilisateur SLAIVIO et copier son **User ID**, qui commence par `user_`. Ce n’est ni l’identifiant de l’organisation ni votre email. Ne partager aucun jeton ni secret.
3. Ouvrir `infra/manual/bootstrap_platform_admin.sql`. Remplacer uniquement `REMPLACER_PAR_USER_ID_CLERK` par cet identifiant. Vérifier que c’est bien le compte interne de votre équipe, puis exécuter ce script dans le SQL Editor Supabase de confiance.
4. Recharger SLAIVIO avec ce même compte. Dans le menu de l’avatar, **Super Admin SLAIVIO** apparaît. Vous pouvez aussi ouvrir `https://slaivio.com/app/platform`.

Ce script est une opération manuelle privilégiée : ne pas le placer dans les migrations automatiques. Aucun compte n’est autorisé en fonction de son nom d’agence, de son email, d’un rôle propriétaire d’agence ou d’une valeur stockée dans le navigateur. Les contrôles sont effectués côté API sur l’identifiant Clerk authentifié.

Si le lien n’apparaît pas, vérifier que l’utilisateur connecté appartient à la même instance Clerk que le compte autorisé, que les permissions sont actives dans la même base que l’API, et que l’API est déployée. Un échec réseau masque le lien par sécurité. L’espace conserve le parcours de connexion et l’initialisation du compte SLAIVIO existants : ce script ne crée pas un compte ou une agence à votre place.

## Fonctions disponibles

- **Vue d’ensemble** : agences, essais, accès payants, demandes de démo, activité et encaissements confirmés séparés par devise. Pas de revenu prévisionnel ni d’état de santé inventé.
- **Demandes de démo** : coordonnées, recherche, filtres, notes, statuts et historique ; aucun email ou rendez-vous externe n’est créé automatiquement.
- **Agences** : registre paginé des agences racines, fiche, membres, notes internes, suspension ou réactivation avec confirmation et motif.
- **Abonnements et paiements** : abonnements, factures SLAIVIO, sessions SasPay et catalogue réel avec limites. Une correction manuelle d’accès nécessite un motif et une échéance future pour un essai ou un accès actif ; elle n’enregistre jamais un paiement ni un remboursement.
- **Support** : recherche, priorité, demande initiale, conversation et réponse visible par l’agence. Le chargement est limité aux 500 premiers messages d’un ticket.
- **Suivi technique** : volumes des communications et des automatisations, attentes prolongées et registre des événements à vérifier, sans contenu brut des messages ni secrets. Lecture seule : aucun renvoi, affectation ou rejeu automatique depuis cet écran.
- **Journal des actions** : pagination, recherche et filtres, auteur, cible et motif. Il n’est pas modifiable depuis la console.
- **Équipe SLAIVIO** : attribution ou révocation des droits par compte, motif obligatoire, confirmation et contrôle des modifications concurrentes. Vos propres accès sont protégés ; utilisez un autre administrateur autorisé pour les modifier. Le dernier compte cumulant consultation et gestion des permissions est protégé.

## Séparation des accès

La consultation de la console nécessite `platform.admin.read`. Les rubriques facturation, support, audit, opérateurs et suivi technique nécessitent en plus leurs permissions dédiées. Les autorisations sont présentées en français dans la console. Une API privée reste protégée même si quelqu’un saisit directement son URL.

Conserver au moins deux administrateurs internes vérifiés et limiter les permissions des autres opérateurs à leur mission. Éviter les comptes partagés ; activer les protections de connexion disponibles dans votre configuration Clerk. Les opérations de configuration Clerk se font dans son tableau de bord, pas dans cette console.

Les migrations 159 et 160 activent la RLS et retirent l’accès navigateur direct aux demandes, journaux, notes internes et permissions plateforme. L’API utilise sa connexion SQL serveur de confiance. Si elle utilise un rôle SQL personnalisé, vérifier ses droits et son accès RLS avant le déploiement ; ne pas accorder les tables aux rôles navigateur pour résoudre une erreur serveur.

## Limites explicites

Cette console couvre les opérations présentes dans SLAIVIO. Elle ne remplace pas une infrastructure de supervision : pas de mesure de disponibilité des fournisseurs, de remboursement SasPay, de changement de prix en direct, d’usurpation de compte agence ou d’accès aux secrets. Ces opérations nécessitent des procédures et des intégrations spécifiques. Aucun de ces boutons n’est simulé dans l’interface.
