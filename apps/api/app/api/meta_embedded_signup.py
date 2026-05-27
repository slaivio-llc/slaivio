from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.meta_webhook_subscription_service import (
    subscribe_app_to_waba_webhooks,
    get_waba_subscribed_apps,
)
from app.db.whatsapp_webhook_repository import (
    update_waba_webhook_status,
    get_whatsapp_account_by_waba,
)
import requests
import os


router = APIRouter()

META_APP_ID = os.getenv("META_APP_ID")
META_APP_SECRET = os.getenv("META_APP_SECRET")
META_REDIRECT_URI = os.getenv("META_REDIRECT_URI")


class ExchangeCodeRequest(BaseModel):
    code: str


class SubscribeWabaWebhookRequest(BaseModel):
    org_id: str = "demo_agency"
    waba_id: str
    access_token: str


class CheckWabaWebhookRequest(BaseModel):
    org_id: str = "demo_agency"
    waba_id: str
    access_token: str

@router.post("/meta/oauth/exchange")
def exchange_code(body: ExchangeCodeRequest):

    response = requests.get(
        "https://graph.facebook.com/v22.0/oauth/access_token",
        params={
            "client_id": META_APP_ID,
            "client_secret": META_APP_SECRET,
            "redirect_uri": META_REDIRECT_URI,
            "code": body.code,
        },
    )

    data = response.json()

    if "access_token" not in data:
        raise HTTPException(
            status_code=400,
            detail=data,
        )

    return {
        "status": "ok",
        "access_token": data["access_token"],
    }

@router.get("/meta/businesses")
def get_businesses(access_token: str):

    response = requests.get(
        "https://graph.facebook.com/v22.0/me/businesses",
        params={
            "access_token": access_token,
        },
    )

    return response.json()


@router.get("/meta/wabas")
def get_wabas(
    business_id: str,
    access_token: str,
):

    response = requests.get(
        f"https://graph.facebook.com/v22.0/{business_id}/owned_whatsapp_business_accounts",
        params={
            "access_token": access_token,
        },
    )

    return response.json()

@router.get("/meta/phone-numbers")
def get_phone_numbers(
    waba_id: str,
    access_token: str,
):

    response = requests.get(
        f"https://graph.facebook.com/v22.0/{waba_id}/phone_numbers",
        params={
            "access_token": access_token,
        },
    )

    return response.json()


@router.post("/meta/waba/webhook/subscribe")
def subscribe_waba_webhook(body: SubscribeWabaWebhookRequest):
    result = subscribe_app_to_waba_webhooks(
        waba_id=body.waba_id,
        access_token=body.access_token,
    )

    if result["ok"]:
        account = update_waba_webhook_status(
            org_id=body.org_id,
            waba_id=body.waba_id,
            status="SUBSCRIBED",
            raw_response=result["data"],
            error_message=None,
        )

        return {
            "status": "ok",
            "webhook_status": "SUBSCRIBED",
            "account": account,
            "meta_response": result["data"],
        }

    account = update_waba_webhook_status(
        org_id=body.org_id,
        waba_id=body.waba_id,
        status="FAILED",
        raw_response=result["data"],
        error_message=str(result["data"]),
    )

    return {
        "status": "failed",
        "webhook_status": "FAILED",
        "account": account,
        "meta_response": result["data"],
    }


@router.post("/meta/waba/webhook/check")
def check_waba_webhook(body: CheckWabaWebhookRequest):
    result = get_waba_subscribed_apps(
        waba_id=body.waba_id,
        access_token=body.access_token,
    )

    status = "SUBSCRIBED" if result["ok"] else "FAILED"

    account = update_waba_webhook_status(
        org_id=body.org_id,
        waba_id=body.waba_id,
        status=status,
        raw_response=result["data"],
        error_message=None if result["ok"] else str(result["data"]),
    )

    await subscribeWabaWebhook({
        org_id: orgId,
        waba_id: selectedWabaId,
        access_token: accessToken,
        });


    return {
        "status": "ok" if result["ok"] else "failed",
        "webhook_status": status,
        "account": account,
        "meta_response": result["data"],
    }
