from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import requests
import os

router = APIRouter()

META_APP_ID = os.getenv("META_APP_ID")
META_APP_SECRET = os.getenv("META_APP_SECRET")
META_REDIRECT_URI = os.getenv("META_REDIRECT_URI")


class ExchangeCodeRequest(BaseModel):
   code: str


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
