# Audit de fiabilité — 27 octobre 2026

## Statut de livraison

Ce passage apporte des correctifs vérifiés, pas une certification de sécurité de
toute la plateforme. Aucun accès à la base de production, paiement réel, invitation
réelle ou envoi WhatsApp n’a été effectué. Aucune migration SQL n’est ajoutée.

La livraison complète reste conditionnée à la résolution des tests historiques
en échec, à une recette multi-agences et à la qualification de l’outillage de test.
Les tests PostgreSQL nécessitent une base **jetable** via `TEST_POSTGRES_URL` ;
ne jamais utiliser la production pour ces tests.

## Problèmes corrigés dans le code

| Priorité | Constat vérifiable | Correction |
| --- | --- | --- |
| Haute | `/wallet/top-up` et `/wallet/charge` acceptaient des écritures de solde fournies par un client authentifié. La route `/wallet/secure/transactions` autorisait également un montant et une nature de transaction sans preuve de paiement externe. | Les trois routes sont fermées par une dépendance renvoyant 410 avant toute opération financière. Les services internes de règlement et les paiements SasPay ne sont pas supprimés. |
| Haute | Le résolveur historique `payments/services/payment_service.py` renvoyait toujours `MockPaymentProvider`, dont la vérification indique `SUCCEEDED`. | Le simulateur est interdit en staging/production avant toute consultation fournisseur ; permissions Finance ajoutées aux routes historiques. |
| Haute | La mise à jour historique d’un paiement utilisait seulement `provider_reference`. | Ajout de `org_id` et `provider_code` obligatoires dans le service et dans le filtre SQL. |
| Moyenne | Le client Axios commun ajoute un jeton à ses requêtes, y compris si un appelant lui transmet une URL absolue ou remplace son `baseURL`. | Contrôle de l’origine de destination avant de récupérer le jeton ; les URLs externes et identifiants dans l’URL sont refusés. Les téléchargements externes doivent utiliser un client sans jeton Slaivio. |
| Moyenne | PyJWT vérifiait les dates uniquement lorsqu’elles étaient présentes. | `exp`, `iat`, `nbf` et `sub` sont désormais obligatoires, avec vérification RS256 conservée. |
| Moyenne | L’envoi historique de médias WhatsApp exigeait une appartenance à une agence mais pas la permission d’envoi. | Ajout de `inbox.reply`, comme pour les réponses de messagerie. |
| Fiabilité | Un manifeste incomplet provoquait une erreur React en lisant `shipment.origin_city`. | Vérification de la structure et affichage d’une erreur explicite, sans présenter un manifeste invalide comme exportable. |
| Parcours | Plusieurs composants choisissaient l’ancienne interface pour les types historiques `AGENCY` ou `VEHICLE_IMPORT`, contrairement au profil produit central. | Colis, expéditions, fiche expédition et en-tête utilisent le même résolveur de profil. |
| Compréhension | Les historiques Finance affichaient directement `PAYMENT_RECORDED` et autres identifiants ; certains titres colis et clients gardaient des codes. | Libellés d’événements partagés, traduction des statuts dans les anciens titres, repli neutre pour les codes inconnus. Les données d’audit stockées restent intactes. |
| Compréhension | La sélection des vues de l’ancienne fiche de suivi affichait des intitulés anglais. | Intitulés français sans modifier les valeurs API ; erreurs passées par la présentation métier commune. |
| Fiabilité | Les montants absents d’une fiche client étaient remplacés par zéro. | Les montants inconnus sont indiqués comme non renseignés ; un vrai zéro reste zéro. |
| Responsive | Le squelette de tableau imposait 72 px minimum par colonne, même dans un petit écran ; une colonne créait deux cellules. | Colonnes rétractables, nombre de cellules exact et débordement contenu. Animation conditionnée aux préférences de mouvement. |
| Accessibilité | Les paramètres déclarés modaux ne géraient pas le focus clavier ; leur navigation pouvait prendre une trop grande partie d’un écran mobile. | Piégeage/restauration du focus, Échap, verrouillage du défilement, protection des fenêtres imbriquées et navigation mobile bornée. |
| Cohérence | Boutons partagés sans anneau de focus explicite ni dimension tactile minimale. | Focus visible commun et surface tactile de 44 px sur petit écran ; état pressé explicite des onglets. |

## Code historique et déchets

- Quatre fichiers Python compilés `.pyc` suivis par Git ont été retirés. Ils sont
  recréables par Python et ne contiennent pas de fonctionnalité source à conserver.
- Le cache pytest local est exclu du lint et de Git ; il n’est pas une source de
  l’application et n’a pas à être parcouru par ESLint.
- `LegacyPackagesPage` et `LegacyShipmentsPage` sont encore explicitement utilisés
  par le profil `CARGO_OS`. Ce ne sont donc pas des fichiers orphelins prouvés.
  Les supprimer exige d’abord une décision de retrait de ce profil et une migration
  des liens, droits, tests et données historiques associés.
- Les routes détaillées expédition et les pages `/app/packages`, `/app/clients`,
  `/app/finance` restent utilisées par les liens de fiches et de rapports. Une
  absence dans le menu latéral ne justifie pas leur suppression.
- Des tests de contrat font encore référence à `app/app/routes/page.tsx` et
  `components/services/service-catalog-center.tsx`, absents du dépôt. Ils doivent
  être rapprochés de Gestion > Services & Routes ; ne pas recréer une ancienne
  page uniquement pour faire passer une assertion textuelle.

## Vérifications et limites

Premier passage depuis la racine : backend 1043 réussites, 32 échecs et 7 ignorés ;
frontend 219 réussites et 21 échecs. Huit échecs backend provenaient de tests qui
supposent un lancement depuis `apps/api`.

Deuxième passage backend depuis `apps/api`, après les premiers correctifs :
1062 réussites, 21 échecs, 7 ignorés. Il précède l’ajout des quatre tests du
durcissement du simulateur de paiement. Les 21 échecs ne sont pas masqués : ils
comprennent des contrats de navigation obsolètes, des assertions textuelles sur
des composants déplacés et des listes de routes RBAC à revoir.

Deuxième passage frontend : 230 réussites et 20 échecs. Les échecs concernent
notamment les scénarios client, création/encaissement de facture, catalogue de
services et registre/fiche expédition. Certains mocks ne correspondent plus au
contrat actuel (libellé `Finance` devenu `Paiements`, manifeste sans objet
`shipment`, export `serviceCatalog` manquant). Il faut mettre à jour les scénarios
et confirmer leur comportement, pas supprimer les contrôles de sécurité.

Les tests ciblés sécurité backend, y compris les photos publiques, réussissent
(18 tests). TypeScript et le lint global réussissent après les corrections.
Les nouveaux tests frontend de protection du jeton, libellés, paramètres,
manifeste et registre colis réussissent ; la suite client historique reste rouge.

Dernier passage complet frontend après les correctifs Finance et Clients :
**246 tests réussis, 10 en échec**. La création client principale, les soldes par
devise, les quatre tests Finance du colis et les trois tests de reprise de paiement
passent désormais. Un scénario de reprise de création client imbriquée reste en
échec, ainsi que les anciens scénarios de fiche/registre expédition, un scénario
de création de route et une attente visuelle de rayon d’onglet.

Les tests RBAC ont été actualisés sans abandonner le moindre droit attendu :
chaque ancienne route conserve son droit attendu, et **chaque route**, nouvelle
ou ancienne, doit déclarer exactement une permission. Les huit tests dossiers et
expéditions concernés passent.

Le build frontend complet de production avec Next.js 15.5.28 a réussi, ainsi que
TypeScript et le lint global. Il n’a pas été déployé.

Dernier passage complet backend **après installation des dépendances Python
corrigées et actualisation RBAC** : **1068 réussites, 19 échecs, 7 ignorés**.
Les échecs restants ne doivent pas être assimilés à des tests validés. Leur liste
reste celle des contrats de navigation, connaissances, services et groupes
WhatsApp décrits ci-dessus, hors les deux tests RBAC désormais corrigés.

## Dépendances

L’audit npm initial des dépendances de production a signalé 7 paquets vulnérables
(1 critique, 5 élevés, 1 modéré). Les versions correctives de la branche existante
ont été vérifiées sur le registre avant modification : Next.js et son ESLint
15.5.28, Axios 1.21.0, PostCSS 8.5.32 et Sharp 0.35.5. Le fichier de verrouillage
doit être livré avec ces modifications. La mise à jour ne constitue pas une
garantie d’absence de vulnérabilités futures.

Après mise à jour et `npm audit fix --ignore-scripts` (sans `--force`),
`npm audit --omit=dev` ne signale plus de vulnérabilité connue : **0**.
L’audit incluant les outils de développement signale encore **3** paquets :
`@vitest/mocker`, `tinypool` et `vitest` (1 modéré, 2 critiques). Le registre
propose une migration majeure de Vitest pour les résoudre. Elle n’est pas
appliquée sans qualification du nouvel outillage. Ne pas exposer de serveur de
test ou d’interface Vitest à Internet.

L’environnement local est sous Node 21.1.0, non pris en charge par plusieurs
outils installés. `.nvmrc` indique Node 22 pour la recette et les déploiements ;
aucune installation globale de Node n’a été modifiée.

L’audit initial Python a signalé 38 avis concernant sept paquets. Les corrections
verrouillées sont `aiohttp 3.14.4`, `anyio 4.14.2`, `certifi 2026.10.19`,
`multidict 6.9.1`, `opentelemetry-api 1.45.1`, `PyJWT 2.15.0` et `urllib3 2.8.0`.
La résolution exige aussi `yarl 1.25.1`, `opentelemetry-semantic-conventions 0.66b1`
et `mistralai 2.10.1` (même génération de SDK ; la version 2.4.5 bloquait les
conventions corrigées). Installation dans le venv effectuée, `pip check` réussi.
L’audit du fichier de dépendances corrigé ne signale plus d’avis connu. Cette
vérification porte sur les versions explicitement verrouillées ; elle ne remplace
pas la recette OCR/IA et la qualification des dépendances transitives sur Linux.

L’audit du venv complet, au-delà des lignes verrouillées de production, a aussi
repéré `Pillow 12.3.0` : il est désormais explicitement verrouillé à **13.0.0**
pour le traitement d’images et les QR codes. Le nouvel audit de `requirements.txt`
incluant Pillow ne signale aucun avis connu.

Des alertes restent dans l’environnement local de développement : `filelock
4.1.1` (aucun dépendant déclaré), `pip 25.2` et `pytest 8.4.2`. Ce ne sont pas des
lignes de `requirements.txt`. Leur qualification/mise à jour doit être traitée
avec celle de l’outillage Vitest ; ne pas annoncer un audit global entièrement
vert sur la seule base des dépendances applicatives.

Après installation de Pillow 13, les tests ciblés logos, photos, partage public,
sessions, portefeuille et simulateur de paiement passent : **42 tests**.
`pip check` ne signale pas de dépendance cassée. Aucun test n’a envoyé de média
à une agence ou traité de paiement réel.

## Recette encore requise avant de déclarer l’ensemble livrable

1. Faire passer la suite complète avec des scénarios correspondant au dashboard
   actuel, sans affaiblir les assertions d’isolation, de permissions ou de reprise.
2. Exécuter les tests PostgreSQL sur une base dédiée, notamment les quotas en
   concurrence et les écritures atomiques. Sept tests ont été ignorés faute de base.
3. Recette navigateur authentifiée aux largeurs 320, 390, 768 et 1440 px : tous les
   modules, fiches, historique long, menus, chargement, vide, erreur et clavier.
4. Vérifier avec deux agences et plusieurs rôles : accès refusé inter-agences,
   invitation, sélection du bureau, accès entrepôt et Finance.
5. Valider les webhooks signés et les cas de double livraison avec des fournisseurs
   en environnement de test ; rapprocher d’éventuelles anciennes écritures simulées
   ou manuelles, sans corriger automatiquement les soldes de production.
6. Vérifier la configuration réelle des origines CORS, de l’émetteur Clerk et des
   authorized parties (`azp`), les secrets, les politiques Supabase et les sauvegardes.
   Ces points ne sont pas certifiés par la lecture du dépôt.
7. Qualifier les connecteurs OCR/IA avec le SDK Mistral mis à jour et auditer le
   service passerelle WhatsApp séparément.

Références pour le durcissement JWT : [vérification Clerk](https://clerk.com/docs/guides/sessions/manual-jwt-verification)
et [claims obligatoires PyJWT](https://pyjwt.readthedocs.io/en/stable/api.html).
