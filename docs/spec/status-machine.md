# STATUS MACHINE — SLAIVO CARGO OS

---

# 1. PHILOSOPHY

A shipment and dossier evolve through controlled states.

Each state:

- defines what is true
- defines what actions are allowed
- defines what actions are blocked
- may trigger automation

---

# 2. DOSSIER STATES

---

## 2.1 LEAD

Client has shown interest.

Examples:

- "I want to ship"
- "How much?"

System:

- create dossier
- start qualification

---

## 2.2 PARTIAL

Some required information is missing.

Examples:

- missing weight
- missing destination
- missing supplier

System:

- ask missing fields
- show in "action required"

---

## 2.3 WAITING_FOR_DROP_OFF

Client must:

- deposit package
- OR supplier must deposit

System:

- schedule relance
- remind client

---

## 2.4 PENDING_VALIDATION

All info provided but:

- package not confirmed
- manager must validate

System:

- notify manager

---

## 2.5 READY_FOR_OPERATION

All required info available.

Shipment can be processed.

---

## 2.6 ACTIVE

Shipment is in progress.

---

## 2.7 COMPLETED

Shipment delivered.

---

## 2.8 BLOCKED

Dossier blocked due to:

- payment
- issue
- missing critical info

---

# 3. SHIPMENT STATES

---

## 3.1 CREATED

Shipment exists but incomplete.

---

## 3.2 RECEIVED_AT_ORIGIN

Package received at origin warehouse.

(important for transitaire flow)

---

## 3.3 WEIGHED

Weight verified.

---

## 3.4 PRICED

Final price calculated.

---

## 3.5 READY_TO_DISPATCH

Shipment ready to leave.

BUT:

Must check payment.

---

## 3.6 DISPATCHED

Shipment has left origin.

---

## 3.7 IN_TRANSIT

Shipment moving.

---

## 3.8 ARRIVED_DESTINATION

Shipment arrived in destination country.

---

## 3.9 READY_FOR_PICKUP

Client can collect.

---

## 3.10 DELIVERED

Shipment handed to client.

---

# 4. CRITICAL RULES

---

## 4.1 PAYMENT BLOCK

Shipment CANNOT move to DISPATCHED if:

balance_due > 0

---

## 4.2 VALIDATION RULE

Tracking can ONLY be sent if:

validation_status = VALIDATED

---

## 4.3 PARTIAL RULE

Shipment can exist with missing data.

But cannot move to READY_TO_DISPATCH without:

- verified weight
- pricing

---

## 4.4 MANAGER CONTROL

Only manager can:

- validate shipment
- correct weight
- correct price
- unblock dossier

---

# 5. TRANSITIONS

---

## Example Flow (SEND CARGO)

LEAD  
→ PARTIAL  
→ WAITING_FOR_DROP_OFF  
→ RECEIVED_AT_ORIGIN  
→ WEIGHED  
→ PRICED  
→ PENDING_VALIDATION  
→ READY_TO_DISPATCH  
→ DISPATCHED  
→ IN_TRANSIT  
→ ARRIVED_DESTINATION  
→ READY_FOR_PICKUP  
→ DELIVERED

---

## Example Flow (TRANSITAIRE)

LEAD  
→ PARTIAL  
→ WAITING_FOR_SUPPLIER  
→ RECEIVED_AT_ORIGIN  
→ WEIGHED  
→ PRICED  
→ PENDING_VALIDATION  
→ READY_TO_DISPATCH  
→ DISPATCHED  
→ IN_TRANSIT  
→ ARRIVED_DESTINATION  
→ READY_FOR_PICKUP  
→ DELIVERED

---

# 6. AUTOMATION TRIGGERS

---

## On ARRIVED_DESTINATION

→ send arrival message  
→ schedule pickup reminder  

---

## On READY_FOR_PICKUP

→ send pickup message  

---

## On WAITING_FOR_DROP_OFF

→ schedule reminder  

---

## On BALANCE_DUE

→ send payment reminder  

---

# 7. STOP CONDITIONS

---

Relance must stop if:

- client responded
- status changed
- dossier closed
- manager disabled relance

---

# 8. ERROR STATES

---

## ISSUE

General problem

## PAYMENT_BLOCKED

Cannot proceed due to unpaid balance

## CLIENT_UNRESPONSIVE

Client not replying

## SUPPLIER_DELAY

Supplier has not deposited

---

# 9. SYSTEM GUARANTEES

---

- No silent transitions
- All changes logged
- All critical steps require validation
- No automatic risky decisions

## Relation avec agency configuration

La machine de statut est universelle.

Les actions déclenchées par les statuts dépendent de :

- templates de l’agence
- règles de notification
- règles de relance
- règles de paiement

Exemple :

Status = ARRIVED_DESTINATION

→ template différent selon l’agence
→ règles de paiement différentes
→ règles de relance différentes