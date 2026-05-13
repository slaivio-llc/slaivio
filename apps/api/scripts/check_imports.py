modules = [
    "app.main",
    "app.api.webhook",
    "app.api.manager",
    "app.api.notifications",
    "app.api.dossiers",
    "app.api.followups",
    "app.api.offices",
    "app.api.pricing",
    "app.api.knowledge",
    "app.api.goods",
    "app.api.batches",
    "app.api.media",
    "app.api.client_shipments",
    "app.api.broadcasts",
    "app.api.escalations",
]

for module in modules:
    __import__(module)
    print(f"OK import {module}")

print("ALL IMPORTS OK")
