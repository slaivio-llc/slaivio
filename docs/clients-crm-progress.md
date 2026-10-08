# Module 02 — Clients / CRM : reprise et critères

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
