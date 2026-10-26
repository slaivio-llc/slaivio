"""Opt-in integration tests. TEST_POSTGRES_URL must point to a disposable test DB."""
import os
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from pathlib import Path
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.exc import DBAPIError

URL = os.getenv('TEST_POSTGRES_URL')
pytestmark = pytest.mark.skipif(not URL, reason='Dedicated TEST_POSTGRES_URL is not configured')
DDL = '''
create table organizations(id text primary key,parent_org_id text,agency_type text default 'OFFICE',status text default 'ACTIVE');
create table pricing_plans(id uuid primary key default gen_random_uuid(),code text unique,max_users int,max_whatsapp_numbers int);
create table plan_entitlements(plan_code text,entitlement_key text,entitlement_type text,boolean_value boolean,limit_value int,unique(plan_code,entitlement_key));
create table agency_subscriptions(org_id text primary key,pricing_plan_id uuid);
create table organization_settings(org_id text primary key,timezone text);
create table cargo_packages(id uuid primary key default gen_random_uuid(),org_id text,created_at timestamptz default now(),status text default 'CREATED');
create table organization_memberships(id uuid primary key default gen_random_uuid(),org_id text,clerk_user_id text,member_email text,status text default 'ACTIVE');
create table organization_invitations(id uuid primary key default gen_random_uuid(),org_id text,email text,status text default 'PENDING');
create table organization_whatsapp_numbers(id uuid primary key default gen_random_uuid(),org_id text,provider text,is_active boolean default true);
create table whatsapp_qr_connections(id uuid primary key default gen_random_uuid(),org_id text,whatsapp_number_id uuid,status text default 'CONNECTING');
create table organization_locations(id uuid primary key default gen_random_uuid(),org_id text,location_type text,status text default 'ACTIVE');
create table warehouses(id uuid primary key default gen_random_uuid(),org_id text,active boolean default true);
create table notification_outbox(id uuid primary key default gen_random_uuid(),org_id text,notification_type text);
insert into organizations(id) values('agency');
insert into pricing_plans(code) values('STARTER'),('PRO'),('ENTERPRISE');
insert into agency_subscriptions select 'agency',id from pricing_plans where code='STARTER';
insert into organization_settings values('agency','Africa/Kinshasa');
'''


@pytest.fixture
def database():
    engine=create_engine(URL)
    schema='slaivio_capacity_test_'+uuid4().hex
    migration=(Path(__file__).resolve().parents[3]/'infra/sql/158_subscription_capacity_limits.sql').read_text(encoding='utf-8')
    script=migration.replace('begin;','').replace('commit;','')
    with engine.connect() as c:
        c.exec_driver_sql(f'create schema {schema}')
        c.exec_driver_sql(f'set search_path to {schema},public')
        c.exec_driver_sql(DDL)
        c.exec_driver_sql(script)
        c.commit()
        try:
            yield c
        finally:
            c.rollback()
            c.exec_driver_sql('set search_path to public')
            c.exec_driver_sql(f'drop schema {schema} cascade')
            c.commit()
    engine.dispose()


def enforce(c):
    c.exec_driver_sql("update billing_capacity_transition set enforce_from=now()-interval '1 second'")


def capacity(c):
    return c.execute(text("select billing_capacity('agency')")).scalar_one()


def rejected(c,sql):
    with pytest.raises(DBAPIError) as error:
        with c.begin_nested():
            c.exec_driver_sql(sql)
    assert 'slaivio_plan_limit_reached' in str(error.value)


def test_approved_limits_and_existing_agency_transition(database):
    c=database
    assert capacity(c)['limits']==dict(max_monthly_packages=500,max_users=3,max_offices=1,max_warehouses=1,max_whatsapp_numbers=1)
    assert capacity(c)['transition_active'] is True
    assert c.exec_driver_sql("select billing_advanced_automation('agency')").scalar_one() is True
    c.exec_driver_sql("insert into organizations(id,parent_org_id) values('extra','agency')")
    assert capacity(c)['usage']['max_offices']==2


def test_monthly_packages_cannot_be_refunded_by_deletion_and_existing_parcels_can_move(database):
    c=database;enforce(c)
    c.exec_driver_sql("update plan_entitlements set limit_value=2 where plan_code='STARTER' and entitlement_key='max_monthly_packages'")
    c.exec_driver_sql("insert into cargo_packages(org_id) values('agency'),('agency')")
    rejected(c,"insert into cargo_packages(org_id) values('agency')")
    c.exec_driver_sql("update cargo_packages set status='DELIVERED'")
    c.exec_driver_sql('delete from cargo_packages')
    assert capacity(c)['usage']['max_monthly_packages']==2
    rejected(c,"insert into cargo_packages(org_id) values('agency')")


def test_nested_workspaces_share_the_root_plan_and_do_not_double_count_storage(database):
    c=database;enforce(c)
    c.exec_driver_sql("insert into organizations(id,parent_org_id,agency_type) values('storage','agency','WAREHOUSE')")
    c.exec_driver_sql("insert into organization_locations(org_id,location_type) values('storage','WAREHOUSE')")
    c.exec_driver_sql("insert into warehouses(org_id) values('storage')")
    assert capacity(c)['usage']['max_warehouses']==1
    assert c.exec_driver_sql("select billing_root('storage')").scalar_one()=='agency'
    rejected(c,"insert into organizations(id,parent_org_id,agency_type) values('extra','storage','WAREHOUSE')")
    rejected(c,"insert into organization_locations(org_id,location_type) values('agency','OFFICE'),('agency','OFFICE')")


def test_members_and_pending_invitations_reserve_the_same_seats(database):
    c=database;enforce(c)
    c.exec_driver_sql("insert into organization_memberships(org_id,clerk_user_id,member_email) values('agency','owner','owner@example.com')")
    c.exec_driver_sql("insert into organization_invitations(org_id,email) values('agency','one@example.com'),('agency','two@example.com')")
    assert capacity(c)['usage']['max_users']==3
    rejected(c,"insert into organization_invitations(org_id,email) values('agency','three@example.com')")
    c.exec_driver_sql("update organization_invitations set status='ACCEPTED' where email='one@example.com'")
    assert capacity(c)['usage']['max_users']==3
    rejected(c,"insert into organization_invitations(org_id,email) values('agency','race@example.com')")
    c.exec_driver_sql("insert into organization_memberships(org_id,clerk_user_id,member_email) values('agency','one','one@example.com')")
    assert capacity(c)['usage']['max_users']==3
    c.exec_driver_sql("update organization_memberships set status='INACTIVE' where clerk_user_id='one'")
    assert capacity(c)['usage']['max_users']==2


def test_qr_slot_is_not_counted_again_when_the_number_is_linked(database):
    c=database;enforce(c)
    c.exec_driver_sql("insert into whatsapp_qr_connections(org_id) values('agency')")
    c.exec_driver_sql("insert into organization_whatsapp_numbers(org_id,provider) values('agency','QR_LINKED_DEVICE')")
    assert capacity(c)['usage']['max_whatsapp_numbers']==1
    rejected(c,"insert into organization_whatsapp_numbers(org_id,provider) values('agency','META')")


def test_starter_keeps_confirmations_but_cannot_queue_premium_reminders(database):
    c=database;enforce(c)
    c.exec_driver_sql("insert into notification_outbox(org_id,notification_type) values('agency','CUSTOMER:payment_confirmed:id:key'),('agency','CUSTOMER:awaiting_parcel:id:key'),('agency','NEXT_DEPARTURE:id:phone')")
    assert c.exec_driver_sql('select count(*) from notification_outbox').scalar_one()==1
    c.exec_driver_sql("update agency_subscriptions set pricing_plan_id=(select id from pricing_plans where code='PRO')")
    c.exec_driver_sql("insert into notification_outbox(org_id,notification_type) values('agency','CUSTOMER:awaiting_parcel:id:key')")
    assert c.exec_driver_sql('select count(*) from notification_outbox').scalar_one()==2


def test_two_simultaneous_requests_cannot_both_take_the_last_parcel_slot(database):
    c=database;enforce(c)
    c.exec_driver_sql("update plan_entitlements set limit_value=1 where plan_code='STARTER' and entitlement_key='max_monthly_packages'")
    schema=c.exec_driver_sql('select current_schema()').scalar_one()
    c.commit()
    barrier=Barrier(2)
    def create():
        engine=create_engine(URL)
        try:
            with engine.begin() as other:
                other.exec_driver_sql(f'set search_path to {schema},public')
                barrier.wait(timeout=10)
                other.exec_driver_sql("insert into cargo_packages(org_id) values('agency')")
            return True
        except DBAPIError as exc:
            assert 'slaivio_plan_limit_reached' in str(exc)
            return False
        finally:
            engine.dispose()
    with ThreadPoolExecutor(max_workers=2) as pool:
        outcomes=list(pool.map(lambda _:create(),range(2)))
    assert sorted(outcomes)==[False,True]
    assert capacity(c)['usage']['max_monthly_packages']==1
