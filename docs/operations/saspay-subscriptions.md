# Abonnements SLAIVIO : essai de 30 jours et paiement SasPay

## Fonctionnement livré

- Essai gratuit de 30 jours, sans carte et sans prélèvement automatique.
- L’essai est créé une seule fois. Une reconnexion, un nouvel appel ou un bureau supplémentaire ne le réinitialise pas.
- Les bureaux et entrepôts rattachés utilisent l’abonnement de leur agence principale.
- Après expiration, les API opérationnelles renvoient `402 subscription_expired`. Les paramètres et la facturation restent accessibles pour renouveler.
- Les forfaits, devises et montants viennent de `pricing_plans`, jamais du navigateur. La migration `156_subscription_plan_prices.sql` fixe le catalogue mensuel à Starter 119 USD, Pro 229 USD et Business 799 USD. Le code historique `ENTERPRISE` conserve ses associations et s’affiche sous le nom Business. Les factures et sessions déjà créées conservent leurs montants initiaux.
- Paiement sur le checkout hébergé SasPay : mobile money ou carte selon les options proposées par le compte marchand et le pays du payeur.
- Un paiement confirmé ajoute un mois calendaire après la fin de l’accès existant, ou à partir de maintenant s’il a expiré. Les jours d’essai restants sont conservés.
- Pas de débit récurrent : chaque renouvellement est validé par le client sur SasPay.
- L’ancien endpoint de confirmation manuelle est réservé aux administrateurs plateforme.

## À faire par le propriétaire SLAIVIO

1. Créer le compte sur <https://app.saspay.me/>, vérifier l’email et créer le **marchand SLAIVIO**. Les agences clientes n’ont pas besoin d’ouvrir un compte marchand SasPay pour payer leur abonnement.
2. Faire valider le dossier KYC du marchand et vérifier qu’il est actif.
3. Créer d’abord une clé **TEST**, scope **PAYIN**. Aucun droit de retrait/PAYOUT n’est nécessaire. Conserver la clé dans le gestionnaire de secrets de l’hébergeur API, pas dans le code ni dans une conversation.
4. Récupérer l’identifiant du marchand correspondant à cette clé.
5. Depuis le dashboard SasPay, créer un webhook avec l’URL :

   `https://<domaine-public-api>/billing/webhooks/saspay`

   Activer `transaction.success` et `transaction.failed`, dans l’environnement correspondant à la clé. Copier le secret de signature lors de sa création : il n’est affiché qu’une fois.

6. Sur le service **API** et le job de rapprochement, renseigner :

   ```dotenv
   SASPAY_API_KEY=sk_test_...
   SASPAY_MERCHANT_ID=<identifiant-du-marchand>
   SASPAY_WEBHOOK_SECRET=<secret-de-signature>
   SASPAY_BILLING_CURRENCIES=<devises-confirmées-par-SasPay-séparées-par-des-virgules>
   PUBLIC_WEB_BASE_URL=https://www.slaivio.com
   ```

   Aucun de ces secrets ne doit porter le préfixe `NEXT_PUBLIC_`. L’API SasPay utilisée est `https://api.saspay.me/api/v1`, l’environnement est porté par la clé.

7. Confirmer les tarifs et devises du catalogue avant activation LIVE. Le catalogue historique SLAIVIO est en USD : faire confirmer par SasPay les devises encaissables pour ce marchand et ses pays. Renseigner `SASPAY_BILLING_CURRENCIES=USD` uniquement si cet encaissement est confirmé ; sinon, définir explicitement les prix du catalogue dans la devise acceptée (par exemple XOF), puis activer cette devise. Sans cette liste explicite, le checkout reste désactivé même si les clés sont présentes. Une devise de forfait absente de la liste est refusée avant toute création de paiement. L’intégration refuse les montants/devises différents de ceux facturés ; elle ne crédite pas aveuglément un paiement converti. Aucun taux de conversion n’est codé en dur.
8. Choisir dans SasPay qui supporte les frais. L’intégration laisse le réglage marchand s’appliquer et conserve le montant débité et le net reçu séparément des tarifs nominaux dans les données de rapprochement de la facture.
9. Appliquer `155_saspay_subscriptions.sql` après les migrations précédentes, puis déployer l’API et le frontend. La migration démarre les essais des agences sans abonnement et étend les anciens essais courts à 30 jours **depuis leur date de début**, sans redémarrer leur compteur ni modifier les abonnements payants.
   Appliquer ensuite `156_subscription_plan_prices.sql` pour les nouveaux tarifs mensuels. Les anciennes périodicités non proposées sont retirées du catalogue, sans modifier les paiements passés ou en attente.

10. Ajouter une tâche toutes les cinq minutes dans l’environnement API :

    `python -m app.jobs.saspay_reconciliation`

    Elle vérifie les sessions locales en attente, sans jamais lancer de nouveau paiement. Elle reprend les événements perdus et les créations dont la réponse réseau a été perdue. Le rattrapage distant d’une session inconnue consulte au plus trois pages SasPay par passage ; au-delà, le support doit rapprocher la session depuis le dashboard plutôt que relancer aveuglément une création.

11. Tester sur une base staging distincte : succès, refus, attente, double-clic, webhook en double, retour navigateur avant webhook, navigateur fermé après paiement, signature invalide et expiration d’essai.
12. Après validation, créer une clé **LIVE PAYIN**, configurer le webhook LIVE et ses secrets, puis redéployer. `APP_ENV=production` refuse les clés TEST pour éviter d’accorder un abonnement réel à partir d’argent de test.

## Sécurité et exploitation

- Les deux origines de checkout reconnues sont `https://pay.saspay.me` (exemples de documentation) et `https://checkout.saspay.me` (URL observée du prestataire). Aucun autre domaine, sous-domaine ressemblant, port personnalisé, HTTP ou identifiant dans l’URL n’est accepté. Le frontend et l’API appliquent la même liste.
- Une ancienne session ne verrouille plus la comparaison des offres. Le récapitulatif affiche le tarif du catalogue actuel. Au clic de paiement, si le forfait ou le tarif diffère, le serveur vérifie puis annule l’ancienne session auprès de SasPay avant de réserver la nouvelle. Le bouton « Annuler l’ancien paiement » utilise le même contrôle. Aucun montant de facture existante n’est réécrit.
- L’annulation est refusée pour un paiement confirmé ou encore en traitement. La réservation et sa facture ouverte ne sont clôturées localement qu’après confirmation distante `CANCELLED` ou `EXPIRED`. Un timeout ou une confirmation ambiguë conserve le verrou. Une nouvelle session n’est pas créée tant que ce contrôle échoue.
- Le catalogue affiche les fonctions opérationnelles implémentées et les éligibilités vérifiées dans `plan_entitlements`. Les anciens quotas `max_users`, `max_whatsapp_numbers` et `max_monthly_messages`, non contrôlés par toutes les routes métier, ne sont plus annoncés comme des limites effectives. Une éligibilité ne contourne jamais un feature flag, une permission ou une activation administrative de module.

- Les réponses SasPay enveloppées (`success/data`) et les ressources directes montrées dans les exemples des endpoints sont reconnues. Une enveloppe explicitement en échec, un objet d’erreur ou une ressource non reconnue reste refusé. Les contrôles marchand, montant, devise, UUID et URL de checkout restent obligatoires.
- Pour une erreur 502, consulter les logs `SasPay request failed`, `SasPay invalid response` ou `SasPay checkout validation failed`. Ils indiquent l’étape ou le statut HTTP sans publier le corps de réponse, les clés ni les informations du payeur. Ne jamais copier une réponse contenant des secrets dans les logs.

- Signature HMAC-SHA256 sur `timestamp.body` brut, comparaison en temps constant, tolérance de cinq minutes et cohérence du type d’événement.
- Le webhook ne fait jamais confiance à son seul statut : vérification du paiement auprès de SasPay, liaison de la transaction à la session locale, marchand, devise, montant et sens entrant.
- Le retour navigateur déclenche une vérification serveur ; `?checkout=...` n’est pas une preuve de paiement.
- Verrou local à la création : un double-clic réutilise une session déjà connue. SasPay n’offrant pas d’idempotence sur la création de checkout, un timeout ambigu conserve l’état `UNKNOWN`, repris uniquement par des lectures de rapprochement.
- Paiement, facture et prolongation d’abonnement sont enregistrés dans une seule transaction SQL, avec verrou et clés uniques. Un même succès ne prolonge jamais deux fois l’abonnement.
- Les paiements ne sont crédités que sur l’agence propriétaire de la session. Aucun ID de facture ni montant client n’est accepté pour simuler un paiement.
- Le webhook est synchrone, idempotent et renvoie une erreur en cas d’impossibilité de vérifier. SasPay pourra le retenter ; le job de rapprochement complète ces tentatives.
- Les signatures invalides et les incohérences de paiement ne sont pas acquittées comme des succès.
- Les cas `UNKNOWN` non rapprochés, les remboursements et les litiges doivent être traités par le support ; l’intégration ne retire aucun argent et ne déclenche aucun remboursement automatique.

## Références officielles

- <https://docs.saspay.me/account-setup>
- <https://docs.saspay.me/api-reference/payments/checkout-create>
- <https://docs.saspay.me/api-reference/payments/checkout-list>
- <https://docs.saspay.me/api-reference/payments/checkout-cancel>
- <https://docs.saspay.me/api-reference/payments/verify>
- <https://docs.saspay.me/api-reference/webhooks>
