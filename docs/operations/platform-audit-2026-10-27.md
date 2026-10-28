# Audit de fiabilité — 27 octobre 2026

## Statut de livraison

Ce passage apporte des correctifs vérifiés, pas une certification de sécurité de
toute la plateforme. Aucun accès à la base de production, paiement réel, invitation
réelle ou envoi WhatsApp n’a été effectué. Aucune migration SQL n’est ajoutée.

Les tests historiques et l’outillage ont été repris dans le second passage,
détaillé en fin de document. La livraison complète reste conditionnée à une
recette multi-agences et aux validations externes indiquées ci-dessous.
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

## Second passage — résultats consolidés

Cette section remplace les états d’échec et les alertes d’outillage consignés
plus haut, qui décrivent le premier passage.

### Corrections supplémentaires

- Routes : « Ajouter une route » ouvrait réellement le formulaire de service.
  Le bouton ouvre désormais la configuration de route ; le test couvre la
  sélection obligatoire d’un service, la vérification et l’enregistrement réel.
- Connaissances : le bouton de publication avait disparu. « Vérifier et publier »
  appelle maintenant l’API existante avec confirmation, permission de publication
  et version courante. Une erreur conserve la confirmation et n’annonce aucun
  succès. La publication n’est pas proposée pour une connaissance archivée.
- Support : après une réponse asynchrone, `event.currentTarget` n’est plus fiable.
  Le formulaire et le champ fichier sont mémorisés avant l’attente réseau. Un
  message envoyé n’est plus présenté comme échoué ; un vrai échec garde le texte.
  Statuts, priorité et auteurs par défaut sont affichés en français.
- Entrepôts : les champs d’emplacement et d’anomalie ont des libellés français
  et accessibles au lieu des clés techniques. Traduction des statuts de transfert,
  des emplacements et des actions d’audit ; erreurs via le présentateur commun.
- Clerk : contrôle exact de `azp` lorsqu’il est présent. Aucun suffixe ni
  sous-domaine arbitraire accepté. Son absence reste compatible avec les sessions
  de navigation décrites dans la documentation Clerk. Six nouveaux scénarios
  couvrent les origines autorisées, falsifiées et la production sans localhost.
- Dépôt : 3 019 fichiers générés de la passerelle étaient suivis dans Git sous
  `node_modules`. Ils ont été retirés de l’index, **pas du disque**, et ignorés.
  `npm ci` les recrée depuis les manifestes. Ces retraits sont déjà préparés dans
  l’index ; les autres modifications ne sont ni commitées ni déployées.

### Tests et dépendances

- API : **1 093 tests réussis, aucun échec, sept ignorés** uniquement faute de
  `TEST_POSTGRES_URL` local. Aucun test n’a utilisé la base de production.
- Dashboard : **265 tests réussis, aucun échec**, sous Node **22.23.4** et Vitest
  **5.0.5**. Les tests d’expédition suivent maintenant les onglets de la fiche,
  tout en conservant les contrôles de reprise, manifeste figé et conflit de version.
- Les anciens tests de chaînes UI ont été alignés sur Gestion, Communication et
  les fiches actuelles. Aucun test n’a été désactivé. La synchronisation des groupes
  de dossiers reste testée côté API ; l’ancien panneau absent n’est pas réintroduit.
  Les assertions de permissions et d’isolation existantes restent conservées.
- Les 112 erreurs statiques des tests Python ont été corrigées sans exclusion de
  fichiers ni désactivation de règles : gardes sur les résultats optionnels,
  contrôles explicites des détails d’erreur structurés et des routes FastAPI,
  références de mocks typées et validation des entrées négatives via Pydantic.
  `pyright` : **zéro erreur, zéro avertissement** ; `ruff check app scripts tests` :
  réussi. Après les derniers ajustements, les 122 tests concernés passent aussi.
  L’import de démarrage `scripts/check_imports.py` réussit en mode test avec une
  URL PostgreSQL locale factice ; aucun serveur ni accès de production utilisé.
- Dashboard : **typecheck, lint sans avertissement et compilation Next de production
  réussis** sous Node 22. Un ancien attribut HTML contenant du vocabulaire non
  affiché, utilisé par les tests de chaînes, a été supprimé ; les contrats portent
  désormais sur les vrais intitulés et la publication testée par interaction.
- `npm audit` dashboard : **zéro vulnérabilité connue**, outils de test inclus.
- `pip-audit --local` : **aucune vulnérabilité connue** dans le venv installé ;
  `pip check` valide sa cohérence. Outils corrigés : pytest **9.1.1**, pip **26.2.2**,
  filelock **4.2.4**. `requirements-dev.txt` accepte pytest 9 corrigé.
- Passerelle WhatsApp : cinq dépendances vulnérables corrigées par mises à jour
  compatibles du lockfile (sans `--force`). Audit : **zéro vulnérabilité connue**.
  Tests chiffrement, signature/anti-rejeu et identité : réussis. Imports Baileys
  et Sharp **0.35.5** validés sous Node 22, sans démarrer le serveur.
  L’image Docker et le contrat Node de la passerelle sont alignés sur Node 22.
- CI frontend alignée sur `.nvmrc` (Node 22) et audit npm ajouté. CI API : les tests
  PostgreSQL utilisent maintenant explicitement le PostgreSQL jetable du job.
  Nouvelle CI passerelle : installation, audit et tests. Ces workflows n’ont pas
  été exécutés sur GitHub depuis cet environnement.

### Configuration à vérifier avant déploiement

Le dashboard nécessite désormais **Node 22** (au moins 22.12 ; validation locale
avec 22.23.4). Utiliser cette version pour `npm ci`, tests et compilation ; le
Node 21 global de ce poste n’a pas été modifié.

Pour l’API, vérifier `PUBLIC_WEB_BASE_URL`. Si plusieurs domaines servent
réellement l’application, définir par exemple :

```dotenv
CLERK_AUTHORIZED_PARTIES=https://slaivio.com,https://www.slaivio.com
```

Ne lister que les origines réellement utilisées, sans chemin ni joker. Sans cette
variable, seule l’origine de `PUBLIC_WEB_BASE_URL` est acceptée ; localhost:3000
est ajouté uniquement hors staging/production. Aucun secret n’est nécessaire pour
cette liste. L’exemple de configuration API est à jour.

### Limites de la validation

Un audit de dépendances sans alerte et des tests verts ne certifient pas toute la
plateforme. Restent à exécuter : les sept tests PostgreSQL (localement ou en CI),
la recette navigateur authentifiée mobile/desktop, l’isolation avec deux vraies
agences et différents rôles, les fournisseurs en sandbox, les politiques Supabase,
les sauvegardes et les secrets de déploiement. Les anciennes pages encore ciblées
par des liens ou par le profil CARGO_OS n’ont pas été supprimées sans remplacement.
