# Recette et vidéo de démonstration LUZA

Cette recette vérifie le fonctionnement réel. Les tests automatisés locaux ne prouvent pas la réception WhatsApp : celle-ci doit être constatée sur le téléphone du destinataire. Utiliser des clients et colis de démonstration, avec des numéros autorisés pour les essais.

## Préparer les données

1. Déployer le backend et le dashboard de la même version. Vérifier les migrations du projet et `PUBLIC_WEB_BASE_URL` : cette adresse HTTPS doit être celle du dashboard accessible aux clients.
2. Dans Paramètres → Entreprise, enregistrer le nom LUZA SERVICES et le lien HTTPS public du logo. Le logo doit être accessible sans connexion.
3. Connecter le WhatsApp du bureau expéditeur. Activer les notifications de jalons. Tester d’abord un message manuel et vérifier sa réception sur le téléphone.
4. Préparer les bureaux Belgique, RDC, Angola et Chine dans le même réseau, avec des membres affectés uniquement aux bureaux autorisés. Prévoir un compte opérateur et un compte de direction.
5. Configurer une route et un service aérien, puis une route et un service maritime : destinations, tarifs, devise, délais et adresses réels validés par LUZA. Ne pas présenter les valeurs d’essai comme des tarifs commerciaux.
6. Publier les connaissances complémentaires, notamment les modalités de paiement. Préparer un client test, un colis payé et un colis non éligible au départ (par exemple paiement insuffisant selon les règles du bureau).

## Parcours à filmer et résultats attendus

| Étape | Manipulation | Résultat à vérifier |
| --- | --- | --- |
| Accueil | Ouvrir le bureau expéditeur | Indicateurs correspondant à ce bureau et aux colis de test. |
| Questions WhatsApp | Demander tarifs, adresse de dépôt, prochain départ, délai et paiement, avec plusieurs formulations | Réponses cohérentes avec les données configurées ; clarification si l’information manque, aucun tarif inventé. |
| Client | Créer ou identifier le client et son numéro WhatsApp | Une fiche identifiable, sans doublon involontaire. Vérifier séparément le parcours automatique de collecte si activé. |
| Réception | Enregistrer poids, marchandise, client, service et destination du colis | Référence de suivi, statut de réception et historique enregistrés. Le client reçoit la notification avec nom de l’agence et lien de suivi. |
| Suivi public | Ouvrir le lien reçu dans un navigateur sans connexion | Le colis est recherché automatiquement ; nom et logo LUZA apparaissent avec trajet, statut et historique. Aucune note interne ni donnée financière privée. |
| Départ | Créer un départ sur le service configuré et affecter les colis | Colis compatible accepté ; colis non éligible refusé avec motif exploitable. Capacité adaptée au transport. |
| Manifeste | Générer le manifeste du départ | Liste des colis affectés, clients, poids et destinations correspondant aux données enregistrées. |
| Expédition | Créer une expédition depuis la route et le service | Origine, destination, voie et devise reprises de la configuration. Références vol/AWB en aérien ou conteneur/BL en maritime. Ajouter les colis éligibles. |
| Départ confirmé | Vérifier l’expédition déjà générée par le départ | Ne pas créer une seconde expédition pour les mêmes colis. Utiliser soit ce parcours, soit l’expédition manuelle sur un autre lot. |
| Transport | Passer l’expédition par les statuts autorisés jusqu’à l’arrivée et la disponibilité | Les colis concernés changent de statut ; leur historique et leur suivi public évoluent ; vérifier chaque message sur le téléphone. |
| Livraison | Valider la remise des colis concernés | Statut livré et notification de remise. Ne pas déclarer toute une expédition livrée si certains colis restent au dépôt. |
| Finance | Enregistrer montant dû et paiement partiel, puis solde ; consulter facture et reçu | Montants cohérents et justificatifs accessibles ; aucune somme de devises différentes présentée comme un total unique. |
| Historique client | Ouvrir la fiche du client | Retrouver colis, paiements, communications et expéditions correspondantes. |
| Multi-bureaux | Passer au bureau destinataire avec son opérateur | Voir les colis entrants autorisés. Vérifier qu’un utilisateur sans accès ne peut pas consulter un autre bureau. |
| Tableau de bord | Revenir à l’accueil après les mouvements | Compteurs et performances par destination cohérents avec les opérations réalisées. |

## Contrôles avant envoi de la vidéo

- Tester un retard et une annulation de départ : message explicite et lien de suivi présent. L’annulation d’un transport ne doit pas signifier que le colis est détruit ou livré.
- Actualiser une page ou répéter une sauvegarde sans changement : pas de deuxième message pour le même jalon.
- Tester une référence inconnue et un suivi désactivé : aucune donnée de colis révélée.
- Vérifier le suivi sur mobile et les formulaires aérien/maritime. Changer de route doit obliger à choisir un service compatible.
- Garder une trace des résultats réels (réussi/échec, référence du colis, heure du message). Corriger les échecs avant de présenter la fonctionnalité comme opérationnelle.

Ordre conseillé de la vidéo : configuration préparée → question WhatsApp → réception du colis → notification et suivi public → départ/manifeste → expédition et arrivée → paiement/reçu → bureau destinataire → historique client et indicateurs.
