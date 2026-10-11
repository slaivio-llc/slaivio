MODULE-04 — EXPÉDITIONS & DÉPARTS
04.01 — Registre des expéditions
Le module Colis est terminé ✅. On passe à l’objet qui permet de regrouper plusieurs colis pour un même mouvement logistique.
La distinction fondamentale est :
CLIENT
   ↓
COLIS
   ↓
EXPÉDITION
   ↓
DÉPART
   ↓
ARRIVÉE

Un client peut avoir plusieurs colis, et une expédition peut contenir les colis de plusieurs clients.
EXPÉDITION EXP-0048
│
├── SLV-002841 → Jean Mukendi
├── SLV-002842 → Sarah Traoré
├── SLV-002843 → Patrick Ilunga
└── ...

C'est notamment ce qui permettra ensuite de produire le manifeste.

A. À quoi sert une expédition ?
L'expédition représente un mouvement réel de marchandises entre une origine et une destination.
Elle permet à l'agence de dire :
« Ces colis partent ensemble de ce point vers cette destination. »
C'est différent du colis.
COLIS
= marchandise d'un client

EXPÉDITION
= mouvement regroupant des colis

Cette séparation est essentielle pour éviter de répéter les mêmes informations de transport sur des centaines de colis.

B. Écran principal
Dans la navigation :
Expéditions

ouvre :
Expéditions                         [+ Nouvelle expédition]

[🔎 Rechercher une expédition...]

[Filtres]

──────────────────────────────────────────────────────
RÉFÉRENCE    TRAJET                 ÉTAT       DÉPART
──────────────────────────────────────────────────────
EXP-0048     Guangzhou → Kinshasa   Partie      12 oct.
EXP-0049     Guangzhou → Ouaga      Prévue       —
EXP-0050     Bruxelles → Kinshasa   Arrivée     05 oct.
──────────────────────────────────────────────────────

Nous restons encore une fois sur les informations essentielles.

C. Référence
Chaque expédition possède sa propre référence :
EXP-0048

Elle est générée par Slaivio.
Elle est différente des références colis :
EXP-0048
   │
   ├── SLV-002841
   ├── SLV-002842
   ├── SLV-002843
   └── SLV-002844

Cela permet de retrouver aussi bien un mouvement complet qu'un colis individuel.

D. Origine et destination
Une expédition doit savoir d'où elle part et où elle va.
Exemple :
Guangzhou
    ↓
Kinshasa

ou :
Guangzhou
    ↓
Ouagadougou

ou pour LUZA :
Bruxelles
    ↓
Kinshasa

Ces lieux doivent venir de la configuration opérationnelle de l'organisation lorsque Slaivio les connaît.
On évite donc les variantes saisies librement comme :
Guangzhou
Guang Zhou
GZ
Chine Guangzhou

pour désigner le même lieu.

E. Route ≠ expédition
Il faut immédiatement distinguer :
ROUTE
Guangzhou → Kinshasa

de :
EXPÉDITION
EXP-0048
Guangzhou → Kinshasa
Départ réel du 12 octobre

La route est une configuration réutilisable.
L'expédition est une occurrence opérationnelle réelle.
Par exemple :
Route
Guangzhou → Kinshasa
       │
       ├── EXP-0045
       ├── EXP-0046
       ├── EXP-0047
       └── EXP-0048

La configuration détaillée des routes appartiendra au module Routes.

F. État de l'expédition
Il faut éviter ici aussi une énorme liste de statuts.
Le cycle métier minimal est :
PRÉVUE
   ↓
PARTIE
   ↓
ARRIVÉE

Avant le départ, l'équipe prépare l'expédition et y rattache les colis.
Quand elle part réellement :
[Confirmer le départ]

elle devient :
Partie

Quand elle arrive :
[Confirmer l'arrivée]

elle devient :
Arrivée


G. Pourquoi « Prévue » ?
Contrairement au colis, une expédition doit exister avant son départ.
L'équipe doit pouvoir :
la créer ;
y affecter les colis ;
préparer son manifeste ;
puis confirmer son départ.
Donc :
EXP-0049

Guangzhou → Ouagadougou
État : Prévue

ne signifie pas que les colis sont déjà expédiés.
C'est précisément une distinction importante.

H. Colis et expédition prévue
Supposons :
SLV-002841
Statut colis : Reçu

On l'ajoute à :
EXP-0049
État : Prévue

Le colis reste :
Reçu

et non :
Expédié

Nous avions posé cette règle dans MODULE-03.
Ce n'est que lorsque :
EXP-0049
[Confirmer le départ]

est effectué que l'événement de départ est produit.

I. Nombre de colis
Dans le registre, une colonne peut devenir utile :
EXP-0048
Guangzhou → Kinshasa
245 colis
Partie

Cette valeur n'est jamais saisie manuellement.
Elle est calculée :
COUNT(
  colis rattachés à EXP-0048
)

Donc aucun champ :
Nombre de colis
[245]

dans la création de l'expédition.

J. Recherche
🔎 Rechercher une expédition...

La référence doit naturellement fonctionner :
EXP-0048

On pourra également retrouver les expéditions selon leur contexte opérationnel, mais on évite de transformer la barre de recherche en moteur universel avant d'avoir défini les données du module.

K. Filtres
Les premiers filtres directement justifiés sont :
État
[ Tous ]

Origine
[ Toutes ]

Destination
[ Toutes ]

Date
[ Toutes les dates ]

Pour une petite agence n'ayant qu'un seul corridor, les filtres redondants peuvent être masqués.
Encore une fois :
La complexité de l'interface doit suivre celle de l'agence.

L. Action principale
+ Nouvelle expédition

Cette action ouvrira le workflow suivant.
Elle ne doit pas demander 20 informations logistiques simplement parce que d'autres logiciels freight le font.
Nous déterminerons les données nécessaires à partir de ce que représente réellement l'expédition.

M. Départ et manifeste ne sont pas trois objets artificiellement séparés
LUZA a demandé :
gestion des départs et manifestes, affectation des colis à un départ, listes/manifestes automatiques.
Il faut donc couvrir ces besoins.
Mais nous n'allons pas automatiquement créer trois modules indépendants :
Expéditions
Départs
Manifestes

si cela oblige l'utilisateur à saisir trois fois la même opération.
La logique peut être beaucoup plus naturelle :
EXPÉDITION
│
├── Informations
├── Colis
├── Départ
├── Arrivée
└── Manifeste généré depuis les colis

Le manifeste devient alors un document de l'expédition, plutôt qu'une nouvelle couche métier inutile.

N. Exemple Burkina Faso
L'agence crée :
EXP-0102

Guangzhou
     ↓
Ouagadougou

État
Prévue

Elle rattache progressivement :
SLV-003001
SLV-003002
SLV-003003
...

Tous restent :
Reçu

Puis, lorsque le chargement part réellement :
[Confirmer le départ]

Slaivio produit :
EXP-0102
Prévue → Partie

        +

SHIPMENT_DEPARTED
        │
        ├── SLV-003001 → Expédié
        ├── SLV-003002 → Expédié
        └── SLV-003003 → Expédié

        +

Historique

        +

Notifications configurées

Une seule opération métier synchronise tout.

O. Exemple LUZA
Même architecture :
EXP-0218

Bruxelles
   ↓
Kinshasa

167 colis

Pas besoin de développer un système spécial « LUZA ».
C'est exactement ce que nous cherchons avec Slaivio :
UNE ARCHITECTURE
       ↓
plusieurs agences
       ↓
plusieurs corridors
       ↓
plusieurs pays

sans coder une logique différente pour chaque client.

P. Multi-bureaux
Pour une organisation plus grande :
EXPÉDITIONS

Guangzhou → Kinshasa
Guangzhou → Lubumbashi
Guangzhou → Ouagadougou
Guangzhou → Bobo-Dioulasso
Bruxelles → Kinshasa

Chaque utilisateur ne voit que ce que son périmètre organisationnel lui permet de consulter.
Ce contrôle vient du modèle Organisation/Permissions, pas d'une duplication des expéditions.

Q. Mobile
Expéditions                   [+]

🔎 Rechercher

EXP-0048
Guangzhou → Kinshasa
Partie
245 colis
12 oct.

──────────────────

EXP-0049
Guangzhou → Ouagadougou
Prévue
86 colis

──────────────────

EXP-0050
Bruxelles → Kinshasa
Arrivée
132 colis

Pas de tableau desktop écrasé sur téléphone.

04.01 — Architecture retenue
REGISTRE EXPÉDITIONS
│
├── Référence
│
├── Origine
│
├── Destination
│
├── État
│
├── Date pertinente
│
├── Nombre de colis
│   └── calculé
│
├── Recherche
│
├── Filtres
│
├── Permissions / scope
│
└── + Nouvelle expédition

Avec le cycle :
PRÉVUE
   │
   │ départ réel
   ▼
PARTIE
   │
   │ arrivée réelle
   ▼
ARRIVÉE

et surtout :
Expédition prévue
      ≠
Colis expédié

Expédition partie
      =
événement réel de départ
      ↓
colis concernés → Expédié

Principe 04.01 : l'expédition est le mouvement collectif des colis. Elle devient la source de vérité du départ et de l'arrivée, tandis que chaque colis conserve son propre suivi.
La prochaine étape est 04.02 — Création d'une expédition et affectation des colis, où il faudra déterminer exactement ce que l'agent renseigne, comment il ajoute 10, 100 ou 1 000 colis sans complexifier l'opération, et comment éviter qu'un même colis soit placé par erreur dans deux expéditions actives.
_____________



Oui. Je reprends 04.02 entièrement, parce qu’il faut corriger un point de conception : une expédition prévue ne sert pas seulement à regrouper des colis. Elle devient aussi un objet opérationnel vivant autour duquel l’agence planifie, informe, modifie, retarde, confirme le départ et gère les personnes concernées.
MODULE-04 — EXPÉDITIONS & DÉPARTS
04.02 — Création, planification et préparation d’une expédition
1. Ce que représente réellement une expédition
Une expédition représente un mouvement collectif de marchandises :
EXP-0102

Guangzhou
    ↓
Ouagadougou

Départ prévu : 15 octobre

Elle possède deux dimensions qu’il ne faut pas mélanger :
EXPÉDITION
│
├── OPÉRATIONS
│   ├── préparation
│   ├── colis affectés
│   ├── manifeste
│   ├── départ
│   └── arrivée
│
└── INFORMATION
    ├── annonce du prochain départ
    ├── modification du départ
    ├── retard
    ├── information importante
    └── communications aux personnes concernées

C’est cette deuxième dimension qui manquait.

A. Création
Depuis :
Expéditions                         [+ Nouvelle expédition]

l’agence crée :
┌─────────────────────────────────────────────┐
│ Nouvelle expédition                      × │
│                                             │
│ Origine *                                   │
│ [Guangzhou                             ▼]   │
│                                             │
│ Destination *                               │
│ [Ouagadougou                           ▼]   │
│                                             │
│ Départ prévu                                │
│ [15 / 10 / 2026]                            │
│                                             │
│                           [Annuler] [Créer] │
└─────────────────────────────────────────────┘

Le départ prévu peut rester vide si l’agence n’a pas encore fixé la date.
Slaivio génère :
Référence        EXP-0102
État             Prévue
Créée le         automatiquement
Créée par        utilisateur connecté


B. Prévu ≠ parti
C’est une règle fondamentale.
Départ prévu
15 octobre

signifie :
l’agence prévoit actuellement de partir le 15 octobre.
Cela ne produit jamais :
SHIPMENT_DEPARTED

Le véritable départ sera une autre action.
On peut donc avoir :
Départ prévu : 15 octobre
Départ réel   : —

Puis :
Départ prévu : 15 octobre
Départ réel   : 16 octobre · 08:32

Les deux informations sont conservées.

C. Fiche après création
← Expéditions

EXP-0102
Guangzhou → Ouagadougou

● Prévue

Départ prévu
15 octobre 2026

86 colis

[+ Ajouter des colis]     [Informer]     [•••]

────────────────────────────────────────────

Aperçu     Colis     Communications     Manifeste

L’onglet Communications a maintenant une vraie justification métier.

D. Affectation des colis
L’agence sélectionne les colis qui doivent partir :
Ajouter des colis à EXP-0102

🔎 Référence, client ou tracking...

☐ SLV-003001   Jean Traoré
☐ SLV-003002   Moussa Kaboré
☐ SLV-003003   Sarah Ouédraogo

3 sélectionnés

                         [Ajouter 3 colis]

Slaivio propose prioritairement les colis compatibles avec l’origine/destination de l’expédition.

E. Affecter ≠ expédier
Après affectation :
SLV-003001

Statut
Reçu

Expédition prévue
EXP-0102

Le colis n’est pas encore Expédié.
Cette règle reste inchangée.

F. Protection contre la double affectation
Si SLV-003001 appartient déjà à une autre expédition prévue incompatible :
⚠ Ce colis est déjà affecté à EXP-0098.

[Voir l’expédition]

Slaivio ne doit pas silencieusement placer le même colis dans deux départs actifs.
Avant le départ, une réaffectation peut être effectuée explicitement.
Après le départ, ce n’est plus une simple modification : il faut une correction opérationnelle traçable.

G. Annoncer un départ prévu
C’est ici que nous intégrons votre correction.
Une fois :
Guangzhou → Ouagadougou
Départ prévu : 15 octobre

l’agence peut sélectionner :
[Informer]

Slaivio prépare alors une annonce de départ prévu.
Informer du prochain départ

Guangzhou → Ouagadougou
15 octobre 2026

Audience suggérée
────────────────────────────

Clients concernés
Contacts WhatsApp intéressés
Autres contacts correspondant à cette route

[Voir les destinataires]

                     [Continuer]


H. Il ne faut surtout pas limiter l’audience aux colis
C’est la différence entre une simple application de tracking et le système que nous voulons construire.
Slaivio peut connaître trois situations :
PERSONNE
│
├── possède déjà un colis
│
├── est déjà cliente mais n'a aucun colis dans ce départ
│
└── n'est pas encore cliente
    mais a contacté l'agence via WhatsApp

La troisième personne peut être commercialement très importante.
Exemple :
« Bonjour, quand est votre prochain départ Chine → Burkina ? »
Lorsque ce départ est créé, cette conversation peut rendre la personne pertinente pour l’annonce.

I. Audience contextuelle
Mais nous ne devons pas envoyer à tous les contacts WhatsApp.
Pour :
Guangzhou → Ouagadougou

Slaivio doit chercher les personnes pertinentes pour ce contexte.
Conceptuellement :
EXPÉDITION
Guangzhou → Ouagadougou
        │
        ▼
Contexte / route
        │
        ▼
Audience potentielle
│
├── clients ayant des colis concernés
│
├── clients ayant manifesté un intérêt
│   pour cette route/service
│
└── conversations WhatsApp dans lesquelles
    cette demande a été identifiée

Puis déduplication :
Jean
├── client
├── possède un colis
└── avait demandé le prochain départ

             ↓

1 destinataire

Pas trois messages.

J. Aperçu obligatoire avant une annonce importante
Avant l’envoi :
Annonce : prochain départ

Guangzhou → Ouagadougou
15 octobre

Destinataires uniques
139

Message
────────────────────────────
Notre prochain départ...

[Modifier le message]

[Voir les 139 destinataires]

[Annuler]                [Envoyer]

L’agence doit savoir qui va recevoir quoi.
Les règles détaillées WhatsApp, templates, consentement, fenêtres de conversation et restrictions du canal seront traitées dans Communication.

K. Les communications d’une expédition ne se limitent pas au prochain départ
Il faut modéliser une catégorie générale :
Événements d’information d’expédition
Par exemple :
EXPÉDITION
│
├── Départ annoncé
├── Date modifiée
├── Retard annoncé
├── Départ confirmé
├── Information importante
└── Arrivée

Mais attention : tous ne sont pas nécessairement des statuts logistiques.
C’est fondamental.

L. Exemple : retard
Supposons :
EXP-0102

Départ prévu
15 octobre

Un problème survient.
L’agence ne doit pas changer le statut du colis en :
Retardé

Le colis est toujours physiquement :
Reçu

L’expédition reste avant son départ.
Le retard est une information relative à la planification.
L’agence peut faire :
[•••]

Modifier le départ prévu
Signaler un retard


M. Signaler un retard
Signaler un retard

EXP-0102
Guangzhou → Ouagadougou

Départ actuellement prévu
15 octobre

Nouvelle date
[18 octobre]

Information aux clients
[...................................]

[Annuler]                 [Continuer]

Si la nouvelle date n’est pas encore connue :
Nouvelle date
○ Connue
● Pas encore déterminée

L’agence ne doit pas être obligée d’inventer une date.

N. Slaivio retrouve les personnes déjà informées
C’est ici qu’une vraie architecture apporte beaucoup de valeur.
Supposons que 139 personnes aient reçu :
Prochain départ :
15 octobre

Puis la date change.
Slaivio sait que ces personnes ont reçu cette information.
Il peut donc afficher :
Départ reporté

15 octobre → 18 octobre

139 personnes ont reçu
l’annonce précédente.

Audience à informer
143 personnes

139 précédemment informées
4 nouvelles personnes concernées

[Voir l’audience]

L’agence ne recherche pas manuellement ses anciennes conversations WhatsApp.

O. Historique de planification
Il ne faut pas écraser :
15 octobre

par :
18 octobre

et perdre l’histoire.
On conserve :
PLANIFICATION

7 oct.
Départ prévu pour le 15 octobre

12 oct.
Départ reporté
15 oct. → 18 oct.

18 oct.
Départ confirmé
08:32

On peut ainsi comprendre plus tard ce qui s’est réellement passé.

P. Différence entre modification et retard
Toutes les modifications de date ne sont pas nécessairement un « incident ».
Si l’agence change simplement son planning avant toute annonce :
15 → 16 octobre

cela peut être une modification du planning.
Si le départ annoncé ne peut pas être respecté et que les personnes doivent être prévenues :
Départ retardé

devient une information métier importante.
L’interface ne doit donc pas automatiquement annoncer publiquement chaque petite modification interne.

Q. Autres situations d’information
Il faut prévoir une architecture suffisamment générale pour des situations comme :
Départ planifié
Modification de la date
Retard
Nouvelle date après retard
Départ réel
Arrivée
Retard d'arrivée / progression perturbée
Information importante concernant l'expédition

Et éventuellement d’autres événements futurs.
Mais je ne crée pas pour autant :
status = delayed
status = rescheduled
status = problem
status = announcement

dans le cycle logistique principal.

R. État physique vs situation opérationnelle
C’est une distinction essentielle pour toute la suite de Slaivio.
Prenons :
EXP-0102

Elle peut avoir :
État physique
Prévue

et simultanément :
Situation
Départ retardé

Les colis restent :
Reçu

Nous avons donc :
ÉTAT LOGISTIQUE
Prévue / Partie / Arrivée

        ≠

ÉVÉNEMENT / INFORMATION
Planifiée
Reportée
Retard
Annonce
Information importante

Cela évite de transformer le moteur de statuts en chaos.

S. Une information importante libre
Il y aura toujours des situations impossibles à prévoir dans une liste.
L’agence doit donc pouvoir communiquer une information concernant l’expédition sans que nous inventions 50 types d’incidents.
Par exemple :
[Informer]

Type

○ Prochain départ
○ Modification du départ
○ Retard
○ Information concernant l'expédition

Le dernier cas permet de couvrir une situation exceptionnelle.
Mais il doit toujours conserver :
expédition concernée
auteur
date
audience
message
résultat d'envoi


T. Départ réel
Lorsque la marchandise quitte réellement le point d’origine, on ne fait plus une annonce de planification.
L’opérateur effectue :
[Confirmer le départ]

Confirmation forte :
Confirmer le départ de EXP-0102 ?

Guangzhou → Ouagadougou

86 colis seront concernés.

Cette action enregistrera leur départ.

[Annuler]           [Confirmer le départ]

Cette protection est importante : une erreur pourrait modifier des centaines de colis.

U. Conséquences du départ
Une seule transaction métier produit :
EXP-0102
Prévue → Partie

Départ réel
18 oct. · 08:32

        ↓

SHIPMENT_DEPARTED

        ↓

86 colis concernés
Reçu → Expédié

        ↓

Historique

        ↓

Tracking client

        ↓

Notifications configurées

À partir de là, nous sommes dans un fait opérationnel, plus dans une prévision.

V. Retard après le départ
Autre situation importante.
Une expédition peut déjà être :
Partie

et subir ensuite un retard pendant son trajet.
Elle ne revient surtout pas à :
Prévue

Elle reste :
Partie

avec un événement :
Retard signalé

Puis les personnes concernées peuvent être informées.
Exemple :
EXP-0102

● Partie

Information
Retard signalé

[Informer les clients concernés]

Cela confirme pourquoi retard ne doit pas être le statut principal de l'expédition.

W. Qui informer après le départ ?
La logique change selon l’événement.
Prochain départ
Audience potentiellement commerciale :
clients
+
contacts WhatsApp intéressés

Retard d’une expédition déjà partie
Audience principalement opérationnelle :
clients ayant réellement
des colis dans EXP-0102

On ne doit pas forcément informer quelqu’un qui avait simplement demandé le prochain départ trois semaines auparavant mais qui n’a finalement rien expédié.
Modification d’un départ annoncé
Audience :
personnes ayant reçu l'annonce
+
nouvelles personnes désormais concernées

C’est donc l’événement qui détermine l’audience, pas une liste de diffusion unique.

X. Arrivée
Même logique lorsque l’expédition arrive :
[Confirmer l'arrivée]

puis :
SHIPMENT_ARRIVED

EXP-0102 → Arrivée

colis concernés → Arrivé

historique mis à jour

tracking mis à jour

notifications selon configuration

Nous approfondirons la confirmation départ/arrivée dans la fiche Expédition.

Y. Communications de l’expédition
La fiche peut montrer :
COMMUNICATIONS

18 oct. · 08:34
Départ confirmé
61 clients concernés
Envoyé

────────────────────────

15 oct. · 09:12
Retard annoncé
139 destinataires
Envoyé

────────────────────────

8 oct. · 11:04
Prochain départ
139 destinataires
Envoyé

Cliquer ouvre le détail dans Communication.
L’expédition ne devient pas elle-même une Inbox.

Z. Manifeste
Les colis affectés permettent toujours de générer le manifeste :
EXP-0102
│
├── 86 colis
│
└── Manifeste

Le manifeste représente le chargement.
Les communications représentent l’information envoyée autour de ce mouvement.
Ce sont deux responsabilités différentes.

Architecture définitive de 04.02
CRÉER EXPÉDITION
│
├── Origine
├── Destination
└── Départ prévu
        │
        ▼
EXPÉDITION PRÉVUE
│
├── Affecter les colis
│
├── Préparer le manifeste
│
└── Gérer la planification
│
├──────────────────────────────────┐
│                                  │
▼                                  ▼
OPÉRATIONS                    COMMUNICATION
│                                  │
├── Ajouter colis                  ├── Annonce départ
├── Retirer colis                  ├── Date modifiée
├── Réaffecter                     ├── Retard
├── Manifeste                      ├── Nouvelle date
│                                  └── Information importante
│
▼
CONFIRMER DÉPART
│
▼
SHIPMENT_DEPARTED
│
├── Expédition → Partie
├── Colis → Expédié
├── Historique
├── Tracking
└── Notification des clients concernés

Et après le départ :
EXPÉDITION PARTIE
│
├── progression normale
│
├── retard / information
│       └── informer les clients concernés
│
└── arrivée réelle
        ↓
SHIPMENT_ARRIVED

Règle centrale à conserver pour Slaivio
Chaque événement doit déterminer son audience.
Ainsi :
Prochain départ
→ clients + prospects/contacts WhatsApp pertinents

Départ reporté
→ personnes précédemment informées + personnes concernées

Départ réel
→ clients ayant des colis concernés

Retard en transit
→ clients ayant des colis dans l'expédition

Arrivée
→ clients ayant des colis concernés

C’est beaucoup plus solide qu’un système où chaque événement envoie simplement « à tous les clients ».
04.02 est maintenant suffisamment complet. On peut passer à 04.03 — Fiche Expédition et pilotage du départ jusqu’à l’arrivée, sans rajouter artificiellement d’autres morceaux à 04.02.
___________

MODULE-04 — EXPÉDITIONS & DÉPARTS
04.04 — Manifeste d’expédition
Le manifeste est explicitement demandé dans les besoins terrain : une agence doit pouvoir affecter ses colis à un départ puis obtenir automatiquement la liste correspondant à ce départ.
La règle de conception est simple :
Le manifeste n’est pas une deuxième base de données. C’est une représentation structurée des colis réellement affectés à une expédition.
Donc aucune ressaisie des colis.

A. Où se trouve le manifeste ?
Dans la fiche :
EXP-0102
Guangzhou → Ouagadougou
● Prévue

Aperçu    Colis    Communications    Manifeste

Onglet :
MANIFESTE

EXP-0102
Guangzhou → Ouagadougou

86 colis

[Exporter]

Il reste attaché à EXP-0102.

B. Génération automatique
Puisque Slaivio connaît déjà :
EXP-0102
│
├── origine
├── destination
├── colis
└── clients associés

le manifeste doit être construit depuis ces informations.
Pas :
Créer manifeste
      ↓
Ressaisir 86 colis

mais :
EXPÉDITION
     ↓
COLIS AFFECTÉS
     ↓
MANIFESTE


C. Informations d’en-tête
L’en-tête peut reprendre les informations déjà connues :
MANIFESTE D’EXPÉDITION

Référence
EXP-0102

Origine
Guangzhou

Destination
Ouagadougou

Départ prévu
18 octobre 2026

Nombre de colis
86

Après le départ réel :
Départ réel
18 octobre 2026 · 08:32

Ces données ne sont pas saisies une deuxième fois.

D. Contenu de base
Nous devons ici résister à la tentation d’inventer un manifeste douanier complet.
À partir de notre modèle actuel, Slaivio connaît réellement :
Colis
Client
Tracking externe
Poids
Destination
SLV-003001
Jean Traoré
YT83920…
12,5 kg
Ouagadougou
SLV-003002
Moussa Kaboré
—
7 kg
Ouagadougou
SLV-003003
Sarah Ouédraogo
TR8291…
22 kg
Ouagadougou

Ces informations sont donc légitimes.
Nous n’ajoutons pas arbitrairement :
Valeur douanière
HS Code
Numéro de conteneur
Transporteur
Nature marchandise
Assurance
Fournisseur
Dimensions
CBM

tant que ces données ne font pas réellement partie du modèle métier validé.

E. Numéro de ligne
Le manifeste peut naturellement numéroter les lignes :
N°    COLIS          CLIENT
01    SLV-003001     Jean Traoré
02    SLV-003002     Moussa Kaboré
03    SLV-003003     Sarah Ouédraogo

Ce numéro est simplement une présentation du document.
Ce n’est pas une nouvelle identité métier du colis.

F. Total des colis
Slaivio calcule :
Total colis
86

Jamais un champ manuel :
Nombre de colis
[86]

qui pourrait diverger du contenu réel.

G. Poids total
Puisque nous avons déjà introduit le poids des colis, le système peut calculer le poids connu :
Poids renseigné
1 248,5 kg

Mais attention à un cas important.
Si :
86 colis

83 ont un poids
3 n’en ont pas

Slaivio ne doit pas présenter :
Poids total de l’expédition
1 248,5 kg

comme si les 86 colis étaient couverts.
Il faut signaler l’incomplétude :
Poids renseigné
1 248,5 kg

83 / 86 colis avec poids

C’est plus fiable.

H. Contrôle avant départ
Le manifeste peut aider à repérer des données manquantes sans inventer une règle bloquante.
Exemple :
86 colis

Tracking externe
79 renseignés

Poids
83 renseignés

Mais Slaivio ne doit pas automatiquement dire :
Impossible de partir :
3 poids manquants.

sauf si l’agence ou le processus exige réellement cette information.
Information manquante ≠ blocage automatique.

I. Manifeste dynamique avant départ
Pendant la préparation :
EXP-0102
● Prévue

l’équipe ajoute :
+ 10 colis

Le manifeste doit refléter les 10 nouveaux colis.
Elle retire deux colis :
- 2 colis

le manifeste reflète le changement.
Nous ne voulons pas générer des dizaines de documents contradictoires pendant la préparation.

J. Le départ crée une frontière importante
Au moment où :
[Confirmer le départ]

est exécuté, nous savons exactement quels colis sont déclarés partis.
Le système doit conserver cet état historique.
Conceptuellement :
EXP-0102

AVANT DÉPART
Manifeste de préparation
modifiable avec le chargement

         ↓

DÉPART CONFIRMÉ

         ↓

Composition partie
conservée historiquement

Ainsi, si les informations d’un client changent deux mois plus tard, on ne doit pas falsifier ce qui constituait réellement l’expédition au moment de son départ.

K. Pourquoi conserver cette version ?
Supposons :
18 octobre

EXP-0102
86 colis

Puis quelqu’un corrige plus tard une information.
Nous devons pouvoir savoir :
Qu’est-ce qui avait réellement été déclaré dans cette expédition au moment du départ ?
C’est important pour :
audit ;
recherche d’erreur ;
litige ;
contrôle interne ;
historique opérationnel.

L. Export
L’agence doit pouvoir sortir son manifeste de Slaivio.
Par exemple :
[Exporter ▼]

PDF
Excel

PDF pour consultation/partage/impression.
Excel lorsqu’une équipe doit travailler avec les données structurées en dehors de Slaivio.
Le format précis du document sera défini au moment de son implémentation.

M. Impression
Depuis le document :
[Imprimer]

est également logique pour les agences ayant encore des processus physiques.
Slaivio digitalise l’opération sans supposer que tous les partenaires externes utilisent Slaivio.

N. Recherche dans le manifeste
Pour une grosse expédition :
Manifeste
1 247 colis

il doit être possible de rechercher :
🔎 Référence, client ou tracking...

sans parcourir 1 247 lignes.

O. Corrections avant départ
Tant que :
EXP-0102
● Prévue

un colis peut être retiré normalement.
Le manifeste est mis à jour.
86 colis
   ↓
Retirer SLV-003042
   ↓
85 colis


P. Correction après départ
Après :
EXP-0102
● Partie

on ne modifie pas silencieusement la composition historique.
Si une erreur réelle est découverte, elle doit être corrigée par une opération explicite et auditée.
Sinon quelqu’un pourrait transformer après coup :
86 colis partis

en :
82 colis partis

sans aucune trace.
Ce serait dangereux.

Q. Manifeste et communications sont indépendants
Il ne faut pas coupler :
Manifeste généré
      ↓
Notification WhatsApp

Ce sont deux choses différentes.
Le manifeste décrit le chargement.
Les communications dépendent d’événements :
Départ prévu
Départ reporté
Départ réel
Retard
Arrivée

Une erreur d’export PDF ne doit jamais empêcher une notification, et une panne WhatsApp ne doit jamais empêcher la génération du manifeste.

R. Mobile
Sur téléphone, inutile d’afficher un tableau immense.
MANIFESTE

EXP-0102

Guangzhou
   ↓
Ouagadougou

86 colis

[Exporter]

──────────────────

SLV-003001
Jean Traoré
12,5 kg

──────────────────

SLV-003002
Moussa Kaboré
7 kg

──────────────────

Le document PDF/Excel peut conserver une présentation tabulaire adaptée à l’export.

S. Permissions
Tous les utilisateurs autorisés à consulter l’expédition peuvent éventuellement consulter son manifeste selon la politique de l’organisation.
Mais des actions peuvent être séparées :
Voir l’expédition       ✓
Voir le manifeste       ✓
Exporter                ✓
Modifier le chargement  ✕
Confirmer le départ     ✕

Les permissions précises seront centralisées dans Équipe & Permissions.

T. Architecture du manifeste
EXPÉDITION
     │
     ├── Origine
     ├── Destination
     ├── Planification
     │
     └── COLIS AFFECTÉS
              │
              ▼
         MANIFESTE
              │
              ├── aperçu
              ├── recherche
              ├── totaux calculés
              ├── export PDF
              ├── export Excel
              └── impression

Et au départ :
CONFIRMATION DU DÉPART
          │
          ├── SHIPMENT_DEPARTED
          │
          └── composition du départ
                    ↓
             conservée historiquement

MODULE-04 — EXPÉDITIONS & DÉPARTS ✅ TERMINÉ
Nous avons maintenant couvert :
04.01  Registre des expéditions
04.02  Création, planification,
       colis & communications
04.03  Pilotage départ → arrivée
04.04  Manifeste

Le flux métier obtenu est cohérent :
COLIS REÇUS
     ↓
EXPÉDITION CRÉÉE
     ↓
COLIS AFFECTÉS
     ↓
DÉPART PLANIFIÉ
     ├── annonces ciblées
     ├── changements
     └── retards
     ↓
MANIFESTE
     ↓
DÉPART CONFIRMÉ
     ↓
COLIS EXPÉDIÉS
     ↓
retards / informations éventuelles
     ↓
ARRIVÉE CONFIRMÉE
     ↓
COLIS ARRIVÉS

On peut donc fermer Expéditions, plutôt que lui ajouter artificiellement 04.05, et passer au prochain domaine métier distinct.
