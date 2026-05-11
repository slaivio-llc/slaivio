from app.db.office_repository import list_offices


def format_office_response(office: dict) -> str:
    lines = []

    city = office.get("city") or "Bureau"
    country = office.get("country")

    if country:
        lines.append(f"📍 {city}, {country} :")
    else:
        lines.append(f"📍 {city} :")

    lines.append(f"Adresse : {office.get('address')}")

    if office.get("phone"):
        lines.append(f"📞 Téléphone : {office.get('phone')}")

    if office.get("whatsapp"):
        lines.append(f"WhatsApp : {office.get('whatsapp')}")

    if office.get("opening_hours"):
        lines.append(f"🕒 Horaires : {office.get('opening_hours')}")

    if office.get("pickup_instructions"):
        lines.append(f"ℹ️ {office.get('pickup_instructions')}")

    return "\n".join(lines)


def detect_office_from_message(
    org_id: str,
    text: str,
) -> dict | None:
    text_lower = (text or "").lower()

    offices = list_offices(
        org_id=org_id,
    )

    for office in offices:
        city = (office.get("city") or "").lower()
        country = (office.get("country") or "").lower()
        office_type = (office.get("office_type") or "").lower()

        if city and city in text_lower:
            return office

        if country and country in text_lower:
            return office

        if office_type and office_type in text_lower:
            return office

    return None


def handle_address_request(
    org_id: str,
    text: str,
) -> dict:
    office = detect_office_from_message(
        org_id=org_id,
        text=text,
    )

    if not office:
        return {
            "message": (
                "Merci de préciser la ville ou le pays concerné afin que nous puissions "
                "vous envoyer la bonne adresse."
            ),
            "found": False,
            "office": None,
        }

    return {
        "message": format_office_response(office),
        "found": True,
        "office": office,
        "city": office.get("city"),
        "country": office.get("country"),
    }
