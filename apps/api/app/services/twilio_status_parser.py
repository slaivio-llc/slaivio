def parse_twilio_status_callback(form: dict) -> dict:
    provider_message_id = (
        form.get("MessageSid")
        or form.get("SmsSid")
        or form.get("SmsMessageSid")
    )

    provider_status = (
        form.get("MessageStatus")
        or form.get("SmsStatus")
        or "unknown"
    )

    error_code = form.get("ErrorCode")
    error_message = form.get("ErrorMessage")

    return {
        "provider": "twilio",
        "provider_message_id": provider_message_id,
        "provider_status": provider_status,
        "error_code": error_code,
        "error_message": error_message,
        "raw": dict(form),
    }
