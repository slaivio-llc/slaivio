# Module 03 — Colis : suivi d’implémentation

Source : [spécification fournie](spec/module-03-parcels.md). État au 11 octobre 2026.

## Arbitrages

- Le complément final impose client + service + route configurés ; il prévaut sur le formulaire initial limité à la destination.
- Le catalogue associe les services et les routes en plusieurs-à-plusieurs ; le formulaire de réception propose les routes actives liées au service.
- Les filtres restent automatiques et le bureau est choisi dans le sélecteur global (décisions visuelles antérieures).
- Les maquettes et exemples de clients du document ne sont pas des données à introduire en production.
- Le parcours véhicules ne doit pas être remplacé par le parcours fret.

## Premier lot réalisé : réception manuelle fret

- L’ancien formulaire fret est remplacé par un composant dédié : client, transport, informations du colis, réception.
- Recherche client avec résultats asynchrones protégés contre les réponses obsolètes, sélection conservée pendant les recherches, création client intégrée sans perdre le brouillon.
- Service puis route compatible du catalogue ; un service actif sans route reste visible avec une explication, mais ne peut pas être soumis. Erreurs de chargement explicites et réessai.
- Référence fournisseur et description facultatives ; poids facultatif, strictement positif s’il est connu. L’absence de pesée reste `null`.
- Emplacement de stockage facultatif ; bureau actif fourni par le contexte serveur.
- Pour la réception manuelle fret sans dossier, le serveur exige client/service/route, impose l’état reçu et l’heure de réception, génère les références et refuse les destinations/montants/identités imposés par le navigateur.
- Le dépôt conserve les contrôles de propriété client/route/service et de compatibilité route-service. L’agent de réception est enregistré même sans date fournie par le navigateur.
- Prérequis de déploiement : appliquer `infra/sql/091_supplier_label_intelligence.sql` avant d'utiliser la création de colis de cette version. Le dépôt insère aussi les colonnes d'audit OCR, même si aucun scan OCR n'est utilisé.
- L’historique et la mise en file de notification existants restent transactionnels ; aucun envoi WhatsApp synchrone n’est ajouté.
- Le bouton empêche un double clic immédiat. Cela ne constitue PAS encore une idempotence réseau/serveur.

## Deuxième lot réalisé : registre, consultation et cohérence visuelle

- Le fret monte désormais `ParcelRegisterPage`, sans monter les effets/statistiques de l’écran historique conservé pour les autres parcours.
- Registre à quatre colonnes (référence, client, service, état), recherche automatique et filtres état/date, pagination de 50 éléments, rafraîchissement iconique. Aucun second sélecteur de bureau, ni KPI/scan/analytics hérité.
- Nouvelles projections `/packages/register`, `/packages/register/{id}` et `/history` : permission `packages.read`, périmètre bureau propriétaire ou destination, recherche paramétrée, dates validées, UUID contrôlés, aucune modification du schéma lors de la lecture.
- Liste sans montants financiers ni coordonnées privées. Historique sans metadata, corps des notifications ou montants de calcul de prix. Les descriptions opérationnelles restent disponibles aux agents autorisés.
- Fiche latérale en consultation avec Vue d’ensemble et Historique paginé ; poids inconnu explicite, service/route, bureau de réception et liens vers les véritables pages client/expédition. Pas de lien vers le CRM d’un autre bureau.
- Les anciennes valeurs d’état restent stockées. La présentation regroupe la préparation sous Reçu et distingue affectation, départ, arrivée et remise ; états hors cycle toujours retrouvables avec Autres états.
- Formulaires Colis et Client fret dans un panneau latéral cohérent ; champs partagés de 36 px, libellés allégés, pied d’action fixe. Focus retenu dans le panneau, Échap sur le panneau supérieur, retour du focus à la fermeture.
- Menu compte fret compact (identité sans répétition, profil, langue, déconnexion). Sélecteur d’espace allégé : nom normalisé, emplacement, état actif, création/administration selon droits ; recherche à partir de sept espaces. Suffixe entrepôt sans duplication.
- Le chantier n’est pas une validation visuelle de toutes les pages historiques.

## Troisième lot réalisé : correction, photos privées et disponibilité

- Correction dédiée avec motif obligatoire et version attendue : description, référence fournisseur, emplacement et poids lorsqu’il reste modifiable. Aucun changement de statut, client, service ou montant accepté par cette commande.
- Verrou transactionnel et historique avant/après ; une fiche obsolète provoque un conflit explicite sans écraser la saisie. Les colis livrés, annulés ou retournés sont exclus de cette correction.
- Le poids est verrouillé dès qu’une expédition, un tarif, un instantané de tarification ou une situation de paiement impose une réévaluation. Le bureau destinataire ne corrige que l’emplacement.
- Photos privées paginées dans la fiche : ajout depuis le bureau propriétaire, consultation par les bureaux autorisés, URL signée obtenue seulement à l’ouverture et non transmise au proxy d’images. Contrôle d’accès avant stockage, taille/format limités et signature de fichier image vérifiée (pas une analyse antivirus ni un décodage intégral).
- Téléversement multiple avec bilan des réussites/échecs partiels ; aucun renvoi automatique. Une réponse perdue nécessite une vérification de la liste avant renvoi.
- Action « Disponible pour retrait » après arrivée, confirmation explicite, version contrôlée, événement et notification en file dans la même transaction. Répéter la confirmation d’un colis déjà disponible ne produit pas de nouvelle notification.
- La nouvelle fiche ne propose pas la remise : l’ancienne commande `delivery_proof` peut clôturer sans contrôle financier suffisant. Il faut établir un rattachement fiable entre colis, factures et paiements avant de l’exposer dans le nouveau parcours.

## Restant — ne pas déclarer Module 03 terminé

Décision utilisateur du 11 octobre 2026 : passer au module 04 sans déclarer Colis terminé. Les points ci-dessous sont conservés ; la remise et ses contrôles financiers seront repris avec le module Finance. Le report ne signifie pas que tous les autres restes dépendent de Finance.

### Reprise obligatoire avec Finance

- Établir une relation explicite et vérifiable colis → factures/lignes → paiements affectés. Ne pas déduire le paiement d’un colis du seul solde global du client ni additionner des devises différentes.
- Définir les conditions de remise par agence et les éventuelles dérogations autorisées, motivées et auditées. Un état financier inconnu ne doit jamais être présenté comme payé.
- Au moment de confirmer une remise, recontrôler état physique, version, autorisation et condition financière ; éviter les doubles remises et doubles notifications lors des nouvelles tentatives.
- Pour une remise groupée, vérifier chaque colis et présenter les blocages individuellement ; enregistrer l’historique et annuler les relances devenues inutiles.
- Auditer et aligner également les anciennes API, notamment `delivery_proof`, et pas uniquement masquer leurs boutons. L’ancienne commande reste un risque connu tant que cette unification n’est pas faite.
- Recette attendue : non payé, avance, payé, paiement annulé, factures multiples, devises différentes, dérogation, concurrence entre agents et réseau interrompu après confirmation.

### Restes transversaux conservés

1. **03.01 Registre** : implémenté dans ce lot ; recette PostgreSQL et navigateur connecté à faire avec les vrais volumes et permissions de l’agence.
2. **03.02 Fiabilité de réception** : idempotence transactionnelle des nouvelles tentatives ; remplacer le blocage historique des références fournisseur répétées par un avertissement contextualisé avec confirmation tracée (une même référence peut désigner plusieurs colis). Vérifier import/API/IA séparément.
3. **03.03 Fiche** : consultation et correction limitée implémentées ; réaffectation client et changement de service après facturation encore à sécuriser et exposer. Les anciens menus d’édition, anomalies, finance et paramètres ne sont pas repris dans la nouvelle fiche fret.
4. **Tarification** : ne pas inventer de prix. Raccorder le calcul aux données suffisantes, afficher « Tarif à définir » lorsque le calcul est impossible, puis vérifier l’éligibilité aux expéditions.
5. **03.04 Cycle de vie** : auditer les transitions existantes et leurs événements ; garantir qu’une affectation n’est pas un départ et qu’une arrivée n’est pas une livraison. Préserver les anciens événements sans proposer tous les états hérités comme parcours normal.
6. **03.05 Retrait** : disponibilité implémentée ; remise, conditions financières par agence, remise groupée contrôlée individuellement, correction auditée et annulation des relances restent à réaliser. Unifier les contrôles des anciennes commandes/API avant activation complète.
7. **03.06–03.07 Photos/localisation** : ajout privé et emplacement dans la fiche implémentés ; ajout dès le formulaire de réception et partage client explicite restent à réaliser. Le stockage objet et la transaction SQL ne sont pas atomiques : prévoir nettoyage des fichiers orphelins et idempotence des ajouts.
8. **Recette réelle** : PostgreSQL, comptes avec permissions limitées, plusieurs bureaux, catalogue modifié pendant la saisie, connexion interrompue après validation, livraison WhatsApp réelle, mobile et accès clavier. Vérifier l’alignement visuel avec le socle partagé.

## Validation du premier lot

- 12 tests Python de préparation et intégration dépôt simulée ; aucun accès à une base de production.
- 9 tests d’acceptation LUZA existants également passants (21 tests Python au total).
- 4 tests d’interaction du nouveau formulaire passants.
- TypeScript et ESLint ciblé exécutés ; validation navigateur authentifiée et base réelle encore nécessaires.
- Pas de migration SQL ajoutée ou appliquée dans ce lot.

## Validation et déploiement du deuxième lot

- 70 tests backend ciblés passants (dont 11 nouveaux tests registre ; dépôts simulés, pas une recette sur PostgreSQL).
- 32 tests frontend passants, dont non-régression Clients, création imbriquée, nouveau registre, formulaire et menus.
- TypeScript et ESLint ciblé passants. Pas de session navigateur authentifiée ni de contrôle visuel aux trois largeurs effectués.
- Déployer le backend avec les nouvelles routes de lecture avant le frontend. Aucune nouvelle migration SQL.
- Photos, édition métier, retrait/remise et idempotence serveur restent à implémenter/valider avant de déclarer le module prêt pour une agence.

## Validation et déploiement du troisième lot

- 64 tests backend ciblés passants, dont 25 pour les corrections/disponibilité et 7 pour les photos. Dépôts simulés, pas de recette PostgreSQL réelle.
- 22 tests frontend passants : réception, registre, conflits de version, confirmation, corrections, photos et panneau latéral.
- TypeScript et ESLint ciblé passants. Pas de validation navigateur connecté, stockage réel ou livraison WhatsApp réelle.
- Aucune migration ajoutée. Déployer le backend avant le frontend ; le bucket privé `package-media` et le circuit existant d’envoi des notifications doivent être configurés.
- Ne pas activer une remise automatique ni annoncer le module terminé avant résolution des points ci-dessus.
