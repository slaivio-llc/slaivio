import requests


GRAPH_API_VERSION = "v22.0"


def subscribe_app_to_waba_webhooks(
    waba_id: str,
    access_token: str,
):
    response = requests.post(
        f"https://graph.facebook.com/{GRAPH_API_VERSION}/{waba_id}/subscribed_apps",
        headers={
            "Authorization": f"Bearer {access_token}",
        },
        timeout=20,
    )

    data = response.json()

    return {
        "ok": response.ok,
        "status_code": response.status_code,
        "data": data,
    }


def get_waba_subscribed_apps(
    waba_id: str,
    access_token: str,
):
    response = requests.get(
        f"https://graph.facebook.com/{GRAPH_API_VERSION}/{waba_id}/subscribed_apps",
        params={
            "access_token": access_token,
        },
        timeout=20,
    )

    data = response.json()

    return {
        "ok": response.ok,
        "status_code": response.status_code,
        "data": data,
    }
