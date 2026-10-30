from types import SimpleNamespace
from unittest.mock import MagicMock, Mock

from app.billing.repositories import plan_repository, saspay_repository
from app.organizations.services import provisioning_service
from app.api import billing


def test_catalog_features_come_from_implemented_products_and_enabled_entitlements(monkeypatch):
    conn,engine=MagicMock(),MagicMock()
    engine.connect.return_value.__enter__.return_value=conn
    def rows(values):return [SimpleNamespace(_mapping=value) for value in values]
    conn.execute.return_value.fetchall.side_effect=[
        rows([{'code':'STARTER','max_users':3},{'code':'PRO','max_users':10},{'code':'ENTERPRISE','max_users':40}]),
        rows([{'plan_code':'STARTER','entitlement_key':'max_monthly_packages','limit_value':500},
              {'plan_code':'PRO','entitlement_key':'max_monthly_packages','limit_value':2500}]),
    ]
    monkeypatch.setattr(plan_repository,'engine',engine)
    starter,pro,business=plan_repository.list_pricing_plans()
    assert starter['limits']['max_monthly_packages']==500
    assert pro['limits']['max_monthly_packages']==2500
    assert 'Relances clients programmées' not in starter['included_features']
    assert 'Relances clients programmées' in pro['included_features']
    assert pro['recommended'] is True
    assert len(starter['value_highlights']) == len(pro['value_highlights']) == len(business['value_highlights']) == 3
    assert 'solde restant' in ' '.join(starter['value_highlights'])
    assert 'départs bloqués' in ' '.join(pro['value_highlights'])
    assert 'mêmes automatisations que Pro' in ' '.join(business['value_highlights'])
    assert business['included_features'][0] == 'Toutes les fonctions de Pro'
    assert 'exclusif' not in ' '.join(business['included_features'])


def test_provisioning_a_new_agency_creates_its_trial_automatically(monkeypatch):
    monkeypatch.setattr(provisioning_service,'upsert_organization',Mock(return_value={'id':'new-agency'}))
    for name in ('ensure_default_roles','ensure_owner_permissions','ensure_client_role_permissions',
                 'ensure_dossier_role_permissions','ensure_shipment_role_permissions','ensure_tracking_role_permissions','ensure_finance_role_permissions','ensure_manager_role_permissions'):
        monkeypatch.setattr(provisioning_service,name,Mock())
    trial=Mock();monkeypatch.setattr(saspay_repository,'ensure_trial',trial)
    provisioning_service.provision_organization('clerk_org','Nouvelle agence')
    trial.assert_called_once_with('new-agency')


def test_header_status_uses_the_existing_agency_trial_without_invoice_queries(monkeypatch):
    trial=Mock(return_value={'status':'TRIAL','trial_ends_at':'2026-11-24','ends_at':'2026-11-24'})
    monkeypatch.setattr(saspay_repository,'ensure_trial',trial)
    assert billing.billing_status({'org_id':'office'})['subscription']['trial_ends_at']=='2026-11-24'
    trial.assert_called_once_with('office')
