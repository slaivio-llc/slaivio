# MODULE-09 — ORGANISATION

## Objectif

Le Module-09 définit le référentiel organisationnel et opérationnel partagé par
les autres domaines de Slaivio :

- une organisation cliente ;
- ses pays d'activité et ses bureaux physiques ;
- ses services de transport ;
- ses routes commerciales.

Il ne recrée ni un module Entrepôts, ni un module distinct pour les Routes. Les
tarifs restent gérés dans le Module-08 et les départs et expéditions dans le
Module-04. Une route ou un service est une configuration réutilisable, pas une
opération réelle.

## Principes transversaux

1. Une organisation reste unique, même si elle opère dans plusieurs pays ou
   possède plusieurs bureaux.
2. Un pays d'activité, un bureau physique et une route sont trois notions
   différentes. Une route Chine → RDC ne prouve pas que l'agence possède un
   bureau en Chine.
3. Les modules opérationnels réutilisent les mêmes référentiels. Ils ne
   maintiennent pas leurs propres listes divergentes de bureaux, services ou
   routes.
4. La désactivation ou l'archivage empêche les nouvelles opérations, sans
   effacer les références et historiques existants.
5. Le contexte de bureau filtre les opérations, mais n'accorde aucune
   permission. L'autorisation doit être vérifiée par le serveur à chaque
   requête.
6. Les données d'une organisation sont isolées de celles des autres
   organisations.

## 09.01 — Organisation et bureaux

### Modèle

| Notion | Signification |
| --- | --- |
| Organisation | L'entreprise cliente de Slaivio |
| Pays d'activité | Pays dans lequel l'entreprise opère |
| Bureau | Implantation physique confirmée par l'entreprise |
| Trajet / route | Liaison commerciale ou logistique entre une origine et une destination |

Une organisation peut posséder plusieurs bureaux dans une ou plusieurs villes,
sans devoir créer plusieurs comptes ni abonnements.

### Création d'un bureau

Le formulaire « Ajouter un bureau » reste rapide et limité aux informations
locales. Les coordonnées générales de l'entreprise restent sur l'organisation.

| Champ | Obligatoire | Règle |
| --- | --- | --- |
| Nom du bureau | Oui | Identifie l'implantation |
| Pays | Oui | Pays dans lequel se trouve le bureau |
| Ville | Oui | Ville dans laquelle se trouve le bureau |
| Adresse | Non | Adresse locale, utile notamment pour le retrait |
| Téléphone | Non | Contact local |
| Horaires | Non | Informations destinées aux clients et à l'assistance |

Slaivio génère l'identifiant interne, rattache le bureau à l'organisation,
enregistre sa date de création et l'active initialement. Le système vérifie les
permissions, l'appartenance à l'organisation et les doublons potentiels. Une
ville n'est jamais une clé unique : plusieurs bureaux peuvent être présents dans
la même ville.

Le formulaire ne configure ni tarifs, ni routes, ni expéditions, ni accès
d'équipe, ni paiements, ni intégrations. Ces fonctions restent dans leurs
domaines respectifs.

### Opérations et contexte de travail

Lorsqu'un bureau est pertinent, l'opération conserve son identifiant. Pour un
colis, les éléments suivants doivent rester distincts :

```text
Origine du transport : Chine
Destination : Burkina Faso
Bureau de retrait : Bobo-Dioulasso
```

Un utilisateur autorisé à plusieurs bureaux peut choisir son contexte de
travail. Un accès limité à un bureau ne doit pas pouvoir être contourné en
modifiant un filtre, un identifiant ou une URL. Le contexte sélectionné ne
remplace jamais les permissions réelles du membre.

Les opérations, indicateurs, données CRM, documents, communications et éléments
financiers ne sont visibles que dans le périmètre de l'organisation et des
bureaux autorisés. Les bureaux désactivés conservent leur historique. Une
modification ultérieure de leur adresse ne réécrit pas les informations
historiques devant préserver leur contexte.

### Réutilisation par les modules

| Module | Utilisation |
| --- | --- |
| Dashboard | Indicateurs des bureaux autorisés |
| CRM | Bureau de rattachement d'un client, lorsque pertinent |
| Colis | Bureau de réception ou de retrait |
| Expéditions | Origine et destination opérationnelles |
| Tracking | Informations du bureau de retrait approprié |
| Communication | Informations locales correctes |
| Finance | Opérations dans le périmètre autorisé |
| Tarification | Services et routes configurés |

## 09.02 — Configuration opérationnelle des bureaux

Le bureau est une implantation identifiable, pas un entrepôt générique. Le
formulaire initial collecte uniquement son nom, son pays et sa ville comme
champs requis, avec adresse, téléphone et horaires facultatifs.

Les paramètres complémentaires nécessaires sont accessibles après création
depuis la fiche du bureau ou dans le module propriétaire du paramètre. Il n'y a
pas de duplication des informations générales de l'organisation.

## 09.03 — Gestion multi-pays

Une organisation unique peut opérer dans plusieurs pays. Les pays d'activité et
les bureaux réellement confirmés sont configurés comme tels ; la présence d'une
route dans un pays ne crée pas automatiquement un bureau dans ce pays.

Les opérations se rattachent au bon bureau lorsque le bureau est pertinent.
Les restrictions d'accès par bureau s'appliquent indépendamment des pays
d'origine et de destination.

## 09.04 — Gestion des services

### Définition

Un service est une prestation commerciale proposée par l'agence. Exemples
possibles : fret aérien, fret maritime ou express. La liste est définie par
l'agence ; ces exemples ne sont pas imposés par Slaivio.

Un nom commercial est distinct du mode de transport. Par exemple, « Express »
peut être le nom du service alors que son mode est aérien.

### Liste et formulaire

L'écran « Services » présente les prestations configurées par l'agence et
permet d'en ajouter une.

| Champ de création | Obligatoire | Règle |
| --- | --- | --- |
| Nom du service | Oui | Libellé commercial libre |
| Mode de transport | Oui | Mode structuré, distinct du nom |
| Description | Non | Explication destinée aux clients |

Slaivio génère l'identifiant et active initialement le service. Ce formulaire ne
configure ni tarifs, ni délais, ni acompte, ni restrictions : ils appartiennent
aux paramètres de tarification et aux règles opérationnelles correspondantes.

### État et historique

Un service inactif n'est plus proposé pour les nouvelles opérations. Les
opérations déjà associées, les tarifs historiques et les expéditions restent
consultables. La désactivation ne supprime ni le service ni ses références.

## 09.05 — Gestion des routes

### Définition et liste

Une route est un trajet commercial configuré entre une origine et une
destination. Plusieurs expéditions peuvent utiliser la même route. La route
n'est pas l'expédition et ne garantit pas qu'un départ existe.

L'écran « Routes » présente les trajets configurés, leurs extrémités et les
services disponibles sur chacun.

### Création et relation avec les services

| Champ | Obligatoire | Règle |
| --- | --- | --- |
| Pays et ville d'origine | Oui | Origine structurée du trajet |
| Pays et ville de destination | Oui | Destination structurée du trajet |
| Services disponibles | Oui, au moins un | Services actifs proposés sur la route |
| Nom personnalisé | Non | Libellé pratique de la route |

Une route peut proposer plusieurs services et un service peut être proposé sur
plusieurs routes. Cette relation est plusieurs-à-plusieurs ; il ne faut pas
créer une route identique par service.

Les services proposés dans le formulaire viennent du référentiel de
l'organisation. Les origines et destinations sont structurées pour éviter des
variantes textuelles d'un même lieu.

### Route et bureau

Une origine ou une destination commerciale n'est pas nécessairement un bureau
physique. Slaivio ne crée donc jamais automatiquement un bureau à partir d'une
route. Si un bureau réel de dépôt ou de retrait existe et a été configuré, il
peut être associé à la route comme information complémentaire.

### Cycle de vie et frontières de modules

| Élément | Domaine responsable |
| --- | --- |
| Service et route configurés | Module-09 — Organisation |
| Tarif publié applicable | Module-08 — Tarification |
| Expédition, départ réel ou prévu | Module-04 — Expéditions & Départs |

Une route ou un service désactivé n'est plus proposé pour les nouvelles
opérations. Les colis, tarifs historiques et expéditions associés restent
consultables. Désactiver une route ne supprime ni son historique ni celui de
ses services.

## Décisions fonctionnelles

- Le Module-09 est le référentiel central des bureaux, services et routes de
  l'agence.
- Les agences choisissent librement leurs services et leurs noms commerciaux.
- Un nom de service ne détermine pas à lui seul le mode de transport.
- Les routes et les services sont associés plusieurs-à-plusieurs.
- Une route ne fixe pas de tarif et ne garantit pas un départ.
- Une route ne constitue pas la preuve d'une implantation physique.
- Le nombre des modules métier reste inchangé ; aucun Module-12 n'est créé.
- Les opérations historiques sont conservées lors des désactivations et
  changements de configuration.

## Suivi de réalisation

Le statut fonctionnel ci-dessous reprend la décision de cadrage :

| Section | Statut fonctionnel |
| --- | --- |
| 09.01 — Organisation et bureaux | Terminé |
| 09.02 — Configuration des bureaux | Terminé |
| 09.03 — Gestion multi-pays | Terminé |
| 09.04 — Services | Implémenté dans le catalogue partagé ; contrôle en attente après migration |
| 09.05 — Routes | Implémenté avec associations multiples et extrémités sans bureau obligatoire |

La relation canonique entre services et routes est `service_route_offerings`.
Le champ historique `shipping_services.route_id` reste renseigné lorsqu'il est
vide afin de maintenir la compatibilité des anciens lecteurs, mais ne constitue
pas la source de vérité de l'association. Les routes sont créées à partir de
pays et villes ; le rattachement à un bureau physique est facultatif et vérifié
contre son organisation, son pays et sa ville. Les doublons de liaison
réutilisent la route existante et y associent les services sélectionnés.

Les services créés depuis le catalogue démarrent actifs, conformément à la
décision 09.04. Leur nom commercial reste indépendant du mode de transport.
Les offres de routes expirées, suspendues ou rattachées à un service inactif ne
sont pas proposées à de nouvelles opérations ; les lignes historiques restent
conservées.

Le statut d'implémentation ne vaut pas certification en production : la
migration `131_module_09_service_route_offerings` doit être appliquée avant le
déploiement des changements API.

### Emplacement dans l'interface

La navigation de l'agence expose un seul point d'entrée « Paramètres » pour la
configuration organisationnelle. Les bureaux et implantations se gèrent dans
les paramètres d'organisation ; Services et Routes sont des sections dédiées
des paramètres, présentées sous forme de fiches de configuration plutôt que
comme des modules opérationnels ou des tableaux génériques. Les formulaires
des routes utilisent des pays et villes structurés et exigent au moins un
service actif. « Opérations » reste consacré aux colis, aux départs et aux
expéditions ; l'entrepôt reste un lieu d'exécution et de stockage. La
tarification demeure dans son domaine dédié (Module-08).

À la réception d'un colis, l'agent choisit un service puis une route associée à
ce service. Cette sélection repose sur l'association plusieurs-à-plusieurs
active du référentiel, et non sur le champ historique unique
`shipping_services.route_id`. L'API vérifie à nouveau l'organisation, l'état du
service, de la route et de leur association avant d'enregistrer le colis.

### Vérifications techniques restantes

- Appliquer puis valider les migrations `129_organization_offices_canonical`,
  `130_organization_membership_office_access` et
  `131_module_09_service_route_offerings` dans les environnements prévus.
- Raccorder et tester le contrôle du périmètre bureau dans les expéditions,
  entrepôts, lots, départs, CRM, tracking, finance et communications selon
  leurs rattachements réels.
- Vérifier les opérations historiques sans bureau ainsi que les opérations
  reliées à plusieurs bureaux.
- Tester l'isolation en changeant d'organisation, d'identifiant de bureau,
  d'URL et de filtre, y compris après désactivation d'un bureau.
- Vérifier que les snapshots et documents qui doivent conserver un contexte
  historique ne sont pas altérés par les changements ultérieurs de fiche.

## Prochaine vérification produit

La prochaine revue fonctionnelle porte sur la réception et les opérations
physiques des colis : stockage, localisation, scans, photos, transferts entre
implantations et historique des mouvements. Elle complète le Module-03 Colis ;
elle ne crée pas automatiquement un module Entrepôts.
