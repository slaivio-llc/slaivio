# DOSSIER MODEL

## Definition

A dossier is the central object that groups:

- client
- messages
- shipments
- payments
- actions
- proofs

## Fields

dossier_id
client_id
status_global
intake_status
validation_status
primary_channel
created_at

## Rules

- A dossier can exist without shipment
- A dossier can be partial
- A dossier can be created automatically or manually

## Relation avec configuration agence

Chaque dossier est lié à une agence.

Le comportement du dossier dépend de :

- agency_workflow_config
- status_machine
- notification_templates

Le dossier ne contient PAS la logique,
il utilise la configuration de l’agence.