import json
import re
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import text

from app.db.database import engine
from app.organizations.services.membership_role_service import sync_membership_with_role
from app.organizations.services.provisioning_service import provision_organization


def _rows(result):
    return [dict(row) for row in result.mappings().all()]


def _event(conn, group_id: str, org_id: str | None, event_type: str, actor_id: str, payload: dict):
    conn.execute(text("""
        insert into organization_network_events(group_id,org_id,event_type,actor_id,payload)
        values(cast(:group_id as uuid),:org_id,:event_type,:actor_id,cast(:payload as jsonb))
    """), {
        "group_id": group_id, "org_id": org_id, "event_type": event_type,
        "actor_id": actor_id, "payload": json.dumps(payload, default=str),
    })


def _current_network(conn, org_id: str):
    return conn.execute(text("""
        select organization.id org_id,organization.group_id::text,
          coalesce(network.group_name,organization.organization_name,organization.name) network_name,
          organization.organization_type
        from organizations organization
        left join organization_groups network on network.id=organization.group_id
        where organization.id=:org_id and organization.status='ACTIVE'
    """), {"org_id": org_id}).mappings().first()


def context(org_id: str, user_id: str) -> dict:
    with engine.connect() as conn:
        current = _current_network(conn, org_id)
        if not current:
            raise HTTPException(404, "organization_not_found")
        if not current.get("group_id"):
            office = conn.execute(text("""
                select id org_id,coalesce(organization_name,name,id) organization_name,
                  organization_code,country,city,address,phone,email,true is_current,
                  'ORIGIN' office_role
                from organizations where id=:org_id
            """), {"org_id": org_id}).mappings().one()
            return {"network": None, "access": None, "offices": [dict(office)], "summary": {"offices": 1, "countries": 1}}

        access = conn.execute(text("""
            select network_role,access_scope,status
            from organization_network_memberships
            where group_id=cast(:group_id as uuid) and clerk_user_id=:user_id and status='ACTIVE'
        """), {"group_id": current["group_id"], "user_id": user_id}).mappings().first()
        all_offices = bool(access and access["access_scope"] == "ALL_OFFICES")
        offices = _rows(conn.execute(text("""
            select office.id org_id,coalesce(office.organization_name,office.name,office.id) organization_name,
              office.organization_code,office.country,office.city,office.address,office.phone,office.email,
              office.id=:org_id is_current,
              case when office.id=:org_id then 'CURRENT' else 'NETWORK' end office_role,
              count(package.id) filter(where package.deleted_at is null)::int package_count,
              count(package.id) filter(where package.deleted_at is null and package.status='IN_TRANSIT')::int in_transit_count,
              count(package.id) filter(where package.deleted_at is null and package.status='DELIVERED')::int delivered_count
            from organizations office
            left join cargo_packages package
              on package.org_id=office.id or package.destination_org_id=office.id
            where office.group_id=cast(:group_id as uuid) and office.status='ACTIVE'
              and (:all_offices or exists(
                select 1 from organization_memberships membership
                where membership.org_id=office.id and membership.clerk_user_id=:user_id and membership.status='ACTIVE'
              ))
            group by office.id
            order by office.id=:org_id desc,office.country,office.city,organization_name
        """), {"group_id": current["group_id"], "org_id": org_id, "user_id": user_id, "all_offices": all_offices}))
        countries = {str(office.get("country") or "").strip() for office in offices if office.get("country")}
        return {
            "network": {"group_id": current["group_id"], "name": current["network_name"]},
            "access": dict(access) if access else {"network_role": "MEMBER", "access_scope": "ASSIGNED_OFFICES"},
            "offices": offices,
            "summary": {
                "offices": len(offices), "countries": len(countries),
                "packages": sum(int(office.get("package_count") or 0) for office in offices),
                "in_transit": sum(int(office.get("in_transit_count") or 0) for office in offices),
            },
        }


def setup(org_id: str, actor_id: str, network_name: str, country_code: str, country_name: str,
          currency_code: str, timezone: str) -> dict:
    code = re.sub(r"[^A-Z0-9]+", "-", network_name.upper()).strip("-")[:30] or "NETWORK"
    with engine.begin() as conn:
        current = _current_network(conn, org_id)
        if not current:
            raise HTTPException(404, "organization_not_found")
        group_id = current.get("group_id")
        if not group_id:
            group = conn.execute(text("""
                insert into organization_groups(group_code,group_name)
                values(:code,:name) on conflict(group_code) do update set group_name=excluded.group_name,updated_at=now()
                returning id::text
            """), {"code": f"{code}-{uuid4().hex[:6].upper()}", "name": network_name.strip()}).mappings().one()
            group_id = group["id"]
            conn.execute(text("update organizations set group_id=cast(:group_id as uuid),parent_org_id=null,updated_at=now() where id=:org_id"), {"group_id": group_id, "org_id": org_id})
        country = conn.execute(text("""
            insert into organization_countries(group_id,country_code,country_name,default_currency_code,default_timezone)
            values(cast(:group_id as uuid),upper(:country_code),:country_name,upper(:currency_code),:timezone)
            on conflict(group_id,country_code) do update set country_name=excluded.country_name,
              default_currency_code=excluded.default_currency_code,default_timezone=excluded.default_timezone,updated_at=now()
            returning id::text
        """), {"group_id": group_id, "country_code": country_code, "country_name": country_name,
                 "currency_code": currency_code, "timezone": timezone}).mappings().one()
        conn.execute(text("update organizations set country_id=cast(:country_id as uuid),country=coalesce(country,:country_name),updated_at=now() where id=:org_id"), {"country_id": country["id"], "country_name": country_name, "org_id": org_id})
        conn.execute(text("""
            insert into organization_settings(org_id,timezone,currency_code,country_code)
            values(:org_id,:timezone,upper(:currency_code),upper(:country_code))
            on conflict(org_id) do update set timezone=excluded.timezone,
              currency_code=excluded.currency_code,country_code=excluded.country_code,updated_at=now()
        """), {"org_id": org_id, "timezone": timezone,
                 "currency_code": currency_code, "country_code": country_code})
        conn.execute(text("""
            insert into organization_network_memberships(group_id,clerk_user_id,network_role,access_scope,created_by)
            values(cast(:group_id as uuid),:actor,'OWNER','ALL_OFFICES',:actor)
            on conflict(group_id,clerk_user_id) do update set network_role='OWNER',access_scope='ALL_OFFICES',status='ACTIVE',updated_at=now()
        """), {"group_id": group_id, "actor": actor_id})
        _event(conn, group_id, org_id, "NETWORK_CONFIGURED", actor_id, {"network_name": network_name, "country_code": country_code})
    return context(org_id, actor_id)


def create_office(org_id: str, actor: dict, payload: dict) -> dict:
    actor_id = str(actor.get("user_id") or actor.get("id") or "")
    with engine.connect() as conn:
        current = _current_network(conn, org_id)
        if not current or not current.get("group_id"):
            raise HTTPException(409, "configure_network_before_creating_office")
        access = conn.execute(text("""
            select network_role,access_scope from organization_network_memberships
            where group_id=cast(:group_id as uuid) and clerk_user_id=:actor and status='ACTIVE'
        """), {"group_id": current["group_id"], "actor": actor_id}).mappings().first()
        if not access or access["network_role"] not in {"OWNER", "DIRECTOR"}:
            raise HTTPException(403, "network_office_creation_denied")

    clerk_org_id = f"office_{uuid4().hex}"
    office = provision_organization(clerk_org_id=clerk_org_id, organization_name=payload["organization_name"].strip())
    if not office:
        raise HTTPException(500, "office_provisioning_failed")
    office_id = str(office["id"])
    with engine.begin() as conn:
        country = conn.execute(text("""
            insert into organization_countries(group_id,country_code,country_name,default_currency_code,default_timezone)
            values(cast(:group_id as uuid),upper(:country_code),:country,upper(:currency),:timezone)
            on conflict(group_id,country_code) do update set default_currency_code=excluded.default_currency_code,
              default_timezone=excluded.default_timezone,updated_at=now() returning id::text
        """), {"group_id": current["group_id"], "country": payload["country"], "country_code": payload["country_code"],
                 "currency": payload["currency_code"], "timezone": payload["timezone"]}).mappings().one()
        conn.execute(text("""
            update organizations set group_id=cast(:group_id as uuid),country_id=cast(:country_id as uuid),
              parent_org_id=:parent,organization_type='PARCEL_FREIGHT',agency_type='OFFICE',
              organization_code=:code,country=:country,city=:city,address=:address,phone=:phone,email=:email,updated_at=now()
            where id=:office_id
        """), {"group_id": current["group_id"], "country_id": country["id"], "parent": org_id,
                 "code": payload["office_code"].upper(), "country": payload["country"], "city": payload["city"],
                 "address": payload.get("address"), "phone": payload.get("phone"), "email": payload.get("email"),
                 "office_id": office_id})
        conn.execute(text("""
            insert into organization_locations(org_id,name,code,location_type,country,city,address,phone,email,timezone)
            values(:office_id,:name,:code,'OFFICE',:country,:city,:address,:phone,:email,:timezone)
            on conflict(org_id,code) do nothing
        """), {"office_id": office_id, "name": payload["organization_name"], "code": payload["office_code"].upper(),
                 "country": payload["country"], "city": payload["city"], "address": payload.get("address"),
                 "phone": payload.get("phone"), "email": payload.get("email"), "timezone": payload["timezone"]})
        conn.execute(text("""
            insert into organization_settings(org_id,timezone,currency_code,country_code,language_code)
            values(:office_id,:timezone,upper(:currency),upper(:country_code),'fr')
            on conflict(org_id) do update set timezone=excluded.timezone,currency_code=excluded.currency_code,country_code=excluded.country_code
        """), {"office_id": office_id, "timezone": payload["timezone"], "currency": payload["currency_code"], "country_code": payload["country_code"]})
        conn.execute(text("insert into organization_billing_profiles(org_id) values(:office_id) on conflict(org_id) do nothing"), {"office_id": office_id})
        conn.execute(text("insert into parcel_operation_settings(org_id) values(:office_id) on conflict(org_id) do nothing"), {"office_id": office_id})
        conn.execute(text("insert into knowledge_settings(org_id) values(:office_id) on conflict(org_id) do nothing"), {"office_id": office_id})
        conn.execute(text("insert into ai_settings(org_id) values(:office_id) on conflict(org_id) do nothing"), {"office_id": office_id})
        conn.execute(text("""
            insert into role_permissions(role_id,permission_id)
            select target_role.id,source_permission.permission_id
            from organization_roles source_role
            join role_permissions source_permission on source_permission.role_id=source_role.id
            join organization_roles target_role
              on target_role.org_id=:office_id and target_role.role_code=source_role.role_code
            where source_role.org_id=:source_org_id
            on conflict do nothing
        """), {"office_id": office_id, "source_org_id": org_id})
        conn.execute(text("""
            insert into document_numbering_settings(org_id,document_type,prefix_format)
            select :office_id,seed.document_type,seed.prefix_format from (values
              ('CLIENT','CLI-{YYYY}-{000001}'),('DOSSIER','DOS-{YYYY}-{000001}'),
              ('PACKAGE','COL-{YYYY}-{000001}'),('SHIPMENT','EXP-{YYYY}-{000001}'),
              ('MANIFEST','MAN-{YYYY}-{000001}'),('INVOICE','INV-{YYYY}-{000001}'),
              ('RECEIPT','REC-{YYYY}-{000001}')
            ) seed(document_type,prefix_format)
            on conflict(org_id,document_type) do nothing
        """), {"office_id": office_id})
        _event(conn, current["group_id"], office_id, "OFFICE_CREATED", actor_id, payload)

    sync_membership_with_role(
        clerk_membership_id=f"network_membership_{uuid4().hex}", clerk_user_id=actor_id,
        clerk_org_id=clerk_org_id, org_id=office_id, user_email=actor.get("email"),
        user_display_name=actor.get("full_name") or actor.get("name") or actor.get("email"),
        default_role_code="OWNER",
    )
    return context(org_id, actor_id)


def grant_offices(org_id: str, actor_id: str, target_user_id: str, office_ids: list[str], role_code: str) -> dict:
    with engine.connect() as conn:
        current = _current_network(conn, org_id)
        if not current or not current.get("group_id"):
            raise HTTPException(409, "organization_network_not_configured")
        source_member = conn.execute(text("""
            select member_email,member_display_name,role_code from organization_memberships
            where clerk_user_id=:user_id and org_id=:org_id and status='ACTIVE'
        """), {"user_id": target_user_id, "org_id": org_id}).mappings().first()
        if not source_member:
            raise HTTPException(404, "member_not_found_in_current_office")
        if source_member["role_code"] == "OWNER":
            raise HTTPException(409, "network_owner_access_must_be_managed_by_another_owner")
        offices = _rows(conn.execute(text("""
            select id,clerk_org_id from organizations
            where group_id=cast(:group_id as uuid) and id=any(cast(:office_ids as text[])) and status='ACTIVE'
        """), {"group_id": current["group_id"], "office_ids": office_ids}))
    if len(offices) != len(set(office_ids)):
        raise HTTPException(422, "office_outside_network")
    with engine.begin() as conn:
        conn.execute(text("""
            insert into organization_memberships(
              clerk_membership_id,clerk_user_id,clerk_org_id,org_id,role_code,
              member_email,member_display_name,status
            )
            select 'network_grant_' || replace(gen_random_uuid()::text,'-',''),
              :user_id,office.clerk_org_id,office.id,:role_code,:email,:display_name,'ACTIVE'
            from organizations office
            where office.group_id=cast(:group_id as uuid)
              and office.id=any(cast(:office_ids as text[]))
            on conflict(clerk_user_id,clerk_org_id) do update set
              role_code=excluded.role_code,
              member_email=coalesce(excluded.member_email,organization_memberships.member_email),
              member_display_name=coalesce(excluded.member_display_name,organization_memberships.member_display_name),
              status='ACTIVE',suspended_at=null,updated_at=now()
        """), {
            "group_id": current["group_id"], "user_id": target_user_id,
            "office_ids": office_ids, "role_code": role_code,
            "email": source_member.get("member_email"),
            "display_name": source_member.get("member_display_name"),
        })
        conn.execute(text("""
            insert into user_role_assignments(user_id,org_id,role_id,assignment_status)
            select :user_id,role.org_id,role.id,'ACTIVE'
            from organization_roles role
            where role.org_id=any(cast(:office_ids as text[])) and role.role_code=:role_code
            on conflict(user_id,org_id,role_id) do update set assignment_status='ACTIVE'
        """), {"user_id": target_user_id, "office_ids": office_ids, "role_code": role_code})
        conn.execute(text("""
            update organization_memberships membership
            set status='SUSPENDED',suspended_at=now(),updated_at=now()
            from organizations office
            where membership.org_id=office.id
              and office.group_id=cast(:group_id as uuid)
              and membership.clerk_user_id=:user_id
              and not (membership.org_id=any(cast(:office_ids as text[])))
        """), {"group_id": current["group_id"], "user_id": target_user_id, "office_ids": office_ids})
        conn.execute(text("""
            update organization_memberships
            set role_code=:role_code,status='ACTIVE',suspended_at=null,updated_at=now()
            where clerk_user_id=:user_id and org_id=any(cast(:office_ids as text[]))
        """), {"user_id": target_user_id, "office_ids": office_ids, "role_code": role_code})
        conn.execute(text("""
            update user_role_assignments assignment
            set assignment_status=case when role.role_code=:role_code
              and assignment.org_id=any(cast(:office_ids as text[])) then 'ACTIVE' else 'SUSPENDED' end
            from organization_roles role, organizations office
            where assignment.role_id=role.id
              and assignment.org_id=office.id
              and office.group_id=cast(:group_id as uuid)
              and assignment.user_id=:user_id
        """), {"group_id": current["group_id"], "user_id": target_user_id,
                 "office_ids": office_ids, "role_code": role_code})
        conn.execute(text("""
            insert into organization_network_memberships(group_id,clerk_user_id,network_role,access_scope,created_by)
            values(cast(:group_id as uuid),:user_id,'MEMBER','ASSIGNED_OFFICES',:actor)
            on conflict(group_id,clerk_user_id) do update set status='ACTIVE',updated_at=now()
        """), {"group_id": current["group_id"], "user_id": target_user_id, "actor": actor_id})
        _event(conn, current["group_id"], org_id, "MEMBER_OFFICES_GRANTED", actor_id, {"user_id": target_user_id, "office_ids": office_ids, "role_code": role_code})
    return {"user_id": target_user_id, "office_ids": office_ids, "role_code": role_code}


def validate_invitation_offices(org_id: str, office_ids: list[str]) -> dict:
    unique_ids = list(dict.fromkeys(office_ids))
    if org_id not in unique_ids:
        raise HTTPException(422, "current_office_required_for_invitation")
    with engine.connect() as conn:
        current = _current_network(conn, org_id)
        if not current or not current.get("group_id"):
            raise HTTPException(409, "organization_network_not_configured")
        offices = _rows(conn.execute(text("""
            select id,clerk_org_id,coalesce(organization_name,name,id) organization_name
            from organizations
            where group_id=cast(:group_id as uuid) and status='ACTIVE'
              and id=any(cast(:office_ids as text[]))
        """), {"group_id": current["group_id"], "office_ids": unique_ids}))
    if len(offices) != len(unique_ids):
        raise HTTPException(422, "office_outside_network")
    return {"group_id": current["group_id"], "offices": offices, "office_ids": unique_ids}


def attach_invitation_offices(
    org_id: str, actor_id: str, invitation_id: str, office_ids: list[str], role_code: str,
) -> dict:
    validated = validate_invitation_offices(org_id, office_ids)
    with engine.begin() as conn:
        invitation = conn.execute(text("""
            select id::text,email,status from organization_invitations
            where id=cast(:invitation_id as uuid) and org_id=:org_id
        """), {"invitation_id": invitation_id, "org_id": org_id}).mappings().first()
        if not invitation:
            raise HTTPException(404, "network_invitation_not_found")
        conn.execute(text("delete from organization_network_invitation_offices where invitation_id=cast(:invitation_id as uuid)"), {"invitation_id": invitation_id})
        conn.execute(text("""
            insert into organization_network_invitation_offices(invitation_id,group_id,org_id,role_code)
            select cast(:invitation_id as uuid),cast(:group_id as uuid),office.id,:role_code
            from organizations office
            where office.id=any(cast(:office_ids as text[]))
        """), {
            "invitation_id": invitation_id, "group_id": validated["group_id"],
            "office_ids": validated["office_ids"], "role_code": role_code,
        })
        _event(conn, validated["group_id"], org_id, "MEMBER_INVITED", actor_id, {
            "invitation_id": invitation_id, "email": invitation["email"],
            "office_ids": validated["office_ids"], "role_code": role_code,
        })
    return {**dict(invitation), "office_ids": validated["office_ids"], "role_code": role_code}


def list_network_invitations(org_id: str) -> list[dict]:
    with engine.connect() as conn:
        current = _current_network(conn, org_id)
        if not current or not current.get("group_id"):
            return []
        return _rows(conn.execute(text("""
            select invitation.id::text,invitation.email,invitation.status,invitation.created_at,
              invitation.accepted_at,grant_row.role_code,
              array_agg(grant_row.org_id order by office.country,office.city,office.organization_name) office_ids,
              array_agg(coalesce(office.organization_name,office.name,office.id)
                order by office.country,office.city,office.organization_name) office_names
            from organization_invitations invitation
            join organization_network_invitation_offices grant_row on grant_row.invitation_id=invitation.id
            join organizations office on office.id=grant_row.org_id
            where grant_row.group_id=cast(:group_id as uuid)
            group by invitation.id,grant_row.role_code
            order by invitation.created_at desc
        """), {"group_id": current["group_id"]}))
