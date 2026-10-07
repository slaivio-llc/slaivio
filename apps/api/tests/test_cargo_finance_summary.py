from datetime import datetime, timezone
from unittest.mock import MagicMock

from app.dashboard.finance_summary import finance_summary
from app.dashboard.periods import resolve_period


def test_no_financial_permission_never_queries():
    conn = MagicMock()
    assert finance_summary(conn, 'a', ['network.overview'], {}) is None
    conn.execute.assert_not_called()


def test_finance_uses_active_office_currency_and_confirmed_payments():
    conn = MagicMock()
    conn.execute.return_value.mappings.return_value = [
        {'currency':'USD','collected':'10.00','outstanding':'4.00','overdue':'0.00'},
        {'currency':'CDF','collected':'20000.00','outstanding':'0.00','overdue':'0.00'},
    ]
    period = resolve_period(now=datetime(2026,10,7,tzinfo=timezone.utc))
    result = finance_summary(conn,'office-a',['finance.read'],period)
    assert len(result['currencies']) == 2
    assert result['scope'] == 'office'
    sql,params = conn.execute.call_args.args
    assert "status='CONFIRMED'" in str(sql)
    assert "status in ('ISSUED','PARTIALLY_PAID','OVERDUE')" in str(sql)
    assert 'group by currency' in str(sql)
    assert params['org_id'] == 'office-a'
    assert params['today'] == period['as_of_date']
