from app.services.template_renderer import (
    render_template,
)

from app.services.whatsapp_routing_service import (
    resolve_outbound_number,
)


def prepare_template_message(
    org_id: str,
    body_text: str,
    variables: list[str],
    preferred_role: str | None = None,
):
    route = resolve_outbound_number(
        org_id=org_id,
        preferred_role=preferred_role,
    )

    if not route["resolved"]:
        return {
            "resolved": False,
            "message": None,
            "number": None,
        }

    rendered_message = render_template(
        body_text=body_text,
        variables=variables,
    )

    return {
        "resolved": True,
        "message": rendered_message,
        "number": route["number"],
    }
