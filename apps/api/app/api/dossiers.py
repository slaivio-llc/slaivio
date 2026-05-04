from fastapi import APIRouter, HTTPException
from app.db.dossier_repository import get_dossier_detail
from app.db.dossier_repository import get_dossier_detail, list_active_dossiers

router = APIRouter()

@router.get("/dossiers")
def get_dossiers():
    dossiers = list_active_dossiers()

    return {
        "status": "ok",
        "count": len(dossiers),
        "dossiers": dossiers,
    }

@router.get("/dossiers/{dossier_id}")
def get_dossier(dossier_id: str):
    dossier = get_dossier_detail(
        org_id="demo_agency",
        dossier_id=dossier_id,
    )

    if not dossier:
        raise HTTPException(status_code=404, detail="Dossier not found")

    return {
        "status": "ok",
        "data": dossier,
    }
