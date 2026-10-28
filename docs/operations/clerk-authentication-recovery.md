# Diagnostiquer un refus de session Clerk

Un `401 invalid_clerk_token` peut toucher l’onboarding comme le dashboard. Il se produit avant la vérification des rôles d’agence ou du Super Admin. Accorder des permissions SQL ne résout pas un refus d’authentification. L’expiration d’une invitation ne prouve pas la cause d’un refus sur d’autres sessions ou comptes neufs.

## Diagnostic après déploiement de l’API

Reproduire une seule tentative, puis relever la ligne `clerk_auth_rejected reason=...` immédiatement avant le 401. Les catégories sont fixes : aucun jeton, identifiant utilisateur, email ou contenu de clé n’est journalisé.

| Raison | Vérification |
| --- | --- |
| `issuer_mismatch` | Comparer `CLERK_ISSUER_URL` avec l’instance Clerk réellement utilisée par le frontend. Le préfixe de clé seul ne permet pas de vérifier le domaine exact. Vérifier les valeurs sans guillemets littéraux ni espaces accidentels. |
| `origin_not_allowed` | Vérifier `CLERK_AUTHORIZED_PARTIES` et l’origine exacte du site. Sans liste explicite, le code utilise l’origine de `PUBLIC_WEB_BASE_URL`, dont la valeur par défaut est `https://slaivio.com`. |
| `signature_invalid` | Vérifier que les clés publiques du backend correspondent à la même instance Clerk que le frontend. Ne jamais désactiver la vérification de signature. |
| `signing_key_not_found` | Vérifier `CLERK_JWKS_URL` (ou sa dérivation depuis l’issuer), l’instance Clerk et un éventuel renouvellement des clés publiques. |
| `expired` | Vérifier le renouvellement de session et l’horloge du serveur. La récupération frontend demande déjà un nouveau jeton une fois après un 401. |
| `not_yet_valid` | Vérifier l’horloge du serveur et la validité temporelle du jeton. Ne pas supprimer les vérifications de dates pour contourner le problème. |
| `required_claim_missing` | Vérifier les claims de session attendus (`exp`, `iat`, `nbf`, `sub`) et l’utilisation d’une session Clerk standard plutôt qu’un jeton personnalisé inadapté. |
| `algorithm_not_allowed`, `malformed_token`, `invalid_token_or_key` | Vérifier la provenance et le format du jeton ou des clés avec l’équipe technique ; ne pas copier les jetons dans des outils tiers. |

Ne partager que la catégorie du journal et les URL publiques de configuration nécessaires. Ne jamais transmettre les en-têtes Authorization, cookies, clés secrètes ou fichiers `.env` complets.

## Récupération frontend

Après un refus persistant, le dashboard et l’onboarding proposent une reconnexion explicite. Ce bouton termine la session Clerk avant de rouvrir la connexion, au lieu de simplement renvoyer vers une page qui pourrait reconnaître la même session refusée. Aucun compte n’est déconnecté automatiquement pour une simple panne réseau.

Le retour conserve uniquement le chemin local `/app` ou `/onboarding`, sans les paramètres d’un ancien lien d’invitation. La connexion utilise un retour par défaut, sans forcer systématiquement le dashboard au détriment de l’étape d’onboarding demandée.

Ces changements corrigent le parcours de récupération et rendent le diagnostic possible ; ils ne constituent pas, à eux seuls, une correction de la configuration de production. Aucune migration SQL n’est nécessaire.
