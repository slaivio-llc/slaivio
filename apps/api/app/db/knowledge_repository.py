from sqlalchemy import text

from app.db.database import engine


def create_knowledge_item(
    org_id: str,
    category: str,
    title: str,
    content: str,
    language: str = "FR",
    tags: list[str] | None = None,
    priority: int = 0,
):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                insert into agency_knowledge_items (
                    org_id,
                    category,
                    title,
                    content,
                    language,
                    tags,
                    priority
                )
                values (
                    :org_id,
                    :category,
                    :title,
                    :content,
                    :language,
                    :tags,
                    :priority
                )
                returning *
            """),
            {
                "org_id": org_id,
                "category": category.strip().upper(),
                "title": title.strip(),
                "content": content.strip(),
                "language": language.strip().upper(),
                "tags": tags or [],
                "priority": priority,
            },
        )

        conn.commit()
        row = result.fetchone()

        return dict(row._mapping) if row else None


def list_knowledge_items(
    org_id: str,
    category: str | None = None,
    is_active: bool = True,
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
                from agency_knowledge_items
                where {where_clause}
                order by priority desc, updated_at desc
                limit :limit
            """),
            params,
        )

        return [dict(row._mapping) for row in result.fetchall()]


def get_knowledge_item(
    org_id: str,
    item_id: str,
):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                select *
                from agency_knowledge_items
                where org_id = :org_id
                  and id = :item_id
                limit 1
            """),
            {
                "org_id": org_id,
                "item_id": item_id,
            },
        ).fetchone()

        return dict(result._mapping) if result else None


def update_knowledge_item(
    org_id: str,
    item_id: str,
    category: str | None = None,
    title: str | None = None,
    content: str | None = None,
    language: str | None = None,
    tags: list[str] | None = None,
    priority: int | None = None,
    is_active: bool | None = None,
):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                update agency_knowledge_items
                set
                    category = coalesce(:category, category),
                    title = coalesce(:title, title),
                    content = coalesce(:content, content),
                    language = coalesce(:language, language),
                    tags = coalesce(:tags, tags),
                    priority = coalesce(:priority, priority),
                    is_active = coalesce(:is_active, is_active),
                    updated_at = now()
                where org_id = :org_id
                  and id = :item_id
                returning *
            """),
            {
                "org_id": org_id,
                "item_id": item_id,
                "category": category.strip().upper() if category else None,
                "title": title.strip() if title else None,
                "content": content.strip() if content else None,
                "language": language.strip().upper() if language else None,
                "tags": tags,
                "priority": priority,
                "is_active": is_active,
            },
        )

        conn.commit()
        row = result.fetchone()

        return dict(row._mapping) if row else None


def search_knowledge_items(
    org_id: str,
    query: str,
    limit: int = 5,
):
    search_text = f"%{query.strip()}%"

    with engine.connect() as conn:
        result = conn.execute(
            text("""
                select *
                from agency_knowledge_items
                where org_id = :org_id
                  and is_active = true
                  and (
                    title ilike :search_text
                    or content ilike :search_text
                    or category ilike :search_text
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

