# Essai gratuit sans plafond commercial

Appliquer `infra/sql/170_unlimited_free_trial.sql` après les migrations précédentes et avant de déployer l’API et le dashboard correspondants.

L’essai est illimité uniquement si l’abonnement du compte racine est `TRIAL`, a commencé et n’a pas expiré. Les bureaux et entrepôts descendants héritent du même essai ; créer un autre espace ne redémarre pas les 30 jours. La migration ne modifie aucune date, aucun forfait payé et aucune donnée existante.

Pendant l’essai : pas de plafond commercial sur les colis mensuels, membres/invitations, bureaux, entrepôts ou numéros WhatsApp. Les autres entitlements numériques sont également sans plafond. Les automatisations avancées de suivi sont disponibles, sous réserve des canaux connectés et réglages/consentements habituels. Les limites techniques, permissions, validations, protections contre les doublons et contrôles de sécurité restent actifs.

`billing_capacity` expose `trial_active`, `trial_ends_at`, les consommations réelles et des plafonds effectifs `null` pendant l’essai. `plan_limits` conserve les plafonds normaux du forfait. Les offres payantes continuent d’afficher leurs propres capacités. Le dashboard n’affiche ni avertissement de saturation ni jauge pendant l’essai.

À expiration ou passage à un abonnement payé, le contournement d’essai cesse : les contrôles d’accès et plafonds ordinaires s’appliquent. La période de transition historique des agences existantes n’est pas réinitialisée. Rien n’est supprimé si l’usage dépasse le forfait choisi ; les nouveaux ajouts concernés sont refusés avec une explication. Les colis créés pendant l’essai restent dans le compteur du mois ; aucune consommation n’est effacée et aucun abonnement n’est souscrit automatiquement.

Vérifier en recette : essai actif au-delà de chacun des cinq plafonds, mêmes résultats depuis un bureau enfant, essai expiré refusant un nouvel ajout, abonnement payé toujours limité, données anciennes toujours présentes. Les tests PostgreSQL sont optionnels et exigent une base jetable via `TEST_POSTGRES_URL` ; ils ne doivent pas viser la production.
