from sqlalchemy import text
from sqlalchemy.exc import DataError

from app.core.config import settings
from app.db.database import engine


DEMO_MANAGER = {
    "id": "demo_manager",
    "user_id": "demo_manager",
    "org_id": settings.app_org_id,
    "org_code": settings.app_org_id,
    "tenant_org_id": settings.app_org_id,
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

        if not row:
            return DEMO_MANAGER

        manager = dict(row._mapping)
        manager.setdefault("user_id", manager.get("id"))
        manager.setdefault("org_code", manager.get("org_id"))
        manager.setdefault("tenant_org_id", manager.get("org_id") or settings.app_org_id)

        return manager
