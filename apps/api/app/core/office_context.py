from fastapi import Depends, Header, HTTPException, Request

from app.core.tenant_context import get_current_tenant
from app.packages.repository import package_matches_office_scope
from app.organization_admin.repository import office_context


def office_scope_ids(context: dict) -> list[str] | None:
    """Return the offices that constrain this request, or None for unrestricted access."""
    if context.get("selected_office_id"):
        return [context["selected_office_id"]]
    if context.get("office_access_scope") == "SELECTED_OFFICES":
        return context.get("allowed_office_ids", [])
    return None


def validate_office_assignment(context: dict, *office_ids: str | None) -> None:
    allowed_ids = office_scope_ids(context)
    if allowed_ids is not None and not any(
        office_id and office_id in allowed_ids for office_id in office_ids
    ):
        raise HTTPException(status_code=403, detail="office_access_denied")


def get_current_office_context(
    selected_office_id: str | None = Header(default=None, alias="X-Slaivio-Office-ID"),
    tenant=Depends(get_current_tenant),
):
    return office_context(
        tenant["org_id"],
        tenant["user_id"],
        selected_office_id,
    )


def require_package_office_scope(
    request: Request,
    tenant=Depends(get_current_tenant),
    context=Depends(get_current_office_context),
):
    office_ids = office_scope_ids(context)
    package_id = request.path_params.get("package_id")
    if package_id and office_ids is not None:
        if not package_matches_office_scope(tenant["org_id"], package_id, office_ids):
            raise HTTPException(status_code=404, detail="package_not_found")
