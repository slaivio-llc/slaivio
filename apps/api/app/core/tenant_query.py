def scoped_where(
    query: str,
    org_column: str = "tenant_org_id",
):
    return f"""
        {query}
        where {org_column} = :org_id
    """

