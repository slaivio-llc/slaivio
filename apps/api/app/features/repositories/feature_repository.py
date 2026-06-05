from sqlalchemy import text

from app.db.database import engine


def list_feature_flags():
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                select *
                from feature_flags
                order by category, flag_key
            """),
        ).fetchall()

        return [dict(row._mapping) for row in rows]


def get_org_feature_flags(
    org_id: str,
):
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                select
                    f.flag_key,
                    f.flag_name,
                    f.description,
                    f.category,
                    coalesce(of.enabled, f.default_enabled) as enabled,
                    coalesce(of.rollout_percentage, 100) as rollout_percentage,
                    of.metadata
                from feature_flags f
                left join organization_feature_flags of
                    on of.flag_key = f.flag_key
                   and of.org_id = :org_id
                order by f.category, f.flag_key
            """),
            {
                "org_id": org_id,
            },
        ).fetchall()

        return [dict(row._mapping) for row in rows]


def set_org_feature_flag(
    org_id: str,
    flag_key: str,
    enabled: bool,
    rollout_percentage: int = 100,
    updated_by_id: str | None = None,
    updated_by_name: str | None = None,
):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                insert into organization_feature_flags (
                    org_id,
                    flag_key,
                    enabled,
                    rollout_percentage,
                    updated_by_id,
                    updated_by_name
                )
                values (
                    :org_id,
                    :flag_key,
                    :enabled,
                    :rollout_percentage,
                    :updated_by_id,
                    :updated_by_name
                )
                on conflict (org_id, flag_key)
                do update set
                    enabled = excluded.enabled,
                    rollout_percentage = excluded.rollout_percentage,
                    updated_by_id = excluded.updated_by_id,
                    updated_by_name = excluded.updated_by_name,
                    updated_at = now()
                returning *
            """),
            {
                "org_id": org_id,
                "flag_key": flag_key,
                "enabled": enabled,
                "rollout_percentage": rollout_percentage,
                "updated_by_id": updated_by_id,
                "updated_by_name": updated_by_name,
            },
        ).fetchone()

        conn.commit()

        return dict(row._mapping) if row else None


def is_feature_enabled_for_org(
    org_id: str,
    flag_key: str,
):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                select
                    coalesce(of.enabled, f.default_enabled) as enabled
                from feature_flags f
                left join organization_feature_flags of
                    on of.flag_key = f.flag_key
                   and of.org_id = :org_id
                where f.flag_key = :flag_key
                limit 1
            """),
            {
                "org_id": org_id,
                "flag_key": flag_key,
            },
        ).fetchone()

        if not row:
            return False

        return bool(row._mapping["enabled"])

