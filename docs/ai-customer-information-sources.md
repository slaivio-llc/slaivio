# Informations utilisées par l’assistant client

L’IA ne parcourt pas toute la base et n’utilise pas Internet pour inventer des
informations sur une agence. Elle reçoit un contexte sélectionné pour l’agence
et la conversation qui vient de recevoir le message.

## Sources disponibles

- Connaissances publiées, autorisées sur WhatsApp, non sensibles et accessibles
  aux clients : textes, réponses, contenu extrait des fichiers après publication.
- Sites actifs de cette agence : nom, pays, ville, adresse, contacts et horaires.
- Services actifs publiés pour les clients et routes actives visibles : description
  client, modes et délais renseignés. Les associations publiques actuelles de
  services à plusieurs routes sont prises en compte, sans mélanger les corridors.
- Anciens tarifs de marchandises rattachés aux services publics, lorsqu’ils sont
  actifs et applicables dans le temps.
- Nouveau module Tarifs : prix de base publics, actifs, applicables et approuvés
  lorsque nécessaire. Une seule règle de prix doit être active, avec une unité
  simple. Catégorie et conditionnement publiés sont conservés. Les paliers,
  règles complexes, restrictions spécifiques de lieu, de client ou de quantité
  restent exclus de ce contexte : ils nécessitent le calcul d’un devis.
- Départs publiés à venir et libellés des moyens de paiement acceptés.
- Pour le suivi : colis du client rattaché à la conversation, dans cette agence.
  Les derniers échanges servent au contexte conversationnel.

Les factures, soldes privés, marges, coûts, notes internes et données d’autres
clients ne sont pas des sources publiques. Les bureaux des autres agences du
réseau ne sont pas ajoutés automatiquement. Les brouillons ne sont pas publiés
par ce changement.

## Réglages à remplir dans le dashboard

1. Communication > Connaissances : publier les réponses et fichiers vérifiés.
2. Gestion > Services : renseigner les informations clients et activer leur
   visibilité ; vérifier les routes associées et leurs informations publiques.
3. Bureaux : renseigner les coordonnées et horaires utiles.
4. Tarifs : lors de la création, cocher explicitement « Autoriser l’assistant à
   communiquer ce tarif aux clients », puis valider et publier le tarif. Par
   défaut, le tarif reste interne. Cocher la case ne garantit pas qu’une règle
   complexe soit exploitable sans devis ; les conditions d’éligibilité ci-dessus
   restent appliquées. Le service et la route doivent aussi être visibles.
5. Départs : publier uniquement les dates confirmées pour communication.

Un prix de base n’est pas le montant final d’une facture. L’assistant doit demander
les précisions manquantes et ne pas inventer de frais ou de promesse de livraison.
L’absence d’une source ou d’un niveau de confiance suffisant peut conduire à une
question ou une reprise humaine, même en mode automatique. Les groupes ne
déclenchent pas de réponse automatique dans le parcours WhatsApp QR actuel.

## Corrections réalisées

- Horaires auparavant chargés mais absents du contexte transmis.
- Services multi-routes auparavant manqués par le lien historique unique.
- Description client publique ajoutée ; visibilité du service et des nouvelles
  associations contrôlée. Un service interne n’est pas rendu public pour aider l’IA.
- Prix de base publics du nouveau catalogue, sans données financières privées.
- Virgule décimale française reconnue comme le même nombre qu’un point décimal.
- Une configuration active relue en direct n’est plus rejetée uniquement parce
  que sa dernière modification date de plus de 180 jours. Le contrôle de
  révision des connaissances éditoriales reste en place.

Les messages d’erreur affichés aux agences proposent une action compréhensible.
Les codes internes restent disponibles dans les réponses de diagnostic et les
logs pour le support, sans inviter l’agence à modifier une variable serveur.

Déployer l’API et le dashboard. Aucune nouvelle migration n’est nécessaire pour
ce correctif ; il repose sur le schéma et les migrations déjà présents.
