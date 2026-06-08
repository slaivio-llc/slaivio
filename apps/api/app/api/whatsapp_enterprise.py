from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.tenant_context import get_current_tenant
from app.db.whatsapp_account_repository import (
    list_whatsapp_accounts,
    get_default_whatsapp_account,
)

from app.db.whatsapp_number_repository import (
    list_whatsapp_numbers,
    get_default_whatsapp_number,
    update_whatsapp_number_role,
)
from app.services.whatsapp_routing_service import resolve_inbound_route


router = APIRouter()


class UpdateNumberRoleRequest(BaseModel):
    number_role: str
    is_default: bool = False


@router.get("/whatsapp/accounts")
def get_accounts(tenant=Depends(get_current_tenant)):
    org_id = tenant["org_id"]

    return {
        "status": "ok",
        "accounts": list_whatsapp_accounts(org_id),
    }


@router.get("/whatsapp/accounts/default")
def get_default_account(tenant=Depends(get_current_tenant)):
    org_id = tenant["org_id"]

    return {
        "status": "ok",
        "account": get_default_whatsapp_account(org_id),
    }


@router.get("/whatsapp/numbers")
def get_numbers(tenant=Depends(get_current_tenant)):
    org_id = tenant["org_id"]

    return {
        "status": "ok",
        "numbers": list_whatsapp_numbers(org_id),
    }


@router.get("/whatsapp/numbers/default")
def get_default_number(tenant=Depends(get_current_tenant)):
    org_id = tenant["org_id"]

    return {
        "status": "ok",
        "number": get_default_whatsapp_number(org_id),
    }


@router.patch("/whatsapp/numbers/{number_id}/role")
def update_number_role(
    number_id: str,
    body: UpdateNumberRoleRequest,
    tenant=Depends(get_current_tenant),
):
    org_id = tenant["org_id"]

    number = update_whatsapp_number_role(
        org_id=org_id,
        number_id=number_id,
        number_role=body.number_role,
        is_default=body.is_default,
    )

    return {
        "status": "ok",
        "number": number,
    }


@router.get("/whatsapp/routing/{phone_number_id}")
def debug_route(phone_number_id: str):
    return {
        "status": "ok",
        "route": resolve_inbound_route(phone_number_id),
    }
