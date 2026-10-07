# Module 02 — Clients / CRM : reprise et critères

Statut : **spécification reçue, audit du code et implémentation à faire**.
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

Tests API/UI, concurrence de création, doublons et numéros locaux/internationaux,
droits par section, isolation réseau, archive sans perte d'historique, liens intermodules,
PostgreSQL réel et recette navigateur. Ne cocher les exigences qu'avec preuves.

L'accueil reste ouvert dans [dashboard-remaining-work.md](dashboard-remaining-work.md).
