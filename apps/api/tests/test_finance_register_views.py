from datetime import date
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.finance import repository


def fake_engine(monkeypatch, rows):
    engine = MagicMock()
    connection = engine.connect.return_value.__enter__.return_value
    total = MagicMock()
    total.scalar_one.return_value = 1
    page = MagicMock()
    page.mappings.return_value.all.return_value = rows
    connection.execute.side_effect = [total, page]
    monkeypatch.setattr(repository, "engine", engine)
    return connection


def test_payment_register_is_tenant_office_scoped_and_filters_paid_date(monkeypatch):
    conn = fake_engine(monkeypatch, [{"receipt_number": "REC-1", "receipt_available": True}])
    result = repository.list_payments(
        "org-a", q="client", currency="usd", status="CONFIRMED",
        start_date="2026-10-01", end_date="2026-10-31", page=2,
        page_size=25, office_ids=["office-a"],
    )

    count_sql, count_params = conn.execute.call_args_list[0].args
    data_sql, data_params = conn.execute.call_args_list[1].args
    assert "p.org_id=:o" in str(count_sql)
    assert "d.office_id=any(cast(:office_ids as uuid[]))" in str(data_sql)
    assert "p.paid_at >= cast(:start_date as date)" in str(data_sql)
    assert "p.paid_at < cast(:end_date as date) + interval '1 day'" in str(data_sql)
    assert "p.receipt_snapshot is not null" in str(data_sql)
    assert count_params == data_params
    assert data_params["o"] == "org-a"
    assert data_params["office_ids"] == ["office-a"]
    assert result["items"] == [{"receipt_number": "REC-1", "receipt_available": True}]


def test_finance_stats_rejects_inverted_period_without_querying(monkeypatch):
    engine = MagicMock()
    monkeypatch.setattr(repository, "engine", engine)
    with pytest.raises(HTTPException) as error:
        repository.stats("org-a", start_date=date(2026, 10, 31), end_date=date(2026, 10, 1))
    assert error.value.status_code == 422
    engine.connect.assert_not_called()


def test_client_balances_remain_separated_by_currency_and_respect_office_scope(monkeypatch):
    conn = fake_engine(monkeypatch, [{"currency": "USD", "balance": 50}])
    result = repository.client_balances(
        "org-a", q="Jean", currency="USD", office_ids=["office-a"]
    )

    count_sql, count_params = conn.execute.call_args_list[0].args
    data_sql, data_params = conn.execute.call_args_list[1].args
    assert "d.office_id=any(cast(:office_ids as uuid[]))" in str(count_sql)
    assert "group by d.client_id,d.currency" in str(count_sql)
    assert "group by d.client_id,c.name,c.phone,c.email,d.currency" in str(data_sql)
    assert "sum(d.balance_due) filter(where d.due_date is null or d.due_date<=current_date)" in str(data_sql)
    assert count_params == data_params
    assert result["items"] == [{"currency": "USD", "balance": 50}]
