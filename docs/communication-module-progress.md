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

1. Remplacer l'INSERT client historique par le service CRM commun, avec transaction,
   idempotence, identité réseau, validations entreprise, audit et périmètre bureau.
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
