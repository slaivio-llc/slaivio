from sqlalchemy import text

from app.db.database import engine


def create_document(
    org_id: str,
    title: str,
    content: str,
    source: str = "manual",
    category: str | None = None,
    tags: list[str] | None = None,
):
    search_text = " ".join(
        value for value in [title, content, category or ""] if value
    )

    with engine.connect() as conn:
        row = conn.execute(
            text("""
                insert into ai_knowledge_documents (
                    org_id,
                    title,
                    content,
                    source,
                    category,
                    tags,
                    search_text
                )
                values (
                    :org_id,
                    :title,
                    :content,
                    :source,
                    :category,
                    :tags,
                    :search_text
                )
                returning *
            """),
            {
                "org_id": org_id,
                "title": title,
                "content": content,
                "source": source,
                "category": category,
                "tags": tags or [],
                "search_text": search_text,
            },
        ).fetchone()

        conn.commit()
        return dict(row._mapping)


def get_documents(
    org_id: str,
    limit: int = 50,
):
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                select *
                from ai_knowledge_documents
                where org_id = :org_id
                  and is_active = true
                order by priority desc, created_at desc
                limit :limit
            """),
            {
                "org_id": org_id,
                "limit": limit,
            },
        ).fetchall()

        return [dict(row._mapping) for row in rows]


def delete_document(document_id: str):
    with engine.connect() as conn:
        conn.execute(
            text("""
                update ai_knowledge_documents
                set
                    is_active = false,
                    updated_at = now()
                where id = :document_id
            """),
            {
                "document_id": document_id,
            },
        )
        conn.commit()


def search_documents(
    org_id: str,
    query: str,
    limit: int = 5,
):
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                select
                    id,
                    title,
                    content,
                    category,
                    tags,
                    priority,
                    ts_rank(
                        to_tsvector('simple', coalesce(search_text, '')),
                        plainto_tsquery('simple', :query)
                    ) as rank
                from ai_knowledge_documents
                where org_id = :org_id
                  and is_active = true
                  and to_tsvector('simple', coalesce(search_text, ''))
                    @@ plainto_tsquery('simple', :query)
                order by rank desc, priority desc, created_at desc
                limit :limit
            """),
            {
                "org_id": org_id,
                "query": query,
                "limit": limit,
            },
        ).fetchall()

        return [dict(row._mapping) for row in rows]

