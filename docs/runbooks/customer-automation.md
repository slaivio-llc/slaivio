# Activation des automatisations clients

## Ordre de déploiement

1. Sauvegarder la base et appliquer `infra/sql/157_customer_journey_automation.sql` sur une base de recette, après les migrations précédentes.
2. Déployer l’API et le dashboard contenant ce module. Le rôle SQL du serveur doit disposer des droits nécessaires sur les tables privées ; ne pas utiliser une clé anonyme Supabase pour ces traitements.
3. Exécuter en recette la commande suivante depuis `apps/api`, puis programmer son exécution toutes les cinq minutes dans le service de tâches planifiées :

   ```sh
   python -m app.jobs.followup_recovery
   ```

   Cette commande produit les automatisations clients, traite les relances existantes puis envoie la file de communication. `python -m app.jobs.customer_automation` seul prépare les messages mais **ne les envoie pas**. Aucun de ces traitements ne doit dépendre d’une page ouverte dans le navigateur.
4. Fournir au worker les mêmes variables de base de données et de fournisseur WhatsApp que l’API, ainsi que `APP_RUNTIME=cron`. Vérifier les secrets configurés sans les publier ni les placer dans les variables publiques du dashboard.
5. Vérifier `PUBLIC_WEB_BASE_URL` côté API et `NEXT_PUBLIC_API_BASE_URL` côté dashboard : les liens `/customer-documents/...` doivent atteindre le dashboard et son proxy doit atteindre l’API publique.
6. Dans Paramètres → Notifications & messages, activer les scénarios voulus, saisir les conditions et modèles de l’agence. Activer la création automatique des particuliers qualifiés si souhaité, avec le droit `inbox.ai.manage` et un mode IA approprié.
7. Configurer la franchise et le tarif de garde dans la même section. Les droits `pickups.settings` sont nécessaires pour enregistrer ces tarifs. La devise doit correspondre à celle des colis concernés. Le taux de taxe Finance est mémorisé avec le tarif à la disponibilité au retrait.
8. Dans Documents & étiquettes, régler la présentation de la facture. Le logo provient du profil de l’agence. Créer et émettre les factures de transport dans Finance avant la remise ; ne pas inventer une facture à partir d’un ancien solde non rapproché.

## Conditions et limites à connaître

- Aucun webhook, fournisseur, paiement ou déploiement réel n’a été exercé par les tests locaux de ce changement. La migration PostgreSQL doit être exécutée et la recette complète doit réussir avant activation générale.
- Pour les colis déjà disponibles au retrait lors de la migration, l’horloge de garde démarre à la migration : pas de frais rétroactifs inventés à partir de la date de réception à l’origine.
- Les conditions de garde sont mémorisées à la disponibilité au retrait. Modifier le tarif aujourd’hui ne modifie pas les anciens colis ; zéro conserve la garde gratuite pour ces colis.
- Les factures de garde sont des documents Finance distincts, visibles et payables par les circuits existants. Elles ne réécrivent pas une facture de transport émise. Une remise peut être bloquée par un solde de garde ; les dérogations restent réservées au circuit autorisé avec justification.
- Une correction directe de `fees_paid` sur un ancien colis n’est pas un paiement Finance confirmé et ne déclenche pas de faux reçu. Rapprocher les anciens paiements dans Finance avant utilisation automatique.
- Le partage numérique est un lien vers une facture HTML figée, imprimable et enregistrable en PDF. Il ne s’agit pas d’une pièce jointe PDF générée par le serveur. Les liens expirent après un an et sont révocables dans les paramètres ; une facture annulée n’est plus accessible publiquement.
- Lorsqu’un retrait comporte plusieurs factures de transport ou de garde, elles sont regroupées sous un seul lien imprimable et un seul message, pas un message WhatsApp par jour de garde.
- Le fournisseur WhatsApp reste l’autorité d’acceptation/livraison. Wazzap ou le canal connecté doivent être actifs. Avec Meta, les messages hors de la fenêtre de conversation peuvent nécessiter des modèles approuvés : le chemin de notification texte existant ne transforme pas automatiquement ces textes personnalisés en modèles Meta. Valider ce scénario avant d’activer des relances Meta différées.
- Les annonces de départ exigent un consentement `OPTED_IN` enregistré ; avoir simplement écrit au numéro de l’agence n’est pas considéré comme un abonnement aux annonces.
- L’automatisation rapproche un seul colis attendu à la réception. Les identités ambiguës et les entreprises passent par une validation humaine. Les déposes multiples peuvent être enregistrées comme attentes distinctes.
- L’impression thermique et le scan matériel restent hors de cette livraison. Les formats d’étiquette et QR déjà présents ne garantissent pas la compatibilité d’une imprimante particulière.

## Recette obligatoire

Utiliser une agence de recette et des numéros autorisés, jamais une liste réelle de clients pour tester une campagne.

1. Qualifier un particulier WhatsApp avec intention explicite et nom complet ; vérifier une seule fiche client et une seule attente.
2. Relancer le job deux fois : vérifier l’absence de double message, le respect des préférences et du maximum de rappels.
3. Enregistrer un colis avec des photos privées, puis une photo partagée ; vérifier le suivi public avec la référence exacte et l’absence des images privées.
4. Recevoir le colis attendu et vérifier qu’un rappel déjà en file est annulé avant envoi. Tester deux attentes pour le même client et une référence fournisseur explicite.
5. Bloquer le départ sur une condition financière puis enregistrer le paiement. Vérifier le message de paiement, le solde exact et l’annulation du rappel de blocage devenu obsolète.
6. Confirmer le départ réel, puis la disponibilité au retrait. Vérifier les messages et les conditions de retrait de l’agence.
7. Utiliser des dates de recette contrôlées pour dépasser la franchise ; rejouer le job et vérifier une seule facturation de chaque période, sans modifier la facture de transport.
8. Régler une partie puis le solde de garde. Vérifier le blocage puis l’autorisation de remise selon la politique de l’agence.
9. Remettre via le guichet et via le flux de livraison directe autorisé : vérifier un envoi de facture par événement, sans doublon guichet/colis.
10. Vérifier la facture publique, son échappement HTML, son impression et la stabilité du document après changement du logo ou du pied de page. Révoquer le lien et vérifier qu’il devient inutilisable.
11. Tester un code de retrait expiré, un code remplacé et plusieurs codes incorrects ; vérifier le verrouillage effectif.
12. Désinscrire le contact et vérifier qu’aucun rappel ni annonce encore en file ne part. Vérifier les erreurs d’envoi et les événements en échec dans les écrans de suivi.

## Exploitation

Les événements échouent définitivement après cinq tentatives et restent visibles dans les paramètres. Corriger la cause, puis utiliser Réessayer. Une facture absente doit être créée et émise, pas simulée.

Une acceptation fournisseur incertaine reste dans la file de rapprochement existante : ne jamais la remettre aveuglément à l’état envoyable, au risque d’un doublon. Surveiller les retours du cron, les erreurs par colis et le nombre d’événements en attente. Adapter la fréquence et le nombre de workers après un test de charge ; les verrous `SKIP LOCKED` permettent de partager la charge.
