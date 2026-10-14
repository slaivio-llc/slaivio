"""Read-only operational projection. No finance or internal conversations in the register."""
from datetime import date
from math import ceil

from sqlalchemy import text

from app.db.database import engine


STAGES = {
    "received": ("RECEIVED", "RECEIVED_AT_ORIGIN", "WAREHOUSED", "WAREHOUSE_PROCESSING", "READY_FOR_DISPATCH", "READY_FOR_BATCH", "BATCHED"),
    "shipped": ("SHIPPED", "IN_TRANSIT", "CUSTOMS"),
    "arrived": ("ARRIVED", "ARRIVED_DESTINATION", "CLEARED"),
    "ready": ("READY_FOR_PICKUP",),
    "delivered": ("DELIVERED",),
}
LABELS = {"received": "Reçu", "shipped": "Expédié", "arrived": "Arrivé", "ready": "À retirer", "delivered": "Livré"}
LEGACY_LABELS = {"CREATED": "À recevoir", "PENDING_VALIDATION": "À valider", "CONFIRMED": "Confirmé",
                 "CANCELLED": "Annulé", "BLOCKED": "Bloqué", "ISSUE": "Incident", "RETURNED": "Retourné"}
SCOPE = "(p.org_id=:org_id or p.destination_org_id=:org_id) and p.deleted_at is null"
JOINS = """from cargo_packages p
    left join clients c on c.id=p.client_id and c.org_id=p.org_id
    left join shipping_services s on s.id=p.shipping_service_id and s.org_id=p.org_id
    left join shipping_routes r on r.id=p.route_id and r.org_id=p.org_id
    left join organizations o on o.id=p.org_id"""
SUMMARY = """p.id::text, p.org_id, p.client_id::text,
    coalesce(p.package_reference,p.tracking_id) reference, p.status,
    coalesce(c.display_name,c.company_name,c.name) client_name,
    s.service_name, coalesce(o.organization_name,o.name) office_name"""


def present(row, org_id):
    result = dict(row)
    stage = next((key for key, values in STAGES.items() if result["status"] in values), "other")
    result.update(stage=stage, status_label=LABELS.get(stage, LEGACY_LABELS.get(result["status"], "État à vérifier")),
                  local_client=result["org_id"] == org_id)
    return result


def parcel_register(
    org_id: str, *, q="", stage=None, start: date | None = None,
    end: date | None = None, page=1, office_ids: list[str] | None = None,
):
    params = {"org_id": org_id, "limit": 50, "offset": (page-1)*50}
    filters = [SCOPE]
    if office_ids is not None:
        filters.append("""exists (
            select 1 from organization_locations office
            where office.org_id=:org_id and office.location_type='OFFICE'
              and office.id=any(cast(:office_ids as uuid[]))
              and office.id in (p.origin_location_id,p.destination_location_id)
        )""")
        params["office_ids"] = office_ids
    if q.strip():
        params["q"] = "%" + q.strip().replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%"
        filters.append("""(p.package_reference ilike :q escape '!' or p.tracking_id ilike :q escape '!'
          or p.supplier_tracking ilike :q escape '!' or p.external_reference ilike :q escape '!'
          or c.display_name ilike :q escape '!' or c.name ilike :q escape '!'
          or c.company_name ilike :q escape '!' or c.phone ilike :q escape '!')""")
    if stage:
        params["states"] = list(STAGES[stage]) if stage != "other" else [state for values in STAGES.values() for state in values]
        filters.append("p.status " + ("<> all" if stage == "other" else "= any") + "(cast(:states as text[]))")
    if start:
        filters.append("p.created_at >= (cast(:start as date)::timestamp at time zone 'UTC')")
        params["start"] = start
    if end:
        filters.append("p.created_at < ((cast(:end as date)+interval '1 day') at time zone 'UTC')")
        params["end"] = end
    where = " and ".join(filters)
    with engine.connect() as conn:
        total = conn.execute(text(f"select count(*) {JOINS} where {where}"), params).scalar_one()
        rows = conn.execute(text(f"select {SUMMARY} {JOINS} where {where} order by p.created_at desc,p.id desc limit :limit offset :offset"), params).mappings()
        return {"items": [present(row, org_id) for row in rows], "total": total, "page": page, "page_size": 50, "total_pages": ceil(total/50)}


def parcel_overview(org_id: str, package_id: str):
    with engine.connect() as conn:
        row = conn.execute(text(f"""select {SUMMARY}, p.supplier_tracking, p.external_reference,
            p.description,p.weight_kg,p.warehouse_location,p.warehouse_zone,p.warehouse_rack,
            p.origin_city,p.origin_country,p.destination_city,p.destination_country,
            p.received_at,p.created_at,
            coalesce((select ep.expedition_id from expedition_packages ep
              where ep.org_id=p.org_id and ep.package_id=p.id and ep.removed_at is null
              order by ep.added_at desc,ep.id limit 1),p.shipment_id)::text as shipment_id,
            p.shipment_reference,r.route_name,
            p.received_by,p.row_version,
            (p.org_id=:org_id and p.shipment_id is null and p.fees_total is null
              and not exists(select 1 from expedition_packages ep where ep.org_id=p.org_id
                and ep.package_id=p.id and ep.removed_at is null)
              and coalesce(p.pricing_snapshot,'{{}}'::jsonb)='{{}}'::jsonb
              and coalesce(p.payment_status,'UNKNOWN')='UNKNOWN') weight_editable
            {JOINS} where {SCOPE} and p.id=cast(:package_id as uuid)"""),
            {"org_id": org_id, "package_id": package_id}).mappings().first()
        return present(row, org_id) if row else None


def parcel_photos(org_id, package_id, page=1):
    params = {"org_id": org_id, "package_id": package_id, "offset": (page-1)*20}
    where = f"{SCOPE} and p.id=cast(:package_id as uuid) and m.org_id=p.org_id and m.media_type='IMAGE' and m.object_path is not null"
    with engine.connect() as conn:
        total = conn.execute(text(f"select count(*) from package_media m join cargo_packages p on p.id=m.package_id where {where}"), params).scalar_one()
        rows = conn.execute(text(f"""select m.id::text,m.file_name,m.caption,m.created_at
            from package_media m join cargo_packages p on p.id=m.package_id
            where {where} order by m.created_at desc,m.id desc limit 20 offset :offset"""), params).mappings()
        return {"items": [dict(row) for row in rows], "total": total, "page": page, "total_pages": ceil(total/20)}


def parcel_history(org_id: str, package_id: str, page=1):
    # Authorize through the parcel, never a caller-supplied owning office.
    where = f"exists(select 1 from cargo_packages p where {SCOPE} and p.id=e.package_id and p.org_id=e.org_id) and e.package_id=cast(:package_id as uuid)"
    params = {"org_id": org_id, "package_id": package_id, "offset": (page-1)*50}
    with engine.connect() as conn:
        total = conn.execute(text(f"select count(*) from package_events e where {where}"), params).scalar_one()
        items = conn.execute(text(f"""select e.id::text,e.title,
            case when e.event_type in ('PRICING_CALCULATED','PACKAGE_NOTIFICATION_QUEUED')
              then null else e.description end as description,
            e.previous_status,e.new_status,e.created_at
            from package_events e where {where} order by e.created_at desc,e.id desc limit 50 offset :offset"""), params).mappings()
        return {"items": [dict(row) for row in items], "page": page, "total_pages": ceil(total/50), "total": total}
