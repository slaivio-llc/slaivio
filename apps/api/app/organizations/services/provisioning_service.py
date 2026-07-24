from app.organizations.repositories.organization_repository import upsert_organization
from sqlalchemy import text

from app.db.database import engine


DEFAULT_ORGANIZATION_ROLES = (
    ("OWNER", "Owner", "Accès total"),
    ("MANAGER", "Manager", "Gestion opérationnelle"),
    ("OPERATOR", "Operator", "Opérations dossiers et expéditions"),
    ("WAREHOUSE", "Warehouse", "Opérations entrepôt"),
    ("SUPPORT", "Support", "Support client"),
    ("FINANCE", "Finance", "Finance et comptabilité"),
)


def ensure_default_roles(org_id: str):
    with engine.connect() as conn:
        for role_code, role_name, description in DEFAULT_ORGANIZATION_ROLES:
            conn.execute(
                text("""
                    insert into organization_roles (
                        org_id,
                        role_code,
                        role_name,
                        description
                    )
                    values (
                        :org_id,
                        :role_code,
                        :role_name,
                        :description
                    )
                    on conflict (org_id, role_code) do nothing
                """),
                {
                    "org_id": org_id,
                    "role_code": role_code,
                    "role_name": role_name,
                    "description": description,
                },
            )
        conn.commit()


def provision_organization(
    clerk_org_id: str,
    organization_name: str,
):
    org = upsert_organization(
        clerk_org_id=clerk_org_id,
        organization_name=organization_name,
    )
    if org:
        ensure_default_roles(str(org["id"]))
    return org
