def tenant_filter(
    sql: str,
):
    return f"""
        {sql}
        where org_id = :org_id
    """

