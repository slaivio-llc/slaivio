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
                      (select count(*) from pickup_orders po where po.org_id=:o and po.created_at>=:start and po.created_at<:end{pickup})::int pickups,
                      (select count(*) from clients c where c.org_id=:o and c.created_at>=:ps and c.created_at<:pe{client})::int previous_clients,
                      (select count(*) from cargo_packages p where p.org_id=:o and p.deleted_at is null and p.created_at>=:ps and p.created_at<:pe{package})::int previous_packages,
                      (select count(*) from cargo_expeditions e where e.org_id=:o and e.archived_at is null and e.deleted_at is null and e.created_at>=:ps and e.created_at<:pe{expedition})::int previous_shipments,
                      (select count(distinct p.client_id) from cargo_packages p where p.org_id=:o and p.deleted_at is null and p.client_id is not null and p.created_at>=:start and p.created_at<:end{package})::int active_clients,
                      (select count(distinct p.client_id) from cargo_packages p where p.org_id=:o and p.deleted_at is null and p.client_id is not null and p.created_at>=:ps and p.created_at<:pe{package})::int previous_active_clients"""
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
        monthly_trend = _rows(
            connection.execute(
                text(
                    f"""with months as (
                      select generate_series(date_trunc('month',cast(:end as date) - interval '1 day') - interval '5 months',
                        date_trunc('month',cast(:end as date) - interval '1 day'), interval '1 month')::date as month_start
                    )
                    select m.month_start as month,
                      coalesce(c.clients,0)::int clients,coalesce(p.packages,0)::int packages,coalesce(s.shipments,0)::int shipments
                    from months m
                    left join (select date_trunc('month',c.created_at)::date month_start,count(*) clients
                      from clients c where c.org_id=:o
                      and c.created_at>=date_trunc('month',cast(:end as date)-interval '1 day')-interval '5 months'
                      and c.created_at<date_trunc('month',cast(:end as date)-interval '1 day')+interval '1 month'{client}
                      group by 1) c using(month_start)
                    left join (select date_trunc('month',p.created_at)::date month_start,count(*) packages
                      from cargo_packages p where p.org_id=:o and p.deleted_at is null
                      and p.created_at>=date_trunc('month',cast(:end as date)-interval '1 day')-interval '5 months'
                      and p.created_at<date_trunc('month',cast(:end as date)-interval '1 day')+interval '1 month'{package}
                      group by 1) p using(month_start)
                    left join (select date_trunc('month',e.created_at)::date month_start,count(*) shipments
                      from cargo_expeditions e where e.org_id=:o and e.archived_at is null and e.deleted_at is null
                      and e.created_at>=date_trunc('month',cast(:end as date)-interval '1 day')-interval '5 months'
                      and e.created_at<date_trunc('month',cast(:end as date)-interval '1 day')+interval '1 month'{expedition}
                      group by 1) s using(month_start)
                    order by m.month_start"""
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
                      select fd.currency,count(*)::int invoices,
                        count(*) filter(where fd.status in ('ISSUED','PARTIALLY_PAID','OVERDUE'))::int pending_invoices,
                        coalesce(sum(fd.total),0)::text invoiced,
                        coalesce(sum(fd.balance_due) filter(where fd.status not in ('VOID','PAID')),0)::text outstanding
                      from finance_documents fd where fd.org_id=:o and fd.document_type='INVOICE'
                        and fd.status in ('ISSUED','PARTIALLY_PAID','PAID','OVERDUE')
                        and coalesce(fd.issue_date,fd.issued_at::date,fd.created_at::date)>=:start
                        and coalesce(fd.issue_date,fd.issued_at::date,fd.created_at::date)<:end{finance}
                      group by fd.currency
                    ), payment_totals as (
                      select payment.currency,
                        coalesce(sum(payment.amount) filter(where payment.paid_at>=:start and payment.paid_at<:end),0)::text collected,
                        coalesce(sum(payment.amount) filter(where payment.paid_at>=:ps and payment.paid_at<:pe),0)::text previous_collected
                      from finance_payments payment join finance_documents fd
                        on fd.org_id=payment.org_id and fd.id=payment.document_id
                      where payment.org_id=:o and payment.status='CONFIRMED'
                        and ((payment.paid_at>=:start and payment.paid_at<:end)
                          or (payment.paid_at>=:ps and payment.paid_at<:pe))
                        and fd.document_type='INVOICE'{_scope('finance', 'fd', office_ids)}
                      group by payment.currency
                    )
                    select coalesce(invoice_totals.currency,payment_totals.currency) currency,
                      coalesce(invoice_totals.invoices,0)::int invoices,
                      coalesce(invoice_totals.pending_invoices,0)::int pending_invoices,
                      coalesce(invoice_totals.invoiced,'0') invoiced,
                      coalesce(payment_totals.collected,'0') collected,
                      coalesce(payment_totals.previous_collected,'0') previous_collected,
                      coalesce(invoice_totals.outstanding,'0') outstanding
                    from invoice_totals full outer join payment_totals using(currency)
                    order by currency"""
                ),
                p,
            )
        )
        monthly_finance = _rows(
            connection.execute(
                text(
                    f"""with months as (
                      select generate_series(date_trunc('month',cast(:end as date) - interval '1 day') - interval '5 months',
                        date_trunc('month',cast(:end as date) - interval '1 day'), interval '1 month')::date as month_start
                    ), invoice_monthly as (
                      select date_trunc('month',coalesce(fd.issue_date,fd.issued_at::date,fd.created_at::date))::date month_start,
                        fd.currency,coalesce(sum(fd.total),0)::text invoiced
                      from finance_documents fd where fd.org_id=:o and fd.document_type='INVOICE'
                        and fd.status in ('ISSUED','PARTIALLY_PAID','PAID','OVERDUE')
                        and coalesce(fd.issue_date,fd.issued_at::date,fd.created_at::date)>=date_trunc('month',cast(:end as date)-interval '1 day')-interval '5 months'
                        and coalesce(fd.issue_date,fd.issued_at::date,fd.created_at::date)<date_trunc('month',cast(:end as date)-interval '1 day')+interval '1 month'{finance}
                      group by 1,fd.currency
                    ), payment_monthly as (
                      select date_trunc('month',payment.paid_at)::date month_start,payment.currency,coalesce(sum(payment.amount),0)::text collected
                      from finance_payments payment join finance_documents fd
                        on fd.org_id=payment.org_id and fd.id=payment.document_id
                      where payment.org_id=:o and payment.status='CONFIRMED' and fd.document_type='INVOICE'
                        and payment.paid_at>=date_trunc('month',cast(:end as date)-interval '1 day')-interval '5 months'
                        and payment.paid_at<date_trunc('month',cast(:end as date)-interval '1 day')+interval '1 month'{_scope('finance', 'fd', office_ids)}
                      group by 1,payment.currency
                    ), currencies as (
                      select currency from invoice_monthly union select currency from payment_monthly
                    )
                    select months.month_start month,currencies.currency,
                      coalesce(invoice_monthly.invoiced,'0') invoiced,coalesce(payment_monthly.collected,'0') collected
                    from months cross join currencies
                    left join invoice_monthly using(month_start,currency)
                    left join payment_monthly using(month_start,currency)
                    order by months.month_start,currencies.currency"""
                ),
                p,
            )
        )
        offices = _rows(
            connection.execute(
                text(
                    """select office.id,office.name,office.city,office.status,
                      (select count(distinct package.id)::int from cargo_packages package
                        where package.org_id=office.org_id and package.deleted_at is null
                          and package.created_at>=:start and package.created_at<:end
                          and office.id in (package.origin_location_id,package.destination_location_id)) packages,
                      (select count(distinct expedition.id)::int from cargo_expeditions expedition
                        where expedition.org_id=office.org_id and expedition.archived_at is null and expedition.deleted_at is null
                          and expedition.created_at>=:start and expedition.created_at<:end
                          and (expedition.destination_office_id=office.agency_office_id or exists (
                            select 1 from expedition_packages link
                            join cargo_packages package on package.org_id=link.org_id and package.id=link.package_id
                            where link.org_id=expedition.org_id and link.expedition_id=expedition.id and link.removed_at is null
                              and package.deleted_at is null
                              and office.id in (package.origin_location_id,package.destination_location_id)
                          ))) expeditions,
                      coalesce((select jsonb_agg(jsonb_build_object('currency',paid.currency,'amount',paid.amount) order by paid.currency)
                        from (select payment.currency,coalesce(sum(payment.amount),0)::text amount
                          from finance_payments payment
                          join finance_documents document on document.org_id=payment.org_id and document.id=payment.document_id
                          where payment.org_id=office.org_id and payment.status='CONFIRMED'
                            and payment.paid_at>=:start and payment.paid_at<:end
                            and document.document_type='INVOICE' and document.office_id=office.id
                          group by payment.currency) paid),'[]'::jsonb) payments
                    from organization_locations office
                    where office.org_id=:o and office.location_type='OFFICE'
                      and (:office_ids is null or office.id=any(cast(:office_ids as uuid[])))
                    order by office.name"""
                ),
                {**p, "office_ids": office_ids},
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
        "monthly_trend": monthly_trend,
        "statuses": statuses,
        "routes": routes,
        "finance": finance_rows,
        "monthly_finance": monthly_finance,
        "offices": offices,
        "warehouses": warehouses,
    }


REPORT_SQL = {
    "clients": "select c.id,c.client_reference,coalesce(c.display_name,c.company_name,c.name) name,c.lifecycle_status,c.phone,c.email,c.country,c.created_at from clients c where c.org_id=:o and c.created_at>=:start and c.created_at<:end",
    "packages": "select p.id,p.package_reference,p.tracking_id,p.status,p.client_id,p.warehouse_name,p.weight_kg,p.volume_cbm,p.destination_country,p.created_at from cargo_packages p where p.org_id=:o and p.deleted_at is null and p.created_at>=:start and p.created_at<:end",
    "shipments": "select e.id,e.expedition_reference,e.status,e.route_label,e.origin_city,e.destination_city,e.mode shipping_mode,e.total_weight_kg weight_kg,e.total_volume_cbm volume_cbm,e.billed_total,e.cost_total,e.profit_total,e.currency,e.created_at,e.updated_at from cargo_expeditions e where e.org_id=:o and e.archived_at is null and e.deleted_at is null and e.created_at>=:start and e.created_at<:end",
    "finance": "select fd.id,fd.document_number,fd.document_type,fd.status,fd.currency,fd.total,fd.amount_paid,fd.balance_due,fd.issue_date,fd.due_date,coalesce(c.display_name,c.company_name,c.name,c.phone,'Client') client_name,fd.created_at from finance_documents fd left join clients c on c.org_id=fd.org_id and c.id=fd.client_id where fd.org_id=:o and fd.document_type='INVOICE' and coalesce(fd.issue_date,fd.issued_at::date,fd.created_at::date)>=:start and coalesce(fd.issue_date,fd.issued_at::date,fd.created_at::date)<:end",
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
