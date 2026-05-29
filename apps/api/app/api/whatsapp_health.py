from fastapi import APIRouter
from sqlalchemy import text

from app.db.database import engine


router = APIRouter()
ORG_ID = "demo_agency"


@router.get("/whatsapp/delivery-events")
def list_delivery_events():
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                select *
                from whatsapp_delivery_events
                where org_id = :org_id
                order by created_at desc
                limit 100
            """),
            {
                "org_id": ORG_ID,
            },
        ).fetchall()

    return {
        "status": "ok",
        "events": [dict(row._mapping) for row in rows],
    }


@router.get("/whatsapp/health/summary")
def whatsapp_health_summary():
    with engine.connect() as conn:
        summary_rows = conn.execute(
            text("""
                select
                    status,
                    count(*) as total
                from whatsapp_delivery_events
                where org_id = :org_id
                  and created_at >= now() - interval '7 days'
                group by status
                order by status
            """),
            {
                "org_id": ORG_ID,
            },
        ).fetchall()

        error_rows = conn.execute(
            text("""
                select
                    error_code,
                    error_title,
                    count(*) as total
                from whatsapp_delivery_events
                where org_id = :org_id
                  and status = 'failed'
                  and created_at >= now() - interval '7 days'
                group by error_code, error_title
                order by total desc
                limit 10
            """),
            {
                "org_id": ORG_ID,
            },
        ).fetchall()

    return {
        "status": "ok",
        "summary": [dict(row._mapping) for row in summary_rows],
        "top_errors": [dict(row._mapping) for row in error_rows],
    }
