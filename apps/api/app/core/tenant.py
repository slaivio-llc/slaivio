from fastapi import HTTPException


def assert_org_scope(
    resource_org_id,
    manager_org_id,
):
    if str(resource_org_id) != str(manager_org_id):
        raise HTTPException(
            status_code=403,
            detail="cross_tenant_access_denied",
        )

