# Paramètres de l’agence — fonctionnement et déploiement

Les réglages passent par les API de l’organisation active. Les écritures du profil et des paramètres utilisent une version attendue ; une version périmée renvoie un conflit au lieu d’écraser une autre modification. Les données JSON sont fusionnées par section. L’enregistrement de l’identité visuelle est transactionnel (profil et favicon ensemble).

| Réglage | Application réelle |
| --- | --- |
| Profil et identité visuelle | Coordonnées, textes, logos et couleurs enregistrés ; identité reprise sur le suivi public et les documents. |
| Suivi public | Adresse `/track?agency=identifiant`, unicité de l’identifiant, activation, message d’accueil et visibilité des coordonnées, de l’historique et du tarif. Les recherches sont limitées à l’agence demandée ; une référence globale ambiguë ne renvoie rien. |
| Horaires | Texte affiché avec le support sur le suivi public. Le fuseau IANA est validé et utilisé par la numérotation. Les horaires particuliers d’un bureau restent dans sa fiche. |
| Réception | Catégorie, conditionnement et mesures contrôlés côté serveur ; photos bloquées avant téléversement si désactivées. Recherche du tarif dans la transaction de création ; une grille inapplicable conserve le colis et crée un événement de vérification tarifaire. |
| Livraison | Preuve exigée pour les transitions de livraison lorsque configurée ; avis d’arrivée filtrés ; délai de retrait utilisé pour les alertes. Les contrôles financiers continuent de s’appliquer. |
| Numérotation | Séquences de 4, 6 ou 8 chiffres, code bureau facultatif, compteur global ou par bureau, remise à zéro annuelle ou mensuelle. Attribution atomique, sans tronquer les dépassements, avec évitement des références colis déjà utilisées. |
| Marchandises | Règles acceptées/interdites/à valider configurables. Les interdictions bloquent la réception ; la validation est vérifiée au chargement et au départ. |
| Documents | Format physique des étiquettes et code QR ; préférences logo/coordonnées sur étiquettes, factures, reçus et nouveaux manifestes. Les reçus de paiement et manifestes déjà figés conservent leur identité historique. |
| Crédit client | Autorisation de l’agence, approbation individuelle avec permission `finance.settings`, plafond et devise vérifiés à la remise. Les dettes des autres factures du client sont prises en compte. |
| Notifications | Préférences vérifiées à la mise en file et juste avant envoi ; désinscriptions et suppressions de contact respectées. Transport via les connexions WhatsApp existantes. |
| Paiements et abonnement | Paramètres financiers reliés au module Finance ; abonnement, factures et usage lus depuis les données réelles, sans valeurs d’essai inventées. |
| Sécurité | Activation de la politique MFA seulement depuis une session ayant vérifié un second facteur ; contrôle des sessions lors de l’accès à l’agence. Les anciennes cases cochées sans contrôle serveur doivent être réactivées pour être appliquées. |
| Langue et devise | Langue de l’agence utilisée par défaut sauf préférence personnelle ; devise transmise à Finance. Les montants historiques ne sont pas convertis. |

## Déploiement

1. Appliquer les migrations précédentes, notamment `152_organization_profile_brand_fields.sql`, puis `153_agency_settings_production.sql` sur une sauvegarde vérifiée avant la production.
2. Déployer l’API et le tableau de bord ensemble, avec leurs dépendances déclarées (`qrcode[pil]` et `python-barcode` sont déjà dans les dépendances de l’API).
3. Pour la MFA, activer les méthodes appropriées dans Clerk et utiliser les jetons de session portant la déclaration signée `fva`. L’administrateur doit vérifier son propre second facteur avant d’activer la politique pour l’agence. Voir la [documentation des jetons Clerk](https://clerk.com/docs/guides/sessions/session-tokens).
4. Vérifier les connexions WhatsApp et le stockage privé existants pour les envois et les photos. Leur activation n’est pas simulée par ces paramètres.
5. En préproduction, vérifier deux agences et deux bureaux : sauvegarde concurrente, identifiant public déjà pris, références simultanées, contrôle des marchandises, remise sans preuve, crédit dépassé et notification désactivée après sa mise en file.

La migration SQL n’est pas exécutée par cette modification. Les tests automatisés couvrent la validation, les autorisations et les commandes avec connexions simulées ; ils ne remplacent pas la vérification de la migration et des intégrations sur PostgreSQL en préproduction.
