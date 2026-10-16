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

## Lot 4 — attribution et accès financiers par bureau

## Lot 5 — décision financière V1 avant départ

- Les paiements en ligne et SasPay restent hors du parcours V1. Le statut utilisé
  pour autoriser un départ provient exclusivement de `finance_payments` confirmés.
- Une politique `DEPARTURE` peut être définie par agence ou par service ; la
  politique service est prioritaire. Les politiques ARRIVAL/DELIVERY ne bloquent
  pas un départ, ce qui évite l'ancien blocage universel.
- La vérification charge la facture du colis, la politique, la devise et la somme
  des paiements confirmés. Elle ne considère jamais un tarif absent comme zéro.
- Les réponses de blocage contiennent code, colis, politique, montant requis,
  montant confirmé, reste et explication lisible. Le workflow reste transactionnel
  et ne crée aucune obligation ni paiement pendant la confirmation.
- Migration `141_finance_departure_clearance.sql` après 139/140 : ajoute le type
  DEPARTURE et l'index service. Migration non exécutée ici.
- Le garde-fou historique `require_payment_clearance` n'est plus utilisé par les
  deux contrôles de sélection/confirmation de départ ; la configuration explicite
  Finance est requise. Une agence sans politique reçoit `FINANCE_POLICY_MISSING`.
- Validation : 22 tests backend ciblés passent pour politiques, devises, factures
  manquantes, acomptes et paiements intégraux. Tester encore les migrations et une
  transaction concurrente PostgreSQL avant production.

Migration `138_finance_office_scope.sql` avant l'API. Aucun backfill automatique :
le bureau de destination du colis n'est pas nécessairement le bureau financier.
Le champ référence `organization_locations`, comme les permissions et le sélecteur
global. L'attribution initiale est réservée à `finance.settings` dans la vue globale,
avec version optimiste, contrôle tenant et événement OFFICE_ASSIGNED. Elle est
définitive dans ce lot ; le trigger interdit une réattribution silencieuse.

La fiche Finance permet au responsable de sélectionner le bureau pour les documents
non attribués. Les membres limités voient ensuite les listes, indicateurs et exports
de leurs bureaux. Détail, impression, paiement, annulation de paiement, émission,
décision et annulation du document vérifient ce même périmètre côté serveur.
Les reçus et paiements héritent de l'attribution de leur document. Un document
non attribué ou hors périmètre répond 404 pour un membre limité.

Limites explicites : création de documents/factures colis, conversion de devis,
application d'avoirs, paramètres et rafraîchissement global des échéances restent
réservés au contexte organisation complet autorisé. Le parcours reste donc : un
responsable prépare et attribue, puis l'équipe du bureau traite la facture.
Le parcours de création directement dans le contexte d'un bureau reste à livrer.
Les autres consommateurs (CRM, Dashboard, IA, tracking) doivent encore être audités
et raccordés au même modèle ; ce lot ne certifie pas leur finance par bureau.

Validation : 53 tests backend ciblés réussis sur dépôts simulés, TypeScript et
ESLint réussis. La migration,
les triggers et la concurrence restent à vérifier sur PostgreSQL avant production.

## SasPay — premier lot d'encaissement

Les schémas ont été vérifiés dans la documentation officielle actuelle :
`POST /checkout-sessions/`, `GET /checkout-sessions/{id}/status/`,
`GET /payments/{payment_id}/verify/` et la signature webhook
`X-Webhook-Signature` + `X-Webhook-Timestamp` + `X-Webhook-Event`.
La création d'une session n'accepte pas `Idempotency-Key`; l'API de paiement
vérifie donc strictement les sessions côté serveur et ne rejoue jamais à l'aveugle
une création dont la réponse est incertaine.

Implémenté :

- Migration `140_finance_saspay_payins.sql` : connexion chiffrée par organisation,
  réservations locales de checkout, tentative unique ouverte par facture, ID
  externe unique et journal de rejeu webhook. Un compte marchand ne peut pas être
  associé à plusieurs organisations.
- Adaptateur hébergé vers `https://api.saspay.me/api/v1`, avec Bearer token,
  timeout borné, aucun retry HTTP et vérification stricte du marchand, de l'URL
  `https://pay.saspay.me`, du montant demandé et de la devise.
- Réservation en base avant l'appel distant. Les expirations réseau / erreurs
  serveur restent `AMBIGUOUS`; le frontend conserve la même clé locale et ne crée
  pas une deuxième session. Une ambiguïté sans ID de session nécessite un
  rapprochement manuel depuis SasPay ; aucun endpoint officiel de recherche par
  métadonnée n'a été confirmé.
- Une tentative ouverte réserve le solde restant : les paiements manuels qui
  consommeraient ce montant, l'application d'un avoir et l'annulation de la
  facture sont refusés jusqu'à la résolution de la tentative. Les clés
  étrangères composites garantissent aussi que facture, tentative et webhook
  appartiennent à la même organisation.
- Webhook public signé sur les octets bruts, horodatage limité à 300 secondes,
  comparaison HMAC en temps constant, puis appel serveur à `verify` avant
  rapprochement. Une URL de retour, un événement seul ou un état `PENDING` ne
  crée pas de paiement.
- Rapprochement strict de la transaction vérifiée : marchand propre à
  l'organisation, `INBOUND`, `PAIEMENT`, état `SUCCESS`, marqueur de tentative,
  montant demandé et devise doivent correspondre. Les paiements résultants
  réutilisent le modèle et la clé d'idempotence Finance existants.
- Le solde client est crédité du montant SasPay `requested_amount`, jamais du
  `net_amount`. `provider_amount`, `provider_fee`, `provider_charged`,
  `provider_net_amount` et `fee_charge_mode` restent séparés dans l'historique.
  Leur cohérence arithmétique est validée pour les modes `ADD_ON` et `DEDUCTED`.
  La devise doit être identique à celle de la facture ; aucune conversion
  implicite n'est acceptée.
- L'interface permet d'ouvrir le checkout et de demander une vérification
  serveur. Elle ne traite pas le retour navigateur comme une preuve. Seuls
  l'identifiant et la clé d'idempotence non sensibles sont conservés en
  `sessionStorage`; aucune clé prestataire n'est exposée au dashboard.
- Connexion administrable par `PUT /finance/saspay/connection` avec
  `finance.settings`; le statut ne renvoie jamais les secrets. Il faut fournir
  `FINANCE_PROVIDER_ENCRYPTION_KEY` (clé Fernet dédiée). Les clés `sk_live_`
  sont refusées hors de `APP_ENV=production`. La configuration est par
  organisation, jamais par défaut au compte SaaS.

Validation locale : les tests backend utilisent un transport simulé / mocks,
sans requête SasPay ni paiement réel. TypeScript et tests front ciblés doivent être
relancés pour chaque évolution. La migration n'a pas été appliquée ici.

Prérequis avant tout essai sandbox : appliquer la migration 140, générer et
configurer la clé Fernet, puis relier explicitement le compte marchand de chaque
organisation. Créer ensuite depuis le tableau de bord SasPay un webhook
`transaction.success` vers `/webhooks/saspay/{org_id}` avec le même secret de
signature. Aucun compte ni paiement live n'est configuré par ce lot. Les
connexions `LIVE` ne sont autorisées qu'en production ; aucune recette sandbox,
PostgreSQL, concurrence, webhook distant ou production n'a été exécutée.

Limites restantes : provisioning des comptes marchands via un écran dédié,
traitement manuel des créations ambiguës sans ID, suivi automatique des échecs
webhook, recette PostgreSQL et sandbox autorisée. Les payouts, retraits et
transferts de wallet sont hors périmètre.

## Communication

Les restes sont conservés dans `docs/communication-module-progress.md`. Leur report
après lancement est demandé par le propriétaire ; cela ne certifie pas leur recette
en production ni ne dispense des contrôles de sécurité sur les nouveaux paiements.
