from pathlib import Path
from datetime import date
from decimal import Decimal
from types import SimpleNamespace

import pytest

from app.reports import repository
from app.api.reports import report_office_scope
from fastapi import HTTPException


REPOSITORY = Path(__file__).parents[1] / "app" / "reports" / "repository.py"


def test_analytics_uses_the_operational_expedition_source_of_truth():
    source = REPOSITORY.read_text(encoding="utf-8")

    assert "cargo_expeditions" in source
    assert " from shipments " not in source
    assert "archived_at is null" in source
    assert "deleted_at is null" in source
    assert "from dossiers" not in source


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


@pytest.mark.parametrize("office_ids", [None, [], ["office-1"]])
def test_monthly_finance_uses_explicit_month_alias(monkeypatch, office_ids):
    fake_engine = FakeEngine()
    monkeypatch.setattr(repository, "engine", fake_engine)

    data = repository.dashboard("org-1", date(2026, 10, 1), date(2026, 10, 23), office_ids)

    query, params = next(
        (query, params)
        for query, params in fake_engine.connection.calls
        if "invoice_monthly as" in query
    )
    # MONTH cannot be a bare PostgreSQL column alias. Keep the API's `month`
    # field, but use AS just like the operational monthly trend query.
    assert "months.month_start as month," in query
    assert "months.month_start month," not in query
    assert "group by 1,fd.currency" in query
    assert "group by 1,payment.currency" in query
    assert params["o"] == "org-1"
    assert params["end"] == date(2026, 10, 24)
    assert data["monthly_finance"] == []
    assert "kpis" in data and "monthly_trend" in data


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


def test_all_offices_includes_unassigned_history_only_for_agency_wide_access():
    assert report_office_scope({'office_access_scope':'ALL_OFFICES','allowed_office_ids':[]},'ALL') is None
    assert report_office_scope({'office_access_scope':'ALL_OFFICES','allowed_office_ids':['office-1'],'selected_office_id':'office-1'},'ALL') is None
    assert report_office_scope({'office_access_scope':'SELECTED_OFFICES','allowed_office_ids':[]},'ALL') == []
    assert report_office_scope({'office_access_scope':'SELECTED_OFFICES','allowed_office_ids':['office-1']},'ALL') == ['office-1']


def test_explicit_office_never_bypasses_member_grants():
    context={'office_access_scope':'SELECTED_OFFICES','allowed_office_ids':['office-1'],'selected_office_id':'office-1'}
    assert report_office_scope(context,None) == ['office-1']
    assert report_office_scope(context,'office-1') == ['office-1']
    with pytest.raises(HTTPException) as error:report_office_scope(context,'office-2')
    assert error.value.status_code == 403


def test_package_reports_match_the_operational_origin_and_destination_scope(monkeypatch):
    fake_engine=FakeEngine()
    monkeypatch.setattr(repository,'engine',fake_engine)
    repository.dashboard('agency',date(2026,10,1),date(2026,10,24),None)
    for query,params in fake_engine.connection.calls:
        if any(marker in query for marker in ('as report_day','invoice_monthly as','invoice_totals as','cargo_expeditions e where')) and 'cargo_packages p' not in query:
            continue
        if 'from cargo_packages p where' in query:
            assert '(p.org_id=:o or p.destination_org_id=:o)' in query
            assert params['o']=='agency'
    assert '(p.org_id=:o or p.destination_org_id=:o)' in repository.REPORT_SQL['packages']
