# Préparer un envoi depuis WhatsApp

## Activation

1. Appliquer `infra/sql/169_whatsapp_customer_intake.sql` après les migrations précédentes, puis déployer l’API et le dashboard ensemble. Aucune activation automatique ni réécriture des clients existants.
2. Dans **Services**, publier un service actif et ses trajets proposés (`service_route_offerings.public_visible`). La route et le service doivent aussi être actifs et publiés, avec des dates de disponibilité valides.
3. Dans **Communication → Assistant IA**, activer **Formulaire client depuis WhatsApp**. Le lien est proposé uniquement en mode automatique contrôlé, après une intention explicite d’expédier, pas après une simple demande de prix/adresse. Ce choix prend priorité sur l’ancienne création automatique après qualification. Les entreprises et demandes sensibles restent sous contrôle humain.
4. Vérifier `PUBLIC_WEB_BASE_URL` dans l’API : domaine HTTPS du dashboard, par défaut `https://slaivio.com`. Aucun nouveau secret ou service Render n’est nécessaire.

## Dépôt fournisseur, notamment en Chine

Dans la fiche de l’entrepôt de départ, onglet **Paramètres → Adresse à transmettre aux fournisseurs** :

- compléter l’adresse physique (texte chinois accepté), le destinataire à inscrire sur le colis, le téléphone public facultatif et les consignes ;
- activer explicitement la publication pour les dépôts fournisseurs ;
- dans les trajets proposés du service, sélectionner cet entrepôt comme entrepôt d’origine.

Seul un entrepôt actif appartenant à l’agence du service est proposé. Les implantations d’un autre espace du réseau ne sont pas publiées automatiquement : configurer le service et son dépôt dans le bon espace agence. Ne pas dupliquer une implantation uniquement pour contourner cette séparation.

Le client choisit « Mon fournisseur dépose les colis à l’entrepôt ». Après confirmation, il copie un bloc contenant le destinataire, l’adresse, le téléphone public, les consignes et une référence `PRE-…` à inscrire sur chaque carton. Le texte chinois est conservé. Les contacts internes de l’entrepôt ne sont jamais utilisés implicitement.

Une adresse désactivée ou modifiée est recontrôlée avant la confirmation. Si elle change après inscription, la réouverture du lien masque l’ancienne adresse et demande de contacter l’agence. Le personnel conserve l’instantané initial pour vérification. Une adresse déjà copiée hors de Slaivio ne peut évidemment pas être retirée du téléphone du fournisseur : prévenir les clients concernés lors d’un changement.

## Parcours client et agence

- Lien personnel valable 72 heures ; aucun compte Slaivio/Clerk nécessaire ; page mobile FR/EN.
- Nom, pays, ville, contact prérempli et modifiable/supprimable, service et trajet publiés, quantité et poids estimés (ou inconnus).
- Consentement à l’utilisation des informations pour préparer l’envoi ; ce n’est pas un consentement publicitaire.
- Le numéro WhatsApp d’origine reste l’identité de rapprochement. Un contact saisi ne devient pas une identité vérifiée. Les fiches existantes ne sont pas écrasées.
- Une seule transaction crée/réutilise le client canonique, crée une attente de réception et enregistre la demande. Le client nouveau est « En attente du premier colis ». Pas de colis réel, de facture, de paiement ni de prix garanti.
- **Clients → Envois annoncés depuis WhatsApp** affiche les 50 dernières demandes aux administrateurs autorisés (`settings.write`). Les attentes restent aussi intégrées au suivi existant. Les autres membres utilisent leurs accès habituels à la fiche client et aux réceptions.
- À réception, rechercher le client par nom/numéro et utiliser la référence inscrite sur le carton. Le personnel crée et mesure les colis réels. La quantité annoncée n’est pas une preuve de réception.
- Double clic ou deuxième lien pour le même numéro et une attente toujours ouverte : même confirmation, pas de deuxième client ou attente. Pour un nouvel envoi distinct, l’agence doit d’abord traiter/clôturer l’attente précédente. L’interface publique ne permet pas de modifier silencieusement une demande confirmée.
- Les relances d’inscription du prospect sont annulées après confirmation ; le suivi de l’attente utilise l’automatisation existante. Le lien ne déclenche aucun job d’envoi supplémentaire à lui seul.

## Sécurité et limites

Le serveur émet le lien à partir d’un vrai message WhatsApp entrant individuel dans l’agence active. Aucun `org_id`, identifiant client ou numéro source n’est accepté depuis le formulaire. Jeton opaque aléatoire : la table des liens ne conserve que son SHA-256 ; l’URL reste naturellement présente dans le message privé envoyé et son historique. Expiration, révocation, agence active et activation du formulaire sont revérifiées. Six émissions maximum par heure et numéro. Le fragment du lien évite de placer le jeton dans les journaux HTTP et les référents ; les appels utilisent un en-tête Bearer via le proxy même origine. Pas de stockage local, d’indexation, de cache public, de session Clerk ni de chargement des API privées sur cette page. Le lien reste personnel : une personne à qui il est transféré peut l’utiliser jusqu’à son expiration/révocation.

API d’accompagnement : `POST /organization/customer-intake/links` avec `source_message_id`, réservé à `inbox.ai.manage` ; `POST /organization/customer-intake/links/{link_id}/revoke`. L’émission manuelle ne transmet pas de message au client. La désactivation du formulaire rend tous les liens indisponibles tant qu’il est désactivé.

Version initiale : particuliers, envois entrants depuis WhatsApp, catalogue publié de l’agence active, pas de compte client, pas de tarifs calculés ni de document de transport. Les pièces jointes ou entreprises ne déclenchent pas ce parcours automatique. Les demandes historiques ne sont ni recréées ni envoyées à l’IA.

## Vérification avant ouverture réelle

Tests automatisés locaux : validation, filtrage du catalogue, isolation d’agence, contact modifié, double confirmation, adresse retirée, caractères chinois, formulaire FR/EN et consignes fournisseur. Les tests de transaction utilisent des doublures : ils ne remplacent pas un essai sur PostgreSQL de recette avec la migration et les déclencheurs existants.

En recette : publier une offre et un dépôt de test, activer le formulaire, confirmer une intention depuis un numéro client, ouvrir le lien sur mobile, soumettre deux fois, vérifier un seul client/une seule attente, rouvrir le lien, retirer l’adresse et vérifier qu’elle n’est plus proposée. Créer ensuite un vrai colis reçu pour ce client et vérifier le rapprochement de l’attente. Aucun de ces essais réels ni aucun déploiement n’est effectué automatiquement par les tests locaux.
