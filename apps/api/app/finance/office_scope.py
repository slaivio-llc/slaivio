"""Explicit, immutable document ownership; payments inherit their document scope."""
from fastapi import HTTPException
from sqlalchemy import text
from app.finance import repository


def require_document(org_id, document_id, offices):
    if offices is None:
        return
    with repository.engine.connect() as conn:
        found = conn.execute(text('''select 1 from finance_documents
            where org_id=:o and id=:d and office_id=any(cast(:offices as uuid[]))'''),
            {'o': org_id, 'd': document_id, 'offices': offices}).first()
        if not found:
            raise HTTPException(404, 'finance_document_not_found')


def assign_office(org_id, document_id, office_id, version, actor_id, actor_name):
    with repository.engine.begin() as conn:
        office = conn.execute(text("select 1 from organization_locations where org_id=:o and id=:office and location_type='OFFICE' and status='ACTIVE'"),
                             {'o': org_id, 'office': office_id}).first()
        if not office:
            raise HTTPException(422, 'finance_office_not_found')
        row = conn.execute(text('''update finance_documents set office_id=:office,
            row_version=row_version+1,updated_at=now()
            where org_id=:o and id=:d and office_id is null and row_version=:version returning *'''),
            {'o': org_id, 'd': document_id, 'office': office_id, 'version': version}).mappings().first()
        if not row:
            raise HTTPException(409, 'finance_office_assignment_conflict')
        repository.event(conn, org_id, document_id, 'OFFICE_ASSIGNED', actor_id, actor_name,
                         {'office_id': office_id})
        return dict(row)
