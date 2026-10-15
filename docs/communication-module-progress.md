# Module 06 — Communication : état réel

Référence : `docs/spec/module-06-communication.md`. Les coches de la spécification
ne constituent pas une validation du code ou des connecteurs en production.

## Lot du 15 octobre 2026

- Le routeur conversationnel reçoit les huit derniers messages (extraits bornés)
  pour comprendre une destination ou un service mentionné précédemment.
- Une demande sensible, une action métier ou une réponse factuelle rejetée ne
  peut plus devenir automatiquement sûre par l'ajout d'une question de qualification.
- Préparer une suggestion manuelle ne déclenche plus la qualification ni la
  création d'un client.
- La conversion automatique exige une intention d'utiliser le service confirmée
  et une confiance numérique entre 0,9 et 1. Une demande de devis seule ne suffit pas.
- Pays et ville restent conservés lorsqu'ils sont fournis, mais ne bloquent pas
  la conversion d'un particulier. Le type de client reste à établir.
- Une identité téléphonique associée à plusieurs fiches n'est plus résolue par
  la sélection arbitraire de la première fiche.
- Les entreprises passent en revue humaine : l'ancien INSERT ne satisfait pas
  le contrat entreprise/contact du CRM.
- Mode effectif et activation sont relus juste avant l'appel fournisseur. Une
  reprise manuelle pendant la génération empêche cet appel. Cela ne peut pas
  rappeler un message déjà accepté par le fournisseur ; un verrou/versionnement
  partagé avec la prise en charge reste nécessaire pour fermer la course résiduelle.
- Une répétition idempotente distingue attente, envoyé, livré, lu et échec.
- Les références métier non UUID sont conservées dans les métadonnées d'audit,
  sans erreur de conversion dans la colonne `source_ids uuid[]`.

## Validation de ce lot

Tests unitaires à fournisseurs et dépôts simulés :

```powershell
cd apps/api
python -m pytest tests/test_communication_control.py tests/test_pilot_inbox_ai.py -q -p no:cacheprovider
```

Pas d'envoi réel, pas de migration, pas de déploiement. Les anciens tests preview
avaient un accès involontaire à PostgreSQL ; leur source opérationnelle est
maintenant simulée explicitement. Cela ne valide pas les requêtes SQL en production.

## Suite indispensable — module non terminé

1. Compléter les validations entreprise et le périmètre bureau de la conversion.
   L'INSERT historique a été remplacé par le dépôt CRM partagé (voir lot ci-dessous).
   La conversion actuelle reste limitée aux particuliers ; elle ne s'exécute que
   si la réponse a passé les contrôles existants.
2. Construire les identités de contact/conversation indépendantes du téléphone,
   du fournisseur et du canal, sans fusion par simple nom et sans second CRM.
3. Unifier intégralement preview et conversation ; les contrôles de faits actuels
   (notamment nombres présents dans les sources) ne prouvent pas la justesse sémantique.
4. Faire consommer les services métier autorisés (tarification, tracking, bureaux,
   finance). Aucun calcul financier libre par le modèle, aucune publication implicite.
5. Revoir l'automatisation des relances prospects, consentements, exclusions et
   confirmations : l'ancien parcours planifie encore des tâches de relance.
6. Sérialiser les traitements d'une conversation, regrouper les messages rapprochés,
   vérifier les versions de mode/prise en charge, gérer reprises et crashs après génération.
7. Unifier notifications événementielles et audiences : aperçu, confirmation,
   déduplication par destinataire, regroupement de colis, historique des annonces,
   correction des reports sans inventer de date ni annuler l'opération logistique.
8. Adapter l'Inbox (Toutes / Non traitées / Mes conversations, attribution, contexte
   métier et canal explicite), sans annoncer Gmail/TikTok avant intégration réelle.
9. Recette PostgreSQL et bout en bout avec deux agences et plusieurs bureaux :
   identité ambiguë, accès croisés, changements de mode concurrents, fournisseur
   indisponible, preuves de livraison et conservation de l'historique.

Ne pas présenter ce lot de sécurisation comme la livraison complète du module.

## Lot suivant — CRM partagé et revue humaine

- `create_client`, `get_client` et la recherche de doublons peuvent participer à
  une transaction existante sans la fermer ni la valider. Le chemin manuel
  conserve son comportement de transaction autonome.
- La conversion utilise désormais `create_client` : normalisation, identité
  réseau, audit et protection de répétition par identifiant du parcours.
  Le parcours et la conversation sont rattachés dans la même transaction.
- Une erreur CRM se propage : aucun parcours n'est marqué converti après un échec.
- Un JID WhatsApp ou un numéro local sans indicatif ne peut plus être transformé
  arbitrairement en identité téléphonique client.
- Le routeur sémantique peut demander une prise en charge humaine dans toutes
  les langues prises en charge par le fournisseur. Preview et conversation
  reconnaissent ce résultat ; il n'autorise ni conversion ni réponse automatique.
  Les tests simulent ce résultat : ils ne mesurent pas la qualité réelle du modèle.
- Aucune migration supplémentaire. La migration 126 reste requise pour la
  protection de création CRM et les migrations réseau existantes pour l'identité.

Validation élargie :

```powershell
cd apps/api
python -m pytest tests/test_communication_crm_transaction.py tests/test_communication_control.py tests/test_client_creation_requests.py tests/test_pilot_inbox_ai.py -q -p no:cacheprovider
```

Les tests de connexion simulée vérifient le contrat de transaction, pas les
verrous ni les rollbacks réels PostgreSQL. La recette d'intégration reste à faire.

## Lot Inbox — prise en charge

- Les trois vues principales sont Toutes, Non traitées et Mes conversations.
  Non traitées utilise la file existante (non lues ou demandant une intervention) ;
  Mes conversations filtre les conversations ouvertes attribuées à l'identité authentifiée.
- Prendre en charge / Libérer sont disponibles aux utilisateurs ayant `inbox.manage`.
  Une adhésion active dans l'organisation est requise par le dépôt.
- L'attribution vérifie la version et verrouille la ligne ; la première attribution
  est sérialisée par verrou transactionnel. Un autre agent ne peut pas reprendre ou
  libérer silencieusement le propriétaire actuel. Les changements sont audités.
- Prendre en charge suspend l'IA. Libérer la conversation ne la réactive pas.
- Appliquer **134_communication_assignment.sql avant le déploiement API**.
  Cette migration n'a pas été exécutée ici.
- Attribution n'est pas autorisation : les droits d'accès existants restent nécessaires.
  Il reste notamment à harmoniser le périmètre bureau sur tous les endpoints,
  à contrôler les réponses concurrentes et à permettre une réattribution administrative.
- Les autres vues restent supportées par l'API. L'interface ne prétend pas encore
  intégrer Gmail/TikTok. Ce lot n'est pas la finalisation du modèle multicanal.

Tests ciblés : `test_communication_assignment.py`, `test_pilot_inbox.py`,
`test_pilot_inbox_privacy.py`, `test_communication_control.py`,
`test_communication_crm_transaction.py`. Tests de dépôts simulés ; recette PostgreSQL
et navigateur avec deux agents encore requise.
