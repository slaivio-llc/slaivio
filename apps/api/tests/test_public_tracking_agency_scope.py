from contextlib import nullcontext
from types import SimpleNamespace
from urllib.parse import parse_qs, urlparse
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from app.services.public_tracking_links import public_agency_key,package_tracking_url
from app.organization_admin import public_page
from app.packages import repository


def test_same_reference_generates_distinct_stable_agency_links_without_private_ids():
    for org in ('personal_user_a','office_other'):
        link=package_tracking_url(org,'COL-2026-000001')
        params=parse_qs(urlparse(link).query)
        assert params['reference']==['COL-2026-000001']
        assert params['agency']==[public_agency_key(org)]
        assert org not in link
    assert public_agency_key('personal_user_a')!=public_agency_key('office_other')


def agency_database(monkeypatch,rows):
    conn=MagicMock()
    conn.execute.return_value.mappings.return_value.all.return_value=rows
    monkeypatch.setattr(public_page,'engine',SimpleNamespace(connect=lambda:nullcontext(conn)))
    return conn


def profile():
    return dict(_org_id='office-a',organization_name='OTIE CARGO',logo_url=None,
                primary_color=None,secondary_color=None,phone='+243000000000',settings=None)


def test_unconfigured_agency_has_public_defaults_and_permanent_routing_key(monkeypatch):
    conn=agency_database(monkeypatch,[profile()])
    key=public_agency_key('office-a')
    result=public_page.public_agency(key)
    assert result['agency_key']==key
    assert result['agency_name']=='OTIE CARGO'
    assert result['tracking_page']['show_brand'] is True
    assert '_org_id' not in result and 'settings' not in result
    query=str(conn.execute.call_args.args[0])
    assert 'left join organization_settings' in query
    assert "md5(o.id)" in query
    assert "o.status='ACTIVE'" in query
    assert "->>'enabled'" in query


@pytest.mark.parametrize('rows',[[],[profile(),{**profile(),'_org_id':'office-b'}]])
def test_unavailable_or_ambiguous_agency_never_chooses_an_arbitrary_profile(monkeypatch,rows):
    agency_database(monkeypatch,rows)
    with pytest.raises(HTTPException) as error:public_page.public_agency('otie-cargo')
    assert error.value.status_code==404


def test_stable_key_does_not_override_disabled_brand_or_support_settings(monkeypatch):
    agency_database(monkeypatch,[{**profile(),'settings':{'public_tracking_page':{'show_brand':False,'show_support':False}}}])
    result=public_page.public_agency(public_agency_key('office-a'))
    assert result['agency_name'] is None and result['agency_support_phone'] is None


def test_tracking_and_shared_photos_use_identical_scope_and_disabled_page_guards(monkeypatch):
    conn=MagicMock()
    conn.execute.return_value.fetchall.return_value=[]
    conn.execute.return_value.mappings.return_value.all.return_value=[]
    monkeypatch.setattr(repository,'engine',SimpleNamespace(connect=lambda:nullcontext(conn)))
    key=public_agency_key('office-a')
    assert repository.public_package_tracking('COL-2026-000001',key) is None
    repository.public_package_tracking_media('COL-2026-000001',key)
    queries=[(str(call.args[0]),call.args[1]) for call in conn.execute.call_args_list]
    for sql,params in queries:
        assert "md5(package.org_id)" in sql and params['slug']==key
        assert "public_tracking_enabled=true" in sql and "->>'enabled'" in sql
        assert "status='ACTIVE'" in sql
    assert 'md5(match.org_id)' in queries[-1][0]
    assert 'media.customer_visible=true' in queries[-1][0]
