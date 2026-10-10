# Module 02 — Clients / CRM : reprise et critères

## État consolidé au 10 octobre 2026 (prioritaire sur les lots historiques ci-dessous)

Implémenté : répertoire Cargo dédié, recherche/filtres/pagination/export, téléphone
international, création rejouable, Customer 360 avec permissions par section,
chronologie métier et contacts entreprise. Les parcours véhicules restent séparés.

Le dernier lot ajoute :

- Création depuis Colis dans le formulaire client partagé : brouillon du colis conservé,
  client créé sélectionné immédiatement, fermeture du sous-formulaire sans fermer le colis.
- Création depuis Inbox Cargo avec téléphone prérempli et source WhatsApp, puis
  rattachement par l'action de contexte existante. En cas d'échec du rattachement,
  le client reste créé et peut être sélectionné sans être recréé.
- Dans Inbox Cargo, lien vers la fiche client et ses colis à la place du dossier véhicules.
- Répertoire multi-bureaux : bureau actif, bureau autorisé ou tous les bureaux autorisés.
  Le serveur exige une appartenance active au même réseau et `clients.read` localement ;
  un droit réseau seul ne donne pas accès aux fiches. Chaque bureau exporté exige
  également `clients.export`. Ouvrir une fiche distante change explicitement le bureau actif.

Non clos : choix explicite du contact destinataire entreprise dans Inbox, colonnes
optionnelles, internationalisation de l'interface, unification des imports historiques
avec le validateur téléphonique, audit des dépendances et recette réelle PostgreSQL/navigateur.
Ne pas présenter le cahier des charges intégral comme terminé sur la seule base des tests unitaires.

### Recette de livraison

1. Appliquer 126 puis 127 sur la base du backend (si non appliquées), puis exécuter
   `python -m app.clients.schema_checks` depuis `apps/api`. Voir [crm-deployment.md](crm-deployment.md).
2. Créer un particulier et une entreprise ; provoquer un échec réseau et réessayer.
   Vérifier qu'une seule fiche existe et que les valeurs saisies sont conservées.
3. Dans un colis commencé, créer un client : vérifier sélection immédiate et brouillon
   inchangé ; Échap doit fermer uniquement le formulaire client.
4. Depuis une conversation non rattachée, créer le client puis vérifier le lien et
   le numéro prérempli ; vérifier que le parcours véhicules conserve ses dossiers.
5. Avec deux bureaux autorisés, rechercher dans tous les bureaux, ouvrir un client
   distant et vérifier le bureau actif. Tester aussi un membre sans accès à ce bureau.
6. Vérifier droits Finance/Communications, contacts entreprise, export et archive.
   Tester mobile et clavier. Les tests SQL simulés ne remplacent pas cette recette.

Les migrations distantes et cette recette déployée n'ont pas été exécutées ici.

Validation locale du lot : 69 tests backend ciblés et 26 tests frontend réussis ;
vérification TypeScript, Ruff sur le nouveau contrôle de portée et tests associés,
et contrôle des espaces Git. Les tests backend utilisent des connexions simulées.

Statut : **premier lot répertoire/création implémenté ; module non terminé**.
Source intégrale : [module-02-clients-crm.md](spec/module-02-clients-crm.md),
copiée depuis la pièce jointe du 7 octobre 2026. Les exemples sont illustratifs,
pas des données à coder en dur. Ce fichier ne remplace pas la source.

## Décisions prioritaires issues de la nouvelle spécification

- Cargo : Client → Colis → Départ/Expédition → Suivi → Livraison. Pas de Dossier intermédiaire.
- Répertoire léger : recherche et ouverture d'une fiche, pas mini-dashboard.
- Les vues Tous les clients / Entreprises remplacent la multiplication des vues/KPI.
- Un téléphone identitaire ; WhatsApp est un canal associé, pas un champ dupliqué.
- Pays et bureau sont distincts. Dériver le pays du bureau lorsque cela a du sens.
- Préserver le parcours véhicules : pas de suppression générale des dossiers ou données historiques.
- Les modules Colis, Finance et Communication restent propriétaires de leurs données.

## Lot du 8 octobre 2026

- Répertoire Cargo dédié sans KPI financiers/opérationnels ; véhicules conservés.
- `/clients/directory` sous `clients.read` : projection limitée, tri contrôlé,
  recherche nom/téléphone/référence, filtres type/date, pagination serveur de 50.
- Portée du bureau actif seulement ; colonne bureau répétitive masquée. Pas de faux
  filtre multi-bureaux. Dates de création en UTC explicitement indiquées.
- Vues Tous/Entreprises, lignes mobiles, vides/recherche/erreurs distincts.
- Formulaire Cargo limité à particulier/entreprise, nom, téléphone, e-mail et adresse
  supplémentaires. Téléphone facultatif pour une entreprise ; contrôles à la création API.
- Localisation dérivée du bureau lors de la création sans données de localisation.
- Modification : pas de remise à zéro des crédits, montants, notes ou langue masqués.
- Toujours ouvert : sélecteur téléphonique international et normalisation par pays,
  idempotence serveur, doublons contextuels, vue réseau, gestion des colonnes, overflow
  import/export, contacts entreprise et refonte complète Customer 360.
- Les détails existants restent utilisés : ce lot ne certifie pas encore leurs permissions
  section par section ni la suppression de toutes les anciennes notions Dossier.
- Tests unitaires et frontend ajoutés ; recette PostgreSQL et navigateur réel à faire.

## 02.01 — Répertoire

- [ ] Auditer frontend, API, permissions, schéma et index avant remplacement.
- [ ] Header compact, Nouveau client comme seule action dominante autorisée.
- [ ] Recherche serveur nom/téléphone/référence ; normalisation internationale contextualisée.
- [ ] Vues Tous/Entreprises ; filtres type/bureau/date avec appliquer/réinitialiser.
- [ ] Colonnes Client/Téléphone/Bureau/Activité ; masquer le bureau constant si pertinent.
- [ ] Dernière activité issue d'événements métier, pas d'une saisie ni d'un faux timestamp.
- [ ] Colonnes optionnelles uniquement si disponibles et autorisées.
- [ ] Pagination et tris serveur ; sélection multiple seulement pour actions effectives.
- [ ] États vide, aucun résultat, chargement et erreur distincts ; présentation mobile dédiée.
- [ ] Portée serveur et droits distincts consulter/créer/modifier/archiver/importer/exporter.

## 02.02 — Création et modification

- [ ] Drawer partagé création/modification, particulier/entreprise réellement distincts.
- [ ] Particulier : nom complet et téléphone obligatoires ; entreprise : nom obligatoire,
  téléphone facultatif selon le document. Ne pas imposer la règle particulier à l'entreprise.
- [ ] Sélecteur d'indicatif recherchable, validation et normalisation serveur.
- [ ] Bureau dérivé ou choisi parmi les bureaux autorisés ; e-mail/adresse supplémentaires.
- [ ] Référence serveur, doublons dans le périmètre accessible, nom seul non bloquant.
- [ ] Idempotence concurrente et bouton protégé ; conserver les saisies après erreur.
- [ ] Rattacher la conversation existante ; création depuis Inbox avec téléphone prérempli.
- [ ] Création depuis Colis sans perdre le brouillon, puis sélection automatique du client.
- [ ] Pas de confirmation de création avant succès serveur, particulièrement hors ligne.

## 02.03 — Customer 360

- [ ] Identité compacte, Message et Enregistrer un colis avec client présélectionné.
- [ ] Aperçu / Colis / Expéditions / Finance / Communications / Activité selon permissions.
- [ ] Liens vers objets réels et retour au client ; aucune copie des données métier.
- [ ] Finance par devise, accès contrôlé côté serveur, pas de conversion inventée.
- [ ] Réutiliser la conversation existante et distinguer envoyé/délivré selon événements.
- [ ] Activité métier agrégée, sans logs techniques ni indicateurs fictifs.
- [ ] Entreprises : contacts distincts, contact principal, choix du destinataire explicite.
- [ ] Identité multi-bureaux sans duplication automatique ; rattachement principal distinct
  des destinations des colis. Auditer le modèle réseau existant avant migration.
- [ ] Archivage conservant opérations et historique, formulaire de modification réutilisé.
- [ ] Mobile, accessibilité, états chargement/erreur et dates/nombres internationaux.

## Validation avant clôture

### Incident de création et finitions du 8 octobre

- Journal Railway : `client_creation_requests` absent. Le correctif d'environnement est
  l'exécution de 126 sur la base utilisée par le backend, puis 127 pour les contacts.
  Aucun SQL distant exécuté pendant cette intervention.
- Détection préventive des tables 126/127 : réponse 503 explicite, aucune écriture ni
  désactivation d'idempotence si le schéma manque. Commande de contrôle en lecture seule :
  `python -m app.clients.schema_checks` depuis `apps/api`.
- Procédure détaillée : [crm-deployment.md](crm-deployment.md).
- Activité : événements CRM, colis, expéditions, finance et messages agrégés selon les
  permissions métier. Événements d'expédition limités à la période de rattachement du colis.
- Export Cargo dédié : mêmes filtres et tri que le répertoire, projection sans montants,
  audit, cellules CSV protégées, refus explicite au-delà de 10 000 clients.
- Validation locale : 64 tests Python et 21 tests frontend passent ; TypeScript et Ruff
  ciblé passent. Ce n'est pas une validation de la migration ni de la concurrence PostgreSQL.
- Encore ouverts : vue réseau consolidée, création intégrée depuis Colis/Inbox avec
  brouillon conservé, choix du contact destinataire dans Inbox, colonnes optionnelles,
  internationalisation UI, recette navigateur/base réelle et audit des dépendances.

### Lot Customer 360 et contacts entreprise

- Cargo utilise une fiche dédiée : Aperçu, Colis, Expéditions, Finance,
  Communications et Activité. Les anciennes fiches véhicules restent séparées.
- Chaque section possède une projection SQL tenant/client et son droit métier
  contrôlé côté API. Pagination de 25 éléments ; erreurs distinctes des listes vides.
- Finance : documents et reçus reliés à la source Finance ; montants facturés séparés
  par devise sur l'ensemble des factures émises, hors devis/brouillons/annulations.
- Colis et expéditions ouvrent leurs objets source. Aucun faux compteur à zéro dans
  l'aperçu ; téléphone unique et référence client affichés.
- Le workspace historique ne charge plus finance/messages/colis sans leur permission.
  Le GET détail Cargo expose une projection d'identité, sans anciens montants financiers.
- Contacts entreprise : ajout, modification, contact principal unique et archivage.
  Verrou de la société et contrôle de version avant modification ; journal client mis à jour.
- Appliquer `127_client_company_contacts.sql` après 126 avant le déploiement.
  Aucune migration de production n'a été exécutée ici.
- **Ce lot ne clôt pas tout le cahier des charges** : répertoire réseau consolidé,
  raccourcis de création Colis/Inbox avec brouillon conservé, sélection du destinataire
  entreprise dans Inbox, colonnes optionnelles et export aligné sur les filtres Cargo,
  historique métier transversal complet et internationalisation UI restent ouverts.
- L'activité de la nouvelle fiche affiche pour l'instant les actions CRM autorisées,
  pas encore toute la chronologie colis/paiements/communications.
- Recette PostgreSQL concurrente et navigateur connecté toujours nécessaire ; les tests
  unitaires SQL utilisent des doubles de connexion et ne valident pas le schéma déployé.
- Vérification locale de ce lot : 57 tests Python ciblés et 21 tests frontend passent ;
  TypeScript, Ruff ciblé, ESLint ciblé et `git diff --check` sans erreur.

### Lot suivant : téléphone et créations rejouables

- Formulaire Cargo : pays/indicatifs recherchables, numéro local ou international,
  valeur E.164, numéro facultatif pour une entreprise. Bibliothèques
  libphonenumber-js et phonenumbers ; aucun indicatif codé en dur.
- API Cargo : validation réelle lors de la création et lorsqu'un numéro est modifié.
  Les imports et autres chemins historiques ne sont pas encore unifiés sur ce validateur.
- Clé de création conservée lors d'une nouvelle tentative identique ; garde synchrone
  contre les doubles soumissions dans le navigateur.
- Verrou transactionnel PostgreSQL par bureau/utilisateur/clé, empreinte de la saisie,
  rejeu du client déjà créé et refus de réutiliser une clé avec une autre saisie.
  Un client archivé n'est pas recréé lors d'un rejeu.
- Migration préalable obligatoire : `126_client_creation_requests.sql`. Installation
  des nouvelles dépendances frontend/backend puis redéploiement. Migration non exécutée
  sur une base distante par cette intervention.
- Limites : clé conservée durant la session du formulaire, pas après rechargement complet ;
  les autres écrans créant des clients doivent encore adopter cette clé.
- Tests concurrence avec PostgreSQL réel, 360, contacts entreprise et réseau restent ouverts.
- Validation de ce lot : 46 tests Python et 16 tests Vitest passent, TypeScript sans erreur,
  Ruff sur les nouveaux modules Python et ESLint sur les composants modifiés passent.
- Environnement local : Node 21 produit des avertissements de compatibilité ; refaire
  la recette sous Node 22. npm signale 16 vulnérabilités (2 modérées, 11 élevées,
  3 critiques) dans l'arbre des dépendances ; qualification et remédiation restent à faire.

Validation ciblée du 8 octobre : 31 tests Python (répertoire, RBAC, isolation),
5 tests Vitest (répertoire et payload du formulaire). Création et modification Cargo
partagent les contraintes d'identité ; une modification partielle conserve les champs
omis, et une version périmée est rejetée. Ces tests ne remplacent pas une recette
sur PostgreSQL réel ni un parcours navigateur connecté.

Tests API/UI, concurrence de création, doublons et numéros locaux/internationaux,
droits par section, isolation réseau, archive sans perte d'historique, liens intermodules,
PostgreSQL réel et recette navigateur. Ne cocher les exigences qu'avec preuves.

L'accueil reste ouvert dans [dashboard-remaining-work.md](dashboard-remaining-work.md).
