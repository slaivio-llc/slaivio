from fastapi import APIRouter

from app.db.whatsapp_account_repository import (
   list_whatsapp_accounts,
)
from app.db.whatsapp_number_repository import (
   list_whatsapp_numbers,
   get_default_whatsapp_number,
)


router = APIRouter()
ORG_ID = "demo_agency"


@router.get("/whatsapp/accounts")
def get_accounts():
   return {
       "status": "ok",
       "accounts": list_whatsapp_accounts(ORG_ID),
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
