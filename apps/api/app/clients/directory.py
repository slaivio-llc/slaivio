from math import ceil
from sqlalchemy import text
from app.db.database import engine


SORTS = {'name_asc': 'display_name asc nulls last,c.id',
         'name_desc': 'display_name desc nulls last,c.id',
         'created_desc': 'c.created_at desc,c.id',
         'activity_desc': 'c.last_activity_at desc nulls last,c.id'}


def directory(org_id, q='', customer_type=None, start=None, end=None, page=1, sort='name_asc', *, page_size=50):
    params = {'org_id':org_id,'offset':(page-1)*page_size,'limit':page_size}
    filters = ['c.org_id=:org_id','c.deleted_at is null']
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
    if start:
        filters.append("c.created_at>=(cast(:start as date)::timestamp at time zone 'UTC')"); params['start']=start
    if end:
        filters.append("c.created_at<((cast(:end as date)+interval '1 day') at time zone 'UTC')"); params['end']=end
    where=' and '.join(filters)
    with engine.connect() as conn:
        total=conn.execute(text(f'select count(*) from clients c where {where}'),params).scalar_one()
        items=[dict(row) for row in conn.execute(text(f'''
            select c.id::text,c.client_reference,coalesce(c.display_name,c.company_name,c.name) display_name,
              c.phone,c.customer_type,c.last_activity_at,c.created_at,
              coalesce(o.organization_name,o.name) office_name
            from clients c join organizations o on o.id=c.org_id
            where {where} order by {SORTS[sort]} limit :limit offset :offset
        '''),params).mappings()]
    return {'items':items,'page':page,'page_size':page_size,'total':total,'total_pages':ceil(total/page_size)}
