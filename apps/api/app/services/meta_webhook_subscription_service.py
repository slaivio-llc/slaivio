from app.services.meta_http_client import meta_get, meta_post


GRAPH_API_VERSION = "v22.0"


def subscribe_app_to_waba_webhooks(
    waba_id: str,
    access_token: str,
):
    return meta_post(
        f"https://graph.facebook.com/{GRAPH_API_VERSION}/{waba_id}/subscribed_apps",
        headers={
            "Authorization": f"Bearer {access_token}",
        },
    )


def get_waba_subscribed_apps(
    waba_id: str,
    access_token: str,
):
    return meta_get(
        f"https://graph.facebook.com/{GRAPH_API_VERSION}/{waba_id}/subscribed_apps",
        params={
            "access_token": access_token,
        },
    )
