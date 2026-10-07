MODULE-02 — CLIENTS / CRM
02.01 — Customer Directory / Vue « Clients »
Cette page est le point d’entrée du CRM. Son objectif n’est pas de tout montrer : elle doit permettre à un agent de retrouver rapidement un client, comprendre son contexte immédiat et ouvrir sa fiche.
Elle ne doit pas dupliquer les modules Colis, Finance ou Communication.

A. Architecture générale de l'écran
Sur desktop :
┌─────────────────────────────────────────────────────────────────────────────┐
│ Clients                                                   [+ Nouveau client]│
│ Retrouvez et gérez les clients de votre organisation.                      │
│                                                                             │
│ [ 🔎 Rechercher par nom, téléphone ou référence...              ]           │
│                                                                             │
│ [Tous les clients]  [Entreprises]                       [Filtres] [•••]      │
│                                                                             │
│ □  CLIENT               TÉLÉPHONE       BUREAU        ACTIVITÉ        •••   │
│ ─────────────────────────────────────────────────────────────────────────── │
│ □  Jean Mukendi         +243 81...      Kinshasa      Aujourd'hui      •••  │
│ □  Sarah Traoré         +226 70...      Ouaga         Hier             •••  │
│ □  Kivu Market SARL     +243 99...      Goma          03 oct.          •••  │
│                                                                             │
│                                                   1–50 sur 2 438    <  >    │
└─────────────────────────────────────────────────────────────────────────────┘

Pas de KPI financiers ou opérationnels imposants ici. Ils appartiennent au Dashboard ou à la fiche du client.

B. Page Header
Titre
Clients

Description
Retrouvez et gérez les clients de votre organisation.

Action principale
+ Nouveau client

Une seule action primaire visuellement dominante.
Importer, exporter, gérer les colonnes, etc. ne doivent pas concurrencer Nouveau client.
Ils peuvent être placés dans :
[•••]

Importer des clients
Exporter
Gérer les colonnes

avec affichage conditionné par les permissions.

C. Recherche principale
🔎 Rechercher par nom, téléphone ou référence...

Recherche supportée
Pour la V1 structurelle de cette page, trois identifiants ont une justification claire :
Nom — l'agent connaît le client.
Téléphone — extrêmement important dans un environnement où WhatsApp est utilisé.
Référence client — identifiant interne Slaivio.
Exemple :
Jean Mukendi

ou :
+243812345678

ou :
CLI-001842

Important
On ne met pas :
Rechercher par nom, téléphone, WhatsApp, email, adresse, colis, facture, entreprise...
simplement pour donner l'impression que la recherche est puissante.
La recherche CRM et la recherche globale de Slaivio sont deux choses différentes.

D. Normalisation du téléphone
La recherche doit comprendre que :
0812345678
+243812345678
00243812345678

peuvent représenter le même numéro selon le contexte et les règles de normalisation.
Dans l'interface, on affiche une forme lisible :
+243 812 345 678

Le backend conserve une représentation normalisée appropriée.
C'est important pour le CRM et pour le rapprochement avec les conversations WhatsApp.

E. Vues principales
Je réduis fortement ce que j'avais proposé précédemment.
Pas besoin de :
Tous
Actifs
Prospects
VIP
Avec solde
Avec colis
...

comme onglets permanents.
La navigation principale peut commencer avec :
[Tous les clients]    [Entreprises]

Tous les clients
Personnes et organisations accessibles à l'utilisateur.
Entreprises
Affiche les comptes entreprise.
Les autres besoins passent par les filtres ou les vues enregistrées si nous décidons plus tard qu'elles sont réellement nécessaires.

F. Table principale
Il faut être strict sur les colonnes par défaut.
Colonnes de base
Colonne
Justification
Client
Identité principale
Téléphone
Contact et recherche
Bureau
Nécessaire dans une organisation multi-bureaux
Dernière activité
Permet de comprendre si la relation est récente
•••
Actions secondaires

Donc :
□ CLIENT              TÉLÉPHONE          BUREAU             ACTIVITÉ       •••
──────────────────────────────────────────────────────────────────────────────
  Jean Mukendi        +243 812...        Kinshasa           Aujourd'hui     •••

  Sarah Traoré        +226 700...        Ouagadougou        Hier            •••

  Kivu Market SARL    +243 998...        Goma               03 oct.         •••


G. Ce qu'on ne met PAS par défaut
Je retire de ma précédente proposition :
Solde
Crédit
Colis actifs
Dernière expédition
Segment
Tags
Responsable
Pays
Statut financier

de la table par défaut.
Ce ne sont pas nécessairement de mauvaises données.
Le problème est qu'elles ne doivent pas toutes être imposées à chaque agence et à chaque utilisateur.
Par exemple, le solde appartient d'abord au domaine Finance. Il pourra être ajouté comme colonne si le rôle et la configuration le justifient.

H. Colonne « Client »
C'est plus qu'un simple nom.
Pour une personne :
Jean Mukendi
CLI-001842

Pour une entreprise :
LUZA SERVICES
Entreprise

Éventuellement avec un avatar initial :
JM   Jean Mukendi

ou logo d'entreprise lorsqu'il existe.
Mais le logo n'est jamais requis pour créer une entreprise.

I. Téléphone
Une seule colonne :
Téléphone

Exemple :
+226 70 12 34 56

Si ce numéro est associé à WhatsApp dans le contexte Slaivio, on peut afficher discrètement l'indication correspondante.
Pas de :
Téléphone       WhatsApp
+226...         +226...

avec deux colonnes contenant la même information.

J. Bureau
C'est ici que le retour terrain Burkina devient important.
L'entreprise peut avoir :
Burkina Faso
├── Ouagadougou
└── Bobo-Dioulasso

La table peut donc afficher :
Sarah Traoré       +226...       Ouagadougou

Pour une organisation qui n'a qu'un seul bureau, cette colonne peut être masquée automatiquement ou retirée de la vue.
Slaivio ne doit pas gaspiller une colonne pour afficher la même valeur sur 2 000 lignes.

K. Dernière activité
Aujourd'hui, 10:42

ou :
Hier

ou :
28 sept. 2026

Cette valeur est calculée, pas saisie.
Elle provient des événements pertinents liés au client.
On ne demande donc jamais :
Dernière activité : [________]

dans un formulaire.

L. Gestion des colonnes
Dans :
••• → Gérer les colonnes

on peut proposer les colonnes réellement disponibles selon les modules activés.
Par exemple :
Colonnes affichées

☑ Client
☑ Téléphone
☑ Bureau
☑ Dernière activité

☐ E-mail
☐ Date de création
☐ Responsable

Puis, lorsque Finance est disponible et que l'utilisateur a les permissions correspondantes :
☐ Solde ouvert

Lorsque les opérations Cargo sont disponibles :
☐ Colis actifs

Ainsi, le CRM reste propre sans empêcher une agence d'avoir une vue plus opérationnelle.

M. Filtres
Bouton :
[Filtres]

ouvre un panneau latéral.
Base raisonnable :
Filtres

Type
[ Tous ▼ ]

Bureau
[ Tous ▼ ]

Date de création
[ Toutes les dates ▼ ]

                         [Réinitialiser] [Appliquer]

Les filtres supplémentaires peuvent apparaître selon les fonctionnalités réellement activées.
Type
Tous
Particulier
Entreprise

Bureau
Seulement pertinent si plusieurs bureaux existent.
Exemple :
Tous les bureaux
Ouagadougou
Bobo-Dioulasso


N. Pays ≠ Bureau
Il faut éviter une autre erreur d'architecture.
Pour l'agence Burkina :
Pays : Burkina Faso

Bureaux :
- Ouagadougou
- Bobo-Dioulasso

Pour LUZA, la structure peut être plus large :
Organisation
├── RDC
│   └── ...
├── Angola
│   └── ...
├── Belgique
│   └── ...
└── Chine
    └── ...

Si l'organisation travaille dans plusieurs pays, un filtre de portée géographique peut devenir pertinent.
Mais nous ne l'imposons pas à l'agence qui travaille uniquement au Burkina.

O. Sélection multiple
La checkbox sert uniquement si nous avons de vraies actions groupées.
☑ 12 clients sélectionnés

[Assigner] [Exporter] [•••]

Mais on ne doit pas inventer quinze bulk actions.
Les opérations destructrices ou financières ne doivent pas devenir triviales parce que plusieurs lignes sont sélectionnées.

P. Menu de ligne
Jean Mukendi                                    •••

Le clic sur la ligne ouvre la fiche client.
••• contient uniquement les raccourcis secondaires pertinents :
Ouvrir
Modifier
Archiver

Les actions métier comme Créer un colis seront beaucoup plus pertinentes dans Customer 360, où l'utilisateur dispose du contexte complet.

Q. Pagination
Pour une plateforme destinée à grandir :
1–50 sur 2 438                     ‹    ›

On ne charge pas 2 438 clients dans le navigateur pour ensuite les filtrer côté frontend.
Recherche, filtres, tri et pagination doivent être pensés côté serveur.

R. Tri
Cliquer sur les colonnes compatibles :
CLIENT ↑

ou :
ACTIVITÉ ↓

Les tris disponibles doivent correspondre aux données réellement indexables.
Pas de tri artificiel sur chaque colonne simplement parce qu'un composant UI le permet.

S. Empty State — aucune donnée
Une nouvelle agence ne doit pas voir :
0 résultats

dans une énorme table vide.
Elle voit :
                    Clients

          Aucun client pour le moment.

Ajoutez votre premier client ou importez votre
base existante pour commencer.

       [+ Nouveau client]    [Importer]


T. Aucun résultat de recherche
C'est différent de « aucun client ».
Aucun client trouvé pour "Mukendii"

Vérifiez votre recherche ou modifiez les filtres.

[Effacer les filtres]

On ne propose pas automatiquement de créer le client à chaque recherche ratée : une faute de frappe ne signifie pas qu'un nouveau client doit être créé.

U. Loading State
Le layout reste stable :
████████████       ██████████       ███████
████████           █████████        ███████
████████████       ██████████       ███████

Skeleton rows.
Pas de disparition complète de la table suivie d'un spinner géant à chaque filtre.

V. Error State
Impossible de charger les clients.

Aucune modification n'a été effectuée.

[Réessayer]

Et les détails techniques vont dans les logs, pas devant l'agent :
HTTP 500
PostgreSQL timeout...

ne doit pas être l'expérience utilisateur.

W. Permissions
La page elle-même change selon les droits.
Agent autorisé à consulter
Clients
[Recherche]
[Filters]

Il ne voit pas nécessairement :
+ Nouveau client
Importer
Exporter
Archiver

Manager
Peut éventuellement avoir :
Créer
Modifier
Importer
Exporter

Direction
Peut disposer d'un scope organisationnel plus large.
Le RBAC exact sera traité dans le module Équipe & Permissions.

X. Scope organisationnel
C'est important pour LUZA et les futures grandes agences.
Un agent basé à Bobo peut avoir :
Clients
Bobo-Dioulasso

La direction :
Clients
Toute l'organisation

Le scope ne doit pas seulement être un filtre esthétique.
Le serveur ne retourne que les données auxquelles l'utilisateur a accès.

Y. Mobile
La table devient des lignes/cartes compactes.
Clients                       +

[ 🔎 Rechercher... ]

[Filtres]

────────────────────────────

Jean Mukendi
+243 812 345 678

Kinshasa
Activité : aujourd'hui

────────────────────────────

Sarah Traoré
+226 70 12 34 56

Ouagadougou
Activité : hier

────────────────────────────

On ne force jamais :
← CLIENT | PHONE | OFFICE | ACTIVITY →

dans une table desktop réduite sur 360 px.

Z. Résultat final de 02.01
L'écran officiel peut donc être résumé ainsi :
CLIENTS
│
├── Page Header
│   ├── Titre
│   └── Nouveau client
│
├── Search
│   ├── Nom
│   ├── Téléphone
│   └── Référence
│
├── Views
│   ├── Tous les clients
│   └── Entreprises
│
├── Filters
│   ├── Type
│   ├── Bureau
│   └── Date de création
│
├── Customer Table
│   ├── Client
│   ├── Téléphone
│   ├── Bureau
│   ├── Dernière activité
│   └── Actions
│
├── Column Management
├── Sorting
├── Pagination
│
├── Empty State
├── No Results
├── Loading
├── Error
│
├── Permissions
├── Organizational Scope
│
└── Responsive

Principe officiel de CRM-02.01
La liste Clients sert à trouver et ouvrir un client. Elle ne doit pas devenir un tableau de bord miniature.
Les données détaillées sur ses colis, ses paiements, ses factures, ses conversations et son historique appartiennent à la Customer 360, tandis que leurs sources de vérité restent leurs modules métier respectifs.
La prochaine section est 02.02 — Création d'un client, où il faudra être encore plus strict : champs exacts, obligatoire/optionnel, particulier/entreprise, validation du téléphone, doublons et comportement après création, sans ajouter de champs hypothétiques.

___________________


MODULE-02 — CLIENTS / CRM
02.02 — Création d’un client
Ici, l’objectif est simple : un agent doit pouvoir enregistrer correctement un client en quelques secondes, sans remplir un formulaire administratif inutile.
Le reste des informations doit apparaître seulement lorsqu’il existe une raison métier de les demander.

A. Point d’entrée
Depuis :
Clients                                      [+ Nouveau client]

Clic sur Nouveau client.
Sur desktop, je recommande un drawer latéral plutôt qu’une nouvelle page.
┌───────────────────────────────┐
│ Nouveau client             ×  │
│                               │
│ Type                          │
│ ● Particulier   ○ Entreprise  │
│                               │
│ Nom complet *                 │
│ [                           ] │
│                               │
│ Téléphone *                   │
│ [🇨🇩 +243 ▼] [              ] │
│                               │
│ Bureau                        │
│ [ Kinshasa               ▼ ] │
│                               │
│ Informations supplémentaires │
│                               │
│        [Annuler] [Créer]      │
└───────────────────────────────┘

Le drawer permet de créer le client sans perdre l’écran depuis lequel l’utilisateur travaille.

B. Première décision : type de client
En haut :
Type de client *

(●) Particulier
( ) Entreprise

Cette décision change réellement la structure des données.
Il ne s’agit donc pas d’un simple tag.

C. Création — Particulier
Formulaire principal :
Nouveau client

Type
● Particulier     ○ Entreprise


Nom complet *
[________________________________]


Téléphone *
[🇨🇩 +243 ▼] [__________________]


Bureau
[Kinshasa                         ▼]


▸ Informations supplémentaires


                    [Annuler] [Créer le client]

C’est volontairement court.

D. Nom du client
Champ :
Nom complet *
[ Jean Mukendi                         ]

Je préfère ici Nom complet plutôt que d’imposer immédiatement :
Prénom
Deuxième prénom
Nom
Postnom

car les conventions de nommage varient entre les pays où Slaivio opérera.
L’interface internationale ne doit pas être conçue uniquement autour d’une convention occidentale ou congolaise.
La structure plus fine pourra être ajoutée lorsqu’un besoin métier réel l’exige.

E. Téléphone
Téléphone *

[ 🇧🇫 +226 ▼ ] [ 70 12 34 56            ]

Un seul champ de numéro.
Pas :
Téléphone
WhatsApp

par défaut.
Le téléphone constitue le moyen de contact.
WhatsApp est un canal associé à ce numéro lorsque disponible.

F. Sélecteur international
Le sélecteur permet :
🇧🇫 Burkina Faso        +226
🇨🇩 RDC                 +243
🇨🇲 Cameroun            +237
🇨🇮 Côte d'Ivoire       +225
🇬🇭 Ghana               +233
...

La liste doit être recherchable.
Exemple :
[ 🔎 Congo ]

🇨🇩 République démocratique du Congo    +243
🇨🇬 République du Congo                 +242

On évite les ambiguïtés.

G. Validation du numéro
Slaivio doit normaliser le numéro avant stockage.
L'utilisateur saisit par exemple :
081 234 5678

avec :
🇨🇩 +243

Le système construit la représentation normalisée appropriée.
Si le numéro est manifestement invalide :
Téléphone *

[🇨🇩 +243] [8123]

⚠ Vérifiez ce numéro de téléphone.

On ne laisse pas l'utilisateur découvrir l'erreur après avoir essayé d'envoyer une notification.

H. WhatsApp
Aucun champ WhatsApp supplémentaire dans ce formulaire.
Après intégration avec le canal, Slaivio peut présenter dans la fiche :
Téléphone

+243 812 345 678

WhatsApp
Canal disponible

Si une conversation WhatsApp avec ce numéro existe déjà, elle peut être rattachée à l'identité client.
C'est une relation système, pas une donnée que l'agent doit ressaisir.

I. Bureau
Bureau
[ Ouagadougou ▼ ]

Le champ dépend de la structure de l'organisation.
Agence avec un seul bureau
Si l'organisation n'a que :
Ouagadougou

et que le contexte permet de le déterminer sans ambiguïté, Slaivio peut l'affecter automatiquement.
Inutile de demander :
Sélectionnez Ouagadougou
à chaque création.
Agence avec deux bureaux
Pour le prospect Burkina :
Bureau

[ Sélectionner ▼ ]

Ouagadougou
Bobo-Dioulasso

Employé limité à Bobo
Si son scope est exclusivement :
Burkina Faso / Bobo-Dioulasso

Slaivio préremplit :
Bureau
Bobo-Dioulasso

sans lui proposer des bureaux auxquels il n'a pas accès.

J. Le pays ne doit pas être demandé inutilement
C'est une correction importante.
Si l'agence fonctionne uniquement au Burkina Faso et que le bureau sélectionné est :
Ouagadougou

nous connaissons déjà :
Pays = Burkina Faso

Demander encore :
Pays *
[Burkina Faso]

est redondant.
Le pays peut être dérivé du bureau lorsque la structure organisationnelle le permet.

K. Informations supplémentaires
Le formulaire principal doit rester court.
Un accordéon :
▸ Informations supplémentaires

peut révéler uniquement des coordonnées réellement pertinentes.
Par exemple :
▾ Informations supplémentaires

E-mail
[________________________________]

Adresse
[________________________________]

Ces champs ne sont pas obligatoires pour enregistrer un client Cargo si le workflow n'en a pas besoin.

L. Ce que nous ne mettons PAS à la création
On ne demande pas :
Nombre de colis
Solde
Montant payé
Crédit utilisé
Dernière expédition
Dernière activité
Nombre de conversations
Date du dernier paiement
Statut WhatsApp

Toutes ces informations sont dérivées du système.
Et nous ne demandons pas non plus arbitrairement :
VIP
Segment
Score client
Niveau de risque
Client fidèle

tant que nous n'avons pas défini un véritable modèle métier pour ces notions.

M. Référence client
L'agent ne la saisit pas.
À la création :
Créer le client
       ↓
Slaivio
       ↓
CLI-001842

La référence est générée par le système.
Elle doit être unique dans le scope défini par notre architecture.
L'identifiant technique interne reste distinct de cette référence lisible.

N. Vérification des doublons
C'est essentiel.
Lorsque l'agent renseigne :
+226 70 12 34 56

Slaivio vérifie s'il existe déjà une identité correspondante accessible dans l'organisation.
Si oui :
┌─────────────────────────────────────┐
│ Client existant possible            │
│                                     │
│ Sarah Traoré                        │
│ +226 70 12 34 56                    │
│ Ouagadougou                         │
│                                     │
│ [Ouvrir la fiche]                   │
└─────────────────────────────────────┘

Le but est d'éviter :
Sarah Traoré
Sarah T.
Mme Traoré
Sarah

devenant quatre clients à cause de quatre opérations différentes.

O. Le nom seul ne doit pas bloquer
Deux personnes peuvent s'appeler :
Jean Mukendi

Le système peut signaler une correspondance potentielle, mais ne doit pas considérer automatiquement qu'il s'agit de la même personne.
Le numéro constitue ici un signal d'identification beaucoup plus utile.

P. Cas : numéro déjà présent dans WhatsApp
Scénario important pour Slaivio :
Client écrit à l'agence sur WhatsApp
          ↓
Conversation existe
          ↓
Numéro connu par Slaivio
          ↓
Agent crée ensuite le client

Lorsqu'il saisit le même numéro :
+226 70 12 34 56

Slaivio peut indiquer :
Conversation existante trouvée

Ce numéro possède déjà une conversation WhatsApp
avec votre agence.

La conversation sera associée au client.

Puis :
[Créer le client]

Après création :
Client
Sarah Traoré
       │
       └── Conversation WhatsApp existante

On ne crée pas une deuxième conversation.

Q. Création depuis WhatsApp
L'inverse doit fonctionner.
Dans Inbox :
+226 70 12 34 56
Client non enregistré

[Créer un client]

Clic :
Nouveau client

Téléphone
+226 70 12 34 56     ← prérempli

Nom complet *
[_________________]

Bureau
[Ouagadougou ▼]

[Créer]

Le téléphone n'est pas ressaisi.

R. Création depuis Colis
Même principe.
Agent enregistre un colis :
Client
[ Rechercher... ]

Le client n'existe pas :
Aucun client trouvé

+ Nouveau client

Le mini-workflow s'ouvre sans perdre le colis en cours.
Une fois créé :
Client
Jean Mukendi
CLI-001842 ✓

est automatiquement sélectionné dans le formulaire du colis.

S. Entreprise
Si :
○ Particulier
● Entreprise

le formulaire change.
Nouvelle entreprise


Nom de l'entreprise *
[ LUZA SERVICES                     ]


Téléphone
[🇨🇩 +243 ▼] [____________________]


Bureau
[ Kinshasa                         ▼]


▸ Informations supplémentaires


                 [Annuler] [Créer l'entreprise]

Ici, Nom complet disparaît.
On demande :
Nom de l'entreprise


T. Contact d'une entreprise
Il ne faut surtout pas faire :
Entreprise : LUZA SERVICES
Téléphone : numéro de M. X
Nom : LUZA SERVICES

et mélanger organisation et personne.
Après création de l'entreprise, sa fiche pourra permettre :
Contacts

+ Ajouter un contact

Puis :
Ajouter un contact

Nom complet *
[ Jean Mukendi ]

Téléphone
[ +243 ... ]

E-mail
[ ...]

Fonction
[ ...]

□ Contact principal

[Ajouter]

La notion Fonction est pertinente ici parce qu'elle décrit la relation de cette personne avec l'entreprise.

U. Téléphone d'entreprise vs téléphone du contact
Exemple :
LUZA SERVICES

Téléphone entreprise
+243 800 000 000

Contacts
──────────────────────────

Patrick
Responsable opérations
+243 811 111 111

Sarah
Comptabilité
+243 822 222 222

Ce sont trois coordonnées différentes.
Slaivio doit savoir à quelle entité appartient chaque numéro.
C'est beaucoup plus propre que d'avoir une série de champs :
Téléphone 1
Téléphone 2
WhatsApp
WhatsApp 2


V. Création réussie
Après :
[Créer le client]

Slaivio confirme :
✓ Client créé

Puis ouvre directement la fiche :
Jean Mukendi
CLI-001842

Pas besoin d'une page intermédiaire :
Félicitations ! Votre client a été créé.
L'utilisateur travaille ; il faut l'amener directement à la prochaine action utile.

W. Échec de création
Si la requête échoue :
Impossible de créer le client.

Vos informations n'ont pas été perdues.

[Réessayer]

Le formulaire reste rempli.
Une erreur serveur ne doit jamais forcer l'agent à retaper le nom et le téléphone.

X. Double clic / réseau lent
Cas très important dans notre contexte Africa-first.
L'utilisateur clique :
Créer le client

plusieurs fois parce que le réseau semble lent.
Cela ne doit jamais produire :
CLI-001842 Jean Mukendi
CLI-001843 Jean Mukendi
CLI-001844 Jean Mukendi

L'opération de création doit être protégée contre les soumissions multiples, avec une logique d'idempotence appropriée.
Interface :
[Création...]

Le bouton devient temporairement indisponible pendant la requête active.

Y. Création hors connexion
Il faut être prudent avec notre principe offline-first.
Si Slaivio ne peut pas garantir immédiatement :
unicité ;
contrôle des doublons ;
génération serveur ;
permissions ;
synchronisation correcte,
il ne doit pas afficher :
✓ Client créé

comme si le serveur avait confirmé.
Il peut afficher, si cette capacité est effectivement implémentée :
En attente de synchronisation

avec un état distinct.
Nous définirons le moteur offline séparément.

Z. Permissions
Trois capacités différentes :
Voir les clients
Créer des clients
Modifier des clients

Un utilisateur qui peut consulter un client n'obtient pas automatiquement le droit d'en créer.
Si l'utilisateur n'a pas :
customer.create

le bouton :
+ Nouveau client

n'apparaît simplement pas.
Et l'API applique la même règle.

02.02 — Modèle final du formulaire
Particulier
┌─────────────────────────────────────────┐
│ Nouveau client                       ×  │
│                                         │
│ Type                                    │
│ ● Particulier       ○ Entreprise        │
│                                         │
│ Nom complet *                           │
│ [____________________________________]  │
│                                         │
│ Téléphone *                             │
│ [+243 ▼] [___________________________]  │
│                                         │
│ Bureau                                  │
│ [Kinshasa                           ▼]  │
│                                         │
│ ▸ Informations supplémentaires          │
│                                         │
│                     [Annuler] [Créer]   │
└─────────────────────────────────────────┘

Entreprise
┌─────────────────────────────────────────┐
│ Nouvelle entreprise                  ×  │
│                                         │
│ Type                                    │
│ ○ Particulier       ● Entreprise        │
│                                         │
│ Nom de l'entreprise *                   │
│ [____________________________________]  │
│                                         │
│ Téléphone                               │
│ [+243 ▼] [___________________________]  │
│                                         │
│ Bureau                                  │
│ [Kinshasa                           ▼]  │
│                                         │
│ ▸ Informations supplémentaires          │
│                                         │
│                     [Annuler] [Créer]   │
└─────────────────────────────────────────┘

Données et provenance
Information
Saisie
Générée/Dérivée
Type client
✓


Nom
✓


Téléphone
✓ pour particulier


Bureau
✓ si nécessaire
contexte possible
Pays


depuis le bureau lorsque possible
E-mail
optionnel


Adresse
optionnel


Référence client


✓
WhatsApp disponible


✓ via canal/intégration
Colis actifs


✓ module Colis
Solde


✓ Finance
Dernière activité


✓ événements
Date de création


✓ système
Créé par


✓ système

Principe officiel — 02.02
Slaivio demande uniquement les informations nécessaires pour identifier et rattacher correctement le client. Tout ce que la plateforme peut connaître à partir du contexte, des opérations ou de ses autres modules doit être dérivé plutôt que redemandé à l'utilisateur.
C'est cette logique qui nous donne une expérience digne d'un SaaS mature : moins de saisie, moins de doublons, meilleure qualité des données.
02.02 est donc la création. La prochaine brique logique est 02.03 — Customer 360 / Fiche client, qui sera l'écran central où l'agence retrouve tout ce qu'elle doit savoir sur un client sans mélanger les responsabilités de Colis, Finance, Expéditions et WhatsApp.
________________



MODULE-02 — CLIENTS / CRM
02.03 — Fiche client / Customer 360
On reprend complètement 02.03 avec la correction fondamentale :
Dans Slaivio Cargo, le client est directement lié à ses colis. Il n'existe pas de couche “Dossier” entre les deux.
La structure métier est donc :
CLIENT
   │
   ├── COLIS
   │
   ├── EXPÉDITIONS
   │
   ├── FINANCE
   │
   ├── COMMUNICATIONS
   │
   └── ACTIVITÉ

La fiche client doit permettre à l'agence de répondre rapidement à : qui est ce client, quels sont ses colis, où en sont-ils, quelle est sa situation financière et quelles communications ont eu lieu ?

A. Structure générale
Lorsqu'un agent ouvre un client :
← Clients

Jean Mukendi                                      [•••]
CLI-001842
+243 812 345 678
Bureau : Kinshasa

[Message]                           [+ Enregistrer un colis]

──────────────────────────────────────────────────────────

Aperçu    Colis    Expéditions    Finance
Communications    Activité

Six espaces suffisent :
Aperçu · Colis · Expéditions · Finance · Communications · Activité
Pas de Dossiers.

B. En-tête du client
L'en-tête reste volontairement compact :
Jean Mukendi
CLI-001842

+243 812 345 678
Bureau : Kinshasa

On y trouve uniquement l'identité et les informations nécessaires pour reconnaître le client.
Pas de :
VIP
Score : 87 %
3 factures
17 colis
Excellent client
Risque faible

Nous n'inventons aucun indicateur.

C. Référence client
CLI-001842

Elle est générée automatiquement par Slaivio.
L'utilisateur ne doit pas avoir à saisir manuellement :
Référence client : [________]

La référence sert notamment à retrouver et distinguer les clients.
L'identifiant technique de base de données reste séparé.

D. Téléphone et WhatsApp
On conserve la règle établie.
Téléphone
+243 812 345 678

Si ce numéro est utilisé sur WhatsApp :
+243 812 345 678
WhatsApp

Pas :
Téléphone : +243 812 345 678
WhatsApp   : +243 812 345 678

WhatsApp est un canal associé au numéro, pas une information identitaire à dupliquer.

E. Actions principales
Deux actions ont une justification directe dans le workflow Cargo :
[Message]       [+ Enregistrer un colis]

Message
Ouvre la communication avec ce client.
Enregistrer un colis
Lance le workflow du module Colis avec le client déjà sélectionné.
Donc :
Jean Mukendi
     │
     │ + Enregistrer un colis
     ▼
Nouveau colis

Client
Jean Mukendi ✓

L'agent ne recherche pas à nouveau le client.

F. Aperçu
L'onglet Aperçu doit rester une synthèse.
APERÇU

┌──────────────────────────────────┐
│ Informations                     │
│                                  │
│ Téléphone    +243 812 345 678    │
│ Bureau       Kinshasa            │
│ E-mail       jean@email.com      │
└──────────────────────────────────┘


COLIS EN COURS

SLV-29382
En transit
                           >

SLV-29411
Reçu
                           >

                    Voir tous →


FINANCE

Montant à payer
126 USD

                    Voir Finance →


ACTIVITÉ RÉCENTE

Aujourd'hui · 10:42
Colis SLV-29382 mis à jour

Aujourd'hui · 09:31
Notification envoyée

5 oct. · 16:21
Paiement enregistré

                 Voir toute l'activité →

Les blocs doivent rester courts.

G. Informations
La première carte contient uniquement les informations appartenant réellement au CRM.
Informations

Téléphone
+243 812 345 678

Bureau
Kinshasa

E-mail
jean@email.com

Adresse
...

Les champs qui n'ont jamais été renseignés ne doivent pas nécessairement occuper l'écran avec des —.
On peut avoir :
Informations

Téléphone
+243 812 345 678

Bureau
Kinshasa

[Ajouter des informations]


H. Modification
Depuis :
[•••]

l'utilisateur autorisé peut sélectionner :
Modifier le client

Le même formulaire que 02.02 est réutilisé :
Modifier le client

Nom complet *
[Jean Mukendi]

Téléphone *
[+243 ▼] [812 345 678]

Bureau
[Kinshasa ▼]

▸ Informations supplémentaires

             [Annuler] [Enregistrer]

Nous ne créons pas un deuxième système de formulaire.

I. Colis en cours dans Aperçu
C'est probablement l'information opérationnelle la plus importante de la fiche d'une agence Cargo.
Exemple :
Colis en cours

SLV-29382
En transit

SLV-29411
Reçu en Chine

SLV-29502
Arrivé

[Voir tous les colis]

Mais ces statuts appartiennent au MODULE Colis.
Customer 360 ne maintient aucune copie de ces données.

J. Onglet Colis
C'est ici que l'on retrouve les colis appartenant au client.
Colis                                      [+ Enregistrer un colis]

[🔎 Rechercher...]

Référence          Statut             Dernière mise à jour
───────────────────────────────────────────────────────────
SLV-29382          En transit         Aujourd'hui
SLV-29411          Reçu               Hier
SLV-29102          Livré              28 sept.

Les colonnes exactes seront définies lorsque nous construirons le MODULE Colis.
Il ne faut donc pas inventer ici poids, CBM, transporteur, conteneur, douane, ETA, etc.
Customer 360 réutilisera la structure définie par le module Colis.

K. Ouverture d'un colis
Clic sur :
SLV-29382

ouvre :
MODULE COLIS
      ↓
SLV-29382

On quitte le contexte Customer 360 pour entrer dans l'objet opérationnel.
Un fil d'Ariane peut permettre :
Clients > Jean Mukendi > SLV-29382

et donc revenir facilement au client.

L. Relation Client → Colis
C'est désormais une relation fondamentale de Slaivio :
Jean Mukendi
     │
     ├── SLV-29382
     ├── SLV-29411
     ├── SLV-29502
     └── SLV-28843

Chaque colis possède son client.
Un client peut posséder plusieurs colis.
Pas besoin de :
Client
   ↓
Dossier
   ↓
Colis


M. Expéditions
L'onglet suivant est :
Expéditions

Pourquoi ?
Parce que plusieurs colis du client peuvent participer à différents départs/expéditions.
Exemple conceptuel :
Jean Mukendi
   │
   ├── Colis A ────┐
   │                ├── Expédition EXP-0048
   ├── Colis B ────┘
   │
   └── Colis C ─────── Expédition EXP-0051

La fiche peut donc montrer les expéditions concernant ce client.

N. Onglet Expéditions
Exemple simple :
Expéditions

EXP-0048
Chine → RDC
En transit

2 colis

────────────────────────

EXP-0051
Chine → RDC
Arrivée

1 colis

Mais, là encore, la définition exacte d'une expédition appartient au MODULE Expéditions.
CRM ne gère ni manifeste, ni départ, ni arrivée.
Il donne accès aux expéditions concernant le client.

O. Finance
Le besoin est confirmé par les agences interrogées : savoir ce qu'un client doit payer et enregistrer les paiements fait partie du fonctionnement Cargo.
Dans Customer 360 :
Finance

Montant à payer

126 USD

Puis :
Factures
Paiements

selon l'architecture exacte que nous construirons dans Finance.

P. Multi-devise
Si le client possède réellement des opérations dans plusieurs devises :
À payer

126 USD
32 000 XOF

on conserve les montants séparés.
Pas :
Total = 178 USD

sans règle de conversion définie.

Q. Onglet Finance
La fiche pourrait présenter :
Finance

À payer
126 USD

─────────────────────────────

Paiements

05 oct. 2026
150 USD

28 sept. 2026
80 USD

Mais les statuts, factures, reçus, paiements partiels, méthodes de paiement et autres règles seront définis dans MODULE Finance.
Nous ne les inventons pas ici.

R. Communications
Onglet :
Communications

Il rassemble le contexte communicationnel lié au client.
Par exemple :
WhatsApp

Jean Mukendi
+243 812 345 678

Dernier message
Aujourd'hui · 10:42

[Ouvrir la conversation]

Customer 360 ne remplace pas l'Inbox.

S. Bouton Message
Clic :
[Message]

Slaivio recherche d'abord si une conversation existe avec le numéro.
Client
   ↓
Numéro
   ↓
Conversation existante ?
   │
   ├── Oui → ouvrir
   │
   └── Non → démarrer selon le canal disponible

Cela évite de multiplier artificiellement les conversations.

T. Notifications automatiques
Les notifications déclenchées par les opérations peuvent également apparaître dans l'historique communicationnel.
Par exemple :
Notifications

Aujourd'hui · 09:31

Colis reçu
WhatsApp
Délivré

ou :
5 oct. · 14:22

Colis expédié
WhatsApp
Délivré

Ce sont les événements réels du système qui produisent ces informations.

U. Activité
Dernier onglet :
Activité

Il répond à une question simple :
Que s'est-il passé récemment avec ce client ?
Exemple :
ACTIVITÉ

Aujourd'hui

10:42
Message reçu

09:31
Colis SLV-29382 mis à jour


5 octobre

16:21
Paiement enregistré

14:03
Colis SLV-29411 enregistré


V. Activité générée automatiquement
L'utilisateur ne saisit pas :
Activité :
[Client a reçu son colis]

La timeline provient des événements des différents modules :
CRM
→ Client créé
→ Coordonnées modifiées

COLIS
→ Colis enregistré
→ Statut modifié

EXPÉDITIONS
→ Colis rattaché à une expédition
→ Départ
→ Arrivée

FINANCE
→ Montant enregistré
→ Paiement reçu

COMMUNICATION
→ Message
→ Notification


W. Pas de journal technique
La timeline n'affiche jamais :
Webhook received
API request 200
Database updated
Queue processed

Ces informations appartiennent aux logs techniques.
L'agent Cargo voit uniquement les événements métier.

X. Entreprise
Si le client est une entreprise :
LUZA SERVICES
CLI-000042
Entreprise

Téléphone
+243...

Bureau
Kinshasa

La différence importante est la possibilité d'avoir plusieurs contacts.

Y. Contacts d'une entreprise
Dans la fiche entreprise :
Contacts

Jean Mukendi
Responsable opérations
+243 81...

Sarah Kabeya
Finance
+243 82...

[+ Ajouter un contact]

On distingue donc clairement :
LUZA SERVICES
      │
      ├── Téléphone entreprise
      │
      ├── Jean Mukendi
      │      └── son téléphone
      │
      └── Sarah Kabeya
             └── son téléphone

Pas de champs absurdes Téléphone 1, Téléphone 2, WhatsApp 1, WhatsApp 2.

Z. Message à une entreprise
Si plusieurs contacts existent et que l'agent clique :
[Message]

Slaivio peut présenter :
Choisir le contact

Jean Mukendi
Responsable opérations
+243...

Sarah Kabeya
Finance
+243...

Le système ne choisit pas arbitrairement la personne.

AA. Bureau principal
Un client peut avoir :
Bureau
Ouagadougou

tout en ayant une opération destinée à :
Bobo-Dioulasso

Cela ne nécessite pas deux clients.
Le bureau du CRM décrit son rattachement principal ; les données opérationnelles restent propres au colis.

AB. Multi-pays
Même principe.
Une entreprise cliente peut avoir des opérations :
Chine → RDC
Belgique → RDC
RDC → Angola

sans être dupliquée trois fois dans Clients.
Une identité client peut participer à plusieurs opérations.

AC. Archivage
Menu :
•••

Modifier
Archiver

L'archivage ne supprime pas l'historique.
Archiver Jean Mukendi ?

Le client sera retiré des clients actifs.
Ses opérations et son historique seront conservés.

[Annuler] [Archiver]

La suppression définitive est un sujet différent qui devra respecter les règles de données et de conformité.

AD. Permissions
Customer 360 respecte les permissions.
Par exemple, un agent opérationnel pourrait avoir accès à :
Aperçu
Colis
Expéditions
Communications
Activité

sans accès à :
Finance

Un utilisateur Finance peut avoir les droits correspondants.
Les règles exactes seront définies dans Équipe & Permissions, pas inventées ici.

AE. Mobile
Sur smartphone :
← Clients                         •••

Jean Mukendi
CLI-001842

+243 812 345 678
Kinshasa

[Message]       [+ Colis]

──────────────────────────

Aperçu   Colis   Plus

──────────────────────────

Colis en cours

SLV-29382
En transit
>

SLV-29411
Reçu
>

Voir tous →

──────────────────────────

Finance

À payer
126 USD

Voir →

──────────────────────────

Activité récente

10:42
Message reçu

09:31
Colis mis à jour

Plus peut contenir les onglets qui ne tiennent pas :
Expéditions
Finance
Communications
Activité


AF. Source de vérité
C'est une règle d'architecture à conserver :
Information
Propriétaire
Nom du client
CRM
Téléphone
CRM
E-mail
CRM
Bureau du client
CRM / Organisation
Référence client
CRM
Colis
Colis
Statut du colis
Colis
Expédition
Expéditions
Montant à payer
Finance
Paiement
Finance
Conversation
Communication
Notification
Communication
Activité
Agrégation des événements

Donc :
CUSTOMER 360
     │
     ├── lit CRM
     ├── lit Colis
     ├── lit Expéditions
     ├── lit Finance
     └── lit Communication

Il ne crée pas cinq copies des mêmes informations.

AG. Architecture officielle de 02.03
CUSTOMER 360
│
├── Header
│   ├── Nom
│   ├── Référence
│   ├── Téléphone
│   └── Bureau
│
├── Actions
│   ├── Message
│   └── Enregistrer un colis
│
├── Aperçu
│   ├── Informations
│   ├── Colis en cours
│   ├── Finance
│   └── Activité récente
│
├── Colis
│
├── Expéditions
│
├── Finance
│
├── Communications
│
├── Activité
│
├── Modification
├── Archivage
├── Permissions
└── Responsive

Principe officiel — 02.03
Dans Slaivio Cargo, le Client est l'identité centrale. Ses colis lui sont directement rattachés. Customer 360 permet de consulter sa relation opérationnelle, financière et communicationnelle sans introduire de “Dossier” intermédiaire et sans dupliquer les données des autres modules.
Et surtout, le cœur opérationnel devient extrêmement clair :
CLIENT
   ↓
COLIS
   ↓
DÉPART / EXPÉDITION
   ↓
SUIVI
   ↓
LIVRAISON

C'est cette chaîne qu'on gardera comme référence pour construire la suite.

_______
