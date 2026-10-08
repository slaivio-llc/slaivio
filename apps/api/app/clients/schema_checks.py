"""Read-only CRM deployment checks. Never create schema inside an HTTP request."""
from fastapi import HTTPException
from sqlalchemy import text

REQUIRED_TABLES = {
    'client_creation_requests': '126_client_creation_requests.sql',
    'client_company_contacts': '127_client_company_contacts.sql',
}


def missing_tables(conn, tables):
    missing = []
    for table in tables:
        if table not in REQUIRED_TABLES:
            raise ValueError('unknown_crm_table')
        # Use the same search_path as application queries.
        if not conn.execute(text('select to_regclass(:table) is not null'), {'table': table}).scalar_one():
            missing.append(REQUIRED_TABLES[table])
    return missing


def require_table(conn, table):
    missing = missing_tables(conn, [table])
    if missing:
        raise HTTPException(status_code=503, detail={
            'code': 'crm_migration_required',
            'message': 'La base de données CRM doit être mise à jour avant cette opération.',
            'migrations': missing,
        })


def main():
    from app.db.database import engine
    with engine.connect() as conn:
        missing = missing_tables(conn, REQUIRED_TABLES)
    if missing:
        print('CRM NON PRET : appliquer dans la base utilisée par DATABASE_URL :')
        for migration in missing:
            print(migration)
        return 1
    print('Tables CRM 126/127 présentes sur le search_path actif. Recette fonctionnelle encore requise.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
