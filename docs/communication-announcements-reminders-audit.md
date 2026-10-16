# Audit — Annonces & Relances V1

Date : 2026-10-16

## État existant

- La page Communication relie déjà la messagerie, le centre Annonces/Relances et les connaissances.
- Les annonces/campagnes ont un modèle, des audiences, consentements/suppressions, prévisualisation de destinataires, programmation, approbation, file de tâches, historique, états de livraison et permissions dédiées (`broadcasts.*`).
- Les relances disposent d'un moteur métier et de parcours de brouillon/confirmation/envoi (`followups.*`, `pilot.followups.*`), avec des fonctions de détection, règles et suivi.
- Les notifications utilisent l'outbox et une réservation de dispatch. Les statuts de livraison doivent provenir des accusés du fournisseur, pas d'une action manuelle.
- Les notifications WhatsApp opérationnelles et les campagnes ne sont pas un même parcours : il faut conserver leurs contrats et leurs permissions propres.

## Premier changement réalisé

- Ajout d'une entrée Communication « Annonces et relances » vers une page commune.
- La page commune propose les onglets Annonces et Relances et réutilise les composants existants.
- Les anciennes routes `/app/broadcasts` et `/app/followups` restent disponibles pour compatibilité.
- Aucune migration, aucun envoi réel et aucune nouvelle infrastructure d'envoi n'ont été ajoutés.

## Corrections de fiabilité réalisées ensuite

- Une campagne destinataire passe maintenant à `DISPATCHING` quand son message entre dans l'outbox, et non à `SENT` avant l'envoi effectif.
- L'état `DISPATCHING` empêche la campagne de se déclarer terminée prématurément.
- L'acceptation/refus explicite du fournisseur met à jour le destinataire lié à l'outbox ; les callbacks de livraison/lecture le mettent ensuite à jour dans le périmètre de l'organisation.
- Les callbacks de livraison ne régressent pas un état `READ` vers `DELIVERED`, ni un état terminal vers un état antérieur.
- Le démarrage d'une campagne utilisait `null` comme valeur Python, ce qui faisait échouer la validation ; la comparaison est corrigée et couverte par test.
- Aucun envoi réel n'a été effectué.
- Une seconde vérification d'éligibilité est maintenant exécutée juste avant l'appel fournisseur : suppressions/consentement commercial pour une annonce, état actuel de la facture ou du retrait et liste d'arrêt pour une relance.
- Les tâches de relance distinguent désormais l'ajout à l'outbox (`DISPATCHING`) de l'acceptation fournisseur (`SENT`). Un état métier résolu ou un opt-out annule l'envoi en attente sans appeler le fournisseur.
- Les relances de paiement exigent une facture avec solde et échéance passée ; les relances de retrait exigent toujours un ordre `READY` ou `NOTIFIED`.
- Les états fournisseur des relances sont projetés vers l'historique d'envoi en tenant compte de l'organisation.
- Les lots de relances pilot restent en cours tant qu'un dispatch est ambigu/en attente et passent en échec partiel si une tentative échoue ou est annulée sans tentative encore active.

## Écarts à traiter dans les prochains lots

1. Vérifier que le statut d'un destinataire distingue clairement la mise en file, l'acceptation fournisseur, la remise et l'échec ; l'ajout à l'outbox ne prouve pas une remise.
2. Auditer les prérequis de canal avant confirmation finale : WhatsApp autorisé/connecté, consentement, modèle approuvé et fenêtre de conversation applicable.
3. Relier les relances financières aux obligations Finance canoniques et refaire l'éligibilité au moment de l'envoi, notamment pour paiements récents et échéances modifiées.
4. Revalider l'état logistique du colis immédiatement avant chaque relance et garantir l'arrêt après livraison.
5. Vérifier les filtres de bureaux sur les audiences, les objets et les tâches, pas seulement l'isolation par organisation.
6. Compléter les tests d'isolation inter-agences, consentement, doublons, changement d'état entre planification et envoi, et panne fournisseur.
7. Confirmer la fiabilité du scheduler et les limites/batchs en production ; les tâches volumineuses ne doivent pas être exécutées dans la requête web.
8. Vérifier l'historique administratif pour auteur, contenu exact, audience figée, décisions d'exclusion et transitions réelles d'envoi.

## Plan proposé

1. Sécuriser et tester les contrôles d'éligibilité et les statuts d'envoi des moteurs existants.
2. Aligner les relances colis et finance sur les services propriétaires, avec nouvelle validation juste avant dispatch.
3. Vérifier les audiences et périmètres bureau, ainsi que les permissions distinctes.
4. Compléter les scénarios d'intégration et documenter les limites opérationnelles.

Ne pas créer un second moteur de campagne, de règles financières ou d'envoi. Ne pas supprimer les parcours existants sans analyse des usages et données.
