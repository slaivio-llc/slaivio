from fastapi import APIRouter, HTTPException
from app.db.dossier_repository import get_dossier_detail

router = APIRouter()


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