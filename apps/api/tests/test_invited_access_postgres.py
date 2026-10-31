"""Migration verification only on an explicitly configured disposable database."""
import os
from pathlib import Path
from uuid import uuid4

import pytest
from sqlalchemy import create_engine

URL=os.getenv('TEST_POSTGRES_URL')
pytestmark=pytest.mark.skipif(not URL,reason='Dedicated TEST_POSTGRES_URL is not configured')
DDL='''
create table organization_invitations(id uuid primary key default gen_random_uuid(),email text,org_id text,status text);
create table organization_roles(id uuid primary key default gen_random_uuid(),org_id text,role_code text,system_role boolean);
create table permissions(id uuid primary key default gen_random_uuid(),permission_code text unique);
create table role_permissions(role_id uuid,permission_id uuid,unique(role_id,permission_id));
create table organization_memberships(org_id text,clerk_user_id text,role_code text,status text);
create table user_role_assignments(user_id text,org_id text,role_id uuid,assignment_status text);
insert into permissions(permission_code) values('finance.read'),('finance.create'),('finance.issue'),('finance.payments'),('finance.export'),('packages.read'),('platform.admin.read'),('quarantine.read');
insert into organization_roles(org_id,role_code,system_role) values('agency','FINANCE',true),('custom','FINANCE',false),('agency','MANAGER',true);
insert into role_permissions select r.id,p.id from organization_roles r cross join permissions p;
insert into organization_memberships values('agency','user','FINANCE','ACTIVE');
insert into user_role_assignments select 'user','agency',id,'ACTIVE' from organization_roles where org_id='agency';
'''


@pytest.fixture
def database():
    assert URL is not None
    engine=create_engine(URL)
    # Fixed prefix plus a generated hex suffix; cleanup never targets app schemas.
    schema='slaivio_invited_access_test_'+uuid4().hex
    migration=(Path(__file__).resolve().parents[3]/'infra/sql/161_invited_member_access.sql').read_text(encoding='utf-8')
    script=migration.replace('begin;','').replace('commit;','')
    with engine.connect() as conn:
        conn.exec_driver_sql(f'create schema {schema}')
        conn.exec_driver_sql(f'set search_path to {schema},public')
        try:
            conn.exec_driver_sql(DDL)
            conn.exec_driver_sql(script)
            conn.commit()
            yield conn,script
        finally:
            conn.rollback()
            conn.exec_driver_sql('set search_path to public')
            conn.exec_driver_sql(f'drop schema {schema} cascade')
            conn.commit()
    engine.dispose()


def test_migration_restricts_only_standard_finance_and_is_repeatable(database):
    conn,script=database
    def granted(org):
        return set(conn.exec_driver_sql('''select p.permission_code from permissions p
            join role_permissions rp on rp.permission_id=p.id join organization_roles r on r.id=rp.role_id
            where r.role_code='FINANCE' and r.org_id=%s''',(org,)).scalars())
    expected={'finance.read','finance.create','finance.issue','finance.payments','finance.export'}
    assert granted('agency')==expected
    assert granted('custom')==expected|{'packages.read'}
    conn.exec_driver_sql(script)
    assert granted('agency')==expected
    assert conn.exec_driver_sql('''select a.assignment_status from user_role_assignments a
        join organization_roles r on r.id=a.role_id where r.role_code='MANAGER' ''').scalar_one()=='REVOKED'
    assert conn.exec_driver_sql('''select a.assignment_status from user_role_assignments a
        join organization_roles r on r.id=a.role_id where r.role_code='FINANCE' ''').scalar_one()=='ACTIVE'


def test_legacy_invitation_defaults_are_preserved(database):
    conn,_=database
    row=conn.exec_driver_sql("insert into organization_invitations(email,org_id,status) values('member@example.com','agency','PENDING') returning office_access_scope,office_ids").one()
    assert row.office_access_scope=='ALL_OFFICES'
    assert row.office_ids==[]


def test_bureau_manager_migration_is_scoped_and_repeatable(database):
    conn,_=database
    conn.exec_driver_sql('alter table organization_roles add column role_name text, add column description text')
    conn.exec_driver_sql("insert into permissions(permission_code) values('network.overview'),('billing.manage'),('team.manage'),('analytics.read')")
    conn.exec_driver_sql("insert into organization_roles(org_id,role_code,system_role) values('custom','MANAGER',false)")
    conn.exec_driver_sql("insert into role_permissions select r.id,p.id from organization_roles r cross join permissions p where r.role_code='MANAGER' on conflict do nothing")
    migration=(Path(__file__).resolve().parents[3]/'infra/sql/162_bureau_manager_access.sql').read_text(encoding='utf-8')
    script=migration.replace('begin;','').replace('commit;','')
    conn.exec_driver_sql(script);conn.commit()
    conn.exec_driver_sql(script);conn.commit()
    standard=set(conn.exec_driver_sql("select p.permission_code from permissions p join role_permissions rp on rp.permission_id=p.id join organization_roles r on r.id=rp.role_id where r.org_id='agency' and r.role_code='MANAGER'").scalars())
    assert {'packages.read','finance.read','finance.payments','team.manage','analytics.read'}<=standard
    assert not {'platform.admin.read','quarantine.read','network.overview','billing.manage'}&standard
    custom=set(conn.exec_driver_sql("select p.permission_code from permissions p join role_permissions rp on rp.permission_id=p.id join organization_roles r on r.id=rp.role_id where r.org_id='custom' and r.role_code='MANAGER'").scalars())
    assert 'network.overview' in custom
    assert conn.exec_driver_sql('select count(*) from organization_memberships').scalar_one()==1


def test_operational_migration_preserves_custom_roles_and_is_repeatable(database):
    from sqlalchemy import text
    from app.organizations.services.operational_role_policy import OPERATIONAL_ROLES
    conn, _ = database
    conn.exec_driver_sql('create table organizations(id text primary key)')
    conn.exec_driver_sql("insert into organizations values('agency'),('custom'),('new-agency')")
    conn.exec_driver_sql('alter table organization_roles add column role_name text, add column description text, add unique(org_id,role_code)')
    conn.exec_driver_sql("insert into organization_roles(org_id,role_code,system_role) values('agency','SUPPORT',true),('custom','SUPPORT',false)")
    for code in {p for value in OPERATIONAL_ROLES.values() for p in value[2].split()}:
        conn.execute(text('insert into permissions(permission_code) select :code where not exists(select 1 from permissions where permission_code=:code)'), {'code': code})
    conn.exec_driver_sql("insert into role_permissions select r.id,p.id from organization_roles r cross join permissions p where r.role_code='SUPPORT'")
    def granted(org):
        return set(conn.execute(text('''select p.permission_code from role_permissions rp
            join permissions p on p.id=rp.permission_id join organization_roles r on r.id=rp.role_id
            where r.org_id=:org and r.role_code='SUPPORT' '''), {'org': org}).scalars())
    custom = granted('custom')
    script = (Path(__file__).resolve().parents[3]/'infra/sql/164_operational_member_access.sql').read_text(encoding='utf-8').replace('begin;', '').replace('commit;', '')
    for _ in range(2):
        conn.exec_driver_sql(script)
        conn.commit()
        assert granted('agency') == set(OPERATIONAL_ROLES['SUPPORT'][2].split())
        assert granted('new-agency') == granted('agency')
        assert granted('custom') == custom
        assert conn.exec_driver_sql('select count(*) from organization_memberships').scalar_one() == 1
