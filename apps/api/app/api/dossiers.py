from fastapi import APIRouter, Depends, HTTPException

from app.core.tenant_context import get_current_tenant
from app.db.dossier_repository import (
    get_dossier_detail,
    list_active_dossiers,
)


router = APIRouter()


@router.get("/dossiers")
def get_dossiers(
    status_global: str | None = None,
    case_type: str | None = None,
    intake_status: str | None = None,
    validation_status: str | None = None,
    limit: int = 50,
    tenant=Depends(get_current_tenant),
):
    org_id = tenant["org_id"]

    dossiers = list_active_dossiers(
        org_id=org_id,
        status_global=status_global,
        case_type=case_type,
        intake_status=intake_status,
        validation_status=validation_status,
        limit=limit,
    )

    return {
        "status": "ok",
        "count": len(dossiers),
        "filters": {
            "status_global": status_global,
            "case_type": case_type,
            "intake_status": intake_status,
            "validation_status": validation_status,
            "limit": limit,
        },
        "dossiers": dossiers,
    }


@router.get("/dossiers/{dossier_id}")
def get_dossier(
    dossier_id: str,
    tenant=Depends(get_current_tenant),
):
    org_id = tenant["org_id"]

    dossier = get_dossier_detail(
        org_id=org_id,
        dossier_id=dossier_id,
    )

    if not dossier:
        raise HTTPException(status_code=404, detail="Dossier not found")

    return {
        "status": "ok",
        "data": dossier,
    }
