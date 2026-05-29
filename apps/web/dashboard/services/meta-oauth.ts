import { api } from "@/services/api";

export async function exchangeCode(
  code: string
) {
  const response = await api.post(
    "/meta/oauth/exchange",
    {
      code,
    }
  );

  return response.data;
}

export async function getBusinesses(
  accessToken: string
) {
  const response = await api.get(
    "/meta/businesses",
    {
      params: {
        access_token: accessToken,
      },
    }
  );

  return response.data;
}

export async function getWabas(
  businessId: string,
  accessToken: string
) {
  const response = await api.get(
    "/meta/wabas",
    {
      params: {
        business_id: businessId,
        access_token: accessToken,
      },
    }
  );

  return response.data;
}

export async function getPhoneNumbers(
  wabaId: string,
  accessToken: string
) {
  const response = await api.get(
    "/meta/phone-numbers",
    {
      params: {
        waba_id: wabaId,
        access_token: accessToken,
      },
    }
  );

  return response.data;
}

export async function subscribeWabaWebhook(data: {
  org_id: string;
  waba_id: string;
  access_token: string;
}) {
  const response = await api.post(
    "/meta/waba/webhook/subscribe",
    data
  );

  return response.data;
}

export async function checkWabaWebhook(data: {
  org_id: string;
  waba_id: string;
  access_token: string;
}) {
  const response = await api.post(
    "/meta/waba/webhook/check",
    data
  );

  return response.data;
}
