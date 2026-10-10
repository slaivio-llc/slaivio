from datetime import date, datetime, timezone
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.dashboard.periods import resolve_period
from app.dashboard import cargo_overview as repo

NOW = datetime(2026, 10, 7, 12, tzinfo=timezone.utc)


@pytest.mark.parametrize('metric', list(repo.FLOW_COLUMNS) + list(repo.STATE_FILTERS))
def test_drilldown_uses_exact_metric_definition(metric):
    predicate = repo.metric_predicate(metric)
    if metric in repo.FLOW_COLUMNS:
        assert predicate == f'{repo.FLOW_COLUMNS[metric]}>=:start and {repo.FLOW_COLUMNS[metric]}<:end'
    else:
        assert predicate == repo.STATE_FILTERS[metric]


def test_invalid_metric_is_rejected_before_database(monkeypatch):
    engine = MagicMock()
    monkeypatch.setattr(repo, 'engine', engine)
    with pytest.raises(HTTPException) as error:
        repo.cargo_overview({'org_id':'a','user_id':'b'}, ['packages.read'], metric='status OR true')
    assert error.value.status_code == 422
    engine.connect.assert_not_called()


@pytest.mark.parametrize('preset,start,end', [
    ('today','2026-10-07','2026-10-07'), ('yesterday','2026-10-06','2026-10-06'),
    ('7d','2026-10-01','2026-10-07'), ('30d','2026-09-08','2026-10-07'),
    ('90d','2026-07-10','2026-10-07'), ('week','2026-10-05','2026-10-07'),
    ('last_week','2026-09-28','2026-10-04'), ('month','2026-10-01','2026-10-07'),
    ('last_month','2026-09-01','2026-09-30'), ('quarter','2026-10-01','2026-10-07'),
    ('last_quarter','2026-07-01','2026-09-30'), ('year','2026-01-01','2026-10-07'),
    ('last_year','2025-01-01','2025-12-31'),
])
def test_calendar_presets(preset, start, end):
    result = resolve_period(preset=preset, now=NOW)
    assert result['current']['start'] == start
    assert result['current']['end'] == end
    assert result['previous']['end_utc'] == result['current']['start_utc']


def test_daylight_saving_day_is_not_assumed_to_be_24_hours():
    result = resolve_period(preset='custom', start=date(2026,3,29), end=date(2026,3,29),
                            timezone_name='Europe/Paris', now=NOW)
    current = result['current']
    assert (current['end_utc']-current['start_utc']).total_seconds() == 23*3600


def test_leap_day_previous_year():
    result = resolve_period(preset='custom', comparison='year', start=date(2024,2,29),
                            end=date(2024,2,29), now=NOW)
    assert result['previous']['start'] == '2023-02-28'


@pytest.mark.parametrize('options', [
    {'preset':'unknown'}, {'comparison':'unknown'}, {'timezone_name':'Not/AZone'},
    {'preset':'custom'}, {'comparison':'custom'},
    {'preset':'custom','start':date(2026,10,7),'end':date(2026,10,6)},
    {'preset':'custom','start':date(2026,10,7),'end':date(2026,10,8)},
    {'preset':'custom','start':date(2020,1,1),'end':date(2026,1,1)},
])
def test_invalid_period_is_rejected(options):
    with pytest.raises(ValueError):
        resolve_period(now=NOW, **options)


def test_custom_comparison_and_no_comparison():
    result = resolve_period(comparison='custom', compare_start=date(2026,8,1),
                            compare_end=date(2026,8,31), now=NOW)
    assert result['previous']['start']=='2026-08-01'
    assert resolve_period(comparison='none',now=NOW)['previous'] is None


@pytest.mark.parametrize('permissions,scope', [([], 'office'), (['packages.read'], 'network')])
def test_missing_permission_never_opens_database(monkeypatch, permissions, scope):
    engine = MagicMock()
    monkeypatch.setattr(repo, 'engine', engine)
    with pytest.raises(HTTPException) as error:
        repo.cargo_overview({'org_id':'office-a','user_id':'agent'}, permissions, scope=scope)
    assert error.value.status_code == 403
    engine.connect.assert_not_called()


def test_office_queries_use_dates_not_status_for_flow(monkeypatch):
    engine=MagicMock()
    monkeypatch.setattr(repo,'engine',engine)
    conn=engine.connect.return_value.__enter__.return_value
    conn.execute.return_value.mappings.return_value.first.return_value={
        'id':'office-a','name':'Agency','country':'CD','city':'Kinshasa',
        'timezone':'Africa/Kinshasa','organization_type':'PARCEL_FREIGHT','group_id':None}
    conn.execute.return_value.mappings.return_value.one.return_value={'received':0,'shipped':0,'delivered':0}
    result=repo.cargo_overview({'org_id':'office-a','user_id':'agent'},['packages.read'])
    assert result['scope']=='office'
    for call in conn.execute.call_args_list[1:]:
        sql,params=call.args
        assert 'p.deleted_at is null' in str(sql)
        assert 'p.destination_org_id=:org_id' in str(sql)
        assert params['org_ids']==['office-a']
    flow,params=conn.execute.call_args_list[1].args
    assert 'received_at>=:start and received_at<:end' in str(flow)
    assert 'dispatched_at>=:start and dispatched_at<:end' in str(flow)
    assert params['start'].tzinfo is not None
    assert not any('from cargo_departures' in str(call.args[0]) for call in conn.execute.call_args_list)


def test_departures_require_permission_and_share_office_scope(monkeypatch):
    engine=MagicMock()
    monkeypatch.setattr(repo,'engine',engine)
    conn=engine.connect.return_value.__enter__.return_value
    conn.execute.return_value.mappings.return_value.first.return_value={
        'id':'office-a','name':'Agency','timezone':'UTC','organization_type':'PARCEL_FREIGHT','group_id':None}
    conn.execute.return_value.mappings.return_value.one.return_value={}
    repo.cargo_overview({'org_id':'office-a','user_id':'agent'},['packages.read','departures.read'])
    sql,params=next(call.args for call in conn.execute.call_args_list if 'from cargo_departures' in str(call.args[0]))
    assert "status in ('OPEN','CLOSED','LOADING')" in str(sql)
    assert 'org_id=any(cast(:org_ids as text[]))' in str(sql)
    assert params['org_ids']==['office-a']


def test_database_failure_is_not_reported_as_zero(monkeypatch):
    engine=MagicMock()
    monkeypatch.setattr(repo,'engine',engine)
    engine.connect.side_effect=RuntimeError('database unavailable')
    with pytest.raises(RuntimeError):
        repo.cargo_overview({'org_id':'office-a','user_id':'agent'},['packages.read'])


@pytest.mark.parametrize('scope', ['office', 'network'])
def test_trend_uses_explicit_day_alias_and_preserves_timezone_scope(monkeypatch, scope):
    engine = MagicMock()
    monkeypatch.setattr(repo, 'engine', engine)
    conn = engine.connect.return_value.__enter__.return_value
    conn.execute.return_value.mappings.return_value.first.return_value = {
        'id': 'office-a', 'name': 'Agency', 'timezone': 'Africa/Kinshasa',
        'organization_type': 'PARCEL_FREIGHT', 'group_id': 'group-a'}
    conn.execute.return_value.scalars.return_value = ['office-a', 'office-b']
    conn.execute.return_value.mappings.return_value.one.return_value = {}
    repo.cargo_overview({'org_id': 'office-a', 'user_id': 'agent'},
                       ['packages.read', 'network.overview'], scope=scope)
    queries = [(str(call.args[0]), call.args[1]) for call in conn.execute.call_args_list
               if 'at time zone :timezone' in str(call.args[0])]
    assert len(queries) == 1
    sql, params = queries[0]
    # DAY cannot be used as a bare alias here; keep the frontend's "day" key.
    assert '::date AS "day"' in sql
    assert 'received_at>=:start and received_at<:end' in sql
    assert 'p.deleted_at is null' in sql
    assert params['timezone'] == 'Africa/Kinshasa'
    assert params['start'].tzinfo is not None
    assert params['end'] > params['start']
    assert params['org_ids'] == (['office-a'] if scope == 'office' else ['office-a', 'office-b'])


def test_drilldown_pagination_and_upcoming_are_scoped(monkeypatch):
    engine=MagicMock()
    monkeypatch.setattr(repo,'engine',engine)
    conn=engine.connect.return_value.__enter__.return_value
    conn.execute.return_value.mappings.return_value.first.return_value={
        'id':'office-a','name':'Agency','timezone':'UTC','organization_type':'PARCEL_FREIGHT','group_id':None}
    conn.execute.return_value.mappings.return_value.one.return_value={'total':31}
    result=repo.cargo_overview({'org_id':'office-a','user_id':'agent'},['packages.read'], metric='received',page=2)
    assert result['drilldown']['total']==31
    assert result['drilldown']['page']==2
    queries=[(str(call.args[0]),call.args[1]) for call in conn.execute.call_args_list]
    matches=[(sql,params) for sql,params in queries if 'limit 25 offset' in sql]
    assert len(matches)==1
    sql,params=matches[0]
    assert 'received_at>=:start and received_at<:end' in sql
    assert params['offset']==25
    assert params['org_ids']==['office-a']
    upcoming=[sql for sql,_ in queries if "interval '7 days'" in sql][0]
    assert "status not in ('DELIVERED','CANCELLED','RETURNED')" in upcoming
    assert 'p.deleted_at is null' in upcoming


def test_network_scope_requires_active_authorized_offices(monkeypatch):
    engine=MagicMock()
    monkeypatch.setattr(repo,'engine',engine)
    conn=engine.connect.return_value.__enter__.return_value
    conn.execute.return_value.mappings.return_value.first.return_value={
        'id':'office-a','name':'Agency','timezone':'UTC','organization_type':'PARCEL_FREIGHT','group_id':'group-a'}
    conn.execute.return_value.scalars.return_value=['office-a','office-b']
    conn.execute.return_value.mappings.return_value.one.return_value={}
    result=repo.cargo_overview({'org_id':'office-a','user_id':'agent'},['packages.read','network.overview'],scope='network')
    sql,params=conn.execute.call_args_list[1].args
    assert "m.status='ACTIVE' and m.access_scope='ALL_OFFICES'" in str(sql)
    assert "m.org_id=o.id and m.clerk_user_id=:user_id and m.status='ACTIVE'" in str(sql)
    assert params['user_id']=='agent'
    assert result['office_count']==2
    assert conn.execute.call_args_list[2].args[1]['org_ids']==['office-a','office-b']
