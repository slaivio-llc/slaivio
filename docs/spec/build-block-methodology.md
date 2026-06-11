# SLAIVIO Build Block Methodology

## Decision

SLAIVIO is no longer developed by broad phase dumps.

From now on, development happens block by block:

1. Authentication
2. Onboarding
3. Dashboard modules, one by one

Each block must be fully finished before the next one starts.

## Definition Of Done

A block is done only when all of this is true:

- backend complete
- frontend complete
- production design stable
- tenant isolation verified
- permissions verified
- real production test passed
- mobile and desktop checked
- user journey is clear

## Current Block

Authentication.

Scope:

- Clerk production mode
- sign-in page
- sign-up page
- protected dashboard routing
- session refresh behavior
- tenant and active organization
- user roles and permissions
- logout
- production redirects
- production domain configuration

## Next Block

Onboarding.

Scope:

- agency profile setup
- first organization setup
- Meta WhatsApp connection
- phone number connection
- first cargo configuration
- readiness checklist

## Dashboard Rule

Backend modules can exist before they are product-ready.

But the dashboard menu must expose only the current validated product blocks.

Hidden backend modules are not deleted. They are simply not presented as ready
until their block is selected, completed, and production-tested.

## Module Rule

When dashboard work begins, modules are developed one at a time:

- Inbox
- Commercial
- Dossiers
- Shipments
- Warehouse
- Batches
- Documents / Manifests
- Customs
- Delivery
- Finance
- Notifications

No module is treated as finished until it passes real production validation.
