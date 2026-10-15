from app.ai.services.pilot_inbox_ai_service import _customer_safe_operational_context


def test_customer_context_excludes_private_finance_without_explicit_access():
    context = {
        "packages": [{
            "tracking_id": "PKG-001",
            "status": "IN_TRANSIT",
            "destination_city": "Lubumbashi",
            "destination_country": "RD Congo",
            "eta_at": "2026-10-20",
            "last_scan_location": "Kisangani",
            "departure_code": "DEP-404",
            "departure_scheduled_at": "2026-10-18",
        }],
        "finance_summary": {
            "amount_paid": 250000,
            "balance_due": 125000,
            "currency": "CDF",
        },
        "client_finance_access": False,
    }

    result = _customer_safe_operational_context(context, "Quel est le statut de mon colis ?")

    assert "PKG-001" in result
    assert "IN_TRANSIT" in result
    assert "250000" not in result
    assert "125000" not in result
    assert "Compte client" not in result


def test_customer_context_allows_private_finance_only_if_explicitly_authorized():
    context = {
        "packages": [],
        "finance_summary": {
            "amount_paid": 450000,
            "balance_due": 75000,
            "currency": "CDF",
        },
        "client_finance_access": True,
    }

    result = _customer_safe_operational_context(context, "Quel est le solde de mon colis ?")

    assert "Compte client" in result
    assert "450000" in result
    assert "75000" in result
