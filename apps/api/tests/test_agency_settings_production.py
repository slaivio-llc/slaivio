from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.api.organization_admin import OrgUpdate, SettingsUpdate, NumberingSave
from app.organization_admin import repository, settings_policy as policy
from app.core import auth, tenant_context
from app.documents.agency_brand import identity, label_html


def test_partial_profile_update_does_not_clear_existing_branding():
    body=OrgUpdate(expected_version=4,phone='+243812345678')
    assert body.model_dump(exclude={'expected_version'},exclude_unset=True)=={'phone':'+243812345678'}


def test_partial_settings_update_does_not_reset_language_or_security():
    body=SettingsUpdate(expected_version=2,settings={'shipment_delivery_rules':{'pickup_delay_days':30}})
    data=body.model_dump(exclude={'expected_version'},exclude_unset=True)
    assert set(data)=={'settings'}
    assert data['settings']['shipment_delivery_rules']['pickup_delay_days']==30


@pytest.mark.parametrize('changes',[
    {'settings':{'shipment_delivery_rules':{'pickup_delay_days':-1}}},
    {'settings':{'parcel_receipt_rules':{'allow_photos':'false'}}},
    {'settings':{'document_preferences':{'label_format':'UNSUPPORTED'}}},
    {'settings':{'public_tracking_page':{'slug':'../another-agency'}}},
    {'timezone':'Invalid/Timezone'},
    {'security':{'require_mfa':'yes'}},
])
def test_invalid_settings_are_rejected_before_storage(changes):
    with pytest.raises(ValidationError):
        SettingsUpdate(expected_version=1,**changes)


@pytest.mark.parametrize('format',['COL-{YYYY}-{0001}','COL-{OFFICE}-{YYYY}-{MM}-{000001}',
                                   'COL-{YYYY}-{00000001}'])
def test_supported_numbering_patterns(format):
    assert NumberingSave(expected_version=1,prefix_format=format).prefix_format==format


@pytest.mark.parametrize('format',['COL-{000001}-{000001}','COL-{UNKNOWN}-{000001}','COL-{YYYY}'])
def test_ambiguous_or_unknown_numbering_is_rejected(format):
    with pytest.raises(ValidationError):
        NumberingSave(expected_version=1,prefix_format=format)


def test_receipt_policy_accepts_volume_without_weight_and_requires_category():
    rules={'parcel_receipt_rules':{'allow_unmeasured':False}}
    policy.validate_receipt(rules,{'category':'TEXTILES','package_type':'carton','volume_cbm':0.25})
    with pytest.raises(HTTPException) as error:
        policy.validate_receipt(rules,{'category':'TEXTILES','package_type':'carton'})
    assert error.value.detail=='package_measurement_required'
    with pytest.raises(HTTPException) as error:
        policy.validate_receipt(rules,{'package_type':'carton','weight_kg':2})
    assert error.value.detail=='package_category_required'


def test_photo_disable_is_enforced_server_side():
    connection=MagicMock()
    connection.execute.return_value.scalar.return_value={'parcel_receipt_rules':{'allow_photos':False}}
    with pytest.raises(HTTPException) as error:
        policy.require_photos_allowed(connection,'agency')
    assert error.value.detail=='package_photos_disabled'
    assert connection.execute.call_args.args[1]=={'org_id':'agency'}


def test_disabled_customer_credit_cannot_be_enabled_per_client():
    connection=MagicMock()
    connection.execute.return_value.scalar.return_value={'client_conditions':{'allow_customer_credit':False}}
    with pytest.raises(HTTPException) as error:
        policy.require_credit_allowed(connection,'agency',True)
    assert error.value.detail=='customer_credit_disabled'


def test_delivery_cannot_bypass_required_proof():
    connection=MagicMock()
    connection.execute.return_value.scalar.return_value={'shipment_delivery_rules':{'delivery_proof':True}}
    connection.execute.return_value.first.return_value=None
    with pytest.raises(HTTPException) as error:
        policy.require_delivery_proof(connection,'agency',{'id':'parcel'})
    assert error.value.detail=='delivery_proof_required'
    assert connection.execute.call_args.args[1]=={'org_id':'agency','package_id':'parcel'}


def test_regulated_goods_can_be_received_but_cannot_ship_without_review():
    connection=MagicMock()
    connection.execute.return_value.scalar.return_value={'goods_restrictions':{'regulated_goods_check':True}}
    connection.execute.return_value.mappings.return_value.all.return_value=[{'accepted':True,'requires_manual_validation':True}]
    package={'category':'BATTERIES','validation_status':'PENDING'}
    policy.check_regulated_goods(connection,'agency',package,receiving=True)
    assert package['validation_status']=='NEEDS_REVIEW'
    with pytest.raises(HTTPException) as error:
        policy.check_regulated_goods(connection,'agency',package)
    assert error.value.detail=='regulated_goods_review_required'
    package['validation_status']='VALIDATED'
    policy.check_regulated_goods(connection,'agency',package)


def test_settings_write_cannot_change_security_without_security_manage(monkeypatch):
    connection=MagicMock()
    connection.execute.return_value.mappings.return_value.first.return_value={'security':{'require_mfa':False}}
    mock_engine=MagicMock()
    monkeypatch.setattr(repository,'engine',mock_engine)
    mock_engine.connect.return_value.__enter__.return_value=connection
    permission=MagicMock(side_effect=HTTPException(403,'permission_denied'))
    monkeypatch.setattr(repository,'assert_permission',permission)
    with pytest.raises(HTTPException):
        repository.authorize_settings_update('agency','user',{'security':{'require_mfa':True}}, {'mfa_verified':True})
    permission.assert_called_once_with(user_id='user',org_id='agency',permission_code='security.manage')


def test_mfa_activation_requires_verified_second_factor(monkeypatch):
    connection=MagicMock()
    connection.execute.return_value.mappings.return_value.first.return_value={'security':{}}
    mock_engine=MagicMock()
    monkeypatch.setattr(repository,'engine',mock_engine)
    mock_engine.connect.return_value.__enter__.return_value=connection
    monkeypatch.setattr(repository,'assert_permission',MagicMock())
    with pytest.raises(HTTPException) as error:
        repository.authorize_settings_update('agency','owner',{'security':{'require_mfa':True}}, {})
    assert error.value.detail=='mfa_setup_required'


@pytest.mark.parametrize('fva,verified', [([0,-1],False),([0,0],True),([1,25],True),([0,'0'],False),(None,False)])
def test_mfa_is_derived_only_from_signed_factor_claims(monkeypatch,fva,verified):
    monkeypatch.setattr(auth,'verify_clerk_token',lambda _: {'sub':'user','fva':fva})
    assert auth.get_current_manager('token')['mfa_verified'] is verified


def test_mfa_policy_blocks_unverified_access_to_active_agency(monkeypatch):
    monkeypatch.setattr(tenant_context,'get_tenant_context',lambda _: {'active_tenant':{'org_id':'agency','require_mfa':True}})
    with pytest.raises(HTTPException) as error:
        tenant_context.get_current_tenant({'user_id':'user','mfa_verified':False})
    assert error.value.detail=='organization_mfa_required'
    assert tenant_context.get_current_tenant({'user_id':'user','mfa_verified':True})['org_id']=='agency'


def test_document_preferences_hide_logo_and_office_contacts():
    connection=MagicMock()
    connection.execute.return_value.mappings.return_value.first.return_value={
        'organization_name':'Agence','logo_url':'https://example.com/logo.png',
        'phone':'+24312345678','address':'Adresse privée',
        'settings':{'document_preferences':{'show_agency_logo':False,'show_office_details':False,'label_format':'A4'}}}
    brand=identity(connection,'agency')
    output=label_html({'package_reference':'COL-1','description':'<script>test</script>'},brand)
    assert 'https://example.com/logo.png' not in output
    assert 'Adresse privée' not in output
    assert 'size:A4' in output
    assert '<script>' not in output
    assert '&lt;script&gt;' in output


def test_settings_storage_merges_json_without_resetting_other_sections(monkeypatch):
    connection=MagicMock()
    old={'row_version':3,'currency_code':'USD','settings':{'agency_hours':{'text':'08–17'},'client_conditions':{'allow_customer_credit':True}}}
    updated={**old,'row_version':4}
    statements=[]
    def execute(sql,parameters):
        statements.append((str(sql),parameters))
        result=MagicMock()
        result.mappings.return_value.first.return_value=updated if str(sql).startswith('update organization_settings') else old
        return result
    connection.execute.side_effect=execute
    mock_engine=MagicMock()
    monkeypatch.setattr(repository,'engine',mock_engine)
    mock_engine.begin.return_value.__enter__.return_value=connection
    result=repository.save_settings('agency','owner',{'settings':{'agency_hours':{'text':'09–18'}}},3)
    assert result is not None
    assert result['row_version']==4
    sql,parameters=next(item for item in statements if item[0].startswith('update organization_settings'))
    assert "coalesce(settings,'{}'::jsonb) || cast(:settings as jsonb)" in sql
    assert 'timezone=' not in sql and 'security=' not in sql
    assert parameters['o']=='agency' and parameters['v']==3


def test_brand_update_rolls_back_when_settings_version_is_stale(monkeypatch):
    from app.api.organization_admin import BrandUpdate,patch_brand
    from app.db import database
    transaction=MagicMock()
    monkeypatch.setattr(database,'engine',transaction)
    monkeypatch.setattr(repository,'update_org',MagicMock(return_value={'id':'agency'}))
    monkeypatch.setattr(repository,'save_settings',MagicMock(return_value=None))
    body=BrandUpdate(organization=OrgUpdate(expected_version=2,logo_url='https://example.com/logo.png'),settings_version=1)
    with pytest.raises(HTTPException) as error:
        patch_brand(body,{'org_id':'agency'},{'user_id':'owner'})
    assert error.value.detail=='settings_were_modified'
    assert transaction.begin.return_value.__exit__.call_args.args[0] is HTTPException
    assert repository.update_org.call_args.kwargs['connection'] is repository.save_settings.call_args.kwargs['connection']


@pytest.mark.parametrize('outstanding,limit,currency,enabled,allowed',[
    (80,100,'USD',True,True),(101,100,'USD',True,False),
    (80,100,'EUR',True,False),(80,100,'USD',False,False),
])
def test_customer_credit_requires_approval_currency_and_available_limit(monkeypatch,outstanding,limit,currency,enabled,allowed):
    from app.finance import clearance
    connection=MagicMock()
    controls=MagicMock();controls.mappings.return_value.first.return_value=None
    credit=MagicMock();credit.mappings.return_value.first.return_value={'credit_enabled':enabled,'credit_limit':limit,'preferred_currency':currency,'outstanding':outstanding}
    connection.execute.side_effect=[controls,credit]
    monkeypatch.setattr(clearance,'_clearance',lambda *_args,**_kwargs:{'allowed':False,'code':'PAYMENT_CLEARANCE_REQUIRED','currency':'USD'})
    monkeypatch.setattr(policy,'load_policies',lambda *_args:{'client_conditions':{'allow_customer_credit':True}})
    decision=clearance.delivery_clearance(connection,'agency',{'id':'parcel','client_id':'client'})
    assert decision['allowed'] is allowed
    assert connection.execute.call_args.args[1]=={'o':'agency','client':'client','currency':'USD'}


@pytest.mark.parametrize('preferences,excluded,allowed',[
    ({},False,True),({'customer_milestone_notifications':{'package_arrived':False}},False,False),
    ({'shipment_delivery_rules':{'arrival_notice':False}},False,False),({},True,False),
])
def test_notification_dispatch_rechecks_preferences_and_opt_out(monkeypatch,preferences,excluded,allowed):
    from app.organization_admin import notification_policy
    connection=MagicMock()
    connection.execute.return_value.mappings.return_value.first.return_value={'settings':preferences,'notify_package_milestones':True}
    connection.execute.return_value.first.return_value=(1,) if excluded else None
    mock_engine=MagicMock()
    monkeypatch.setattr(notification_policy,'engine',mock_engine)
    mock_engine.connect.return_value.__enter__.return_value=connection
    assert notification_policy.can_dispatch({'org_id':'agency','notification_type':'PACKAGE_STATUS:parcel:ARRIVED','recipient_phone':'+243812345678'}) is allowed
