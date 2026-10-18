import csv
import io
import json
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import text

from app.db.database import engine


def _rows(result):
    rows = []
    for row in result:
        item = dict(row._mapping)
        # PostgreSQL NUMERIC values must not become binary floats in JSON/CSV.
        rows.append({key: str(value) if isinstance(value, Decimal) else value for key, value in item.items()})
    return rows


def _range(start, end):
    finish = end or date.today()
    begin = start or finish - timedelta(days=29)
    if begin > finish:
        raise ValueError("invalid_date_range")
    if (finish - begin).days > 730:
        raise ValueError("date_range_too_large")
    days = (finish - begin).days + 1
    return begin, finish, days


def _package_office_predicate(package_alias="p"):
    return f"""exists (
        select 1 from organization_locations office
        where office.org_id=:o and office.location_type='OFFICE'
          and office.id=any(cast(:office_ids as uuid[]))
          and office.id in ({package_alias}.origin_location_id,{package_alias}.destination_location_id)
    )"""


def _office_predicate(kind, alias):
    """Return a predicate using canonical organization_locations office IDs."""
    if kind == "package":
        return _package_office_predicate(alias)
    if kind == "client":
        return f"""exists (
            select 1 from cargo_packages scoped_package
            where scoped_package.org_id={alias}.org_id
              and scoped_package.client_id={alias}.id
              and scoped_package.deleted_at is null
              and {_package_office_predicate('scoped_package')}
        )"""
    if kind == "expedition":
        return f"""(
            exists (
                select 1 from expedition_packages ep
                join cargo_packages scoped_package
                  on scoped_package.org_id=ep.org_id and scoped_package.id=ep.package_id
                where ep.org_id={alias}.org_id and ep.expedition_id={alias}.id
                  and ep.removed_at is null and scoped_package.deleted_at is null
                  and {_package_office_predicate('scoped_package')}
            ) or exists (
                select 1 from organization_locations office
                where office.org_id=:o and office.location_type='OFFICE'
                  and office.id=any(cast(:office_ids as uuid[]))
                  and office.agency_office_id={alias}.destination_office_id
            )
        )"""
    if kind == "dossier":
        return f"""(
            exists (
                select 1 from organization_locations office
                where office.org_id=:o and office.location_type='OFFICE'
                  and office.id=any(cast(:office_ids as uuid[]))
                  and office.agency_office_id={alias}.destination_office_id
            ) or exists (
                select 1 from cargo_packages scoped_package
                where scoped_package.org_id={alias}.org_id
                  and scoped_package.dossier_id={alias}.id
                  and scoped_package.deleted_at is null
                  and {_package_office_predicate('scoped_package')}
            )
        )"""
    if kind == "finance":
        return f"{alias}.office_id=any(cast(:office_ids as uuid[]))"
    if kind == "pickup":
        return f"""exists (
            select 1 from organization_locations office
            where office.org_id=:o and office.location_type='OFFICE'
              and office.id=any(cast(:office_ids as uuid[]))
              and office.agency_office_id={alias}.office_id
        )"""
    raise ValueError(f"unknown_office_scope:{kind}")


def _scope(kind, alias, office_ids):
    return "" if office_ids is None else f" and {_office_predicate(kind, alias)}"


def _params(values, office_ids):
    return {**values, **({"office_ids": office_ids} if office_ids is not None else {})}


def dashboard(org_id, start=None, end=None, office_ids=None):
    start, end, days = _range(start, end)
    previous_end = start - timedelta(days=1)
    previous_start = previous_end - timedelta(days=days - 1)
    p = _params(
        {
            "o": org_id,
            "start": start,
            "end": end + timedelta(days=1),
            "ps": previous_start,
            "pe": previous_end + timedelta(days=1),
        },
        office_ids,
    )
    client = _scope("client", "c", office_ids)
    package = _scope("package", "p", office_ids)
    expedition = _scope("expedition", "e", office_ids)
    dossier = _scope("dossier", "d", office_ids)
    pickup = _scope("pickup", "po", office_ids)
    finance = _scope("finance", "fd", office_ids)
    with engine.connect() as connection:
        kpis = dict(
            connection.execute(
                text(
                    f"""select
                      (select count(*) from clients c where c.org_id=:o and c.created_at>=:start and c.created_at<:end{client})::int clients,
                      (select count(*) from cargo_packages p where p.org_id=:o and p.deleted_at is null and p.created_at>=:start and p.created_at<:end{package})::int packages,
                      (select coalesce(sum(p.weight_kg),0) from cargo_packages p where p.org_id=:o and p.deleted_at is null and p.created_at>=:start and p.created_at<:end{package})::float weight_kg,
                      (select count(*) from cargo_expeditions e where e.org_id=:o and e.archived_at is null and e.deleted_at is null and e.created_at>=:start and e.created_at<:end{expedition})::int shipments,
                      (select count(*) from dossiers d where d.org_id=:o and d.created_at>=:start and d.created_at<:end{dossier})::int dossiers,
                      (select count(*) from pickup_orders po where po.org_id=:o and po.created_at>=:start and po.created_at<:end{pickup})::int pickups,
                      (select count(*) from clients c where c.org_id=:o and c.created_at>=:ps and c.created_at<:pe{client})::int previous_clients,
                      (select count(*) from cargo_packages p where p.org_id=:o and p.deleted_at is null and p.created_at>=:ps and p.created_at<:pe{package})::int previous_packages,
                      (select count(*) from cargo_expeditions e where e.org_id=:o and e.archived_at is null and e.deleted_at is null and e.created_at>=:ps and e.created_at<:pe{expedition})::int previous_shipments"""
                ),
                p,
            ).mappings().one()
        )
        trend = _rows(
            connection.execute(
                text(
                    f"""with days as(select generate_series(cast(:start as date),cast(:end as date)-1,interval '1 day')::date as report_day)
                    select d.report_day as day,coalesce(c.clients,0)::int clients,coalesce(p.packages,0)::int packages,coalesce(s.shipments,0)::int shipments
                    from days d
                    left join(select c.created_at::date as report_day,count(*) clients from clients c where c.org_id=:o and c.created_at>=:start and c.created_at<:end{client} group by 1)c using(report_day)
                    left join(select p.created_at::date as report_day,count(*) packages from cargo_packages p where p.org_id=:o and p.deleted_at is null and p.created_at>=:start and p.created_at<:end{package} group by 1)p using(report_day)
                    left join(select e.created_at::date as report_day,count(*) shipments from cargo_expeditions e where e.org_id=:o and e.archived_at is null and e.deleted_at is null and e.created_at>=:start and e.created_at<:end{expedition} group by 1)s using(report_day)
                    order by d.report_day"""
                ),
                p,
            )
        )
        statuses = {
            "packages": _rows(
                connection.execute(
                    text(
                        f"""select p.status label,count(*)::int value from cargo_packages p
                        where p.org_id=:o and p.deleted_at is null and p.created_at>=:start and p.created_at<:end{package}
                        group by p.status order by value desc"""
                    ),
                    p,
                )
            ),
            "shipments": _rows(
                connection.execute(
                    text(
                        f"""select e.status label,count(*)::int value from cargo_expeditions e
                        where e.org_id=:o and e.archived_at is null and e.deleted_at is null and e.created_at>=:start and e.created_at<:end{expedition}
                        group by e.status order by value desc"""
                    ),
                    p,
                )
            ),
            "dossiers": _rows(
                connection.execute(
                    text(
                        f"""select d.status_global label,count(*)::int value from dossiers d
                        where d.org_id=:o and d.archived_at is null and d.created_at>=:start and d.created_at<:end{dossier}
                        group by d.status_global order by value desc"""
                    ),
                    p,
                )
            ),
        }
        routes = _rows(
            connection.execute(
                text(
                    f"""select coalesce(nullif(e.route_label,''),nullif(concat_ws(' → ',nullif(e.origin_city,''),nullif(e.destination_city,'')),''),'Route non renseignée') route,
                    e.mode shipping_mode,count(*)::int shipments,coalesce(sum(e.total_weight_kg),0)::float weight_kg,
                    round(avg(extract(epoch from(e.updated_at-e.created_at))/86400)::numeric,1)::float average_days
                    from cargo_expeditions e where e.org_id=:o and e.archived_at is null and e.deleted_at is null
                    and e.created_at>=:start and e.created_at<:end{expedition}
                    group by e.route_label,e.origin_city,e.destination_city,e.mode order by shipments desc limit 20"""
                ),
                p,
            )
        )
        # Collections are attributed to the payment date, not the invoice's
        # creation date. Balances remain current balances for invoices issued
        # in the selected period; separate currencies are never combined.
        finance_rows = _rows(
            connection.execute(
                text(
                    f"""with invoice_totals as (
                      select fd.currency,count(*)::int invoices,coalesce(sum(fd.total),0)::text invoiced,
                        coalesce(sum(fd.balance_due) filter(where fd.status not in ('VOID','PAID')),0)::text outstanding
                      from finance_documents fd where fd.org_id=:o and fd.document_type='INVOICE'
                        and fd.status in ('ISSUED','PARTIALLY_PAID','PAID','OVERDUE')
                        and coalesce(fd.issue_date,fd.issued_at::date,fd.created_at::date)>=:start
                        and coalesce(fd.issue_date,fd.issued_at::date,fd.created_at::date)<:end{finance}
                      group by fd.currency
                    ), payment_totals as (
                      select payment.currency,coalesce(sum(payment.amount),0)::text collected
                      from finance_payments payment join finance_documents fd
                        on fd.org_id=payment.org_id and fd.id=payment.document_id
                      where payment.org_id=:o and payment.status='CONFIRMED'
                        and payment.paid_at>=:start and payment.paid_at<:end
                        and fd.document_type='INVOICE'{_scope('finance', 'fd', office_ids)}
                      group by payment.currency
                    )
                    select coalesce(invoice_totals.currency,payment_totals.currency) currency,
                      coalesce(invoice_totals.invoices,0)::int invoices,
                      coalesce(invoice_totals.invoiced,'0') invoiced,
                      coalesce(payment_totals.collected,'0') collected,
                      coalesce(invoice_totals.outstanding,'0') outstanding
                    from invoice_totals full outer join payment_totals using(currency)
                    order by currency"""
                ),
                p,
            )
        )
        warehouses = _rows(
            connection.execute(
                text(
                    f"""select coalesce(p.warehouse_name,'Non affecté') warehouse,count(*)::int packages,
                    coalesce(sum(p.weight_kg),0)::float weight_kg,coalesce(sum(p.volume_cbm),0)::float volume_cbm,
                    count(*) filter(where p.is_fragile)::int fragile from cargo_packages p
                    where p.org_id=:o and p.deleted_at is null and p.inventory_status='IN_STOCK'{package}
                    group by p.warehouse_name order by packages desc"""
                ),
                p,
            )
        )
    return {
        "period": {"start": start, "end": end, "days": days},
        "kpis": kpis,
        "trend": trend,
        "statuses": statuses,
        "routes": routes,
        "finance": finance_rows,
        "warehouses": warehouses,
    }


REPORT_SQL = {
    "clients": "select c.id,c.name,c.phone,c.email,c.country,c.created_at from clients c where c.org_id=:o and c.created_at>=:start and c.created_at<:end",
    "packages": "select p.package_reference,p.tracking_id,p.status,p.client_id,p.warehouse_name,p.weight_kg,p.volume_cbm,p.destination_country,p.created_at from cargo_packages p where p.org_id=:o and p.deleted_at is null and p.created_at>=:start and p.created_at<:end",
    "shipments": "select e.expedition_reference,e.status,e.route_label,e.origin_city,e.destination_city,e.mode shipping_mode,e.total_weight_kg weight_kg,e.total_volume_cbm volume_cbm,e.billed_total,e.cost_total,e.profit_total,e.currency,e.created_at,e.updated_at from cargo_expeditions e where e.org_id=:o and e.archived_at is null and e.deleted_at is null and e.created_at>=:start and e.created_at<:end",
    "finance": "select fd.document_number,fd.document_type,fd.status,fd.currency,fd.total,fd.amount_paid,fd.balance_due,fd.issue_date,fd.due_date,fd.created_at from finance_documents fd where fd.org_id=:o and fd.created_at>=:start and fd.created_at<:end",
    "pickups": "select po.pickup_reference,po.status,po.client_id,po.recipient_name,po.recipient_phone,po.payment_status,po.required_amount,po.paid_amount,po.storage_fee,po.currency,po.ready_at,po.checked_in_at,po.released_at,po.created_at from pickup_orders po where po.org_id=:o and po.created_at>=:start and po.created_at<:end",
}

REPORT_OFFICE_SCOPE = {
    "clients": ("client", "c"),
    "packages": ("package", "p"),
    "shipments": ("expedition", "e"),
    "finance": ("finance", "fd"),
    "pickups": ("pickup", "po"),
}


def report_rows(org_id, key, start=None, end=None, limit=10000, office_ids=None):
    if key not in REPORT_SQL:
        raise KeyError(key)
    start, end, _ = _range(start, end)
    kind, alias = REPORT_OFFICE_SCOPE[key]
    query = REPORT_SQL[key] + _scope(kind, alias, office_ids) + " order by created_at desc limit :limit"
    params = _params({"o": org_id, "start": start, "end": end + timedelta(days=1), "limit": limit}, office_ids)
    with engine.connect() as connection:
        return _rows(connection.execute(text(query), params))


def csv_export(org_id, actor, key, start=None, end=None, office_ids=None):
    data = report_rows(org_id, key, start, end, office_ids=office_ids)
    output = io.StringIO(newline="")
    if data:
        writer = csv.DictWriter(output, fieldnames=list(data[0]))
        writer.writeheader()
        writer.writerows(data)
    filters = {"start": str(start) if start else None, "end": str(end) if end else None}
    if office_ids is not None:
        filters["office_ids"] = office_ids
    with engine.begin() as connection:
        connection.execute(
            text("""insert into report_export_audit(org_id,actor_id,report_key,format,filters,row_count)
                values(:o,:a,:k,'CSV',cast(:f as jsonb),:n)"""),
            {"o": org_id, "a": actor, "k": key, "f": json.dumps(filters), "n": len(data)},
        )
    return output.getvalue(), len(data)


def views(org_id, user_id):
    with engine.connect() as connection:
        return _rows(
            connection.execute(
                text("select * from analytics_saved_views where org_id=:o and(owner_id=:u or is_shared) order by updated_at desc"),
                {"o": org_id, "u": user_id},
            )
        )


def save_view(org_id, user_id, data):
    with engine.begin() as connection:
        result = connection.execute(
            text("""insert into analytics_saved_views(org_id,owner_id,name,report_key,filters,is_shared)
                values(:o,:u,:name,:report_key,cast(:filters as jsonb),:is_shared)
                on conflict(org_id,owner_id,name) do update set report_key=excluded.report_key,
                  filters=excluded.filters,is_shared=excluded.is_shared,updated_at=now() returning *"""),
            {"o": org_id, "u": user_id, "filters": json.dumps(data["filters"]), **{key: value for key, value in data.items() if key != "filters"}},
        )
        row = result.mappings().one()
        return {key: str(value) if isinstance(value, Decimal) else value for key, value in row.items()}
