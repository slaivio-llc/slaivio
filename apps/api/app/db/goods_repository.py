from sqlalchemy import text

from app.db.database import engine


def normalize_goods_name(value: str) -> str:
    return value.strip().lower()


def create_goods_rule(
    org_id: str,
    goods_name: str,
    category: str | None = None,
    accepted: bool = True,
    pricing_mode: str = "PER_KG",
    price_note: str | None = None,
    handling_note: str | None = None,
    restriction_note: str | None = None,
    requires_manual_validation: bool = False,
    language: str = "FR",
    tags: list[str] | None = None,
    priority: int = 0,
):
    normalized_name = normalize_goods_name(goods_name)

    with engine.connect() as conn:
        result = conn.execute(
            text("""
                insert into goods_rules (
                    org_id,
                    goods_name,
                    normalized_name,
                    category,
                    accepted,
                    pricing_mode,
                    price_note,
                    handling_note,
                    restriction_note,
                    requires_manual_validation,
                    language,
                    tags,
                    priority
                )
                values (
                    :org_id,
                    :goods_name,
                    :normalized_name,
                    :category,
                    :accepted,
                    :pricing_mode,
                    :price_note,
                    :handling_note,
                    :restriction_note,
                    :requires_manual_validation,
                    :language,
                    :tags,
                    :priority
                )
                returning *
            """),
            {
                "org_id": org_id,
                "goods_name": goods_name.strip(),
                "normalized_name": normalized_name,
                "category": category.strip().upper() if category else None,
                "accepted": accepted,
                "pricing_mode": pricing_mode.strip().upper(),
                "price_note": price_note,
                "handling_note": handling_note,
                "restriction_note": restriction_note,
                "requires_manual_validation": requires_manual_validation,
                "language": language.strip().upper(),
                "tags": tags or [],
                "priority": priority,
            },
        )

        conn.commit()
        row = result.fetchone()

        return dict(row._mapping) if row else None


def list_goods_rules(
    org_id: str,
    is_active: bool = True,
    category: str | None = None,
    limit: int = 100,
):
    filters = [
        "org_id = :org_id",
        "is_active = :is_active",
    ]

    params = {
        "org_id": org_id,
        "is_active": is_active,
        "limit": limit,
    }

    if category:
        filters.append("category = :category")
        params["category"] = category.strip().upper()

    where_clause = " and ".join(filters)

    with engine.connect() as conn:
        result = conn.execute(
            text(f"""
                select *
                from goods_rules
                where {where_clause}
                order by priority desc, updated_at desc
                limit :limit
            """),
            params,
        )

        return [dict(row._mapping) for row in result.fetchall()]


def get_goods_rule(
    org_id: str,
    rule_id: str,
):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                select *
                from goods_rules
                where org_id = :org_id
                  and id = :rule_id
                limit 1
            """),
            {
                "org_id": org_id,
                "rule_id": rule_id,
            },
        ).fetchone()

        return dict(result._mapping) if result else None


def update_goods_rule(
    org_id: str,
    rule_id: str,
    goods_name: str | None = None,
    category: str | None = None,
    accepted: bool | None = None,
    pricing_mode: str | None = None,
    price_note: str | None = None,
    handling_note: str | None = None,
    restriction_note: str | None = None,
    requires_manual_validation: bool | None = None,
    language: str | None = None,
    tags: list[str] | None = None,
    priority: int | None = None,
    is_active: bool | None = None,
):
    normalized_name = normalize_goods_name(goods_name) if goods_name else None

    with engine.connect() as conn:
        result = conn.execute(
            text("""
                update goods_rules
                set
                    goods_name = coalesce(:goods_name, goods_name),
                    normalized_name = coalesce(:normalized_name, normalized_name),
                    category = coalesce(:category, category),
                    accepted = coalesce(:accepted, accepted),
                    pricing_mode = coalesce(:pricing_mode, pricing_mode),
                    price_note = coalesce(:price_note, price_note),
                    handling_note = coalesce(:handling_note, handling_note),
                    restriction_note = coalesce(:restriction_note, restriction_note),
                    requires_manual_validation = coalesce(:requires_manual_validation, requires_manual_validation),
                    language = coalesce(:language, language),
                    tags = coalesce(:tags, tags),
                    priority = coalesce(:priority, priority),
                    is_active = coalesce(:is_active, is_active),
                    updated_at = now()
                where org_id = :org_id
                  and id = :rule_id
                returning *
            """),
            {
                "org_id": org_id,
                "rule_id": rule_id,
                "goods_name": goods_name.strip() if goods_name else None,
                "normalized_name": normalized_name,
                "category": category.strip().upper() if category else None,
                "accepted": accepted,
                "pricing_mode": pricing_mode.strip().upper() if pricing_mode else None,
                "price_note": price_note,
                "handling_note": handling_note,
                "restriction_note": restriction_note,
                "requires_manual_validation": requires_manual_validation,
                "language": language.strip().upper() if language else None,
                "tags": tags,
                "priority": priority,
                "is_active": is_active,
            },
        )

        conn.commit()
        row = result.fetchone()

        return dict(row._mapping) if row else None


def search_goods_rules(
    org_id: str,
    query: str,
    limit: int = 5,
):
    search_text = f"%{query.strip()}%"

    with engine.connect() as conn:
        result = conn.execute(
            text("""
                select *
                from goods_rules
                where org_id = :org_id
                  and is_active = true
                  and (
                    goods_name ilike :search_text
                    or normalized_name ilike :search_text
                    or category ilike :search_text
                    or price_note ilike :search_text
                    or handling_note ilike :search_text
                    or restriction_note ilike :search_text
                    or array_to_string(tags, ' ') ilike :search_text
                  )
                order by priority desc, updated_at desc
                limit :limit
            """),
            {
                "org_id": org_id,
                "search_text": search_text,
                "limit": limit,
            },
        )

        return [dict(row._mapping) for row in result.fetchall()]
