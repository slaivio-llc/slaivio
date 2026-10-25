# Parcours agence : de WhatsApp à la remise du colis

État du contrôle du code au 25 octobre 2026. Ce document décrit la cible et les écarts ; il ne constitue pas une validation en production.

## Parcours attendu

1. Information : répondre depuis les services, tarifs KG/CBM, restrictions et adresses réellement configurés. Si une donnée manque, demander une intervention humaine plutôt qu’inventer un prix.
2. Accord du client : demander son nom complet après une intention explicite d’envoyer un colis. Réutiliser son numéro WhatsApp normalisé et rechercher un client existant dans la même agence avant création.
3. Attente du colis : enregistrer une attente distincte du colis physique. Relancer selon les délais de l’agence ; arrêter après réception, refus, désinscription ou clôture manuelle.
4. Réception réelle : associer le colis au client, saisir ses mesures, joindre des photos et transmettre la référence et le lien de suivi. Ne pas annoncer une réception physique pour une simple préinscription.
5. Départ : contrôler les conditions de transport et de paiement. Les colis non admissibles restent en attente avec un motif compréhensible et une relance adaptée. Annoncer le départ seulement après confirmation opérationnelle.
6. Arrivée : informer le destinataire du bureau de retrait, des horaires, du solde, des justificatifs et des conditions de retrait.
7. Garde : démarrer le délai à partir de la disponibilité effective au retrait à destination, pas de la réception à l’origine. Relancer avant échéance ; calculer ensuite les frais selon la politique convenue, sans double facturation.
8. Paiement : après enregistrement confirmé, transmettre le montant reçu, la devise et le solde exact. Un paiement partiel n’est pas présenté comme un règlement complet.
9. Remise : vérifier le paiement, l’identité et les preuves exigées ; enregistrer la remise et fournir le document papier et numérique avec l’identité de l’agence. Distinguer reçu de paiement, facture et preuve de remise.
10. Plus tard : impression thermique des étiquettes, QR/code-barres et lecture par scanner, après choix du matériel et du protocole.

## État réel des composants inspectés

| Domaine | Présent dans le code | Écart à terminer ou vérifier |
|---|---|---|
| Création IA du client | Parcours qualifié, intention explicite, contrôle de confiance, rapprochement par téléphone, option d’activation de l’agence | Conversion automatique conditionnelle ; les entreprises passent en validation humaine. Vérifier le parcours complet avec le fournisseur WhatsApp configuré. |
| Attente du colis | Relances de prospects et tâches de suivi existantes | La conversion clôture les relances du prospect sans créer une attente de réception dédiée. Ajouter cette étape et ses critères d’arrêt. |
| Réception et suivi | Notifications de jalons, référence exacte, historique public filtré, photos publiques autorisées | Vérifier les écrans de création et d’ajout ultérieur avec un stockage configuré ; poids et volume ajoutés au suivi public dans cette modification. |
| Expéditions | Synchronisation des jalons vers les colis et contrôles de départ existants | Compléter les relances personnalisables des conditions manquantes et leur arrêt dès régularisation. |
| Annonce d’un départ prévu | Publication et sélection de contacts liés au corridor existantes | Ne pas assimiler tout ancien contact à un consentement aux annonces. Prévoir un abonnement explicite et la désinscription. Ne pas annoncer un brouillon. |
| Messages automatiques | Préférences de jalons et file d’envoi présentes | Plusieurs textes restent fixes : centraliser les modèles paramétrables, l’aperçu, les variables autorisées et la version envoyée. |
| Retrait et entreposage | Paramètres de garde, ordre de retrait, rappels et contrôles de remise présents | Calcul de garde ponctuel utilisant la réception et des nombres flottants dans le chemin inspecté : remplacer par une base destination et un calcul monétaire exact, périodique et idempotent. Vérifier le raccordement des rappels à l’envoi effectif. |
| Paiements clients | Montants exacts, contrôle du solde, idempotence, reçu avec identité mémorisée | Le chemin `finance.repository.pay` inspecté ne met pas en file la confirmation WhatsApp du paiement. Raccorder toutes les sources sans doublon. |
| Facture à la remise | Documents financiers et reçu imprimable présents | Livraison automatique du document final à la remise et personnalisation encadrée du modèle à finaliser ; ne pas confondre reçu et facture. |
| Essai gratuit | Essai de 30 jours initialisé et conservé par agence | Rappel déplacé dans la barre supérieure ; plus de bloc de rappel dans les paramètres d’abonnement. Aucun redémarrage de l’essai à chaque visite. |

## Compléments nécessaires pour ne rien manquer

- Un client peut avoir plusieurs attentes, fournisseurs, colis et destinataires ; une réception partielle ne doit pas clore toutes ses attentes.
- Prévoir les colis sans propriétaire identifié, doublons, photos sensibles, avaries, litiges, retours et remises partielles.
- L’adresse à transmettre doit inclure le code client, les consignes fournisseur, les horaires et le contact du bon entrepôt, selon le corridor.
- Séparer les notifications transactionnelles des annonces commerciales ; conserver la preuve du consentement et les exclusions par agence.
- Toutes les notifications doivent être inscrites après un événement réel dans la transaction métier, puis envoyées par une file avec déduplication, reprises bornées et journal d’échec visible.
- Recontrôler les préférences et désinscriptions au moment de l’envoi. Une relance annulée ne doit pas repartir après une reprise du serveur.
- Utiliser le fuseau horaire de l’agence et des heures d’envoi raisonnables ; prévoir une fréquence maximale par client.
- Ne jamais mélanger les devises. Les frais utilisent des décimales, une règle de calcul explicite et une trace auditable ; pas d’application rétroactive silencieuse après changement des paramètres.
- Le suivi public expose uniquement les informations utiles au destinataire, jamais les notes internes, les coordonnées d’autres clients ou les photos non partagées.
- Conserver les documents émis et leur identité visuelle historique ; modifier le logo aujourd’hui ne doit pas réécrire un ancien document.
- L’agence doit voir les messages en attente, envoyés ou échoués, pouvoir intervenir et connaître le motif d’un blocage.

## Ordre de réalisation restant

1. Attentes de réception et modèles de messages communs, avec tâches planifiées et annulation fiable.
2. Confirmation de paiement raccordée à la file d’envoi et tests de paiement partiel, total et rejoué.
3. Disponibilité au retrait, rappels et frais de garde exacts, après validation du mode de facturation (par colis, kg ou CBM, périodicité, franchise et plafond).
4. Document final à la remise, aperçu personnalisable et livraison numérique sécurisée.
5. Annonces de départ sur consentement, suivi des échecs et campagne de recette complète.
6. Impression thermique et scan, dans une étape ultérieure.

## Recette de bout en bout à effectuer avant activation générale

Par agence et par bureau : contact WhatsApp → accord explicite → client unique → attente → réception avec photos → suivi public → blocage puis régularisation → départ réel → arrivée destination → rappels → garde → paiement partiel puis complet → remise → document final.

Répéter avec un redémarrage du serveur, une notification en double, une désinscription, une agence sans connexion WhatsApp, une devise différente et deux clients portant le même nom. Les tests unitaires locaux ne prouvent pas la livraison effective d’un message, l’exécution du planificateur en production ou le fonctionnement d’une imprimante.
