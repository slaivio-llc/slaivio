from app.organizations.repositories.organization_repository import upsert_organization


def provision_organization(
    clerk_org_id: str,
    organization_name: str,
):
    return upsert_organization(
        clerk_org_id=clerk_org_id,
        organization_name=organization_name,
    )

