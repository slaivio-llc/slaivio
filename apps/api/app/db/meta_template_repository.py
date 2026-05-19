from sqlalchemy import text
from app.db.database import engine


def upsert_meta_template_mapping(
    org_id: str,
    template_key: str,
    meta_template_name: str,
    language: str = "fr",
    category: str | None = None,
    template_type: str = "TEXT",
):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                insert into meta_template_mappings (
                    org_id,
                    template_key,
                    meta_template_name,
                    language,
                    category,
                    template_type
                )
                values (
                    :org_id,
                    :template_key,
                    :meta_template_name,
                    :language,
                    :category,
                    :template_type
                )
                on conflict (org_id, template_key)
                do update set
                    meta_template_name = excluded.meta_template_name,
                    language = excluded.language,
                    category = excluded.category,
                    template_type = excluded.template_type,
                    updated_at = now()
                returning *
            """),
            {
                "org_id": org_id,
                "template_key": template_key.strip().upper(),
                "meta_template_name": meta_template_name.strip(),
                "language": language,
                "category": category.strip().upper() if category else None,
                "template_type": template_type.strip().upper(),
            },
        )

        conn.commit()
        row = result.fetchone()

        return dict(row._mapping) if row else None


def get_meta_template_mapping(
    org_id: str,
    template_key: str,
):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                select *
                from meta_template_mappings
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

        return dict(row._mapping) if row else None


def list_meta_template_mappings(
    org_id: str,
):
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                select *
                from meta_template_mappings
                where org_id = :org_id
                  and is_active = true
                order by created_at desc
            """),
            {
                "org_id": org_id,
            },
        ).fetchall()

        return [dict(row._mapping) for row in rows]
