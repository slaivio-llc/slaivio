from fastapi import HTTPException


def assert_same_org(
    resource_org_id,
    tenant_org_id,
):
    if str(resource_org_id) != str(tenant_org_id):
        raise HTTPException(
            status_code=403,
            detail="Cross tenant access",
        )

