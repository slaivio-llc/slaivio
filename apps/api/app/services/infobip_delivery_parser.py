def parse_infobip_delivery_payload(payload: dict) -> list[dict]:
    results = payload.get("results") or []

    parsed_items = []

    for item in results:
        status = item.get("status") or {}
        error = item.get("error") or {}

        parsed_items.append({
            "provider": "infobip",
            "provider_message_id": item.get("messageId"),
            "to": item.get("to"),
            "sent_at": item.get("sentAt"),
            "done_at": item.get("doneAt"),
            "sms_count": item.get("smsCount"),
            "provider_status_id": status.get("id"),
            "provider_status_group_id": status.get("groupId"),
            "provider_status_group_name": status.get("groupName"),
            "provider_status_name": status.get("name"),
            "provider_status_description": status.get("description"),
            "error_code": str(error.get("id")) if error.get("id") is not None else None,
            "error_message": error.get("description") or error.get("name"),
            "raw": item,
        })

    return parsed_items


def normalize_infobip_status(group_name: str | None, status_name: str | None = None) -> str:
    group = (group_name or "").upper()
    name = (status_name or "").upper()

    if group in {"DELIVERED"} or name in {"DELIVERED_TO_HANDSET", "DELIVERED"}:
        return "DELIVERED"

    if group in {"PENDING"}:
        return "PENDING"

    if group in {"UNDELIVERABLE", "REJECTED", "EXPIRED"}:
        return "FAILED"

    if group in {"SEEN", "READ"} or name in {"SEEN", "READ"}:
        return "READ"

    return group or name or "UNKNOWN"


def is_infobip_failure(status: str) -> bool:
    return status.upper() in {
        "FAILED",
        "UNDELIVERABLE",
        "REJECTED",
        "EXPIRED",
    }
