MODULE-03 — COLIS
03.01 — Registre des colis / Vue « Colis »
On entre maintenant dans le cœur opérationnel Cargo.
Le registre Colis doit répondre rapidement à trois questions :
Quel colis ? À quel client appartient-il ? Où en est-il ?
L'écran principal :
Colis                                      [+ Enregistrer un colis]

[🔎 Rechercher un colis...]

[Filtres]

──────────────────────────────────────────────────────────────
RÉFÉRENCE       CLIENT              STATUT          BUREAU
──────────────────────────────────────────────────────────────
SLV-002841      Jean Mukendi        Reçu            Kinshasa
SLV-002842      Sarah Traoré        En transit      Ouagadougou
SLV-002843      Paul Kabeya         Arrivé          Bobo
──────────────────────────────────────────────────────────────

                                      1–50 sur 4 281    ‹  ›

Colonnes de base
Je reste volontairement strict :
Colonne
Pourquoi elle existe
Référence
Identifier le colis
Client
Savoir à qui appartient le colis
Statut
Connaître son état opérationnel
Bureau
Situer l'opération lorsque l'agence a plusieurs bureaux

Je n'ajoute pas maintenant poids, CBM, prix, mode de transport, conteneur, destination, transporteur, ETA, etc. Nous déciderons de ces champs au moment de 03.02 — Enregistrement d'un colis, en fonction du fonctionnement réel d'une agence fret.
Recherche
🔎 Rechercher par référence ou client...

La référence colis doit naturellement être recherchable.
Le client doit également l'être afin qu'un agent puisse retrouver rapidement les colis de Jean Mukendi.
Le téléphone du client peut éventuellement être exploité par le moteur de recherche sans devenir une colonne supplémentaire.
Statut
Le statut est central, mais je ne fixe pas encore une liste inventée de statuts.
Nous savons déjà grâce aux agences interrogées qu'elles parlent notamment de :
Reçu
Expédié
Arrivé

et qu'une notification doit pouvoir partir lorsque certains de ces événements se produisent.
La véritable machine d'état sera définie avec le workflow Colis, pas inventée dans la table.
Client
Une ligne peut afficher :
SLV-002841

Jean Mukendi
CLI-001842

Cliquer sur Jean Mukendi ouvre Customer 360.
Cliquer sur SLV-002841 ouvre la fiche du colis.
On obtient donc une navigation naturelle :
CLIENT
   │
   ├── Colis A
   ├── Colis B
   └── Colis C

Bureau
Même logique que CRM.
Pour l'agence Burkina :
SLV-002841    Sarah Traoré    Reçu    Ouagadougou
SLV-002842    Paul Traoré     Reçu    Bobo-Dioulasso

Si l'agence ne possède qu'un bureau, inutile d'afficher la même valeur sur toutes les lignes : la colonne peut disparaître.
Filtres
On commence uniquement avec les filtres directement justifiés :
Filtres

Statut
[ Tous ▼ ]

Bureau
[ Tous ▼ ]

Date d'enregistrement
[ Toutes les dates ▼ ]

[Réinitialiser]                       [Appliquer]

D'autres filtres seront ajoutés uniquement lorsque le modèle Colis nous aura donné les données correspondantes.
Action principale
Une seule :
+ Enregistrer un colis

C'est le prochain workflow critique.
Et nous gardons maintenant cette règle pour toute l'architecture : on termine un module lorsqu'il couvre réellement son besoin ; ensuite on passe au suivant au lieu d'inventer des sections supplémentaires.
La prochaine étape est donc 03.02 — Enregistrement d'un colis, où nous déterminerons précisément quelles informations une agence fret doit réellement saisir lorsqu'elle reçoit un colis, champ par champ, sans supposer que le scan, le CBM, le conteneur ou d'autres données sont obligatoires.


_____________

MODULE-03 — COLIS

03.02 — Enregistrement d’un colis

C’est l’un des workflows les plus importants de Slaivio. Quand un colis arrive au point de réception — par exemple en Chine — l’agent doit pouvoir l’enregistrer rapidement, l’associer au bon client et déclencher la suite du processus.

Le retour terrain nous donne déjà un besoin clair : lorsqu’un colis est enregistré comme reçu, le client doit pouvoir être informé automatiquement.


---

A. Point d’entrée

Depuis :

Colis                                  [+ Enregistrer un colis]

Le clic ouvre le formulaire :

┌──────────────────────────────────────────────┐
│ Enregistrer un colis                     ×  │
│                                              │
│ Client *                                     │
│ [ 🔎 Rechercher un client...              ] │
│                                              │
│ Référence / Tracking                         │
│ [________________________________________]  │
│                                              │
│ Poids                                        │
│ [____________] kg                            │
│                                              │
│ Destination                                  │
│ [ Sélectionner                           ▼]  │
│                                              │
│                    [Annuler] [Enregistrer]   │
└──────────────────────────────────────────────┘

Mais il faut examiner chacun de ces champs avant de considérer ce formulaire comme définitif.


---

B. Client — obligatoire

Client *

[ 🔎 Nom ou téléphone... ]

L’agent recherche :

Jean Mukendi
+243 812 345 678

Résultat :

Jean Mukendi
CLI-001842
+243 812 345 678

Sélection :

Client *

Jean Mukendi
+243 812 345 678                       ×

Le colis est maintenant directement lié au client.

CUSTOMER
   │
   └── PARCEL

Pas de Dossier intermédiaire.


---

C. Client inexistant

Si l’agent recherche :

Patrick Ilunga

et qu’il n’existe pas :

Aucun client trouvé.

[+ Créer un client]

Le mini-formulaire de 02.02 s’ouvre.

Une fois créé :

✓ Patrick Ilunga créé

Client
Patrick Ilunga
CLI-001843

est automatiquement sélectionné.

L’agent ne recommence pas l’enregistrement du colis.


---

D. Référence / numéro de tracking

LUZA a explicitement demandé l’enregistrement du tracking number.

Donc ce champ a une justification terrain :

Numéro de tracking
[________________________________]

Il peut s’agir de la référence déjà présente sur la marchandise provenant du fournisseur ou du transport précédent.

Mais il faut distinguer cela de la référence interne Slaivio.


---

E. Deux références différentes

Référence Slaivio

Générée par le système :

SLV-002841

Numéro de tracking externe

Renseigné lorsqu’il existe :

YT839205720CN

Donc :

COLIS
│
├── Référence Slaivio
│   └── SLV-002841
│
└── Tracking externe
    └── YT839205720CN

On ne mélange pas les deux.


---

F. Tracking externe non obligatoire universellement

Un colis peut arriver sans numéro exploitable.

Le système ne doit donc pas nécessairement bloquer :

Numéro de tracking
[                    ]

si l’agence est capable d’identifier et d’enregistrer le colis autrement.

La référence Slaivio sera générée dans tous les cas.


---

G. Poids

LUZA a également explicitement demandé :

> réception → poids, tracking number, client, destination, statut, historique.



Le poids a donc une justification réelle.

Poids

[ 12,5 ] kg

Mais il ne faut pas supposer que le poids est connu au moment exact de chaque réception.

Donc le modèle doit pouvoir accepter son ajout ou sa correction ultérieure si le workflow de l’agence l’exige.


---

H. Unité

Si le produit cible utilise principalement les kilogrammes :

Poids
[12,5] kg

On ne demande pas inutilement :

Unité
kg
lb
oz
tonne
...

à chaque colis si l’organisation travaille dans une unité configurée.

L’unité peut venir des paramètres de l’agence.


---

I. Destination

Le besoin de destination est également confirmé par LUZA.

Destination *

[ Kinshasa ▼ ]

Pour Burkina :

Destination

[ Ouagadougou ▼ ]
[ Bobo-Dioulasso ]

La destination ne doit pas être un champ texte libre comme :

Destination
[Bobo]

si Slaivio possède déjà les destinations configurées.

Cela évite :

Bobo
Bobo Dioulasso
Bobo-Dioulasso
BOBO

de devenir quatre destinations différentes.


---

J. Réception

Le contexte de réception doit être connu.

Par exemple :

Reçu à
Guangzhou

Si l’agent est connecté à un entrepôt/bureau de Guangzhou, Slaivio peut déjà connaître ce contexte.

Il ne faut donc pas nécessairement lui demander à chaque colis :

Pays de réception : Chine
Ville : Guangzhou
Entrepôt : Guangzhou

si ces informations sont déjà déterminées par sa session ou son emplacement opérationnel sélectionné.


---

K. Statut initial

Lorsque l’agent utilise :

+ Enregistrer un colis

dans le contexte de réception, l’opération elle-même peut déterminer le statut initial.

Par exemple :

Reçu

Il n’est donc pas logique de lui demander :

Statut *
[Reçu ▼]

alors qu’il vient précisément d’effectuer l’action Enregistrer une réception.

Principe :

> Lorsqu’une action métier permet de déduire une donnée, Slaivio ne doit pas demander à l’utilisateur de la sélectionner à nouveau.




---

L. Date et heure de réception

Même logique.

Le système connaît :

Reçu le
7 oct. 2026 · 12:48

L’agent n’a pas besoin de saisir systématiquement :

Date : 07/10/2026
Heure : 12:48

Slaivio enregistre automatiquement le timestamp.

Si l’agence doit enregistrer rétroactivement une réception, ce sera un cas spécifique avec permission appropriée.


---

M. Agent ayant enregistré le colis

Dérivé de la session :

Enregistré par
Patrick M.

Jamais :

Agent
[Patrick M. ▼]

dans le formulaire normal.

Slaivio sait qui effectue l’action.


---

N. Formulaire corrigé

Nous arrivons donc à quelque chose de beaucoup plus propre :

┌──────────────────────────────────────────────┐
│ Enregistrer un colis                     ×  │
│                                              │
│ Client *                                     │
│ [ 🔎 Rechercher par nom ou téléphone...   ] │
│                                              │
│ Numéro de tracking                           │
│ [________________________________________]  │
│                                              │
│ Poids                                        │
│ [________________________] kg                │
│                                              │
│ Destination *                                │
│ [ Sélectionner                           ▼]  │
│                                              │
│                    [Annuler] [Enregistrer]   │
└──────────────────────────────────────────────┘

Et automatiquement :

Référence Slaivio    → générée
Statut               → reçu
Date/heure           → générée
Lieu de réception    → contexte opérationnel
Agent                → utilisateur connecté
Historique           → événement généré

C’est précisément le type de simplification qu’on recherche.


---

O. Que se passe-t-il après « Enregistrer » ?

C’est ici que Slaivio commence à devenir un véritable système opérationnel.

Agent
  │
  │ Enregistrer
  ▼
COLIS CRÉÉ
  │
  ├── Référence générée
  │
  ├── Client associé
  │
  ├── Statut = Reçu
  │
  ├── Réception enregistrée
  │
  ├── Historique créé
  │
  └── Événement PARCEL_RECEIVED

L’événement est plus important qu’un simple changement d’écran.


---

P. PARCEL_RECEIVED

Conceptuellement :

PARCEL_RECEIVED

contient les références nécessaires à l’événement :

parcel_id
customer_id
organization_id
location_id
occurred_at
actor_id

et les données métier appropriées.

Cela permet aux autres parties de Slaivio de réagir sans mettre toute la logique dans le formulaire.


---

Q. Notification client

Le besoin du prospect Burkina est précisément :

> Dès qu’on renseigne que le colis a été reçu en Chine, le client reçoit automatiquement un message.



Donc :

PARCEL_RECEIVED
       │
       ▼
Moteur de notifications
       │
       ├── règle activée ?
       ├── client joignable ?
       ├── canal disponible ?
       └── template applicable ?
               │
               ▼
            WhatsApp

Exemple de message configuré par l’agence :

> Bonjour Jean, votre colis SLV-002841 a bien été reçu dans notre dépôt en Chine.



Le texte exact et les templates appartiendront au module Communication/Notifications.


---

R. L’enregistrement ne dépend pas de WhatsApp

Très important.

Si WhatsApp est indisponible :

Colis enregistré ✓
Notification WhatsApp ✕

et non :

WhatsApp en panne
      ↓
Impossible d'enregistrer le colis

Les opérations Cargo doivent continuer à fonctionner même si un canal externe rencontre un problème.


---

S. Résultat visible

Après création :

✓ Colis SLV-002841 enregistré

Puis ouverture de sa fiche :

SLV-002841

Reçu

Client
Jean Mukendi

Tracking
YT839205720CN

Poids
12,5 kg

Destination
Kinshasa

Réception
Guangzhou
7 oct. 2026 · 12:48

La fiche complète sera 03.03.


---

T. Doublon de tracking

Si l’agent entre :

YT839205720CN

et que ce numéro existe déjà, Slaivio doit au minimum signaler la correspondance :

Colis existant possible

SLV-002501
Tracking : YT839205720CN
Client : Jean Mukendi

[Ouvrir le colis]

On ne doit pas créer silencieusement deux colis parce qu’un agent a enregistré deux fois la même étiquette.

Mais nous ne devons pas non plus décider sans analyse que tout tracking externe est universellement unique. La règle exacte dépendra de la source et du transporteur.


---

U. Erreur réseau

Si l’enregistrement échoue :

Impossible d'enregistrer le colis.

Les informations saisies ont été conservées.

[Réessayer]

Le formulaire reste rempli.


---

V. Double clic

Même protection que pour Client.

[Enregistrement...]

Un réseau lent ne doit pas créer :

SLV-002841
SLV-002842
SLV-002843

pour le même clic répété.


---

W. Mobile

La réception doit être particulièrement efficace sur téléphone :

Enregistrer un colis

Client *
[Rechercher...]

Tracking
[________________]

Poids
[___________] kg

Destination *
[Sélectionner ▼]


[      Enregistrer le colis      ]

Les champs doivent être suffisamment grands pour une utilisation en environnement d’entrepôt.


---

X. Ce qu’on n’ajoute PAS maintenant

Je n’ajoute volontairement pas :

CBM
Longueur
Largeur
Hauteur
Conteneur
Numéro de lot
Transporteur
Fournisseur
Valeur marchandise
Assurance
Douane
ETA
Photos obligatoires
QR obligatoire
Code-barres obligatoire
Scan obligatoire
Description obligatoire
Catégorie obligatoire

Certains pourront être nécessaires plus tard dans le modèle Colis ou dans certains services.

Mais nous ne les déclarons pas obligatoires sans justification métier.


---

03.02 — Structure officielle

ENREGISTRER UN COLIS
│
├── Saisi
│   ├── Client *
│   ├── Tracking externe
│   ├── Poids
│   └── Destination *
│
├── Déduit / généré
│   ├── Référence Slaivio
│   ├── Statut de réception
│   ├── Date / heure
│   ├── Lieu de réception
│   └── Agent
│
├── Contrôles
│   ├── Client valide
│   ├── Tracking existant
│   └── Données requises
│
└── Après création
    ├── Colis créé
    ├── Historique créé
    ├── PARCEL_RECEIVED
    └── Notification selon configuration

> Principe 03.02 : l’agent renseigne seulement ce que Slaivio ne peut pas connaître. Le système déduit le contexte de réception et transforme l’enregistrement en événement opérationnel.



La prochaine partie logique est 03.03 — Fiche détaillée du colis, c’est-à-dire l’endroit où l’agence voit l’identité du colis, son client, son état actuel et son historique.


_______________


MODULE-03 — COLIS
03.03 — Fiche détaillée du colis
La fiche colis est la source opérationnelle principale d’un colis.
Elle doit répondre immédiatement à quatre questions :
Quel colis ? À quel client appartient-il ? Quel est son état actuel ? Que s’est-il passé depuis sa réception ?
Elle ne doit pas devenir une fiche remplie de champs logistiques que l’agence n’utilise pas.

A. Structure générale
Depuis le registre Colis, clic sur SLV-002841 :
← Colis

SLV-002841                                      [•••]
Reçu

Client
Jean Mukendi
+243 812 345 678

[Modifier]                         [Action suivante]

──────────────────────────────────────────────────────

Aperçu     Historique

Je garde volontairement peu d’onglets.
Les éléments comme paiements, conversations ou informations complètes du client sont accessibles via leurs objets respectifs, sans transformer la fiche colis en Customer 360.

B. Header
SLV-002841

Reçu

La référence Slaivio est l’élément principal.
À côté ou en dessous apparaît le statut actuel.
Le client est immédiatement visible :
Client

Jean Mukendi
CLI-001842
+243 812 345 678

Cliquer sur Jean ouvre sa fiche Customer 360.

C. Informations du colis
L’aperçu reprend uniquement les informations réellement enregistrées dans 03.02.
Informations du colis

Référence
SLV-002841

Tracking externe
YT839205720CN

Poids
12,5 kg

Destination
Kinshasa

Pas de :
CBM
Dimensions
Transporteur
Assurance
Douane
Valeur
Conteneur
Fournisseur

tant que ces données n’ont pas été introduites et justifiées dans le modèle métier.

D. Informations de réception
La réception est un événement réel.
Réception

Lieu
Guangzhou

Date
7 oct. 2026 · 12:48

Enregistré par
Patrick M.

Ces informations n’ont pas été saisies manuellement si Slaivio pouvait les déterminer.
Elles proviennent de l’événement de réception.

E. Client
Carte compacte :
Client

Jean Mukendi
CLI-001842

+243 812 345 678

[Voir le client]

Nous ne recopions pas :
ses autres colis ;
son solde complet ;
toutes ses conversations ;
toutes ses coordonnées.
Cela appartient à Customer 360.

F. Statut du colis
Le statut actuel doit être extrêmement visible :
● Reçu

Mais il faut maintenant poser une règle importante :
Le statut ne devrait pas être modifié comme un simple champ texte ou dropdown lorsque le changement correspond à une véritable opération métier.
Donc éviter :
Statut

[Reçu ▼]

Reçu
Expédié
Arrivé
Livré

avec possibilité de sauter arbitrairement d’un état à l’autre.

G. Actions métier plutôt que changement de statut
Si le colis est actuellement :
Reçu

l’interface doit proposer l’action correspondant réellement à la suite du workflow.
Par exemple, son rattachement à un départ/expédition se fera dans le module approprié.
Quand ce départ est effectivement enregistré :
Colis
SLV-002841
     ↓
Expédition / Départ
     ↓
Départ confirmé
     ↓
nouvel événement

Le statut du colis évolue à partir de cette opération.
L’agent n’a pas besoin de venir changer manuellement :
Reçu → Expédié

si Slaivio sait déjà que l’expédition vient de partir.

H. Pourquoi c’est important
Sinon, on peut avoir :
Expédition
Pas encore partie

Colis
Expédié

Deux vérités contradictoires.
Avec une architecture événementielle :
EXPÉDITION PART
       ↓
événement
       ↓
colis concernés mis à jour
       ↓
tracking mis à jour
       ↓
notification déclenchée

La réalité opérationnelle produit le statut.

I. Historique du colis
Deuxième onglet :
Historique

Exemple :
HISTORIQUE

7 OCTOBRE 2026

12:48
Colis reçu
Guangzhou

12:48
Colis enregistré
par Patrick M.

Plus tard :
12 OCTOBRE 2026

18:30
Expédition partie
Chine → Burkina Faso

Puis :
25 OCTOBRE 2026

09:15
Arrivé
Ouagadougou

L’historique se construit progressivement.

J. Historique immuable
On ne donne pas à l’agent un bouton :
[Modifier l’historique]

L’historique représente les événements qui se sont produits.
Si une erreur métier doit être corrigée, une action de correction appropriée produit une nouvelle trace.
Exemple conceptuel :
12:48
Poids enregistré : 12,5 kg

13:02
Poids corrigé : 12,8 kg
par Patrick M.

plutôt que faire disparaître toute trace de l’ancienne information lorsque l’audit est nécessaire.

K. Notifications dans l’historique
Il faut distinguer événement opérationnel et communication.
Par exemple :
12:48
Colis reçu
Guangzhou

peut déclencher :
12:49
Notification envoyée au client
WhatsApp

Mais la fiche colis ne doit pas devenir l’Inbox.
On peut montrer l’information utile :
Notification client
Envoyée

avec accès au détail de la communication si nécessaire.

L. Échec d’une notification
Scénario important :
Colis reçu ✓

Notification client
Échec

Le colis reste Reçu.
On ne revient jamais à un ancien statut parce que WhatsApp n’a pas fonctionné.
L’opération Cargo et la communication restent découplées.

M. Modifier les informations du colis
Bouton :
[Modifier]

ouvre :
Modifier le colis

Tracking externe
[YT839205720CN]

Poids
[12,5] kg

Destination
[Kinshasa ▼]

              [Annuler] [Enregistrer]

Nous ne mettons pas :
Référence Slaivio
Statut
Date de réception
Agent

comme champs ordinaires modifiables.
Ils ne sont pas de même nature.

N. Modification du client associé
Le client est plus sensible.
Une erreur peut arriver :
le colis a été enregistré sur Jean alors qu’il appartient à Patrick.
Cela nécessite une action explicite :
•••
Réattribuer le colis

plutôt que de placer :
Client [Jean Mukendi ▼]

dans chaque modification ordinaire.

O. Réattribution
Workflow :
Réattribuer le colis

Client actuel
Jean Mukendi

Nouveau client
[🔎 Rechercher...]

Raison
[____________________________]

[Annuler]            [Réattribuer]

La nécessité exacte du champ Raison peut dépendre de notre politique d’audit, mais la réattribution doit au minimum être une opération consciente et traçable.
Après :
Historique

14:32
Colis réattribué
Jean Mukendi → Patrick Ilunga
par Sarah K.

On ne supprime pas silencieusement l’ancien rattachement.

P. Expédition associée
Lorsque le colis appartient à une expédition :
Expédition

EXP-0048
Chine → RDC
En transit

[Voir l’expédition]

Cette information provient du module Expéditions.
La fiche colis ne modifie pas l’expédition.

Q. Colis pas encore affecté
Avant son départ :
Expédition

Pas encore affecté à une expédition

Selon notre futur workflow, l’affectation pourra se faire depuis Départs / Manifestes ou depuis le colis.
Nous déciderons cela dans le module concerné au lieu de l’inventer maintenant.

R. Destination
La fiche affiche :
Destination
Kinshasa

Il faut distinguer cela du lieu actuel.
Un colis peut avoir :
Lieu actuel
Guangzhou

Destination
Kinshasa

Ce sont deux concepts différents.
Mais le lieu actuel doit provenir des opérations enregistrées, pas d’un champ libre que quelqu’un modifie arbitrairement.

S. Tracking externe
Tracking externe

YT839205720CN
[Copier]

Si absent :
Tracking externe
Non renseigné

Il ne faut pas confondre :
SLV-002841

avec :
YT839205720CN

Le premier appartient à Slaivio ; le second provient de l’extérieur.

T. Recherche depuis la fiche
Les références doivent pouvoir être copiées rapidement :
SLV-002841    [Copier]
YT839205...   [Copier]

C’est particulièrement utile lorsqu’un agent doit communiquer une référence à un collègue ou au client.

U. Mobile
La fiche doit être parfaitement exploitable en entrepôt :
← Colis                         •••

SLV-002841
● Reçu

Jean Mukendi
+243 812 345 678

[Modifier]

────────────────────

Informations

Tracking
YT839205720CN

Poids
12,5 kg

Destination
Kinshasa

────────────────────

Réception

Guangzhou
7 oct. · 12:48

────────────────────

Historique

12:48
Colis reçu

Pas de tableau desktop compressé sur téléphone.

V. Permissions
Un agent peut être autorisé à :
Voir le colis          ✓
Modifier informations  ✓
Réattribuer client      ✕

Un responsable peut avoir davantage de droits.
Les permissions exactes seront centralisées plus tard ; la fiche doit simplement être conçue pour les respecter.

W. Source de vérité
Information
Source
Référence Slaivio
Colis
Tracking externe
Colis
Poids
Colis
Destination
Colis
Client associé
relation Client ↔ Colis
Réception
événement opérationnel
Statut actuel
état opérationnel du colis
Expédition
Expéditions
Notification
Communication
Historique
événements


X. Architecture officielle 03.03
FICHE COLIS
│
├── Header
│   ├── Référence
│   └── Statut actuel
│
├── Client
│
├── Informations
│   ├── Tracking externe
│   ├── Poids
│   └── Destination
│
├── Réception
│   ├── Lieu
│   ├── Date / heure
│   └── Agent
│
├── Expédition associée
│
├── Historique
│
├── Notification client
│
├── Modification
│
├── Réattribution
│
├── Permissions
└── Responsive

Principe 03.03 : la fiche Colis représente la vérité opérationnelle d’un colis. Les changements importants doivent provenir d’actions métier réelles plutôt que d’un simple menu “changer le statut”.
Il reste maintenant à définir comment un colis évolue réellement après sa réception — notamment son rattachement à un départ, son départ, son arrivée et sa remise au client — sans créer des statuts artificiels.
__________________

MODULE-03 — COLIS
03.04 — Cycle de vie du colis
Après l’enregistrement et la fiche détaillée, il faut définir comment le colis évolue réellement dans Slaivio.
Ici, il faut rester très strict : les statuts doivent correspondre à des événements que l’agence Cargo effectue réellement. On ne crée pas 10 ou 15 statuts pour faire « logiciel logistique professionnel ».
D’après les besoins déjà recueillis auprès des agences, quatre moments sont clairement établis :
REÇU
  ↓
EXPÉDIÉ
  ↓
ARRIVÉ
  ↓
LIVRÉ

La disponibilité/retrait peut exister dans certaines agences, mais on ne l’impose pas encore comme état universel.

A. Principe fondamental
L’agent ne doit normalement pas gérer le colis ainsi :
Statut
[ Reçu ▼ ]

→ Expédié
→ Arrivé
→ Livré

Les changements doivent être produits par des actions métier.
ACTION MÉTIER
     ↓
ÉVÉNEMENT
     ↓
ÉTAT DU COLIS
     ↓
HISTORIQUE
     ↓
NOTIFICATION éventuelle

Cela empêche le statut affiché de diverger de ce qui s’est réellement passé.

B. 1 — Reçu
Le premier état naît du workflow 03.02 — Enregistrer un colis.
Agent enregistre le colis
          ↓
PARCEL_RECEIVED
          ↓
        Reçu

Slaivio connaît également :
Référence : SLV-002841
Client : Jean Mukendi
Lieu : Guangzhou
Date : 7 oct. 2026 · 12:48
Agent : Patrick M.

La timeline reçoit :
12:48
Colis reçu
Guangzhou

Et, si la règle de communication de l’agence est activée :
PARCEL_RECEIVED
      ↓
Notification client

Exemple :
Bonjour Jean, votre colis SLV-002841 a bien été reçu.

C. Entre « Reçu » et « Expédié »
C’est ici qu’il ne faut pas inventer un statut.
Le colis peut rester :
Reçu

pendant qu’il attend son prochain départ.
Lorsqu’il est associé à une expédition, cette information peut être affichée séparément :
Statut du colis
Reçu

Expédition
EXP-0048
Départ prévu : ...

Le simple fait d’affecter le colis à une expédition ne signifie pas nécessairement qu’il est déjà parti.
Donc nous ne créons pas artificiellement :
Affecté
Préparé
En attente
Prêt
Manifesté

comme cinq statuts du colis.
Ces notions pourront appartenir au workflow du départ si elles sont nécessaires.

D. 2 — Expédié
Le besoin terrain est explicite : lorsque le colis quitte la Chine, le client doit pouvoir être informé.
Mais ce changement ne doit pas être effectué colis par colis si 300 colis partent dans la même expédition.
Exemple :
EXP-0048
Chine → Burkina Faso

300 colis

L’opérateur confirme :
[Confirmer le départ]

Slaivio produit :
SHIPMENT_DEPARTED
        │
        ├── Colis 001 → Expédié
        ├── Colis 002 → Expédié
        ├── Colis 003 → Expédié
        ├── ...
        └── Colis 300 → Expédié

C’est l’expédition qui constitue la preuve opérationnelle du départ.

E. Historique après départ
Pour SLV-002841 :
HISTORIQUE

12 OCT. · 18:30
Colis expédié
Guangzhou → Ouagadougou

7 OCT. · 12:48
Colis reçu
Guangzhou

Le colis garde donc son propre historique même si l’événement provient de l’expédition.

F. Notification de départ
L’événement peut déclencher :
SHIPMENT_DEPARTED
       ↓
Clients concernés
       ↓
Règles de notification
       ↓
WhatsApp

Le prospect Burkina a explicitement demandé ce comportement.
Mais attention : si Jean possède trois colis dans la même expédition, Slaivio ne devrait pas nécessairement lui envoyer trois messages identiques.
Le moteur de communication devra être capable de regrouper intelligemment les notifications selon la configuration de l’agence.
Ce comportement sera défini dans Communication / Notifications.

G. 3 — Arrivé
Lorsque l’expédition arrive à destination, l’opérateur effectue l’action correspondante dans le module Expéditions :
EXP-0048

[Confirmer l’arrivée]

Ce qui produit :
SHIPMENT_ARRIVED
       │
       ├── colis concernés
       ↓
      Arrivé

La fiche du colis devient :
SLV-002841

● Arrivé

Destination
Ouagadougou

Historique :
25 OCT. · 09:15
Colis arrivé
Ouagadougou


H. Notification d’arrivée
C’est également un besoin confirmé :
SHIPMENT_ARRIVED
       ↓
Notification
       ↓
Client

Exemple :
Bonjour Jean, votre colis SLV-002841 est arrivé à Ouagadougou.
Le contenu exact n’est pas codé dans le module Colis. Il appartient aux templates de communication de l’agence.

I. Arrivé ≠ livré
C’est une distinction fondamentale.
Arrivé

signifie que la marchandise est arrivée à destination opérationnelle.
Cela ne signifie pas que Jean l’a déjà récupérée.
Donc :
ARRIVÉ
   ≠
LIVRÉ

Cette séparation permet à l’agence de savoir quels colis sont physiquement arrivés mais restent encore à remettre.

J. « Disponible pour retrait »
Certaines agences peuvent avoir une étape :
Arrivé
   ↓
Disponible pour retrait
   ↓
Livré

Cela est cohérent avec certains besoins recueillis, notamment les notifications indiquant que la marchandise est disponible au point de retrait.
Mais il ne faut pas l’imposer à toutes les agences.
Le workflow pourra permettre à l’organisation d’utiliser cette étape lorsque son fonctionnement la nécessite.
Par exemple :
Agence A

Reçu → Expédié → Arrivé → Livré

contre :
Agence B

Reçu → Expédié → Arrivé
                    ↓
          Disponible au retrait
                    ↓
                  Livré

Ce n’est pas une raison pour rendre tous les workflows entièrement personnalisables sans contrôle. On définira les variantes supportées proprement.

K. 4 — Livré
Lorsque le client récupère réellement son colis, l’agent effectue une action métier :
[Marquer comme livré]

Une confirmation est appropriée :
Confirmer la livraison ?

Colis
SLV-002841

Client
Jean Mukendi

[Annuler]      [Confirmer la livraison]

Puis :
PARCEL_DELIVERED
       ↓
      Livré


L. Pourquoi la livraison peut être individuelle
Contrairement au départ d’une expédition, les clients ne récupèrent pas nécessairement leurs colis au même moment.
Donc :
EXP-0048
300 colis arrivent

peut donner :
Colis A → Livré lundi
Colis B → Livré lundi
Colis C → Livré mardi
Colis D → toujours Arrivé
...

La livraison appartient donc naturellement au colis ou au processus de remise, pas à l’expédition entière.

M. Historique final
La fiche peut alors présenter :
HISTORIQUE

29 OCT. · 14:22
Colis livré
Ouagadougou

25 OCT. · 09:15
Colis arrivé
Ouagadougou

12 OCT. · 18:30
Colis expédié
Guangzhou

7 OCT. · 12:48
Colis reçu
Guangzhou

C’est compréhensible immédiatement par l’agence.

N. Relation avec le paiement
Le prospect Burkina demande également :
notifier le client du montant à payer et, si possible, lui permettre de payer sur la plateforme.
Il faut cependant éviter de mélanger :
STATUT LOGISTIQUE

et :
STATUT FINANCIER

Un colis peut être :
Arrivé

avec :
Paiement
En attente

ou :
Arrivé
Paiement
Payé

Ce sont deux dimensions différentes.
On ne crée donc pas un statut :
Arrivé non payé

dans le moteur logistique.

O. Peut-on livrer si le paiement n’est pas terminé ?
Cette règle peut varier selon l’agence.
Certaines peuvent exiger :
Montant restant = 0
        ↓
Livraison autorisée

D’autres peuvent autoriser :
crédit client ;
paiement ultérieur ;
exception manager.
Nous ne fixons donc pas une règle universelle ici.
Elle devra appartenir aux règles Finance/Service de l’organisation.

P. Annulation / erreur
Il ne faut pas ajouter immédiatement :
Annulé
Perdu
Endommagé
Retourné
Bloqué
Douane
Litige

au cycle principal.
Ces situations existent potentiellement, mais elles ne représentent pas toutes des étapes normales du parcours.
Par exemple, un colis perdu relève davantage d’une exception/réclamation que d’une étape entre Expédié et Arrivé.
Le parcours principal reste propre.

Q. Cycle principal officiel
Pour Slaivio Cargo :
┌─────────┐
│  REÇU   │
└────┬────┘
     │
     │ Départ de l’expédition
     ▼
┌──────────┐
│ EXPÉDIÉ  │
└────┬─────┘
     │
     │ Arrivée de l’expédition
     ▼
┌─────────┐
│ ARRIVÉ  │
└────┬────┘
     │
     │ Remise au client
     ▼
┌─────────┐
│ LIVRÉ   │
└─────────┘

Avec éventuellement, pour les agences qui l’utilisent :
ARRIVÉ
   ↓
DISPONIBLE POUR RETRAIT
   ↓
LIVRÉ


R. Événements correspondants
Architecture :
PARCEL_RECEIVED
      ↓
REÇU

SHIPMENT_DEPARTED
      ↓
EXPÉDIÉ

SHIPMENT_ARRIVED
      ↓
ARRIVÉ

PARCEL_DELIVERED
      ↓
LIVRÉ

Cela donne une architecture beaucoup plus solide qu’un simple :
UPDATE parcels
SET status = 'shipped'

effectué manuellement sans contexte.

S. Notifications correspondantes
Les événements peuvent alimenter :
PARCEL_RECEIVED
        └── notification de réception

SHIPMENT_DEPARTED
        └── notification de départ

SHIPMENT_ARRIVED
        └── notification d’arrivée

PARCEL_READY_FOR_PICKUP
        └── notification de retrait

PARCEL_DELIVERED
        └── éventuellement confirmation

Mais l’existence d’un événement ne signifie pas obligatoirement qu’un message doit partir.
C’est le moteur Communication qui décide selon la configuration.

T. Tracking client
Ces mêmes événements alimentent naturellement le suivi côté client :
Votre colis
SLV-002841

✓ Reçu
  7 oct.

✓ Expédié
  12 oct.

✓ Arrivé
  25 oct.

○ Livré

Nous n’avons donc pas besoin d’un deuxième historique spécialement construit pour le portail client.
Le système utilise les événements autorisés du même colis.

U. Source unique
La chaîne devient :
OPÉRATION RÉELLE
      ↓
ÉVÉNEMENT
      ↓
┌───────────────┬───────────────┬────────────────┐
│               │               │                │
▼               ▼               ▼                ▼
Statut       Historique      Tracking       Notification
interne      opérationnel    client         éventuelle

C’est un point architectural majeur de Slaivio.

V. 03.04 — Résultat final
Le cycle Colis est donc volontairement petit :
COLIS

Reçu
 ↓
Expédié
 ↓
Arrivé
 ↓
Livré

avec une étape Disponible pour retrait uniquement lorsque l’agence l’utilise.
Pas de statuts ajoutés pour donner une impression de sophistication.
La sophistication de Slaivio vient du fait que chaque état correspond à une vraie opération et peut automatiquement synchroniser historique, tracking et communication — pas du nombre de statuts disponibles.
Avec 03.01 Registre, 03.02 Enregistrement, 03.03 Fiche colis et 03.04 Cycle de vie, le cœur du MODULE-03 Colis est maintenant couvert. La prochaine étape ne doit donc pas être 03.05 artificiellement : on peut clôturer MODULE-03 — COLIS ✅ et passer au prochain module opérationnel, Expéditions / Départs, où plusieurs colis seront regroupés et où les événements SHIPMENT_DEPARTED et SHIPMENT_ARRIVED seront réellement produits.
___________

### MODULE-03 — COLIS

### 03.05 — Disponibilité, retrait et remise des colis

Complément du Module-03

Cette section complète le cycle de vie des colis déjà validé dans `03.04`. Elle ne crée ni nouveau module, ni deuxième registre, ni nouvelle identité pour les colis.

Les pratiques observées chez M.O.G Group et 1610 Express confirment trois besoins : informer les clients lorsque leurs colis sont disponibles, enregistrer leur retrait et retrouver ceux qui n'ont pas encore été récupérés.

Objectif : permettre à l'agence de suivre un colis depuis son arrivée jusqu'à sa remise effective, sans compliquer les opérations quotidiennes.

### A. Cycle de vie du colis

* Reçu

    Le colis a été enregistré par l'agence.

* Expédié

    L'expédition contenant le colis est réellement partie.

* Arrivé

    L'expédition est arrivée à destination.

* Disponible pour retrait (si l'agence utilise cette étape)

    L'agence confirme que le colis peut être récupéré.

* Livré / Retiré

    Le colis a effectivement été remis.

Pour une agence sans étape distincte de disponibilité, le passage `Arrivé → Livré` reste possible.

Règle fondamentale : l'arrivée d'une expédition ne signifie jamais que tous ses colis ont été livrés.

### B. L'interface reste dans Colis

L'agent n'a pas besoin de quitter le module pour gérer les retraits.

### Colis

TousArrivésÀ retirerLivrés

SLV-003001

Jean Mukendi

Disponible pour retrait

SLV-003018

Sarah Traoré

Arrivé

SLV-003025

Paul Kaboré

Livré

SLV-003031

Amina Traoré

Disponible pour retrait

Maquette interactive illustrative, sans connexion aux données de l'agence.

Il ne faut pas ajouter une colonne « Retrait » ou un champ « Retiré : oui/non » au colis. L'état opérationnel et les événements existants permettent déjà de déterminer cette information.

### C. Confirmation de disponibilité

Lorsqu'une expédition arrive, ses colis passent à `Arrivé`, conformément au Module-04.

Pour les agences qui distinguent arrivée et disponibilité, un agent autorisé peut ensuite confirmer que les colis sont prêts à être récupérés.

```text
EXP-0102
Expédition arrivée
       │
       ▼
Colis concernés
       │
       ▼
Sélection des colis prêts
       │
       ▼
Confirmer la disponibilité
       │
       ▼
PARCEL_READY_FOR_PICKUP
```

L'agence peut confirmer un seul colis ou plusieurs colis d'une même arrivée.

Avant validation, Slaivio vérifie que les colis sont effectivement arrivés et qu'ils ne sont pas déjà remis. Une deuxième confirmation ne doit pas créer un nouvel événement identique.

La date, l'heure et l'agent sont enregistrés automatiquement.

Important : rendre un colis disponible ne signifie pas qu'il a été retiré.

### D. Notification au client

Après confirmation, Communication peut informer les clients concernés.

Exemple :

> Bonjour Jean, votre colis SLV-003001 est disponible pour retrait auprès de notre agence de Kinshasa. Vous pouvez venir le récupérer selon nos horaires habituels.

Cette formulation n'est possible que si l'agence a réellement renseigné son lieu et ses horaires.

Le flux :

```text
PARCEL_READY_FOR_PICKUP
          │
          ▼
Communication
          │
          ▼
Client concerné
          │
          ▼
Canal configuré
          │
          ▼
Message au nom de l'agence
```

La notification peut utiliser WhatsApp aujourd'hui, puis d'autres canaux compatibles ultérieurement.

Une notification échouée ne remet pas le colis à l'état `Arrivé`.

### E. Confirmation de la remise

Lorsqu'un client vient récupérer sa marchandise, l'agent ouvre le colis et confirme la remise réelle.

### SLV-003001

À retirer

Client

Jean Mukendi

Lieu

Kinshasa

Confirmer la remise

Je confirme que le colis a effectivement été remis.

Confirmer la remiseExemple de parcours. Aucune opération réelle n'est enregistrée ici.

À la confirmation valide :

```text
PARCEL_DELIVERED
       │
       ├── Colis → Livré
       ├── Historique → événement ajouté
       ├── Tracking → statut actualisé
       └── Communication → confirmation si configurée
```

Nous ne rendons pas obligatoires les signatures, photos d'identité, OTP ou autres preuves complexes sans validation terrain.

Cela n'empêche pas l'agence d'appliquer ses propres procédures de vérification avant de remettre physiquement une marchandise.

### F. Vérification financière

C'est le point de connexion avec `Module-07 Finance`.

Si une agence exige le paiement complet avant remise, Slaivio doit appliquer cette règle au moment de la confirmation.

```text
Confirmer la remise
       │
       ▼
Politique de l'agence
       │
       ├── Paiement non requis
       │       └── Remise possible
       │
       └── Paiement requis
               │
               ▼
          Vérifier Finance
               │
          ┌────┴────┐
          ▼         ▼
        Réglé    Solde dû
          │         │
          ▼         ▼
        Remise   Condition
        possible non satisfaite
```

Si un paiement est requis, le montant vient exclusivement de Finance.

L'agent peut alors orienter le client vers le paiement prévu, notamment via le lien SaaSPay si cette fonctionnalité est disponible.

Ne pas confondre : un colis peut être `Disponible pour retrait` tout en ayant un montant à régler. Ce sont deux informations distinctes.

### G. Un client retire plusieurs colis

Prenons Jean, qui possède :

| Colis      | État                    |
| ---------- | ----------------------- |
| SLV-003001 | Disponible pour retrait |
| SLV-003018 | Disponible pour retrait |
| SLV-003025 | Arrivé                  |

L'agent peut sélectionner les deux colis réellement remis et confirmer leur remise ensemble.

Le troisième reste `Arrivé`.

Pour une confirmation groupée, Slaivio doit vérifier individuellement l'éligibilité de chaque colis et appliquer les éventuelles conditions financières.

Un seul clic ne doit jamais livrer tous les colis du client sans distinction.

### H. Colis non retirés

C'est un besoin confirmé par l'exemple 1610 Express Cargo.

Il ne faut cependant pas créer un statut supplémentaire :

```text
NON RETIRÉ
```

car un colis `Disponible pour retrait` et pas encore `Livré` est déjà, par définition, non retiré.

Nous pouvons calculer :

```text
État = Disponible pour retrait
ET
Aucun événement PARCEL_DELIVERED
       │
       ▼
Colis non retiré
```

La date de disponibilité permet de connaître depuis combien de temps le colis attend.

Exemple :

| Colis      | Client       | Disponible depuis | Situation  |
| ---------- | ------------ | ----------------- | ---------- |
| SLV-003001 | Jean Mukendi | 2 octobre         | Non retiré |
| SLV-003018 | Sarah Traoré | 5 octobre         | Non retiré |
| SLV-003031 | Paul Kaboré  | 7 octobre         | Non retiré |

Il s'agit d'une vue filtrée du registre Colis, pas d'un nouveau registre.

### I. Relance des colis non retirés

Cette fonctionnalité appartient à Communication.

L'agence pourra définir à partir de quand elle souhaite relancer un client après la mise à disposition de son colis.

Par exemple, une politique pourrait prévoir une relance après cinq jours. Ce délai est illustratif et ne doit pas être imposé à toutes les agences.

```text
Colis disponible
       │
       ▼
Délai configuré atteint ?
       │
       ▼
Colis toujours non retiré ?
       │
       ▼
Communication
       │
       ▼
Relance du client concerné
```

La relance doit être annulée si le colis a déjà été remis.

Il faut également éviter les messages répétés inutilement : Communication conserve l'historique des relances déjà envoyées.

L'IA peut formuler un message naturel, adapté à la conversation et aux informations de l'agence, sans imposer une réponse robotique identique à tous les clients.

### J. Tracking côté client

Dans l'espace de suivi aux couleurs de l'agence :

### Agence Cargo

Suivi de votre colis

SLV-003001

Disponible pour retrait

* Reçu

* Expédié

* Arrivé

* Disponible pour retrait

Le lieu et les horaires de retrait sont affichés lorsqu'ils sont renseignés par l'agence.

Lorsque la remise est confirmée, Tracking affiche `Livré / Retiré`.

Il ne doit pas exposer les notes internes, les autres clients ou les détails financiers de l'agence.

### K. Erreurs et corrections

Une remise peut être confirmée par erreur. Il faut prévoir une correction contrôlée plutôt que permettre de changer librement le statut dans une liste déroulante.

Règles :

* Seul un utilisateur autorisé peut corriger une remise.

* L'événement initial reste traçable.

* La correction précise quel état opérationnel doit être rétabli.

* Tracking et Communication utilisent ensuite l'état corrigé.

* Une même remise ne peut pas être confirmée deux fois à cause d'un double clic ou de deux agents simultanés.

Ces contrôles sont nécessaires pour conserver un historique fiable.

### L. Responsabilités des modules

| Information ou action         | Responsable              |
| ----------------------------- | ------------------------ |
| État du colis                 | Colis                    |
| Disponibilité pour retrait    | Colis                    |
| Confirmation de remise        | Colis                    |
| Colis non retirés             | Vue dérivée de Colis     |
| Paiement requis avant remise  | Finance                  |
| Notification de disponibilité | Communication            |
| Relance de non-retrait        | Communication            |
| Suivi visible au client       | Tracking                 |
| Lieu et horaires de retrait   | Informations de l'agence |

Aucun de ces modules ne doit conserver une deuxième version contradictoire du statut du colis.

### M. Ce que nous ne construisons pas

Nous ne rajoutons pas de gestion de chauffeurs, de tournées de livraison, de géolocalisation des véhicules, de signatures obligatoires, de stockage payant automatique ou de procédures douanières supplémentaires.

Ces fonctions ne sont pas nécessaires pour couvrir les besoins validés ici.

### Architecture finale de 03.05

```text
                   EXPÉDITION
                       │
                       ▼
                SHIPMENT_ARRIVED
                       │
                       ▼
                    COLIS
                    ARRIVÉ
                       │
           ┌───────────┴───────────┐
           │                       │
     Agence avec étape       Agence sans étape
     de disponibilité        de disponibilité
           │                       │
           ▼                       │
     PARCEL_READY_FOR_PICKUP        │
           │                       │
           ├── Tracking            │
           ├── Communication       │
           └── Relance si attente  │
           │                       │
           └───────────┬───────────┘
                       ▼
              Vérification éventuelle
                     Finance
                       │
                       ▼
                Remise effective
                       │
                       ▼
                PARCEL_DELIVERED
                       │
           ┌───────────┼───────────┐
           ▼           ▼           ▼
         Colis       Tracking   Communication
         Livré       Livré      si configurée
```

### Décision finale

03.05 — Disponibilité, retrait et remise est terminé.

Il complète le Module-03 sans créer un Module-09 artificiel. Les agences peuvent maintenant gérer le cycle complet :

Reçu → Expédié → Arrivé → Disponible pour retrait (si applicable) → Livré.

Le Module-03 reste le propriétaire de toutes les opérations liées à l'état physique d'un colis.
______

D'accord. Nous allons garder le Module-03 simple, pratique et adapté aux besoins immédiats des agences Cargo, sans le surcharger.

Voici le périmètre corrigé et retenu.

### MODULE-03 — COLIS : Compléments validés

| Section          | Fonctionnalité                                | Décision    |
| ---------------- | --------------------------------------------- | ----------- |
| 03.06            | Réception physique des colis                  | Retenue     |
| 03.07            | Localisation et stockage                      | Retenue     |
| Photos des colis | Prise, consultation et partage au client      | Prioritaire |
| 03.08–03.11      | Scan avancé, transferts, inventaire et autres | Reportés    |

### 03.06 — Réception physique

L'agent enregistre le colis reçu avec les informations essentielles : client, lieu de réception, référence fournisseur si disponible, poids si connu et photos facultatives.

Les photos doivent pouvoir être ajoutées dès la réception.

### 03.07 — Localisation et stockage

L'agent peut indiquer où se trouve le colis : par exemple, Guangzhou, zone A ou étagère B3.

La localisation détaillée reste facultative pour ne pas compliquer le travail des petites agences.

### Photos — Fonctionnalité intégrée à la fiche Colis

Photos du colis

![Reusing Corrugated Boxes Creatively - Imperial Paper Co.](https://images.openai.com/static-rsc-4/sxs--lG3efzVfuzR8M5yPZBBY256ayWiAUMFwYxsRBebL9o2iQ1M6lxsOY-kzJXWSe_lQwgqdyiM0s6JWvoY-Lf928ulVn-Edba5PPopylBZcwrImCgcRlFnDmahLqWjenk4WrwyduPtj_8G0DoVHgG5Apjhg_IbardVxTWbuoy3qrVdvP87MA4Xhwi2GREl?purpose=fullsize)

![Go viral with TikTok Fulfilment | Zendbox | eCommerce Fulfilment](https://images.openai.com/static-rsc-4/Han1E4fcGANak1Lt8rtxLkFgpHMXgWIUf0sIUOa00l67WdB8Pvk6HMnubg-0PG0a7q0DByECM0u6XQRUChK5Hid9ZrGUL75016XfMWe2XDIzXVCRzEs-QW8Y9DXdMH86W_W8vNc4zCb7PbFMp9ORW0AsKTaDtFE_ANanJuMMCRiCdngQM9ImFPtLE81c7YJ5?purpose=fullsize)

Photos internesPartage client autorisé

Illustration du type de photos que l'agent peut joindre à un colis.

L'agent peut prendre ou ajouter plusieurs photos et choisir celles qui seront visibles par le client.

Les photos autorisées peuvent être consultées dans la page de suivi du client (Module-05) ou envoyées via WhatsApp (Module-06), notamment avec une notification de réception.

Les photos internes restent privées. Le partage doit respecter les permissions et ne pas exposer les étiquettes ou informations personnelles d'autres clients.

Décision définitive pour cette étape : nous conservons uniquement `03.06`, `03.07` et les photos intégrées aux colis. Le reste est reporté, sans ajout de nouvelles sections pour le moment.

Nous pouvons poursuivre l'audit des autres modules avec cette même philosophie : ajouter uniquement ce qui apporte une valeur immédiate aux agences Cargo.
_________

Ajout à mistral 


Oui, absolument. Lors de la création d'un colis dans Slaivio, l'agent doit sélectionner le service de transport utilisé. C'est même une information essentielle, car elle détermine notamment la route disponible, la tarification applicable et le type d'expédition auquel le colis pourra être associé.

Nous devons donc l'ajouter explicitement dans Opérations → Colis → Nouveau colis.

### 1\. Comment organiser le formulaire « Nouveau colis » ?

Je recommande un panneau latéral droit avec quatre sections, plutôt qu'une grande page complexe.

Opérations / Colis

### Nouveau colis

Exemple

1\. Client

Client \*Marie Kabeya

2\. Transport

Service utilisé \*Cargo aérien

Route \*Guangzhou → Kinshasa

Dans le produit réel, seules les routes autorisées pour le service choisi seront proposées.

3\. Informations du colis

Référence fournisseur (facultatif)

Description

Poids (kg) — si connu

État opérationnelReçu

La référence interne Slaivio sera générée automatiquement.

4\. Réception et photos

Ajouter les photos du colis, son lieu de réception et son emplacement de stockage, si le colis a été physiquement reçu.

Examiner la création du colisPrototype de formulaire. Aucun colis réel n'est créé.

### 2\. Comment le service fonctionne avec les autres modules ?

Voici le lien logique :

Gestion → Services & Routes

L'agence configure les services et les routes disponibles.

Gestion → Tarification

L'agence définit les grilles de prix applicables.

Opérations → Colis → Nouveau colis

L'agent choisit le service et la route du colis.

Tarif applicable

Le système calcule un montant si les données nécessaires sont disponibles.

Opérations → Expéditions

Le colis pourra être affecté à un départ compatible.

### 3\. Quelques règles métier indispensables

| Situation                                 | Comportement de Slaivio                                    |
| ----------------------------------------- | ---------------------------------------------------------- |
| L'agent sélectionne « Cargo aérien »      | Afficher les routes compatibles avec ce service            |
| L'agent sélectionne « Groupage maritime » | Proposer les routes maritimes autorisées                   |
| Le poids du colis est inconnu             | Autoriser l'enregistrement, calculer plus tard             |
| Le service possède une grille tarifaire   | Calculer le prix lorsque les informations sont suffisantes |
| Aucun tarif n'est configuré               | Afficher « Tarif à définir », sans inventer de montant     |
| Le colis doit rejoindre une expédition    | Proposer uniquement les départs compatibles                |
| Le service est modifié après facturation  | Exiger une réévaluation explicite, avec traçabilité        |

Il faut également distinguer le service de l'expédition :

* Service : Cargo aérien, Groupage maritime, Express, etc. C'est ce que le client achète.

* Expédition : le départ concret auquel son colis sera affecté, avec une date, une route et éventuellement un manifeste.

Un agent peut donc créer un colis en sélectionnant « Cargo aérien » sans connaître encore le vol ou la date de départ.

### 4\. Où afficher le service après la création ?

Le service doit rester visible dans trois endroits :

Liste des colis : une colonne « Service », éventuellement masquable pour garder le tableau compact.

Fiche colis : dans les informations générales, à côté de la route, de la référence et du statut.

Expéditions : dans les critères d'affectation des colis à un départ.

Décision finale à intégrer au cahier des charges : dans Slaivio, chaque colis doit être rattaché à un client, un service commercial et une route, avec une référence interne générée automatiquement. Le service et la route doivent provenir des configurations de l'agence, et non de champs libres.

Le prix peut rester à calculer si le poids, le volume ou d'autres données nécessaires ne sont pas encore connus. L'affectation à une expédition se fait ensuite, lorsqu'un départ compatible existe.
