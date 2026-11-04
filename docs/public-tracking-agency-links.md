# Liens publics de suivi par agence

Chaque agence active dispose maintenant d’un identifiant public permanent calculé à partir de son identifiant interne, sans exposer celui-ci dans le lien. Aucun nouveau paramètre ni migration SQL n’est nécessaire. Un identifiant personnalisé enregistré reste utilisable ; une page explicitement désactivée reste inaccessible.

Les paramètres affichent uniquement un lien reconnu par l’API : modifier le champ sans enregistrer ne change pas le lien publié. Les anciens liens construits à partir du nom restent compatibles lorsque l’agence n’a pas enregistré d’identifiant personnalisé et que ce nom désigne une seule agence.

Les notifications colis, affectations et départs incluent l’agence dans le lien de suivi. Les références locales comme `COL-2026-000001` peuvent exister dans plusieurs agences : un ancien lien sans agence ne choisit jamais arbitrairement un colis. Il demande le lien communiqué par l’agence si plusieurs colis publics correspondent. Les photos suivent exactement le même périmètre et restent limitées aux images explicitement visibles au client.

## Déploiement et vérification

Déployer ensemble l’API et le dashboard. Aucun colis ni aucune référence existante n’est réécrit. Les anciens messages WhatsApp ne sont pas modifiés : partager un nouveau lien depuis la fiche du colis ou les paramètres de l’agence.

Vérifier en navigation privée le lien des paramètres d’une agence nouvellement créée, puis le lien d’un colis. Contrôler deux agences ayant la même référence, une page désactivée et une photo non partagée. Sur mobile, le champ et le bouton de recherche sont empilés pour éviter le débordement.

Les erreurs de connexion sont distinguées d’un colis introuvable. Les pages `/track` et `/track/*` ne nécessitent pas de session Slaivio.

Le formulaire du registre utilise explicitement le mode création (« Créer l’expédition ») ; le calendrier conserve le mode planification. Si l’ancien libellé reste visible, vérifier que la dernière version du dashboard est déployée et recharger la page.

Validation locale : 96 tests API et 58 tests frontend ciblés, vérification TypeScript sans erreur. Les tests API utilisent des simulations ; la vérification sur PostgreSQL et le contrôle après déploiement restent à effectuer.
