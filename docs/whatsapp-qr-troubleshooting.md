# Vérification du gateway WhatsApp

## Déployer ce correctif

1. Déployer l’API (ajoute le contrôle signé de retour).
2. Déployer le service `apps/whatsapp-qr-gateway` (Node 22 / Dockerfile existant).
3. Déployer le dashboard (erreur de déconnexion affichée dans sa fenêtre).

Aucune migration SQL et aucune rotation de clé ne sont nécessaires. Ne pas vider
les sessions en base : les opérations de diagnostic ci-dessous sont en lecture
seule. Le logout ne nettoie que la connexion explicitement sélectionnée.

## Tester depuis le service API déployé

Dans le Shell du service API Render, depuis le dossier `apps/api` :

```sh
python -m app.services.whatsapp_qr_diagnostics
```

Le programme utilise les variables déjà configurées dans ce service. Il ne
demande et n’affiche ni secret, ni numéro, ni QR, ni contenu de message.

- `gateway_health.ok=true` : le gateway et sa base répondent.
- `signed_round_trip.ok=true` : l’API atteint le gateway avec la signature, et
  le gateway atteint le contrôle signé de cette même API.
- Erreur sur `/diagnostics` : regarder les logs API `QR gateway request failed`.
  `gateway_identified=false` indique l’absence de l’en-tête du nouveau gateway :
  intermédiaire réseau, mauvaise cible ou ancien déploiement restent à vérifier.
- `callback_http_status=401` : vérifier le secret partagé dans les deux services.
- `callback_http_status=404` : vérifier le déploiement API et `SLAIVIO_API_URL`.
- Pas de statut de retour : vérifier la joignabilité du callback et son URL.

Un résultat positif ne vérifie pas la réception WhatsApp, la synchronisation
Baileys ou les conditions d’envoi de l’IA. Il isole le chemin réseau signé.

## Tester un nouveau message client

Envoyer un message privé depuis un autre numéro, puis lire les logs du gateway :

```text
qr_inbound_pipeline stage=received
qr_inbound_pipeline stage=forwarding
qr_inbound_pipeline stage=delivered reason=api_accepted
```

`stage=ignored` explique le filtrage (message sortant, historique, statut,
newsletter ou groupe non géré). `message_callback_failed` indique une erreur
pendant le traitement ou la transmission ; il ne signifie pas à lui seul que le
message a été refusé par l’API. Les événements HTTP ont le marqueur
`qr_gateway_http` et un identifiant de requête généré par le gateway.

## Déconnexion

Le gateway borne l’attente du logout, ferme le socket et nettoie les clés de la
connexion même si WhatsApp refuse le logout. Une erreur distante reste visible
avec un statut 503 ; elle n’est pas transformée en succès. Les écritures de clés
déjà commencées sont terminées avant suppression et les écritures tardives sont
ignorées pour éviter de recréer une session déconnectée.

Si aucun socket n’est chargé, le nettoyage local est possible mais le retour
`remote_logout_confirmed=false` demande de vérifier aussi WhatsApp > Appareils
connectés. Ne pas présenter ce cas comme une confirmation de logout distante.

Les erreurs `tried remove, but no previous op` de synchronisation ne sont pas
masquées ou prétendument réparées par ce correctif ; leur lien avec un message
manquant doit être établi à partir du parcours observé.
