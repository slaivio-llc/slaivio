from pathlib import Path
from unittest.mock import Mock

import pytest
from fastapi import HTTPException
from app.entitlements.repositories import entitlement_repository as repository
from app.entitlements.services import entitlement_service as service


@pytest.mark.parametrize('key',['max_monthly_packages','max_users','max_offices','max_warehouses','max_whatsapp_numbers','max_monthly_messages'])
def test_all_numeric_trial_entitlements_are_unlimited_and_plan_values_unchanged(monkeypatch,key):
    original={'entitlement_key':key,'entitlement_type':'LIMIT','limit_value':1}
    unlimited=repository._trial_limit(original,True)
    assert unlimited['limit_value'] is None and unlimited['unlimited']
    assert original['limit_value']==1
    monkeypatch.setattr(service,'get_entitlement',lambda **kw: unlimited)
    assert service.get_limit_entitlement('office',key) is None
    assert service.assert_under_limit('office',key,10000000) is True


def test_paid_missing_and_boolean_entitlements_do_not_get_a_trial_bypass(monkeypatch):
    original={'entitlement_key':'max_offices','entitlement_type':'LIMIT','limit_value':1}
    assert repository._trial_limit(original,False)==original
    monkeypatch.setattr(service,'get_entitlement',lambda **kw: original)
    with pytest.raises(HTTPException):service.assert_under_limit('office','max_offices',1)
    monkeypatch.setattr(service,'get_entitlement',lambda **kw: None)
    with pytest.raises(HTTPException):service.assert_under_limit('office','missing',0)
    boolean={'entitlement_type':'BOOLEAN','boolean_value':False}
    assert repository._trial_limit(boolean,True)==boolean


def test_org_entitlements_use_authoritative_trial_state(monkeypatch):
    monkeypatch.setattr(repository,'get_org_plan_code',lambda o:'STARTER')
    monkeypatch.setattr(repository,'get_plan_entitlements',lambda p:[{'entitlement_type':'LIMIT','limit_value':3}])
    trial=Mock(return_value=True)
    monkeypatch.setattr(repository,'is_trial_active',trial)
    assert repository.get_org_entitlements('child-office')['entitlements'][0]['unlimited']
    trial.assert_called_once_with('child-office')
    trial.return_value=False
    assert repository.get_org_entitlements('child-office')['entitlements'][0]['limit_value']==3


def test_migration_bounds_the_bypass_without_rewriting_subscriptions_or_usage():
    sql=(Path(__file__).parents[3]/'infra/sql/170_unlimited_free_trial.sql').read_text(encoding='utf-8')
    for guard in ("s.org_id=billing_root(requested_org)","s.status='TRIAL'",'s.starts_at<=now()', 's.trial_ends_at>now()',
                  "info->>'trial_active'", "'trial_active',trial", "'plan_limits',coalesce(limits,'{}')",'billing_trial_active(requested_org) or exists'):
        assert guard in sql
    assert 'update agency_subscriptions' not in sql
    assert 'update plan_entitlements' not in sql
    assert 'delete from' not in sql
