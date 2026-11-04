# Factures PDF privées sur WhatsApp

## Mise en service

1. Appliquer `infra/sql/171_invoice_whatsapp_pdf.sql` après les migrations précédentes.
2. Déployer le gateway QR, l’API (avec ReportLab installé depuis requirements.txt) et le dashboard.
3. Conserver le job `python -m app.jobs.followup_recovery` : sa phase `communication_dispatch` reprend les envois en attente si l’API redémarre. Aucun nouveau job Render n’est nécessaire.
4. Connecter le numéro WhatsApp de l’agence par QR puis activer **Finance → Paramètres → Factures PDF par WhatsApp**.

L’activation n’envoie aucune ancienne facture. Seule l’émission d’une nouvelle facture alimente automatiquement la file. Une facture déjà émise peut être envoyée manuellement depuis sa fiche. Les devis, avoirs et brouillons ne sont pas concernés.

## Fonctionnement et protections

- Le document et son identité d’agence sont figés lors de la première mise en file ; les renvois reprennent ce même contenu. Les lignes, taxes, remises et totaux viennent de Finance, sans recalcul tarifaire.
- Le PDF est généré côté serveur avec pagination, puis transmis en octets au gateway signé. Aucune URL publique, aucun téléchargement d’image distante. Le logo distant n’est pas intégré dans cette première version.
- Le destinataire vient du numéro WhatsApp du client (sinon son téléphone). Les groupes et autres identifiants de discussion sont interdits. Les refus de communication, suppressions, changements de destinataire et factures annulées sont revérifiés avant l’envoi.
- La mise en file est transactionnelle avec l’émission ; l’envoi commence après validation de cette transaction. L’échec de transport n’annule pas une facture émise.
- Les accès API conservent les permissions Finance, le filtrage de bureau et l’organisation courante. Les instantanés sont dans une table privée avec RLS et sans accès anon/authenticated.
- La file possède une prise en charge atomique ; le gateway enregistre aussi sa propre prise en charge durable pour empêcher les doublons après rejeu ou redémarrage.
- « PDF envoyé à WhatsApp » signifie accepté par le canal, pas lu ou reçu par le client. Un résultat incertain n’est jamais renvoyé automatiquement. Vérifier la conversation et utiliser la réconciliation existante avec une preuve externe ; ne pas réinitialiser aveuglément les prises en charge.
- Le transport de document est actuellement disponible pour **QR_LINKED_DEVICE** uniquement. Un autre fournisseur échoue sans envoyer un simple texte à la place du PDF. Pièce jointe limitée à 5 Mio.

## Vérification après déploiement

Avec un client de test ayant accepté les messages : créer un brouillon (aucun envoi), l’émettre, vérifier le PDF en conversation privée et le statut dans la fiche. Vérifier qu’un double clic n’envoie qu’une copie et qu’une nouvelle copie nécessite une action explicite « Renvoyer le PDF ». Désactiver ensuite le réglage et vérifier qu’une nouvelle émission reste sans envoi automatique.

Les tests locaux utilisent des transports simulés : aucun message client n’est envoyé et aucune base de production n’est modifiée. La vérification réelle reste à effectuer après migration et déploiement.
