from types import SimpleNamespace
from unittest.mock import MagicMock, Mock

from app.billing.repositories import plan_repository, saspay_repository
from app.organizations.services import provisioning_service


def test_catalog_features_come_from_implemented_products_and_enabled_entitlements(monkeypatch):
    conn,engine=MagicMock(),MagicMock()
    engine.connect.return_value.__enter__.return_value=conn
    def rows(values):return [SimpleNamespace(_mapping=value) for value in values]
    conn.execute.return_value.fetchall.side_effect=[
        rows([{'code':'STARTER','max_users':3},{'code':'PRO','max_users':10}]),
        rows([{'plan_code':'STARTER','entitlement_key':'finance_dashboard'},
              {'plan_code':'PRO','entitlement_key':'wallet'}]),
    ]
    monkeypatch.setattr(plan_repository,'engine',engine)
    starter,pro=plan_repository.list_pricing_plans()
    assert 'Gestion des colis et des expéditions' in starter['included_features']
    assert 'Tableau de bord financier (selon activation)' in starter['included_features']
    assert not any('portefeuille' in item for item in starter['included_features'])
    assert 'Éligibilité au portefeuille agence (activation requise)' in pro['included_features']
    assert all('utilisateurs' not in item for item in starter['included_features'])


def test_provisioning_a_new_agency_creates_its_trial_automatically(monkeypatch):
    monkeypatch.setattr(provisioning_service,'upsert_organization',Mock(return_value={'id':'new-agency'}))
    for name in ('ensure_default_roles','ensure_owner_permissions','ensure_client_role_permissions',
                 'ensure_dossier_role_permissions','ensure_shipment_role_permissions','ensure_tracking_role_permissions'):
        monkeypatch.setattr(provisioning_service,name,Mock())
    trial=Mock();monkeypatch.setattr(saspay_repository,'ensure_trial',trial)
    provisioning_service.provision_organization('clerk_org','Nouvelle agence')
    trial.assert_called_once_with('new-agency')
