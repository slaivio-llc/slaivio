# Agency Workflow Config — SLAIVO CARGO OS

## 1. Purpose

SLAIVO must adapt to each cargo/import-export agency.

Each agency can configure:

- agency profile
- services offered
- routes
- offices
- origin warehouses
- shipping modes
- pricing rules
- payment rules
- shipment statuses
- notification templates
- broadcasts
- delay notifications
- optional services

SLAIVO must not hardcode one agency workflow.

---

## 2. Agency Profile

Each agency defines its identity.

Fields:

- agency_name
- slogan
- description
- main_country
- main_city
- default_language
- tone
- WhatsApp numbers
- public links

Example:

Agency: YAK CARGO  
Slogan: Votre succès, notre mission  
Description: Expert import/export Chine → Cameroun  
Cities: Douala, Yaoundé

Rule:

All client messages must be personalized with the agency name.

---

## 3. Core Services

Core services are always part of SLAIVO:

- WhatsApp client communication
- client management
- conversation tracking
- shipment tracking
- pricing information
- status updates
- client notifications
- pickup reminders
- payment balance display

---

## 4. Optional Services

Not all agencies offer the same services.

Optional services can be enabled or disabled per agency:

- supplier payment
- currency exchange
- storage
- assisted purchasing
- local delivery
- insurance
- quality control
- container shipping
- groupage

Rule:

SLAIVO must always check if the agency offers the service before answering.

Example:

If client asks for supplier payment but the agency does not offer it:

“Ce service n’est pas disponible chez {{agency_name}} pour le moment.”

---

## 5. Agency Offices

Agencies can have offices in multiple countries and cities.

Fields:

- office_id
- agency_id
- country
- city
- address
- phone
- opening_hours
- pickup_instructions
- notes

Examples:

- Kinshasa
- Douala
- Abidjan
- Accra
- Yaoundé
- Goma
- Kampala

Rule:

SLAIVO must never invent an office address.

---

## 6. Origin Warehouses

Agencies can configure warehouses where suppliers deposit packages.

Fields:

- warehouse_id
- agency_id
- country
- city
- address
- contact_phone
- instructions
- supported_shipping_modes

Examples:

- China warehouse
- Dubai warehouse
- France warehouse
- Turkey warehouse

Rule:

This is the address the client gives to the supplier.

---

## 7. Supplier Deposit Label Requirements

When a supplier deposits a package, the package must include identification info.

Required label fields can include:

- agency name
- client full name
- client WhatsApp number
- destination country
- destination city
- product description
- shipping mark

Rule:

If required label info is missing, the shipment can be marked as ISSUE or NEEDS_REVIEW.

---

## 8. Routes

A route defines how cargo moves.

Fields:

- route_id
- agency_id
- origin_country
- origin_city
- hub_country
- hub_city
- destination_country
- destination_city
- shipping_mode
- estimated_transit_time
- notes

Examples:

- Kinshasa → Kampala
- Kinshasa → Kampala → Goma
- China → Abidjan
- China → Douala
- Dubai → Kinshasa

Rule:

A route can have zero, one, or many hubs.

---

## 9. Shipping Modes

Supported shipping modes:

- AIR
- SEA
- ROAD
- EXPRESS
- GROUPAGE
- CONTAINER
- CUSTOM_QUOTE

Examples:

AIR → often priced per KG  
SEA → often priced per CBM  
CONTAINER → fixed price or manual quote  
GROUPAGE → shared container pricing

---

## 10. Universal Pricing Engine

Pricing must be configurable per agency.

A pricing rule depends on:

- agency_id
- origin_country
- origin_city
- destination_country
- destination_city
- shipping_mode
- goods_category
- pricing_unit
- min_quantity
- max_quantity
- price_per_unit
- currency
- notes

Pricing units:

- PER_KG
- PER_CBM
- PER_PIECE
- FIXED_PRICE
- MANUAL_QUOTE

Examples:

AIR + PER_KG  
SEA + PER_CBM  
PHONE + PER_PIECE  
CONTAINER + FIXED_PRICE  
SPECIAL GOODS + MANUAL_QUOTE

---

## 11. Quantity Bands

Pricing can change by quantity.

Examples:

0–5.9 kg:
- standard goods = 12000 FCFA/kg

6–20 kg:
- standard goods = 10000 FCFA/kg

20kg+:
- discounted rate

Rule:

If required information is missing, SLAIVO asks for missing info before giving price.

SLAIVO must never invent a price.

---

## 12. Goods Categories

Each agency can define goods categories.

Examples:

- ordinary goods
- cosmetics
- liquids
- powder
- electronics
- phones
- tablets
- computers
- battery goods
- food supplements
- fragile goods
- restricted goods

Each category can have:

- pricing rule
- restriction
- payment rule
- manager validation requirement

---

## 13. Cargo Restrictions

Agencies can define restrictions.

Examples:

- no battery goods except authorized products
- shipping mark required
- some goods require manager validation
- some goods require manual quote
- some goods are not accepted

Rule:

If restricted goods are detected, SLAIVO must not confirm automatically.

---

## 14. Payment Rules

Payment rules depend on agency, route, mode, category, or shipment stage.

Examples:

- full payment before dispatch
- partial payment before dispatch
- balance on arrival
- payment before pickup
- payment on arrival

Fields:

- payment_policy_id
- agency_id
- route_id
- shipping_mode
- upfront_percentage_required
- balance_due_stage
- blocking_stage
- notes

Blocking stages:

- BEFORE_DISPATCH
- BEFORE_PICKUP
- BEFORE_DELIVERY
- NONE

Example:

If blocking_stage = BEFORE_PICKUP, shipment can arrive but cannot be delivered until balance is paid.

---

## 15. Currency / Money Rules

Money must always include currency.

Wrong:

- 25000

Correct:

- 25000 FCFA
- 25 USD
- 30 EUR
- 50000 CDF

Shipment financial fields:

- fees_total
- fees_paid
- balance_due
- currency

Client message must include:

- amount
- currency
- reason
- tracking reference
- payment/pickup instruction

Example:

“Votre colis {{tracking_id}} est arrivé à {{destination_city}}.
Montant restant avant retrait : {{balance_due}} {{currency}}.”

Rule:

SLAIVO V1 does not convert currencies automatically unless the agency configured an exchange service.

---

## 16. Supplier Payment Optional Service

Some agencies offer supplier payment.

Example:

Client wants to pay supplier in China.

Supported methods:

- WeChat Pay
- Alipay
- bank transfer
- other local methods

Exchange rules can depend on amount.

Example:

If amount < 3000 RMB:
- 1 RMB = 103 FCFA

If amount >= 3000 RMB:
- 1 RMB = 95 FCFA

Rule:

SLAIVO must never guess exchange rates.

Rates must come from agency configuration.

---

## 17. Status Flow

SLAIVO uses standard statuses but allows agency-specific templates.

Core statuses:

- LEAD
- WAITING_FOR_INFO
- WAITING_FOR_DEPOSIT
- RECEIVED_AT_ORIGIN
- SCHEDULED_FOR_DEPARTURE
- DEPARTED
- IN_TRANSIT
- ARRIVED_HUB
- IN_LOCAL_TRANSIT
- ARRIVED_DESTINATION
- READY_FOR_PICKUP
- DELIVERED
- BLOCKED
- ISSUE

Example flow:

Client asks price/address  
→ waits for deposit  
→ package received at origin  
→ departure scheduled  
→ in transit  
→ arrived hub  
→ local transit  
→ arrived destination  
→ ready for pickup  
→ delivered

---

## 18. Notification Templates

Each status can trigger a message.

Each template belongs to an agency.

Example:

RECEIVED_AT_ORIGIN:

“Bonjour {{client_name}}, votre colis a été reçu à {{origin_city}}.
Le départ est prévu dans {{days_before_departure}} jours.”

DEPARTED:

“Bonjour {{client_name}}, votre colis {{tracking_id}} est en cours d’expédition vers {{hub_or_destination}}.”

ARRIVED_HUB:

“Votre colis {{tracking_id}} est arrivé à {{hub_city}}.”

IN_LOCAL_TRANSIT:

“Votre colis {{tracking_id}} est en transit vers {{destination_city}}.”

ARRIVED_DESTINATION:

“Votre colis {{tracking_id}} est arrivé à notre adresse à {{destination_city}}.
Montant restant : {{balance_due}} {{currency}}.
Merci de passer pour le retrait.”

Rule:

Templates can use variables only if data exists.

---

## 19. Pickup Reminder / Relance

If shipment is READY_FOR_PICKUP and not delivered, SLAIVO can relaunch the client.

Relance can depend on:

- number of days since arrival
- destination office
- balance due
- agency rule
- client promised pickup date

Example:

Client says:

“Je vais passer vendredi.”

SLAIVO stores expected_pickup_date.

On Friday, SLAIVO sends reminder.

Rule:

No spam. Relances must have stop conditions.

Stop conditions:

- client replies
- shipment delivered
- manager disables relance
- dossier closed
- client muted

---

## 20. Broadcast / Agency Announcements

Agencies can send announcements when operational info changes.

Examples:

- departure schedule updated
- pricing updated
- warehouse address updated
- payment condition updated
- shipping delay
- new arrival announcement

Audience options:

- all open conversations
- all leads
- all active dossiers
- all active shipments
- clients by route
- clients by destination city
- clients by shipping mode
- clients waiting for deposit
- clients waiting for pickup

Rule:

Broadcast requires manager confirmation.

Broadcast must show:

- audience selected
- message preview
- estimated recipient count
- confirmation
- audit log

---

## 21. Delay Notifications

SLAIVO must support delay notifications.

Delay reasons:

- flight delay
- sea shipment delay
- customs delay
- hub delay
- supplier delay
- warehouse delay
- destination arrival delay

Delay targeting can be based on:

- shipment_id
- route
- origin city
- destination city
- hub city
- shipping mode
- departure batch
- status

Example:

“Bonjour {{client_name}}, information de {{agency_name}} :
votre colis {{tracking_id}} connaît un retard sur l’expédition {{origin_city}} → {{destination_city}}.
Nouvelle estimation : {{estimated_new_date}}.”

Rule:

Delay message must be sent only to affected clients.

---

## 22. WhatsApp Status Replacement

Many agencies currently announce broadly on WhatsApp status.

Example:

“Certains colis traînent au bureau, veuillez récupérer.”

SLAIVO replaces this with targeted notifications.

Instead of global message:

“Certains colis sont arrivés.”

SLAIVO sends:

“Bonjour {{client_name}}, votre colis {{tracking_id}} est arrivé à {{destination_city}}.
Reste à payer : {{balance_due}} {{currency}}.
Merci de passer à {{office_address}}.”

Rule:

Targeted message is better than generic broadcast when shipment data exists.

---

## 23. Agency Knowledge Base

Each agency can provide operational information as text or structured sections.

Knowledge can include:

- services
- routes
- prices
- offices
- warehouses
- payment rules
- shipping schedules
- restrictions
- FAQ
- official messages
- WhatsApp channel links

Rule:

SLAIVO answers only from agency knowledge and configuration.

If info is missing, SLAIVO asks or escalates.

---

## 24. AI Rule

AI is used for understanding, not uncontrolled decision-making.

AI can:

- classify intent
- extract fields
- detect missing info
- draft responses

AI cannot invent:

- prices
- addresses
- shipment status
- delivery dates
- discounts
- payment conditions
- exchange rates

Final response must be controlled by SLAIVO rules.

---

## 25. Manager Control

Manager remains the final decision-maker.

Manager can:

- validate shipment
- update status
- correct price
- correct weight
- send broadcast
- confirm delay notification
- disable relance
- override message
- close dossier

All critical actions must be logged.

---

## 26. Audit Log

SLAIVO must log:

- messages received
- status changes
- notifications sent
- broadcasts sent
- delay notifications
- pricing overrides
- payment updates
- manager actions

Purpose:

- trust
- debugging
- proof
- accountability

---

## 27. Universal System Rule

SLAIVO must be universal:

Different agencies can have different:

- routes
- prices
- shipping modes
- currencies
- payment rules
- optional services
- message templates
- delay rules
- pickup rules

But the core engine stays the same.

Core engine:

message  
→ client  
→ conversation  
→ dossier  
→ shipment  
→ status  
→ notification  
→ relance  
→ audit

## Relation avec core system

This file configures behavior of:

- dossier model
- status machine
- notification engine

It does not redefine them.

It only provides parameters used by the core engine.