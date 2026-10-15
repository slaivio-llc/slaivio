# Module 07 — Finance Cargo

## Contrat à respecter (07.01 / 07.02)

- Finance possède les montants, obligations, paiements, soldes et documents ; CRM,
  Tracking et Communication consomment ses résultats, sans recalcul indépendant.
- Prix du service, montant actuellement exigible et argent reçu sont distincts.
- Les états financiers et logistiques restent indépendants.
- Les totaux sont séparés par devise, sans conversion implicite.
- Paiement externe enregistré par un agent autorisé et paiement fournisseur vérifié
  convergent vers le même modèle financier, avec une provenance distincte.
- Une facture provient d'une opération connue ; un reçu prouve un paiement reconnu.
- Les corrections laissent un historique. Aucun paiement n'est effacé silencieusement.
- La section 07.03 reste à préciser : ne pas inventer 50 % à réception pour toutes
  les agences, ni une interdiction universelle de remise des colis non payés.

## Premier lot : intégrité du module existant

- Paiements API en Decimal, positifs, finis, maximum deux décimales conformément au
  stockage existant. Le support des devises à trois décimales reste à définir.
- Verrou transactionnel organisation + clé d'idempotence avant recherche du paiement.
- Rejeu identique : paiement existant ; changement de facture, montant, devise,
  méthode ou référence : conflit 409, aucune nouvelle insertion.
- Verrou facture et contrôle du solde avant insertion ; pas de dépassement du solde.
- Paiement et annulation préservent les avoirs déjà appliqués au solde.
- Annulation conservée dans l'historique avec auteur et motif ; incohérence de
  montant payé refusée au lieu d'être masquée par un zéro.
- Indicateurs retournés dans `by_currency`, affichés avec chaque devise dans Finance.
  Les brouillons et factures annulées sont exclus des agrégats monétaires.

Validation locale : 17 tests réussis (intégrité des paiements, contrat Finance et
résumé Cargo), TypeScript `tsc --noEmit` réussi. Les transactions sont simulées :
cela ne remplace pas une recette PostgreSQL concurrente ou une recette navigateur.
Pas de migration nécessaire pour ce lot. Déployer API et frontend ensemble : le
contrat `/finance/stats` change, les anciens totaux sans devise sont supprimés.

## Suite indispensable avant de déclarer le module complet

1. Modèle canonique prix / exigibilité / paiements rattaché aux opérations Cargo,
   reprise explicite des données existantes et périmètres bureaux côté serveur.
2. Vue Paiements / Factures et enregistrement court depuis l'opération, sans
   ressaisir client, devise ou référence ; corriger les anciens parcours en doublon.
3. Factures et reçus aux couleurs de l'agence, snapshots historiques et accès client
   sécurisé. Le numéro de suivi seul ne donne pas un accès général aux finances.
4. Consommation unifiée par CRM, Tracking et IA ; notifications selon configuration.
5. Demandes de paiement et adaptateur SasPay, rapprochement et gestion des anomalies.
6. Recette migrations / PostgreSQL / concurrence / isolation inter-agences et bureaux,
   puis sandbox fournisseur et navigateur. Aucun paiement réel pendant les tests.

## Deuxième lot : saisie intégrée et reçus

- Remplacement des prompts navigateur de paiement par un formulaire intégré :
  montant uniquement, client/facture/devise connus ; source manuelle explicite.
- La même demande et sa clé sont conservées lors d'une reprise dans le formulaire.
  Après confirmation, un échec de rafraîchissement ne renvoie pas de paiement.
  Cette protection mémoire ne survit pas à la fermeture/recharge de la page : en
  cas de résultat ambigu, vérifier l'historique avant de créer une nouvelle demande.
- Les reçus des nouveaux paiements mémorisent atomiquement le nom agence, le nom
  client, la référence facture et l'URL du logo. Aucun recalcul du solde n'y figure.
  L'URL est figée mais le fichier distant du logo n'est pas archivé dans ce lot.
- Téléchargement HTML imprimable en PDF par le navigateur ; accès authentifié avec
  finance.read, filtrage organisation + facture + paiement, aucune route publique.
- Paiements annulés signalés et génération de reçu refusée. Les anciens paiements
  sans identité historique ne sont pas rétroactivement enrichis avec les données
  actuelles ; un message indique l'indisponibilité du reçu historique.
- Migration `136_finance_payment_receipts.sql` à appliquer AVANT l'API. Pas exécutée
  par l'agent. Aucun compte fournisseur ni paiement SasPay n'est utilisé dans ce lot.
- 23 tests backend ciblés et 6 tests frontend passent (dépôt/API simulés),
  TypeScript et ESLint passent. Les tests frontend couvrent la reprise identique
  après timeout, l'échec de rafraîchissement après confirmation et le dépassement du solde.
  La recette base de données et navigateur reste nécessaire.

## Troisième lot : facture depuis le colis

- Depuis l'onglet Paiement du colis, préparation d'une facture DRAFT à partir de
  `pricing_snapshot`, uniquement si montant et devise correspondent au colis.
  Pas de montant saisi de nouveau ni de nouveau calcul tarifaire.
- Le client doit exister dans la même organisation. Les encaissements historiques
  `fees_paid` non nuls imposent un rapprochement ; ils ne sont pas importés en silence.
- Verrou colis, version contrôlée, transaction unique et index unique de facture
  active : les reprises renvoient la même facture. Un snapshot conserve la référence,
  la version du colis et le résultat tarifaire utilisé.
- Réutilisation de la création Finance, sans deuxième modèle de facturation.
  Aucune émission automatique, aucune notification ni mutation logistique.
- L'onglet lit les montants depuis Finance, pas par soustraction de champs Cargo.
  Les anciens autres consommateurs de fees_total/fees_paid restent à migrer.
- IMPORTANT : toutes les routes `/finance` refusent désormais les contextes limités
  par bureau (403). Les documents historiques n'ont pas de rattachement bureau
  fiable. Un membre autorisé à tous les bureaux doit sélectionner la vue organisation
  complète ; un membre restreint ne peut pas contourner ses droits en retirant le filtre.
  Il s'agit d'une protection temporaire, pas de la livraison de Finance multi-bureaux.
- Migration `137_finance_package_invoices.sql` avant déploiement API (après 136).
  Aucun rattachement des anciennes factures n'est inventé : vérifier les documents
  historiques avant de facturer des opérations anciennes. Migration non exécutée ici.
- Validation : 36 tests backend et 9 tests frontend ciblés réussis,
  TypeScript et ESLint réussis.
  Verrous, index et trigger restent à tester sur PostgreSQL avant production.

## SasPay — contraintes fournies, intégration pas encore implémentée

- Vérifier les schémas des endpoints officiels avant codage de l'adaptateur.
- Clés exclusivement backend, rattachées au bon marchand/agence ; ne pas encaisser
  toutes les agences sur un compte global par défaut.
- Checkout hébergé privilégié pour le parcours demandé. Sa création ne supporte pas
  Idempotency-Key : réservation locale et réconciliation des réponses ambiguës,
  jamais une boucle de retry aveugle.
- Un retour navigateur réussi, une session créée ou un statut PENDING ne prouvent
  pas un paiement. Vérification serveur du paiement et rapprochement de la demande,
  de la transaction entrante, du marchand, du montant et de la devise obligatoires.
- Webhook : HMAC sur timestamp + point + corps brut, comparaison constante,
  tolérance 300 secondes et unicité du paiement externe en base.
- Conserver amount, charged, fee et net_amount séparément. Définir explicitement
  le crédit de la créance et le traitement des frais et conversions ; ne pas
  assimiler le net marchand au montant payé pour le service.
- Pas de retraits, payouts ni transferts wallet : hors du périmètre d'encaissement.
- Aucun secret, webhook distant, paiement, déploiement ou migration exécuté ici.

## Communication

Les restes sont conservés dans `docs/communication-module-progress.md`. Leur report
après lancement est demandé par le propriétaire ; cela ne certifie pas leur recette
en production ni ne dispense des contrôles de sécurité sur les nouveaux paiements.
