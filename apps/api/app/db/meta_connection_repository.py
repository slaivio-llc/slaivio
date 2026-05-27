from sqlalchemy import text
from app.db.whatsapp_account_repository import (
    upsert_whatsapp_account,
)
from app.db.whatsapp_number_repository import (
    upsert_whatsapp_number,
)
from app.db.database import engine


def create_whatsapp_connection(
    org_id: str,
    business_id: str,
    waba_id: str,
    phone_number_id: str,
    display_phone_number: str | None,
    verified_name: str | None,
    access_token: str,
    account_name: str | None = None,
):
    account = upsert_whatsapp_account(
        org_id=org_id,
        provider="META",
        business_id=business_id,
        waba_id=waba_id,
        account_name=account_name,
        access_token=access_token,
        connection_status="CONNECTED",
        is_default=True,
    )

    number = upsert_whatsapp_number(
        org_id=org_id,
        whatsapp_account_id=str(account["id"]) if account else None,
        provider="META",
        business_id=business_id,
        waba_id=waba_id,
        phone_number_id=phone_number_id,
        display_phone_number=display_phone_number,
        verified_name=verified_name,
        number_role="PRIMARY",
        connection_status="CONNECTED",
        is_default=True,
        access_token=access_token,
    )

    return {
        "account": account,
        "number": number,
    }
