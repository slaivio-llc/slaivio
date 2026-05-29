from fastapi import APIRouter
from pydantic import BaseModel

from app.db.whatsapp_account_repository import (
    list_whatsapp_accounts,
    get_default_whatsapp_account,
)

from app.db.whatsapp_number_repository import (
    list_whatsapp_numbers,
    get_default_whatsapp_number,
    update_whatsapp_number_role,
)


router = APIRouter()

ORG_ID = "demo_agency"


class UpdateNumberRoleRequest(BaseModel):
    number_role: str
    is_default: bool = False


@router.get("/whatsapp/accounts")
def get_accounts():
    return {
        "status": "ok",
        "accounts": list_whatsapp_accounts(ORG_ID),
    }


@router.get("/whatsapp/accounts/default")
def get_default_account():
    return {
        "status": "ok",
        "account": get_default_whatsapp_account(ORG_ID),
    }


@router.get("/whatsapp/numbers")
def get_numbers():
    return {
        "status": "ok",
        "numbers": list_whatsapp_numbers(ORG_ID),
    }


@router.get("/whatsapp/numbers/default")
def get_default_number():
    return {
        "status": "ok",
        "number": get_default_whatsapp_number(ORG_ID),
    }


@router.patch("/whatsapp/numbers/{number_id}/role")
def update_number_role(
    number_id: str,
    body: UpdateNumberRoleRequest,
):
    number = update_whatsapp_number_role(
        org_id=ORG_ID,
        number_id=number_id,
        number_role=body.number_role,
        is_default=body.is_default,
    )

    return {
        "status": "ok",
        "number": number,
    }
