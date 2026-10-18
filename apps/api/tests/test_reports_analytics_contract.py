from pathlib import Path
from datetime import date
from decimal import Decimal
from types import SimpleNamespace

from app.reports import repository


REPOSITORY = Path(__file__).parents[1] / "app" / "reports" / "repository.py"


def test_analytics_uses_the_operational_expedition_source_of_truth():
    source = REPOSITORY.read_text(encoding="utf-8")

    assert "cargo_expeditions" in source
    assert " from shipments " not in source
    assert "archived_at is null" in source
    assert "deleted_at is null" in source


def test_expedition_report_exports_transactional_totals():
    source = REPOSITORY.read_text(encoding="utf-8")

    assert "expedition_reference" in source
    assert "billed_total" in source
    assert "cost_total" in source
    assert "profit_total" in source


class FakeResult:
    def __init__(self, rows=None, one=None):
        self.rows = rows or []
        self.one_row = one or {}

    def mappings(self):
        return self

    def one(self):
        return self.one_row

    def __iter__(self):
        return iter(SimpleNamespace(_mapping=row) for row in self.rows)


class FakeConnection:
    def __init__(self):
        self.calls = []

    def execute(self, query, params):
        self.calls.append((str(query), params))
        return FakeResult(one={})


class FakeEngine:
    def __init__(self):
        self.connection = FakeConnection()

    def connect(self):
        return self

    def __enter__(self):
        return self.connection

    def __exit__(self, *_):
        return False


def test_dashboard_applies_selected_office_scope_to_every_source(monkeypatch):
    fake_engine = FakeEngine()
    monkeypatch.setattr(repository, "engine", fake_engine)

    repository.dashboard("org-1", date(2026, 10, 1), date(2026, 10, 7), ["office-1"])

    assert fake_engine.connection.calls
    for query, params in fake_engine.connection.calls:
        assert "office_ids" in params
        assert "any(cast(:office_ids as uuid[]))" in query
    finance_query = next(query for query, _ in fake_engine.connection.calls if "payment_totals" in query)
    assert "payment.paid_at>=:start" in finance_query
    assert "payment.paid_at<:end" in finance_query


def test_dashboard_trend_uses_non_reserved_date_alias(monkeypatch):
    fake_engine = FakeEngine()
    monkeypatch.setattr(repository, "engine", fake_engine)

    repository.dashboard("org-1", date(2026, 10, 1), date(2026, 10, 7), ["office-1"])

    trend_query = next(query for query, _ in fake_engine.connection.calls if "generate_series" in query)
    assert "as report_day" in trend_query
    assert "using(report_day)" in trend_query
    assert "::date day)" not in trend_query


def test_report_preview_applies_selected_office_scope(monkeypatch):
    fake_engine = FakeEngine()
    monkeypatch.setattr(repository, "engine", fake_engine)

    repository.report_rows("org-1", "finance", date(2026, 10, 1), date(2026, 10, 7), office_ids=["office-1"])

    query, params = fake_engine.connection.calls[0]
    assert "fd.office_id=any(cast(:office_ids as uuid[]))" in query
    assert params["office_ids"] == ["office-1"]


def test_numeric_database_values_remain_exact_decimal_strings():
    values = repository._rows([SimpleNamespace(_mapping={"amount": Decimal("123456789012345.67")})])

    assert values == [{"amount": "123456789012345.67"}]
