"""Execute the scope queries against SQLite, translating only PostgreSQL text casts."""
import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine,text
from app.organization_network.operational_points import points,require_point


@pytest.fixture
def connection():
    engine=create_engine('sqlite://')
    with engine.begin() as conn:
        for sql in (
          'create table organizations(id text primary key,group_id text,status text,organization_name text,name text)',
          'create table organization_locations(id text,org_id text,name text,code text,location_type text,country text,city text,address text,phone text,status text,agency_office_id text)',
          'create table organization_memberships(id text,org_id text,clerk_user_id text,status text,role_code text,office_access_scope text)',
          'create table organization_network_memberships(group_id text,clerk_user_id text,status text,access_scope text)',
          'create table organization_membership_offices(membership_id text,org_id text,location_id text)',
          'create table warehouses(id text,org_id text,warehouse_name text,city text,country_code text,active boolean)',
        ):conn.execute(text(sql))
        for org,group,kind in [('root','net','OFFICE'),('branch','net','OFFICE'),('depot','net','WAREHOUSE'),('foreign','another','OFFICE')]:
            conn.execute(text("insert into organizations values(:id,:group,'ACTIVE',:id,:id)"),{'id':org,'group':group})
            conn.execute(text("insert into organization_locations values(:id,:org,:org,:org,:kind,'Chine','Guangzhou',null,null,'ACTIVE',:office)"),{'id':'loc-'+org,'org':org,'kind':kind,'office':None if kind=='WAREHOUSE' else 'office-'+org})
        conn.execute(text("insert into warehouses values('warehouse-depot','depot','Dépôt Chine','Guangzhou','CN',true)"))
        conn.execute(text("insert into organization_memberships values('membership','root','owner','ACTIVE','OWNER','ALL_OFFICES')"))
        conn.execute(text("insert into organization_network_memberships values('net','owner','ACTIVE','ALL_OFFICES')"))
        class Adapter:
            def execute(self,query,params):return conn.execute(text(str(query).replace('::text','')),params)
        yield conn,Adapter()
    engine.dispose()


def test_owner_sees_two_offices_and_one_warehouse_from_the_switcher_network(connection):
    _,conn=connection
    result=points(conn,'root','owner')
    assert {row['org_id'] for row in result['locations']}=={'root','branch','depot'}
    assert {row['id'] for row in result['offices']}=={'office-root','office-branch'}
    assert [row['id'] for row in result['warehouses']]==['warehouse-depot']
    assert len(result['responsible_offices'])==2


def test_network_warehouse_and_destination_office_keep_their_real_owner(connection):
    _,conn=connection
    assert require_point(conn,'root','owner','warehouses','warehouse-depot')['org_id']=='depot'
    assert require_point(conn,'root','owner','offices','office-branch')['org_id']=='branch'


@pytest.mark.parametrize('actor,point',[('owner','office-foreign'),('stranger','office-root')])
def test_unknown_actor_or_foreign_agency_is_refused(connection,actor,point):
    _,conn=connection
    with pytest.raises(HTTPException) as error:require_point(conn,'root',actor,'offices',point)
    assert error.value.status_code==422


def test_assigned_member_only_sees_explicitly_granted_local_office(connection):
    raw,conn=connection
    raw.execute(text("insert into organization_memberships values('staff-member','root','staff','ACTIVE','OPERATOR','SELECTED_OFFICES')"))
    assert points(conn,'root','staff')['locations']==[]
    raw.execute(text("insert into organization_membership_offices values('staff-member','root','loc-root')"))
    assert [row['id'] for row in points(conn,'root','staff')['locations']]==['loc-root']
    assert points(conn,'root','staff')['warehouses']==[]


def test_inactive_network_organization_is_hidden_even_for_owner(connection):
    raw,conn=connection
    raw.execute(text("update organizations set status='INACTIVE' where id='depot'"))
    result=points(conn,'root','owner')
    assert result['warehouses']==[]
    assert len(result['locations'])==2
