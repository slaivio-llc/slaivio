"""Network addresses for configuration, not cross-office access to business records."""
from fastapi import HTTPException
from sqlalchemy import text


SCOPE = """
 target.status='ACTIVE' and source.status='ACTIVE' and
 (target.id=source.id or (source.group_id is not null and target.group_id=source.group_id))
 and exists(select 1 from organization_memberships current_member
   where current_member.org_id=source.id and current_member.clerk_user_id=:actor
     and current_member.status='ACTIVE')
 and (exists(select 1 from organization_network_memberships access
   where access.group_id=source.group_id and access.clerk_user_id=:actor
     and access.status='ACTIVE' and access.access_scope='ALL_OFFICES')
   or exists(select 1 from organization_memberships member
     where member.org_id=target.id and member.clerk_user_id=:actor and member.status='ACTIVE'
       and (member.role_code='OWNER' or member.office_access_scope='ALL_OFFICES'
         or exists(select 1 from organization_membership_offices grant_row
           where grant_row.membership_id=member.id and grant_row.org_id=target.id
             and grant_row.location_id=location.id))))
"""


def points(conn, org_id, actor):
    params={'org': org_id, 'actor': actor}
    locations=conn.execute(text(f"""select location.id::text id,location.id::text location_id,
        location.org_id,location.name,location.code,location.location_type,location.country,
        location.city,location.address,location.phone,location.status,location.agency_office_id::text,
        coalesce(target.organization_name,target.name) organization_name
      from organizations source join organizations target on true
      join organization_locations location on location.org_id=target.id and location.status='ACTIVE'
      where source.id=:org and {SCOPE}
      order by target.id=source.id desc,location.country,location.city,location.name"""),params).mappings().all()
    warehouses=conn.execute(text(f"""select distinct warehouse.id::text id,warehouse.org_id,
        warehouse.warehouse_name name,warehouse.city,warehouse.country_code country
      from organizations source join organizations target on true
      join warehouses warehouse on warehouse.org_id=target.id and warehouse.active
      left join organization_locations location on location.org_id=target.id
        and location.location_type='WAREHOUSE' and location.status='ACTIVE'
      where source.id=:org and {SCOPE} order by name"""),params).mappings().all()
    locations=[dict(row) for row in locations]
    return {'locations':locations,'responsible_offices':[row for row in locations if row['location_type']=='OFFICE'],
            'offices':[{**row,'id':row['agency_office_id']} for row in locations
                       if row['location_type']=='OFFICE' and row['agency_office_id']],
            'warehouses':[dict(row) for row in warehouses]}


def require_point(conn, org_id, actor, kind, point_id):
    if not point_id:
        return None
    match=next((row for row in points(conn,org_id,actor)[kind] if str(row['id'])==str(point_id)),None)
    if not match:
        raise HTTPException(422,'Cette implantation est indisponible ou vous n’avez pas accès à ce bureau.')
    return match
