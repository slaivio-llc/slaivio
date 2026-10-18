from math import ceil
from sqlalchemy import text
from app.db.database import engine


SORTS = {'name_asc': 'display_name asc nulls last,c.id',
         'name_desc': 'display_name desc nulls last,c.id',
         'created_desc': 'c.created_at desc,c.id',
         'activity_desc': 'c.last_activity_at desc nulls last,c.id'}


def directory(org_id, q='', customer_type=None, start=None, end=None, page=1, sort='name_asc', *, page_size=50, office_ids=None, include_finance=False, include_packages=True, balance_status=None):
    params = {'org_id':org_id,'offset':(page-1)*page_size,'limit':page_size}
    filters = ['c.org_id=:org_id','c.deleted_at is null']
    if office_ids is not None:
        params['office_ids'] = office_ids
        filters[0] = 'c.org_id=any(cast(:office_ids as text[]))'
    if q.strip():
        query = q.strip()
        params['q'] = '%' + query.replace('!','!!').replace('%','!%').replace('_','!_') + '%'
        params['digits'] = ''.join(c for c in query if c.isascii() and c.isdigit())
        if params['digits'].startswith('00'):
            params['digits'] = params['digits'][2:]
        filters.append("""(c.name ilike :q escape '!' or c.display_name ilike :q escape '!'
          or c.company_name ilike :q escape '!' or c.client_reference ilike :q escape '!'
          or (length(:digits)>=5 and regexp_replace(coalesce(c.phone,''),'[^0-9]','','g') like '%' || :digits || '%'))""")
    if customer_type:
        filters.append('c.customer_type=:customer_type'); params['customer_type']=customer_type
    if balance_status and include_finance:
        balance_test = "exists(select 1 from finance_documents fd where fd.org_id=c.org_id and fd.client_id=c.id and fd.document_type='INVOICE' and fd.status in ('ISSUED','PARTIALLY_PAID','OVERDUE') and fd.balance_due>0)"
        filters.append(balance_test if balance_status == 'due' else f'not {balance_test}')
    if start:
        filters.append("c.created_at>=(cast(:start as date)::timestamp at time zone 'UTC')"); params['start']=start
    if end:
        filters.append("c.created_at<((cast(:end as date)+interval '1 day') at time zone 'UTC')"); params['end']=end
    where=' and '.join(filters)
    with engine.connect() as conn:
        total=conn.execute(text(f'select count(*) from clients c where {where}'),params).scalar_one()
        finance_projection = """
              ,coalesce(finance.balance_due,0)::numeric(18,2) balance_due,
              finance.currency balance_currency,
              coalesce(finance.currency_count,0)::int balance_currency_count
        """ if include_finance else ""
        finance_join = """
            left join lateral (
              select sum(balance_due) balance_due,
                     case when count(distinct currency)=1 then min(currency) end currency,
                     count(distinct currency) currency_count
              from finance_documents
              where org_id=c.org_id and client_id=c.id and document_type='INVOICE'
                and status in ('ISSUED','PARTIALLY_PAID','OVERDUE') and balance_due>0
            ) finance on true
        """ if include_finance else ""
        package_projection = "coalesce(packages.package_count,0)::int package_count" if include_packages else "null::int package_count"
        package_join = """
            left join lateral (
              select count(*) package_count from cargo_packages p
              where p.org_id=c.org_id and p.client_id=c.id and p.deleted_at is null
            ) packages on true
        """ if include_packages else ""
        items=[dict(row) for row in conn.execute(text(f'''
            select c.id::text,c.org_id,c.client_reference,coalesce(c.display_name,c.company_name,c.name) display_name,
              c.phone,c.customer_type,c.last_activity_at,c.created_at,
              c.country,
              coalesce(o.organization_name,o.name) office_name,
              {package_projection}
              {finance_projection}
            from clients c join organizations o on o.id=c.org_id
            {package_join}
            {finance_join}
            where {where} order by {SORTS[sort]} limit :limit offset :offset
        '''),params).mappings()]
        visible_orgs = office_ids if office_ids is not None else [org_id]
        totals_params = {'org_id': org_id, 'office_ids': visible_orgs}
        due_join = """
          left join lateral (
            select sum(balance_due) balance_due from finance_documents
            where org_id=c.org_id and client_id=c.id and document_type='INVOICE'
              and status in ('ISSUED','PARTIALLY_PAID','OVERDUE') and balance_due>0
          ) finance on true
        """ if include_finance else ""
        due_summary = "count(*) filter (where coalesce(finance.balance_due,0)>0)::int" if include_finance else "0::int"
        active_summary = "count(*) filter (where coalesce(packages.package_count,0)>0)::int" if include_packages else "0::int"
        package_summary_join = package_join
        summary = conn.execute(text(f'''
          select count(*)::int total,
                 {active_summary} active,
                 {due_summary} due
          from clients c
          {package_summary_join}
          {due_join}
          where c.org_id=any(cast(:office_ids as text[])) and c.deleted_at is null
        '''), totals_params).mappings().one()
    return {'items':items,'page':page,'page_size':page_size,'total':total,'total_pages':ceil(total/page_size),
            'summary': {'total': summary['total'], 'active': summary['active'],
                        'due': summary['due'] if include_finance else None,
                        'finance_visible': include_finance, 'packages_visible': include_packages}}
