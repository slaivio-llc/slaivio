from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.tenant_context import get_current_tenant
from app.accounting.repositories.category_repository import (
    create_accounting_category,
    list_accounting_categories,
)
from app.accounting.services.accounting_service import (
    get_accounting_overview,
    record_accounting_entry,
)


router = APIRouter()


class AccountingCategoryRequest(BaseModel):
    category_code: str
    category_name: str
    category_type: str


class AccountingEntryRequest(BaseModel):
    category_id: str
    entry_type: str
    amount_minor: int
    currency_code: str = "USD"
    description: str | None = None
    source_type: str | None = None
    source_id: str | None = None


@router.get("/accounting/categories")
def get_categories(tenant=Depends(get_current_tenant)):
    org_id = tenant["org_id"]

    return {
        "status": "ok",
        "categories": list_accounting_categories(org_id),
    }


@router.post("/accounting/categories")
def create_category(body: AccountingCategoryRequest, tenant=Depends(get_current_tenant)):
    org_id = tenant["org_id"]

    category = create_accounting_category(
        org_id=org_id,
        category_code=body.category_code,
        category_name=body.category_name,
        category_type=body.category_type,
    )

    return {
        "status": "ok",
        "category": category,
    }


@router.get("/accounting/entries")
def get_entries(tenant=Depends(get_current_tenant)):
    org_id = tenant["org_id"]

    return {
        "status": "ok",
        **get_accounting_overview(org_id),
    }


@router.post("/accounting/entries")
def create_entry(body: AccountingEntryRequest, tenant=Depends(get_current_tenant)):
    org_id = tenant["org_id"]

    try:
        entry = record_accounting_entry(
            org_id=org_id,
            category_id=body.category_id,
            entry_type=body.entry_type,
            amount_minor=body.amount_minor,
            currency_code=body.currency_code,
            description=body.description,
            source_type=body.source_type,
            source_id=body.source_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {
        "status": "ok",
        "entry": entry,
    }
