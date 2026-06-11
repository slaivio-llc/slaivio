# SLAIVIO Launch Foundation Cap

Source: `PHASE LANCEMENT .pdf`

## Vision Officielle

SLAIVIO n'est pas un CRM, un WhatsApp bot ou un simple tracking tool.
SLAIVIO est un **Cargo Operating System**.

Mission:

Permettre a n'importe quelle agence cargo dans le monde de gerer entierement ses operations depuis une seule plateforme.

## Architecture Freeze

A partir de la phase Launch, aucune nouvelle phase ne doit creer:

- un nouveau domaine metier sans justification d'architecture
- une nouvelle source of truth parallele
- un workflow qui contourne le dossier
- des valeurs codees en dur comme pays, devise, prix, warehouse ou ETA

Tout doit respecter:

- tenant isolation
- org scoping
- configuration-driven execution
- versioning quand une configuration impacte devis, shipment, paiement ou notification

## Domaines Officiels

SLAIVIO possede 16 domaines metier:

1. Organization Domain
2. Identity Domain
3. Customer Domain
4. Conversation Domain
5. Commercial Domain
6. Dossier Domain
7. Shipment Domain
8. Warehouse Domain
9. Batch Domain
10. Route Domain
11. Tracking Domain
12. Notification Domain
13. Finance Domain
14. Document Domain
15. Incident Domain
16. Configuration Domain

## Sources Of Truth

- Client: `clients`
- Conversation: `conversations`
- Dossier: `dossiers`
- Shipment: `shipments`
- Batch: `shipment_batches`
- Route: `routes`

Objet central du systeme: **Dossier**.

Regle: aucun workflow SLAIVIO important ne doit exister sans dossier.

## Hierarchie Officielle

Organization
-> Client
-> Conversation
-> Dossier
-> Shipment
-> Warehouse
-> Batch
-> Route
-> Delivery

## Events Globaux Officiels

- `client_created`
- `conversation_started`
- `quote_requested`
- `quote_generated`
- `quote_accepted`
- `procurement_started`
- `shipment_created`
- `shipment_received`
- `shipment_batched`
- `shipment_departed`
- `shipment_arrived`
- `shipment_ready_for_pickup`
- `shipment_delivered`
- `shipment_cancelled`
- `incident_created`
- `payment_received`

## Launch Scope Obligatoire

Avant lancement, SLAIVIO doit stabiliser:

- Commercial
- Customer
- Shipment
- Warehouse
- Batch
- Tracking
- Notifications
- Finance
- Documents

Non obligatoire avant lancement:

- AI recommendations
- marketplace
- predictive analytics
- knowledge graph

## Gaps Avant L1.0

Avant le Commercial Engine, il faut consolider:

- Agency Configuration Domain
- Route Catalog Domain
- Warehouse Network Domain
- Pricing Catalog Domain
- Notification Templates Domain
- Followup Policies Domain

## Foundation 0.1

Objectif: Agency Configuration Platform.

Modules a stabiliser:

- routes
- warehouses
- pricing
- goods rules
- notification policies
- followup policies

Corrections staff-level identifiees:

- Shipping Service Catalog, pas seulement Route Catalog
- Warehouse Capabilities V2
- Pricing Components
- Notification Templates avec language, channel, country, event, version
- Followup Policies avec conditions, max attempts, channels, business hours
- Goods Rules avancees
- Configuration Versioning
- Configuration Audit Logs

## Foundation 0.2

Objectif: Configuration Governance Layer.

SLAIVIO doit devenir une **Configuration Driven Platform**.

Chaque agence doit pouvoir:

- creer routes/services/prix/regles/templates
- tester
- valider
- approuver
- publier
- rollback

Sans appeler SLAIVIO.

Cycle officiel:

Draft
-> Validation
-> Approval
-> Activation
-> Production
-> Archive
-> Rollback

Concept central:

**Configuration Package**

Exemple: `June 2026 Pricing Update`

Chaque package peut contenir:

- nouvelles routes
- nouveaux services
- nouveaux prix
- nouvelles regles produits
- nouveaux templates

## Resolver Pattern

Tous les moteurs doivent passer par un resolver:

- Commercial: `PricingResolver`, `ServiceResolver`, `RestrictionResolver`
- Shipment: `RouteResolver`, `WarehouseResolver`
- Notification: `TemplateResolver`, `PolicyResolver`

Interdiction definitive:

- `price = 5`
- `eta = 10`
- `country = "Cameroon"`
- `currency = "USD"`

Tout doit venir:

Configuration Layer
-> Resolver
-> Execution

## Prochaine Phase Recommandee

Ne pas lancer L1.0 directement.

Ordre recommande:

1. Foundation 0.0: architecture review et freeze
2. Foundation 0.1: Agency Configuration Platform
3. Foundation 0.2: Configuration Governance Layer
4. L1.0: Commercial Engine

