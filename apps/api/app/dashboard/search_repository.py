"""Bounded workspace search. Each resource is queried only with its read grant."""
from sqlalchemy import text

from app.db.database import engine


SEARCH_SOURCES = (
    ('clients.read', 'client', 'clients', "coalesce(display_name,name,phone,'Client')", "coalesce(phone,'')", "concat_ws(' ',display_name,name,phone,email)", "deleted_at is null", '/app/clients?open='),
    ('packages.read', 'package', 'cargo_packages', "coalesce(package_reference,tracking_id,id::text)", "concat_ws(' · ',destination_city,destination_country,status)", "concat_ws(' ',package_reference,tracking_id)", "deleted_at is null", '/app/packages?open='),
    ('shipments.read', 'shipment', 'cargo_expeditions', 'expedition_reference', "concat_ws(' → ',origin_city,destination_city)", 'expedition_reference', 'archived_at is null', '/app/shipments/'),
    ('dossiers.read', 'dossier', 'dossiers', "coalesce(dossier_reference,tracking_id,id::text)", "coalesce(status_global,'')", "concat_ws(' ',dossier_reference,tracking_id)", 'true', '/app/dossiers/'),
    ('finance.read', 'invoice', 'finance_documents', 'document_number', "concat_ws(' · ',currency,status)", 'document_number', "document_type='INVOICE'", '/app/finance?open='),
)


def search_home(org_id: str, query: str, permissions: list[str], limit: int = 5) -> list[dict]:
    value = query.strip()
    if not org_id or len(value) < 2:
        return []
    sources = [source for source in SEARCH_SOURCES if source[0] in permissions]
    if not sources:
        return []
    # Escape LIKE wildcards: user text is a literal search, not a SQL pattern.
    escaped = value.replace('!', '!!').replace('%', '!%').replace('_', '!_')
    params = {'org_id': org_id, 'query': f'%{escaped}%', 'limit': max(1, min(limit, 10))}
    results = []
    with engine.connect() as conn:
        for _, kind, table, title, subtitle, searchable, condition, href in sources:
            rows = conn.execute(text(f"""
                select id::text id, {title} title, {subtitle} subtitle
                from {table}
                where org_id=:org_id and ({condition})
                  and ({searchable}) ilike :query escape '!'
                order by created_at desc, id
                limit :limit
            """), params).mappings().all()
            results.extend(dict(row, kind=kind, href=href + str(row['id'])) for row in rows)
    return results
