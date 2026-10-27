from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest

from app.api import wallet, secure_wallet


@pytest.mark.parametrize("path", ["/wallet/top-up", "/wallet/charge", "/wallet/secure/transactions"])
def test_client_cannot_mint_or_debit_platform_funds(path, monkeypatch):
    def forbidden(*args, **kwargs):
        pytest.fail("A retired endpoint must never access a balance or payment service")

    monkeypatch.setattr(wallet, "top_up_wallet", forbidden)
    monkeypatch.setattr(wallet, "charge_wallet_usage", forbidden)
    monkeypatch.setattr(secure_wallet, "apply_secure_wallet_transaction", forbidden)
    app = FastAPI()
    app.include_router(wallet.router)
    app.include_router(secure_wallet.router)
    response = TestClient(app).post(path, json={"amount_minor": 1000000, "transaction_type": "CREDIT", "usage_type": "TEST"})
    assert response.status_code == 410
    assert response.json()["detail"] == "wallet_client_mutation_retired"
