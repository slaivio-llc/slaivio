def extract_meta_delivery_statuses(payload: dict):
    results = []

    for entry in payload.get("entry", []):
        waba_id = entry.get("id")

        for change in entry.get("changes", []):
            value = change.get("value", {})
            metadata = value.get("metadata", {})

            phone_number_id = metadata.get("phone_number_id")

            for status_item in value.get("statuses", []):
                errors = status_item.get("errors") or []
                first_error = errors[0] if errors else None

                results.append(
                    {
                        "waba_id": waba_id,
                        "phone_number_id": phone_number_id,
                        "provider_message_id": status_item.get("id"),
                        "recipient_phone": status_item.get("recipient_id"),
                        "status": status_item.get("status"),
                        "timestamp": status_item.get("timestamp"),
                        "error_code": str(first_error.get("code")) if first_error else None,
                        "error_title": first_error.get("title") if first_error else None,
                        "error_message": first_error.get("message") if first_error else None,
                        "error_details": first_error,
                        "raw": status_item,
                    }
                )

    return results
