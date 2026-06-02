from app.services.meta_http_client import meta_get, meta_post


GRAPH_API_VERSION = "v22.0"


def create_meta_template(
    waba_id: str,
    access_token: str,
    template_name: str,
    category: str,
    language: str,
    body_text: str,
):
    return meta_post(
        f"https://graph.facebook.com/{GRAPH_API_VERSION}/{waba_id}/message_templates",
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        },
        json={
            "name": template_name,
            "category": category,
            "language": language,
            "components": [
                {
                    "type": "BODY",
                    "text": body_text,
                }
            ],
        },
    )


def list_meta_templates(
    waba_id: str,
    access_token: str,
):
    return meta_get(
        f"https://graph.facebook.com/{GRAPH_API_VERSION}/{waba_id}/message_templates",
        headers={
            "Authorization": f"Bearer {access_token}",
        },
    )
