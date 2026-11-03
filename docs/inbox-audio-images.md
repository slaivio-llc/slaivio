# Messages vocaux et images des clients

## Périmètre

Les nouveaux messages privés reçus par le **WhatsApp connecté par QR** sont
analysés avant de préparer une réponse : transcription des vocaux, description
factuelle et lecture du texte des images. Les messages de groupe restent humains.
Ce traitement ne concerne pas encore les pièces jointes Meta Cloud/Wazzap,
les vidéos, PDF et stickers. Aucun historique n'est envoyé rétroactivement.

Le texte original et le fichier privé restent conservés. Le texte extrait est
affiché séparément dans la boîte de réception et ajouté au contexte de cette
conversation uniquement, jamais aux connaissances publiées de l'agence.
Les descriptions/transcriptions peuvent être inexactes : une image ne valide
pas un paiement, une identité, un poids ou une valeur. Les demandes sensibles
restent à vérifier ; aucun client n'est créé automatiquement à partir d'un média.
Les règles de réponse existantes (pause, suggestion, automatique, accès client,
sources publiées, transfert humain) restent appliquées.

## Déploiement

1. Appliquer `infra/sql/167_inbox_media_analysis.sql`, puis
   `infra/sql/168_whatsapp_audio_storage.sql` avant l'API et le dashboard.
   Le bucket `dossier-documents` d'origine autorisait uniquement PDF/images :
   la migration 168 ajoute les formats audio et aligne sa limite minimale sur
   les 12 Mio du gateway, sans le rendre public, ni retirer d'autres types
   autorisés, ni réduire une limite plus grande ou déjà illimitée.
2. Dans l'API et le cron, conserver la configuration privée Supabase et
   `MISTRAL_API_KEY`. Mistral reçoit le contenu pour analyse : vérifier les
   engagements de traitement des données et l'information donnée aux clients.
   Les modèles sont réglables par `INBOX_AUDIO_MODEL` (défaut
   `voxtral-mini-latest`) et `INBOX_VISION_MODEL` (défaut `mistral-small-latest`).
3. Configurer ClamAV comme pour les fichiers de connaissances. En production,
   l'analyse refuse un fichier non vérifiable ; ne pas désactiver l'antivirus.
4. Déployer l'API, le gateway QR et le dashboard.
5. Ajouter un cron de récupération, depuis `apps/api`, toutes les minutes :
   `python -m app.jobs.inbox_media`, avec les mêmes variables que l'API.

La réception enregistre atomiquement l'état d'attente avec le message. L'API
lance une tâche après son accusé de réception ; le cron reprend les tâches
interrompues et les échecs temporaires après dix minutes. Une seule exécution
peut réclamer un message ; au maximum trois tentatives, puis reprise humaine.
Une transcription déjà enregistrée est réutilisée sans nouvel appel de transcription lors de la reprise.
L'analyse est suspendue si l'IA de l'agence est désactivée ; une conversation en
pause ne transmet pas son fichier au fournisseur. Un ancien média analysé après
un message plus récent enrichit le contexte sans provoquer une réponse retardée.

Limites : 12 Mio par fichier, JPEG/PNG/WebP jusqu'à 20 millions de pixels,
audio OGG/MP3/M4A/WAV/WebM/FLAC/AAC selon décodage du fournisseur. Le type réel
est vérifié et les téléchargements sont bornés. Aucune URL externe de client
n'est récupérée par l'analyse ; seuls les objets privés de l'agence sont lus.
Les fichiers illisibles, trop longs ou refusés ne déclenchent pas de réponse
fondée sur une devinette. Une indication simple est affichée à l'agence.

## Vérification en production

- Depuis un numéro client distinct, envoyer un vocal demandant les horaires.
- Envoyer une photo lisible d'un colis ou d'une étiquette, avec une question.
- Contrôler le texte extrait, la bonne conversation et la réponse selon le mode.
- Envoyer une photo de reçu : aucune confirmation de paiement automatique.
- Tester un fichier illisible, l'IA en pause et un groupe : reprise humaine.
- Arrêter momentanément l'API après réception : vérifier la reprise par le cron.
- Vérifier qu'une autre agence ne peut voir ni fichier ni transcription.

Documentation fournisseur :
[transcription](https://docs.mistral.ai/studio/audio/speech-to-text/transcribe-files),
[vision](https://docs.mistral.ai/studio/conversations/vision).

## Refus de stockage avant transcription

Un `POST .../storage/v1/object/dossier-documents/...ogg` refusé avec 400,
suivi de `document_storage_upload_failed`, survient avant l'analyse IA.
Le statut seul ne prouve pas la cause exacte. Vérifier les types et la taille
autorisés dans Supabase Storage, notamment `audio/ogg`, puis le détail de
l'erreur dans les logs Storage si le refus persiste après 168. Ne pas rendre
le bucket public ou partager une clé pour résoudre un refus MIME.
Si `DOSSIER_DOCUMENTS_BUCKET` a été personnalisé, vérifier les mêmes réglages
sur ce bucket : la migration cible uniquement le bucket standard.
Après correction, envoyer un nouveau vocal de test ; la réexécution automatique
des anciens événements échoués n'est pas garantie par cette migration.
