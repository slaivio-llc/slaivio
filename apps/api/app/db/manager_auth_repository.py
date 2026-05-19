from sqlalchemy import text
from app.db.database import engine


def get_manager_by_id(manager_id: str):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                select *
                from manager_users
                where id = :manager_id
                limit 1
            """),
            {
                "manager_id": manager_id,
            },
        ).fetchone()

        return dict(row._mapping) if row else {
            "id": "demo_manager",
            "org_id": "demo_agency",
            "full_name": "Demo Manager",
            "email": "demo@slaivo.com",
            "role": "OWNER",
            "is_active": True,
        }