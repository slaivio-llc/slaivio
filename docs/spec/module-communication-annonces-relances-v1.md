# SLAIVIO CARGO OS — Module Annonces & Relances V1

## Mission

Auditer, corriger et développer les fonctionnalités Annonces & Relances dans le module Communication de Slaivio Cargo OS. Créer une solution simple, professionnelle et fonctionnelle pour les agences Cargo, sans construire une plateforme marketing complexe.

## 1. Audit initial

Avant toute modification :

- Examiner le module Communication existant.
- Identifier les fonctionnalités de campagnes, annonces, notifications et relances déjà présentes.
- Vérifier les connexions WhatsApp Business existantes.
- Examiner les modèles Clients, Colis, Expéditions et Finance.
- Identifier les services d'envoi de messages et les permissions.
- Réutiliser les composants et API existants.
- Présenter un plan avant toute modification importante.
- Ne pas supprimer les fonctionnalités opérationnelles.

## 2. Navigation

Conserver l'entrée principale Communication et organiser ses sections :

- Boîte de réception.
- Notifications.
- Annonces & Relances.
- Paramètres.

Dans Annonces & Relances, créer deux onglets : **Annonces** et **Relances**. Ne pas ajouter d'entrée à la sidebar principale.

## 3. Interface utilisateur

Respecter le design system de Slaivio : fond principalement blanc, typographie compacte, tableaux élégants, boutons sobres, filtres discrets, panneaux latéraux droits et interface responsive. Chaque fonctionnalité doit utiliser des données réelles ; aucun bouton fictif.

## 4. Annonces

### Liste

Afficher le titre, le type, l'audience, le canal, la date de création, le statut, le nombre de destinataires et les résultats d'envoi. Les statuts doivent refléter l'état réel : brouillon, programmée, en cours, terminée, annulée ou échouée.

### Création

Le formulaire « Nouvelle annonce » comprend : titre interne, type, message, audience ciblée, canal disponible, envoi immédiat ou programmation, aperçu et confirmation.

Types : prochain départ, arrivée de marchandises, modification d'horaires ou d'adresse, nouveau service, modification tarifaire, fermeture exceptionnelle et annonce personnalisée.

### Ciblage

Permettre le ciblage des contacts éligibles, des clients d'un bureau, d'un service ou d'une route, des clients ayant des colis concernés et des clients sélectionnés manuellement. Ne jamais envoyer une annonce générale lorsqu'elle ne concerne qu'une route ou un bureau. Afficher le nombre de destinataires éligibles avant confirmation.

### WhatsApp

Utiliser uniquement les connexions WhatsApp Business existantes et autorisées. Respecter les modèles approuvés, les fenêtres de conversation et les règles de consentement. Si aucun canal compatible n'est connecté, permettre de préparer l'annonce, sans prétendre qu'elle a été envoyée.

## 5. Relances

Créer l'onglet Relances avec les types suivants :

- Colis arrivé mais non récupéré.
- Rappel de retrait.
- Paiement exigible.
- Dossier incomplet.
- Relance personnalisée destinée à un client ou groupe sélectionné.

La liste affiche le client ou l'audience, le type, le colis/facture/dossier associé, la date prévue, le dernier envoi, le statut et l'action.

Pour chaque type, permettre une configuration simple : activation, délai avant première relance, intervalle, nombre maximal de relances, modèle de message et canal autorisé. Aucun constructeur visuel de workflows en V1.

### Relances financières

Réutiliser Finance. Avant une relance, vérifier facture, solde, montant exigible, échéance et paiements confirmés. Ne jamais relancer un paiement déjà reçu ni un solde qui n'est pas exigible. Finance reste propriétaire de la logique financière ; Communication prépare et envoie les messages.

### Relances de colis

Réutiliser les données Opérations. Avant chaque envoi, vérifier que le colis est toujours disponible, non livré, que le destinataire est autorisé et que la limite de relances n'est pas atteinte. Ne jamais relancer un colis déjà livré.

## 6. Modèles de messages

Autoriser les variables contrôlées suivantes : nom du client, nom de l'agence, référence colis, service, route, date de départ, date d'arrivée, bureau de retrait, montant exigible et devise. Elles doivent provenir des données réelles. Ne jamais inventer une date, un tarif ou un statut. Afficher un aperçu avant l'envoi.

## 7. Historique et suivi

Enregistrer le message, le type, l'auteur, les destinataires, la date, le canal, l'état réel et le motif d'échec éventuel. Distinguer préparé, en attente, envoyé, remis (uniquement si confirmé par le fournisseur) et échoué. Une acceptation par le fournisseur ne signifie pas remise. Prévenir les doublons et répétitions accidentelles.

## 8. Permissions

Prévoir des permissions distinctes pour consulter les annonces, créer, envoyer, programmer, configurer les relances et consulter l'historique. Respecter l'isolation multi-tenant et le périmètre des bureaux.

## 9. Simplicité et performance

Ne pas développer de CRM marketing, constructeur complexe de scénarios, plateforme publicitaire, segmentation prédictive, campagnes multicanales complexes ou statistiques marketing avancées. Réutiliser les services de messagerie, files de tâches et mécanismes de programmation existants. Si aucune exécution différée fiable n'existe, présenter une solution minimale compatible avant de l'implémenter. Traiter les envois volumineux hors de la requête utilisateur.

## 10. Tests

Tester la création et le brouillon d'annonce, l'audience et l'exclusion des contacts non éligibles, l'envoi par canal connecté et l'absence de canal, les relances de colis (dont l'absence après livraison), les relances de factures exigibles et leur arrêt après paiement, la prévention des doublons, les permissions, l'isolation entre agences et les échecs d'envoi.

## 11. Livrable

Présenter l'état existant, les fonctionnalités conservées, les modifications, les fichiers, API et migrations concernés, les tests exécutés et les limites V1.

## Règle finale

Slaivio doit permettre aux agences Cargo de préparer des annonces, cibler leurs clients, effectuer des relances et suivre les envois, en restant simple, rapide et fiable. Commencer par auditer le repository et présenter un plan avant toute modification du code.
