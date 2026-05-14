from sqlalchemy import text
from app.db.database import engine


def upsert_infobip_template_mapping(
    org_id: str,
    template_key: str,
    infobip_template_name: str,
    language: str = "fr",
    category: str | None = None,
    template_type: str = "TEXT",
):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                insert into infobip_template_mappings (
                    org_id,
                    template_key,
                    infobip_template_name,
                    language,
                    category,
                    template_type
                )
                values (
                    :org_id,
                    :template_key,
                    :infobip_template_name,
                    :language,
                    :category,
                    :template_type
                )
                on conflict (org_id, template_key)
                do update set
                    infobip_template_name = excluded.infobip_template_name,
                    language = excluded.language,
                    category = excluded.category,
                    template_type = excluded.template_type,
                    updated_at = now()
                returning *
            """),
            {
                "org_id": org_id,
                "template_key": template_key.strip().upper(),
                "infobip_template_name": infobip_template_name.strip(),
                "language": language,
                "category": category.strip().upper() if category else None,
                "template_type": template_type.strip().upper(),
            },
        )

        conn.commit()
        row = result.fetchone()

        return dict(row._mapping) if row else None


def get_infobip_template_mapping(
    org_id: str,
    template_key: str,
):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                select *
                from infobip_template_mappings
                where org_id = :org_id
                  and template_key = :template_key
                  and is_active = true
                limit 1
            """),
            {
                "org_id": org_id,
                "template_key": template_key.strip().upper(),
            },
        ).fetchone()

        return dict(result._mapping) if result else None


def list_infobip_template_mappings(
    org_id: str,
    limit: int = 100,
):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                select *
                from infobip_template_mappings
                where org_id = :org_id
                  and is_active = true
                order by created_at desc
                limit :limit
            """),
            {
                "org_id": org_id,
                "limit": limit,
            },
        )

        return [dict(row._mapping) for row in result.fetchall()]
