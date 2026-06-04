from sqlalchemy import text
from sqlalchemy.exc import DataError

from app.db.database import engine


DEMO_MANAGER = {
    "id": "demo_manager",
    "org_id": "demo_agency",
    "full_name": "Demo Manager",
    "email": "demo@slaivo.com",
    "role": "OWNER",
    "is_active": True,
}


def get_manager_by_id(manager_id: str):
    with engine.connect() as conn:
        try:
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
        except DataError:
            conn.rollback()
            return DEMO_MANAGER

        return dict(row._mapping) if row else DEMO_MANAGER
