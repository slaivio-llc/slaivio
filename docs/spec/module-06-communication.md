MODULE-06 — COMMUNICATION
Le principe architectural devient :
                        COMMUNICATION
                              │
                ┌─────────────┼─────────────┐
                │             │             │
                ▼             ▼             ▼
            WhatsApp        Gmail         TikTok
                │             │             │
                └─────────────┼─────────────┘
                              │
                         Conversations
                              │
                           Slaivio

Slaivio doit comprendre la conversation, le contact, le client et le contexte métier indépendamment du canal utilisé.
Le canal transporte le message. Slaivio gère la relation et le contexte.

06.01 — Boîte de réception unifiée
Les besoins terrain sont déjà très clairs.
L'agence de Kampala nous a expliqué qu'une seule personne pouvait recevoir plus de 100 messages avec toujours les mêmes questions :
Où est ma marchandise ?
Quand arrive-t-elle ?
Combien ça coûte ?
Quand est le prochain départ ?
Que faire en cas de problème ?
Les autres agences ont également demandé des réponses automatiques, des notifications et des communications liées aux opérations.
Le premier élément de Communication doit donc être une Inbox unifiée.

A. Interface principale
COMMUNICATION

[ Toutes ] [ Non traitées ] [ Mes conversations ]

🔎 Rechercher...

──────────────────────────────────────────────────

Jean Mukendi                         WhatsApp
Où est mon colis ?                   10:42
● Nouveau

Paul Kaboré                          WhatsApp
Merci beaucoup                       10:38

Sarah Traoré                         WhatsApp
Quand est le prochain départ ?       10:31

Entreprise ABC                       Gmail
Demande d'informations               Hier

Plus tard, si TikTok fournit un type de conversation exploitable :
Amina                                TikTok
Bonjour, comment fonctionne...       09:18

L'Inbox reste la même.

B. Le canal est une propriété de la conversation
Pas :
WHATSAPP MODULE
├── contacts
├── messages
├── clients
└── IA

GMAIL MODULE
├── contacts
├── messages
├── clients
└── IA

Cela créerait plusieurs CRM parallèles.
Nous voulons :
COMMUNICATION
│
├── Conversation A
│      └── Canal : WhatsApp
│
├── Conversation B
│      └── Canal : Gmail
│
└── Conversation C
       └── Canal : TikTok


C. Conversation ≠ Client
C'est particulièrement important compte tenu du besoin découvert avec les annonces de départ.
Quelqu'un peut écrire :
Bonjour, c'est combien le kilo Chine → Burkina ?
Cette personne n'est pas automatiquement un client.
Slaivio peut connaître :
CONTACT
│
├── téléphone
├── canal : WhatsApp
└── conversation

sans créer immédiatement :
CLIENT CRM


D. Contact qui devient client
Plus tard, cette personne dépose réellement un colis.
À ce moment :
CONTACT
   │
   │ identification / association
   ▼
CLIENT

L'historique pertinent peut rester rattaché à la relation.
On évite donc :
1 message reçu
      ↓
Créer automatiquement un client

qui polluerait le CRM avec tous ceux qui demandent simplement un tarif.

E. Client déjà connu
Jean existe déjà :
CLIENT
Jean Mukendi
+243...

Il écrit depuis son numéro connu.
Slaivio peut résoudre :
Message entrant
      ↓
Identité du canal
      ↓
Client trouvé
      ↓
Contexte client disponible

L'agent voit alors quelque chose comme :
┌─────────────────────────────────────────────┐
│ Jean Mukendi                                │
│ WhatsApp                                    │
│                                             │
│ Jean                                        │
│ Où est mon colis ?                          │
│                                             │
│                           SLAIVIO            │
│ Votre colis SLV-003001...                   │
│                                             │
├─────────────────────────────────────────────┤
│ Écrire un message...                        │
└──────────────────────────────┬──────────────┘
                               │
                 CONTEXTE CLIENT
                 Jean Mukendi
                 +243...
                 
                 Colis actifs : 2
                 SLV-003001
                 SLV-003018
                 
                 [Voir le client]


F. Slaivio ne copie pas les données métier dans Communication
Le panneau peut montrer :
SLV-003001
Expédié

mais Communication ne possède pas ce statut.
Il demande au module Colis/Tracking.
Même principe pour :
montant dû       → Finance
prochain départ  → Expéditions
tarifs           → Tarification
adresse agence   → Organisation/configuration

C'est essentiel pour l'IA future.

G. Comprendre pourquoi la personne écrit
Les demandes terrain nous donnent déjà plusieurs intentions réelles :
Suivi d'un colis
Tarif
Prochain départ
Délai
Adresse / point de dépôt
Paiement
Problème avec une marchandise
Autre demande

Cela ne signifie pas qu'il faut afficher à l'agent un énorme formulaire :
Choisissez l'intention :
[...]

à chaque message.
C'est une information que Slaivio peut utiliser pour comprendre et router la conversation.

H. Exemple : suivi
Jean :
Où est mon colis ?
Slaivio :
Conversation
     ↓
Client identifié
     ↓
Intention : suivi
     ↓
Colis du client
     ↓
Tracking

Si Jean possède un seul colis pertinent :
Votre colis SLV-003001 a été expédié le 18 octobre. Vous pouvez consulter son suivi ici.
[Suivre mon colis]

Si plusieurs colis correspondent :
Vous avez plusieurs colis en cours. Lequel souhaitez-vous suivre ?
ou accès à :
[Voir mes colis]


I. Exemple : prochain départ
Une personne qui n'est pas encore cliente demande :
Votre prochain départ Chine-Burkina est quand ?
Slaivio consulte :
Communication
      ↓
Expéditions
      ↓
Départs prévus

Si :
EXP-0102
Guangzhou → Ouagadougou
18 octobre

est réellement planifiée, Slaivio peut répondre à partir de cette information.
Il ne faut pas que l'IA invente une date à partir d'une ancienne conversation.

J. Ce contact devient intéressant pour une annonce future
Cette conversation nous apprend quelque chose :
Contact
      ↓
a demandé
"prochain départ Chine → Burkina"
      ↓
intérêt opérationnel
Chine → Burkina

Plus tard, lorsque l'agence prépare :
EXP-0108
Guangzhou → Ouagadougou
5 novembre

ce contact peut faire partie de l'audience proposée pour l'annonce du prochain départ.
C'est exactement le besoin que nous avons identifié dans Expéditions.

K. Mais pas de broadcast aveugle
Slaivio ne doit jamais raisonner :
Nouveau départ
      ↓
Tous les contacts WhatsApp
      ↓
ENVOYER

Nous voulons :
ÉVÉNEMENT
      ↓
Contexte
      ↓
Audience pertinente
      ↓
Déduplication
      ↓
Aperçu
      ↓
Confirmation / règle agence
      ↓
Envoi


L. Une conversation peut être prise en charge par un humain
L'objectif n'est pas :
IA = supprimer les agents.
Certaines conversations doivent passer à l'équipe.
Exemple :
Client :
Mon colis est arrivé endommagé.

Slaivio peut déterminer que cette situation nécessite une prise en charge humaine.
IA
 ↓
Passage à l'équipe
 ↓
Agent

L'agent récupère la conversation avec son contexte.

M. État simple de traitement
Pour éviter qu'une équipe de plusieurs personnes réponde deux fois au même client, il faut au minimum distinguer la prise en charge.
Par exemple :
Nouveau
   ↓
En cours
   ↓
Résolu

L'objectif n'est pas de créer dix statuts de support.
Nous ajouterons uniquement ceux qui deviennent nécessaires au fonctionnement réel.

N. Attribution
Dans une petite agence :
Support
1 personne

Slaivio ne doit pas compliquer l'écran avec des mécanismes d'équipe inutiles.
Dans une agence avec plusieurs agents :
Conversation
Jean Mukendi

Assignée à :
Patrick

cela évite que Patrick et Sarah travaillent simultanément sur la même demande.

O. Réponse humaine et réponse assistée
L'agent peut simplement écrire :
[Écrire un message...]

Mais Slaivio peut également lui proposer une réponse basée sur les données.
Jean :
Où est mon colis ?
Suggestion :
Votre colis SLV-003001 a été expédié
le 18 octobre et n'est pas encore
enregistré comme arrivé.

[Utiliser] [Modifier]

L'agent peut :
utiliser
modifier
ignorer


P. Réponse automatique contrôlée
Pour certaines demandes fiables :
adresse
horaires
tarifs configurés
statut réel du colis
prochain départ réellement planifié

l'agence pourra autoriser Slaivio à répondre automatiquement.
Architecture :
MESSAGE
   ↓
Compréhension
   ↓
Données nécessaires
   ↓
Source de vérité
   ↓
Confiance / règles
   ↓
┌───────────────────┐
│ réponse automatique│
│         OU         │
│ suggestion agent   │
│         OU         │
│ transfert humain   │
└───────────────────┘


Q. L'IA n'est jamais la source de vérité
C'est une règle fondamentale de Slaivio.
La mauvaise architecture serait :
Client
"Quand arrive mon colis ?"
       ↓
LLM
       ↓
"Probablement vendredi."

La bonne :
Client
       ↓
Communication
       ↓
Tracking / Expédition
       ↓
Données réelles
       ↓
IA formule la réponse

Si Slaivio ne connaît pas l'information :
Nous n'avons pas encore de nouvelle date d'arrivée enregistrée pour cette expédition.
plutôt qu'une invention.

R. Notifications opérationnelles
Communication ne gère pas seulement les messages entrants.
Il reçoit également des événements du Cargo OS.
PARCEL_RECEIVED
       ↓
Communication
       ↓
Client concerné
       ↓
Canal configuré
       ↓
Message

Même principe :
SHIPMENT_DEPARTED
SHIPMENT_ARRIVED
PAYMENT_DUE
PAYMENT_RECEIVED

lorsque ces événements sont concernés par les règles de l'agence.

S. Le canal est choisi après l'événement
C'est là que votre correction devient particulièrement importante.
Pas :
PARCEL_RECEIVED
       ↓
WHATSAPP_NOTIFICATION

mais :
PARCEL_RECEIVED
       ↓
COMMUNICATION
       ↓
Quel message ?
Quel destinataire ?
Quel canal ?
       ↓
WhatsApp / Gmail / futur canal

Aujourd'hui une agence peut privilégier WhatsApp.
Demain :
réception colis → WhatsApp
facture → Email
support → WhatsApp
document → Email

sans modifier le cœur métier.

T. Historique multicanal
Pour un client connu :
Jean Mukendi

COMMUNICATIONS

Aujourd'hui
WhatsApp
"Où est mon colis ?"

18 octobre
WhatsApp
"Votre colis a été expédié."

10 octobre
WhatsApp
"Votre colis a été réceptionné."

8 octobre
Gmail
"Confirmation..."

Cela donne une vision relationnelle unique sans prétendre que tous les canaux sont identiques.

U. Ne pas fusionner artificiellement les identités
Même nom ne signifie pas automatiquement même personne.
WhatsApp
+243...

Gmail
jean@example...

Slaivio ne doit pas les fusionner simplement parce que les deux affichent :
Jean Mukendi

Lorsqu'une relation fiable avec le même client existe, les canaux peuvent être rattachés à cette identité client.

V. Communication liée à un événement
Chaque message sortant important doit garder son contexte.
Exemple :
Message
"Votre colis a été expédié."

Contexte :
SHIPMENT_DEPARTED
EXP-0102
SLV-003001

Ainsi nous pouvons savoir pourquoi ce message a été envoyé.

W. Échec d'un canal
Supposons :
PARCEL_RECEIVED
       ↓
Communication
       ↓
WhatsApp
       ↓
ÉCHEC

Résultat opérationnel :
Colis = Reçu ✓
Tracking = Reçu ✓

Communication :
Message = Échec

On ne rollback jamais la réception du colis parce qu'un canal externe ne fonctionne pas.

X. Architecture fondamentale
                   SLAIVIO CARGO OS
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
      CLIENTS            COLIS           EXPÉDITIONS
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │
                       TRACKING
                           │
                    ÉVÉNEMENTS MÉTIER
                           │
                           ▼
                    COMMUNICATION
                           │
             ┌─────────────┼─────────────┐
             │             │             │
             ▼             ▼             ▼
         WhatsApp        Gmail         TikTok
             │             │             │
             └─────────────┼─────────────┘
                           │
                         CONTACT
                           │
                    éventuellement
                           │
                           ▼
                         CLIENT

Principe de 06.01
Slaivio n'est pas un outil WhatsApp. Slaivio possède un système de Communication indépendant des canaux. WhatsApp, Gmail, TikTok et les futurs canaux sont des moyens d'entrée et de sortie autour d'une même intelligence métier et d'une même relation client.
C'est cette séparation qui permettra plus tard d'ajouter ou remplacer un canal sans reconstruire Clients, Tracking, Colis, Expéditions ou l'IA.

_______________________


Oui. Là, tu viens de préciser une partie fondamentale de Communication. Il faut corriger 06.02 avant de poursuivre, parce que le fonctionnement doit être beaucoup plus naturel.
Le système ne doit pas ressembler à un chatbot à boutons. L’utilisateur écrit normalement, Slaivio comprend la conversation, récupère les données métier nécessaires et répond naturellement. Et surtout, l’agence décide quelles conversations sont gérées par l’IA et lesquelles restent manuelles.
MODULE-06 — COMMUNICATION
06.02 — Conversation, IA et conversion Contact → Client — VERSION CORRIGÉE
1. Une vraie conversation, pas un chatbot à scénarios
On retire les « actions rapides » du type :
[Voir le colis]
[Voir le suivi]
[Voir le paiement]
[Choisir une demande]

comme logique principale de conversation.
Le client doit pouvoir écrire librement :
Bonjour, je voudrais envoyer des marchandises depuis la Chine. Vous travaillez comment ?
ou :
Mon colis est arrivé ?
ou :
C'est combien le kilo pour Kinshasa ?
ou même :
Bjr svp mn colis là ça en est où ?
Slaivio doit comprendre la demande dans son langage naturel, avec le contexte de la conversation.
Donc :
MESSAGE LIBRE
     ↓
Compréhension du contexte
     ↓
Données Slaivio nécessaires
     ↓
Réponse naturelle

Pas :
Message
  ↓
Menu 1 / 2 / 3 / 4
  ↓
Réponse préprogrammée


2. L’IA doit s’adapter à la conversation
Nous ne hardcodons pas :
SI "prix"
→ réponse A

SI "colis"
→ réponse B

SI "adresse"
→ réponse C

La compréhension est sémantique et contextuelle.
Exemple :
Vous êtes situés où à Guangzhou et si je vous envoie 15 kg ça va coûter combien pour Kinshasa ?
Il y a plusieurs demandes dans un seul message :
adresse
+
tarification
+
destination
+
poids

Slaivio doit pouvoir construire une seule réponse humaine à partir des données disponibles.

3. Mais l’IA ne doit toujours rien inventer
L’intelligence conversationnelle est libre.
Les faits métier, eux, viennent de Slaivio.
                   IA
                     │
              comprend / formule
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
    Tracking     Tarification   Agence
        │            │            │
   état réel     prix réel     infos réelles

L’IA peut être très naturelle dans sa manière de parler sans devenir la source des informations.

4. Mode IA ou mode manuel par conversation
C’est une règle importante.
Chaque conversation/contact doit pouvoir fonctionner selon deux modes :
MODE

● IA
○ Manuel

IA
Slaivio peut prendre en charge la conversation selon les règles de l’agence.
Manuel
L’IA n’envoie pas de réponse à la place de l’agent.
L’équipe humaine répond directement.

5. L’agence peut sélectionner plusieurs conversations
Dans l’Inbox :
COMMUNICATION

☐ Jean Mukendi          Manuel
☐ Sarah Traoré          IA
☐ +226 70 XX XX XX      IA
☐ Entreprise ABC        Manuel
☐ Paul Kaboré           Manuel

L’agent peut sélectionner :
☑ Jean Mukendi
☑ Paul Kaboré
☑ +226 70 XX XX XX

puis :
Passer en :
[IA] [Manuel]

Donc l’agence garde le contrôle.

6. Changement individuel
Dans une conversation :
Jean Mukendi
WhatsApp

Gestion
[ IA ▼ ]

ou :
Gestion
[ Manuel ▼ ]

L’agent peut reprendre la main quand il le souhaite.

7. Le mode appartient à la conversation, pas à WhatsApp
Très important.
Pas :
WhatsApp = IA
Gmail = Manuel

nécessairement.
Nous voulons pouvoir avoir :
Jean / WhatsApp
→ IA

Paul / WhatsApp
→ Manuel

Entreprise ABC / Gmail
→ Manuel

Et demain :
Amina / TikTok
→ IA

Cela respecte notre architecture indépendante des canaux.

8. Passage IA → humain
Même lorsqu’une conversation est en IA, l’IA peut arriver à une situation où elle ne doit pas continuer seule.
Elle conserve alors le contexte et transmet à l’équipe.
Inversement, un agent peut reprendre immédiatement :
Conversation : IA

[Passer en manuel]

À partir de là :
IA
✕ n'envoie plus de réponses

Agent
✓ prend la conversation

Pas besoin de faire croire au client qu’il vient de changer de système.

9. L’IA doit aussi aider l’agence à transformer une demande en client
C’est ici que ta nouvelle règle devient très intéressante.
Quelqu’un écrit :
Bonjour, vous faites Chine-Kinshasa ?
Cette personne est actuellement :
CONTACT

et non :
CLIENT

L’IA répond naturellement avec les informations de l’agence.
Mais elle ne doit pas nécessairement s’arrêter à :
Oui, nous faisons Chine-Kinshasa.
Elle doit pouvoir accompagner la personne vers l’utilisation réelle du service.

10. Conversation commerciale naturelle
Par exemple :
Contact :
Bonjour, je veux faire venir des marchandises depuis Guangzhou.
Slaivio :
Bonjour 👋 Oui, nous prenons en charge les expéditions depuis Guangzhou vers Kinshasa. Quel type de marchandise souhaitez-vous envoyer ?
Le prospect répond :
Des vêtements, environ 20 kg.
La conversation continue naturellement selon les informations réellement disponibles dans l’agence.
Puis, lorsque l’intention devient suffisamment claire :
D'accord, je vais envoyer mes colis chez vous.
À cet instant, la situation change.
CONTACT
   ↓
intention confirmée d'utiliser le service
   ↓
COLLECTE DES INFORMATIONS CLIENT


11. Ne pas créer le client trop tôt
Une personne qui demande :
C'est combien le kilo ?
n’est pas encore forcément cliente.
Une personne qui demande :
Vous êtes où ?
non plus.
Donc pas :
Premier message
     ↓
CLIENT CRM

Nous gardons :
CONTACT
     ↓
conversation
     ↓
intérêt
     ↓
confirmation réelle
     ↓
CLIENT


12. L’IA détecte la confirmation dans la conversation
Il ne faut pas imposer un bouton :
[Je veux devenir client]

La personne peut simplement écrire :
Ok ça me convient, je vais envoyer le colis demain.
ou :
D’accord, donnez-moi l’adresse, mon fournisseur va vous livrer.
ou :
Parfait, je veux travailler avec vous.
Le système comprend que la conversation passe d’une simple demande d’information vers une intention réelle d’utiliser le service.

13. L’IA demande alors les informations de base
Nous devons rester cohérents avec le CRM déjà validé.
Pour un particulier, les informations fondamentales sont :
Nom complet
Téléphone

Mais le téléphone peut déjà être connu par le canal.
Par exemple WhatsApp :
Téléphone
+243812345678

→ déjà connu

Il ne faut pas demander :
Quel est votre numéro WhatsApp ?
alors que la conversation se déroule déjà avec ce numéro.
L’IA demande uniquement ce qui manque réellement.

14. Exemple complet
Contact :
Je voudrais envoyer un colis depuis la Chine vers Kinshasa.
IA :
Bonjour 👋 Oui, notre agence propose ce service. [Réponse naturelle utilisant les informations réelles de l’agence.]
La discussion continue.
Contact :
D’accord ça me convient. Mon fournisseur va envoyer le colis chez vous.
L’IA comprend :
INTENTION CONFIRMÉE

Elle peut répondre naturellement :
Parfait. Pour enregistrer votre envoi à votre nom lorsqu’il sera réceptionné, puis-je avoir votre nom complet ?
Contact :
Jean Mukendi.
Le téléphone est déjà connu.
Slaivio dispose maintenant de :
Nom
Jean Mukendi

Téléphone
+243...

Source
Conversation WhatsApp

Le client peut être créé.

15. Client en attente de colis
Mais il faut faire attention à notre modèle.
En attente du colis ne doit pas devenir arbitrairement un statut CRM universel compliqué.
Le sens métier est simplement :
CLIENT CRÉÉ
     ↓
aucun colis encore réceptionné

Slaivio sait donc naturellement que :
Jean Mukendi
Client

Colis : 0

et que son premier colis est attendu dans le cadre de la relation engagée.
Nous pouvons afficher dans l’expérience opérationnelle quelque chose comme :
Jean Mukendi
En attente du premier colis

si cela aide réellement les agents, mais nous n’avons pas besoin de créer une machine de statuts CRM simplement pour cela.

16. Lorsque le colis arrive
Plus tard :
Fournisseur
     ↓
envoie marchandise
     ↓
Agence réceptionne

L’agent recherche :
Jean Mukendi

et retrouve le client créé depuis Communication.
Puis :
+ Enregistrer un colis
       ↓
Jean Mukendi
       ↓
SLV-003001
       ↓
PARCEL_RECEIVED

Jean passe naturellement de :
Client sans colis

à :
Client
└── SLV-003001

Aucune conversion supplémentaire n’est nécessaire.

17. Deux façons officielles de créer un client
Nous avons donc maintenant une règle importante pour le CRM Slaivio.
Méthode 1 — Création manuelle
Depuis :
CLIENTS

[+ Nouveau client]

L’agent renseigne les informations.
Méthode 2 — Création depuis une conversation
CANAL
   ↓
CONTACT
   ↓
conversation
   ↓
intention confirmée
   ↓
informations manquantes demandées
   ↓
CLIENT CRM

Et cela ne doit pas être spécifique à WhatsApp.
Aujourd’hui :
WhatsApp
→ Contact
→ Client

Demain potentiellement :
Gmail
→ Contact
→ Client

ou un autre canal compatible.

18. L’IA ne doit pas créer silencieusement un client
Même si elle comprend :
Je vais envoyer mon colis.
il faut que les informations nécessaires soient suffisamment établies.
Pas :
"Je suis intéressé"
       ↓
CLIENT CRÉÉ

Nous voulons une vraie progression conversationnelle :
Demande d'information
       ↓
Discussion
       ↓
Intention d'utiliser le service
       ↓
Confirmation
       ↓
Informations nécessaires
       ↓
Création du client


19. Et si la personne change d’avis ?
Exemple :
Finalement je vais attendre le mois prochain.
Si elle n’avait pas encore confirmé et fourni les informations nécessaires :
reste CONTACT

Si elle avait déjà été créée comme client :
nous ne supprimons pas automatiquement son identité CRM simplement parce que son colis n’est finalement pas arrivé.
Le CRM conserve la relation réelle.

20. Entreprise
Si la conversation montre qu’il s’agit d’une entreprise :
Nous sommes ABC Trading et nous voulons travailler avec vous régulièrement.
Nous utilisons le modèle Entreprise déjà défini dans CRM.
L’IA collecte uniquement les informations nécessaires à cette création.
Elle ne construit pas un second modèle CRM dans Communication.

21. L’IA doit connaître l’objectif commercial sans devenir agressive
C’est une nuance importante.
Si quelqu’un demande :
Vous êtes situés où ?
l’objectif n’est pas simplement :
Guangzhou, rue X.
Puis fin de conversation.
La réponse peut naturellement poursuivre :
Nous sommes situés à [adresse configurée]. Si vous souhaitez nous faire parvenir un colis, je peux également vous expliquer comment procéder.
Cela accompagne le contact vers le service.
Mais l’IA ne doit pas forcer chaque personne à s’enregistrer.
La progression dépend de la conversation.

22. Le comportement vient des informations de l’agence
L’agence doit pouvoir fournir à Slaivio ses informations :
services
tarifs
destinations
adresses
conditions
délais
prochains départs
instructions

L’IA utilise ensuite cette connaissance pour mener une conversation naturelle.
C’est précisément ce que nous construirons dans le futur module Connaissances.

23. Pas de réponses rigides
Nous ne voulons pas stocker uniquement :
QUESTION :
"Quelle est votre adresse ?"

RÉPONSE :
"Notre adresse est..."

car le client peut demander :
Votre dépôt en Chine est où ?
ou :
Donne-moi l’adresse de Guangzhou.
ou :
Mon fournisseur doit livrer où ?
ou :
Vous avez un dépôt près de Yiwu ?
Le système doit comprendre l’intention et construire la réponse avec les informations pertinentes.

24. Architecture corrigée
                   MESSAGE
                       │
                       ▼
                     CANAL
                       │
                       ▼
                   CONTACT
                       │
                       ▼
                 CONVERSATION
                       │
                 Mode de gestion
                 ┌─────┴─────┐
                 ▼           ▼
                IA         MANUEL
                 │           │
                 │           ▼
                 │         AGENT
                 │
                 ▼
         Compréhension naturelle
                 │
         ┌───────┼────────┐
         ▼       ▼        ▼
      Données  Knowledge  Données
      métier   agence     client
         │       │        │
         └───────┼────────┘
                 ▼
          Réponse naturelle
                 │
                 ▼
        Intention commerciale ?
                 │
           ┌─────┴─────┐
          NON         CONFIRMÉE
           │             │
     conversation        ▼
       continue     infos nécessaires
                         │
                         ▼
                   CLIENT CRM
                         │
                  en attente de
                  son premier colis
                         │
                         ▼
                 PARCEL_RECEIVED
                         │
                         ▼
                    TRACKING

Règles désormais validées pour Communication
Pas de chatbot à boutons comme expérience principale.
Pas de réponses hardcodées à chaque formulation.
Le client parle naturellement.
L’IA utilise les sources métier de Slaivio pour répondre.
Une conversation peut être IA ou Manuel.
L’agent peut changer individuellement ce mode.
L’agent peut sélectionner plusieurs conversations et les passer en IA ou Manuel.
Le fonctionnement IA/Manuel est indépendant du canal.
Un contact n’est pas automatiquement un client.
L’IA peut accompagner naturellement un contact vers le service de l’agence.
Lorsqu’il confirme réellement vouloir utiliser le service, l’IA collecte les informations CRM manquantes.
Le téléphone n’est pas redemandé si le canal l’a déjà fourni de manière exploitable.
Le client peut donc être créé manuellement ou depuis une conversation.
Une fois créé avant réception, il peut être considéré opérationnellement comme attendant son premier colis, sans inventer une lourde machine de statuts CRM.
À la réception, le colis est directement rattaché à ce client existant.
Cette correction rend Communication beaucoup plus proche de ce que doit être Slaivio : une couche conversationnelle intelligente au-dessus du Cargo OS, et non un bot WhatsApp à scénarios.
________________________


MODULE-06 — COMMUNICATION
06.03 — Notifications & communications déclenchées par les opérations
Maintenant que nous avons défini les conversations entrantes, le mode IA / Manuel et la transformation naturelle Contact → Client, il faut traiter l’autre sens :
Slaivio
   ↓
informe le client

C’est directement validé par les agences interrogées : réception du colis, départ, arrivée, montant à payer, changements ou retards.
Le principe est :
Une opération métier produit un événement. Communication détermine ensuite s’il faut informer quelqu’un, qui doit être informé et par quel canal.

A. Ne pas coder les notifications dans Colis ou Expéditions
Mauvaise architecture :
Colis reçu
   ↓
Envoyer WhatsApp

Expédition partie
   ↓
Envoyer WhatsApp

Expédition arrivée
   ↓
Envoyer WhatsApp

Cela rendrait tout Slaivio dépendant de WhatsApp.
Nous voulons :
PARCEL_RECEIVED
        │
        ▼
COMMUNICATION
        │
        ├── destinataire
        ├── règle agence
        ├── contenu
        └── canal
                │
        ┌───────┼────────┐
        ▼       ▼        ▼
    WhatsApp   Gmail   futur canal


B. Événements actuellement justifiés
À ce stade, nous n’avons besoin que des événements déjà établis dans les modules précédents :
PARCEL_RECEIVED
SHIPMENT_DEPARTED
SHIPMENT_ARRIVED
PARCEL_READY_FOR_PICKUP   si utilisé
PARCEL_DELIVERED

PAYMENT_DUE               lorsque Finance sera construit
PAYMENT_RECEIVED

Et les informations liées à une expédition :
Départ annoncé
Date de départ modifiée
Retard signalé
Nouvelle information importante

Pas besoin d’inventer cinquante événements supplémentaires.

C. Réception du colis
L’agent enregistre :
SLV-003001
Jean Mukendi

[Enregistrer]

Cela produit :
PARCEL_RECEIVED

Communication regarde ensuite la configuration de l’agence.
Si l’information automatique est activée :
PARCEL_RECEIVED
       ↓
Jean Mukendi
       ↓
canal disponible/préféré
       ↓
message

Le client pourrait recevoir naturellement :
Bonjour Jean, nous avons bien réceptionné votre colis à Guangzhou. Sa référence de suivi est SLV-003001. Vous pouvez suivre son évolution ici : [lien]
Le texte ne doit pas obligatoirement être exactement identique pour toutes les agences.

D. Le message doit être au nom de l’agence
Comme pour le portail Tracking, la relation commerciale appartient à l’agence.
Le client ne doit pas recevoir quelque chose ressemblant à :
Slaivio vous informe que...
mais plutôt une communication de son agence.
Slaivio agit derrière :
AGENCE
   ↓
SLAIVIO
   ↓
CANAL
   ↓
CLIENT


E. Départ réel
Nous avons :
EXP-0102
86 colis
61 clients

[Confirmer le départ]

Après confirmation :
SHIPMENT_DEPARTED

Communication détermine les clients réellement concernés par les colis de cette expédition.
EXP-0102
   ↓
86 colis
   ↓
61 clients uniques
   ↓
Communication

Pas 86 messages nécessairement si plusieurs colis appartiennent au même client.

F. Message adapté à plusieurs colis
Jean possède :
SLV-003001
SLV-003018
SLV-003022

tous dans EXP-0102.
Il serait mauvais de lui envoyer trois messages presque identiques en quelques secondes.
Communication doit connaître le destinataire, pas uniquement l’événement brut.
Elle peut produire une communication cohérente du type :
Bonjour Jean, vos 3 colis affectés à notre expédition Guangzhou → Kinshasa ont été expédiés.
Puis fournir l’accès à son suivi.

G. Arrivée
Même principe :
SHIPMENT_ARRIVED
       ↓
colis concernés
       ↓
clients uniques
       ↓
Communication

Le message correspond à la réalité :
Bonjour Jean, votre colis SLV-003001 est arrivé à destination.
ou, lorsque plusieurs colis concernés appartiennent au même client :
Bonjour Jean, vos 3 colis sont arrivés à destination.

H. Arrivé ne signifie pas forcément « venez récupérer »
Nous avons déjà fait cette distinction dans Colis.
ARRIVÉ
≠
DISPONIBLE POUR RETRAIT

pour une agence qui possède une étape supplémentaire avant remise.
Donc Communication ne doit pas transformer automatiquement :
SHIPMENT_ARRIVED

en :
Venez récupérer votre colis.
L’événement doit déterminer ce qu’on peut réellement affirmer.

I. Montant à payer
Prenons les trois agences déjà évoquées.
Agence A
Réception
   ↓
50 % exigible

Agence B
Réception
   ↓
60 % exigible

Agence C
Réception
   ↓
aucun paiement

Communication ne décide pas de ces règles.
Finance produit éventuellement :
PAYMENT_DUE

avec le montant réel concerné.
Communication peut ensuite informer le client.

J. Ne jamais laisser l’IA calculer librement le montant
Pas :
IA :
"Vous devez payer environ 50 $."

mais :
FINANCE
Montant dû : 52 USD
      ↓
COMMUNICATION
      ↓
IA formule naturellement
      ↓
"Le montant actuellement dû
pour votre colis est de 52 USD."

La formulation peut être intelligente.
Le chiffre ne l’est pas.
Il vient de Finance.

K. Paiement reçu
Lorsque Finance connaît :
PAYMENT_RECEIVED

Communication peut, selon la configuration de l’agence, envoyer une confirmation.
Par exemple :
Bonjour Jean, votre paiement de 50 USD a bien été enregistré. Merci.
Encore une fois, l’événement financier est la source.

L. Annonce du prochain départ
Ici, l’audience change complètement.
Prenons :
EXP-0110

Guangzhou → Ouagadougou
Départ prévu : 5 novembre

L’agence souhaite annoncer ce départ.
Les personnes concernées peuvent être :
clients avec colis concernés
+
clients ayant exprimé un intérêt
+
contacts ayant demandé des informations
sur cette route/service

Donc :
EXPÉDITION
     ↓
[Informer du prochain départ]
     ↓
Communication
     ↓
Audience proposée


M. Compréhension conversationnelle de l’audience
C’est particulièrement important avec ce que nous venons de construire.
Une personne avait écrit :
Vous avez un départ Chine Burkina quand ?
Elle n’est peut-être toujours pas cliente.
Mais Communication sait que cette conversation concernait :
Chine → Burkina
+
prochain départ

Elle peut donc devenir pertinente lorsqu’un nouveau départ correspondant est annoncé.

N. Pas de segmentation rigide obligatoire
Nous ne voulons pas obliger l’agent à créer manuellement :
Liste A
Liste B
Liste Chine
Liste Burkina
Liste prospects départ novembre
...

pour chaque situation.
Slaivio doit pouvoir exploiter le contexte déjà connu pour proposer l’audience pertinente.

O. Mais l’IA ne décide pas aveuglément d’envoyer à tout le monde
Avant une communication importante :
Prochain départ
Guangzhou → Ouagadougou
5 novembre

Audience proposée

Clients concernés           63
Contacts intéressés         21

Destinataires uniques       84

[Voir les destinataires]

Puis l’agence décide de poursuivre selon ses règles.
Cela reprend également le besoin historique de prévisualisation avant envoi.

P. Sélection manuelle reste possible
L’intelligence ne doit pas retirer le contrôle humain.
L’agent peut rechercher et sélectionner :
☑ Jean Mukendi
☑ Sarah Traoré
☐ Paul Kaboré
☑ +226 70...

puis communiquer avec ces personnes.
La sélection peut concerner :
1 personne
5 personnes
100 personnes

sans transformer ces contacts en clients.

Q. Retard d’un départ prévu
Exemple :
Départ annoncé
15 octobre

139 personnes ont été informées.
Puis l’agence apprend :
Départ reporté
18 octobre

Slaivio conserve :
15 oct.
annonce initiale
139 destinataires

et sait donc qui a reçu l’information devenue obsolète.
Lors de la mise à jour :
Départ reporté au 18 octobre

Audience proposée

Personnes ayant reçu
l'annonce précédente       139

Nouvelles personnes
concernées                   4

Total unique               143


R. Retard sans nouvelle date
Si l’agence ne connaît pas encore la nouvelle date :
Départ retardé
Nouvelle date : inconnue

Communication ne doit pas obliger l’IA à inventer une date.
Elle peut communiquer naturellement :
Le départ initialement prévu a été reporté. La nouvelle date n’est pas encore confirmée. Nous vous tiendrons informé dès qu’elle sera disponible.

S. Retard pendant le transport
L’expédition est :
EXP-0102
● Partie

Puis :
Retard signalé

L’état reste Partie.
Communication détermine cette fois l’audience à partir des clients ayant réellement des colis dans l’expédition.
Pas les prospects qui avaient simplement demandé la date du départ.
RETARD EN TRANSIT
       ↓
EXP-0102
       ↓
colis
       ↓
clients concernés


T. Information importante libre
Nous avons aussi prévu qu’une agence puisse avoir une information importante sans que nous ayons créé un statut spécifique.
Exemple :
EXP-0102

[Informer]

L’agence fournit l’information.
Communication peut aider à la formuler naturellement et déterminer les personnes concernées.
Cela évite de coder :
INCIDENT_TYPE_01
INCIDENT_TYPE_02
INCIDENT_TYPE_03
...

pour toutes les situations imaginables.

U. Historique des communications
Chaque envoi doit conserver au minimum le contexte nécessaire pour répondre :
Qu'est-ce qui a été envoyé ?
À qui ?
Quand ?
Pourquoi ?
Par quel canal ?
Quel résultat ?

Exemple :
EXP-0102

COMMUNICATIONS

26 oct. · 10:18
Arrivée communiquée
61 clients

21 oct. · 15:42
Retard communiqué
61 clients

18 oct. · 08:35
Départ communiqué
61 clients

12 oct. · 09:10
Départ reporté
143 destinataires


V. Résultat par destinataire
Dans une communication envoyée à 61 clients, il faut pouvoir distinguer :
Envoyé
En attente
Échec

selon ce que le canal permet réellement de connaître.
Parce qu’un envoi global :
61 destinataires

ne signifie pas nécessairement :
61 personnes effectivement atteintes


W. Un échec de communication ne change jamais l’opération
C’est une règle absolue :
SHIPMENT_DEPARTED
        ↓
Expédition = Partie
        ↓
Colis = Expédiés

Puis :
Communication
WhatsApp indisponible
        ↓
ÉCHEC

Le résultat reste :
Expédition = Partie ✓
Colis = Expédiés ✓
Tracking = Expédié ✓

Communication = Échec

Pas de rollback logistique.

X. Canal différent selon la communication
Comme le module est réellement Communication, l’architecture permettra à l’agence de choisir des canaux selon ses usages.
Conceptuellement :
Réception colis
→ canal configuré

Départ
→ canal configuré

Facture
→ canal configuré

Annonce
→ canal configuré

Aujourd’hui WhatsApp pourra être dominant pour les agences ciblées.
Mais aucune règle métier Cargo ne doit dépendre directement de WhatsApp.

Y. IA et notifications ne sont pas la même chose
Il faut également séparer :
Conversation IA
Client écrit
      ↓
IA répond

Communication événementielle
Opération se produit
      ↓
Slaivio informe

Les deux utilisent le même système Communication et les mêmes canaux, mais leur origine est différente.

Z. Architecture de 06.03
                CARGO OS
                    │
         ÉVÉNEMENT MÉTIER
                    │
        ┌───────────┼───────────┐
        │           │           │
 PARCEL_RECEIVED  DEPARTURE   ARRIVAL
        │           │           │
        └───────────┼───────────┘
                    ▼
              COMMUNICATION
                    │
             règle de l'agence
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
     QUI ?       QUOI ?      CANAL ?
        │           │           │
        └───────────┼───────────┘
                    ▼
                 ENVOI
                    │
            ┌───────┼───────┐
            ▼       ▼       ▼
          envoyé attente   échec
                    │
                    ▼
               HISTORIQUE

Principe de 06.03
Slaivio ne doit pas seulement savoir envoyer des messages. Il doit comprendre quel événement vient de se produire, quelles personnes sont réellement concernées, quelle information peut être affirmée et quel canal l’agence souhaite utiliser.
Et surtout, nous gardons la séparation fondamentale : l’IA rend la communication humaine ; elle ne décide jamais elle-même des faits logistiques, des montants ou des événements.


__________€


Le Module-06 Communication n’est pas encore complètement fini. Il manque une partie indispensable à ce que tu as demandé : le contrôle de l’IA par l’agence. Nous avons défini le mode IA/Manuel, mais pas encore précisément comment l’agence pilote cela sans rendre le système compliqué.
MODULE-06 — COMMUNICATION
06.04 — Contrôle IA / Manuel
L’objectif est que le responsable puisse décider très simplement :
« Ces conversations, Slaivio peut les gérer. Celles-ci, mon équipe les gère. »
Sans créer des scénarios ou des règles compliquées.
A. Depuis la liste des conversations
COMMUNICATION

☐ Jean Mukendi             IA
  Où est mon colis ?

☐ Sarah Traoré             Manuel
  J'aimerais envoyer un colis

☐ +226 70 XX XX XX         IA
  Vous êtes situés où ?

☐ Paul Kaboré              Manuel
  J'ai un problème avec mon colis

Le responsable sélectionne une ou plusieurs conversations :
☑ Jean Mukendi
☑ +226 70 XX XX XX
☑ Paul Kaboré

3 conversations sélectionnées

[ Passer en IA ]   [ Passer en manuel ]

C'est tout.
Pas besoin de configurer un arbre de décision.

B. Le mode IA signifie réellement « prise en charge »
Si Jean est en :
Mode : IA

Jean peut écrire :
Bonjour
puis :
Mon fournisseur m'a dit qu'il a envoyé mon colis hier mais je n'ai encore rien reçu comme confirmation, vous pouvez vérifier ?
Slaivio comprend l'ensemble de la demande, consulte les données disponibles et répond naturellement.
Il ne cherche pas seulement un mot-clé colis.

C. L'IA conserve le contexte
Exemple :
Client
Vous faites Chine Kinshasa ?
IA
Oui, l'agence propose ce service...
Client
Et c'est combien ?
L'IA comprend que :
« c'est combien ? »
concerne Chine → Kinshasa.
Puis :
Client
D'accord, je vais envoyer 20 kg.
La conversation précédente fait toujours partie du contexte.
L'expérience doit ressembler à une discussion humaine, pas à :
Veuillez préciser votre demande.
à chaque nouveau message.

D. Une personne peut envoyer plusieurs messages
Les utilisateurs WhatsApp écrivent souvent :
Bonjour
svp
vous faites Chine Kinshasa ?
c'est combien kg ?
Ce n'est pas quatre demandes indépendantes.
Slaivio doit comprendre la conversation comme un ensemble cohérent.

E. Mode Manuel
Lorsque la conversation est :
Mode : Manuel

le message arrive normalement dans Communication.
Client
   ↓
Communication
   ↓
Agent humain

Slaivio ne répond pas automatiquement à sa place.
L'historique et le contexte métier restent disponibles à l'équipe.

F. Reprendre une conversation gérée par l'IA
Même en mode IA, l'agent peut ouvrir la conversation pendant que Slaivio la gère.
Il voit les échanges :
Jean
Je souhaite envoyer 30 kg depuis Guangzhou.

Slaivio
...

Jean
D'accord, je vais utiliser votre agence.

L'agent peut simplement faire :
Mode
IA ▼

→ Manuel

À partir de là, l'IA cesse d'envoyer des réponses dans cette conversation.

G. Redonner ensuite la conversation à l'IA
Après intervention :
Manuel → IA

Slaivio récupère la conversation avec son contexte.
Le client n'a pas besoin de recommencer :
Bonjour, voici mon problème...

H. Création client par l'IA
Le fonctionnement validé devient :
CONTACT
   │
   ▼
Conversation IA
   │
   ├── demande des informations
   ├── questions sur l'agence
   ├── tarifs
   ├── départs
   └── autres échanges
          │
          ▼
   intention réelle confirmée
          │
          ▼
 informations CRM manquantes
          │
          ▼
       CLIENT

L'IA ne transforme donc pas tous les contacts en clients.

I. Deux portes d'entrée vers le même CRM
C'est maintenant une règle d'architecture de Slaivio :
            CLIENT CRM
             ▲        ▲
             │        │
             │        │
       MANUEL        COMMUNICATION
             │        │
     Agent crée    IA accompagne
       client        contact

Dans les deux cas, c'est exactement le même objet Client.
Il ne doit surtout pas exister :
Client WhatsApp
Client manuel

Ce serait une erreur d'architecture.
Il existe simplement :
CLIENT

avec une origine de création conservée dans l'historique si nécessaire.

J. Le canal ne détermine toujours pas l'intelligence
Aujourd'hui :
WhatsApp
    ↓
Communication
    ↓
IA / Manuel

Demain :
Gmail
    ↓
Communication
    ↓
IA / Manuel

Et si un autre canal est intégré :
Nouveau canal
    ↓
Communication
    ↓
IA / Manuel

Le moteur conversationnel reste le même.

K. Ce que nous ne construisons pas
Nous ne rajoutons pas maintenant :
❌ arbre de chatbot
❌ boutons de réponses rapides imposés
❌ scénarios "si mot X → réponse Y"
❌ formulaires dans chaque conversation
❌ 15 niveaux d'automatisation
❌ CRM spécifique WhatsApp
❌ statuts commerciaux inventés

Tout cela irait contre le fonctionnement naturel que nous venons de définir.

Module-06 terminé ✅
Nous avons maintenant couvert ce qui est réellement nécessaire :
06 — COMMUNICATION

06.01  Boîte de réception unifiée
       + architecture multicanale

06.02  Conversations
       + compréhension naturelle
       + Contact → Client
       + création client depuis un canal

06.03  Communications événementielles
       + réception
       + départ
       + arrivée
       + retard
       + paiement lorsque Finance le fournit
       + audiences pertinentes

06.04  Contrôle IA / Manuel
       + individuel
       + sélection multiple
       + reprise humaine
       + retour vers IA

Donc on ferme Communication ici. Ajouter 06.05, 06.06, etc. commencerait à fabriquer de la complexité sans nouvelle demande terrain.
Architecture validée jusqu'ici
01 — Dashboard                     ✅
02 — Clients / CRM                 ✅
03 — Colis                         ✅
04 — Expéditions & Départs         ✅
05 — Tracking & Suivi client       ✅
06 — Communication                 ✅

Le prochain module doit maintenant venir d'un autre besoin réellement exprimé par les agences, pas d'une fonctionnalité que nous imaginons.
