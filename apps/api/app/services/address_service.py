from app.db.office_repository import find_office


def format_office_response(office: dict) -> str:
    lines = []

    lines.append(f"📍 {office.get('city')} :")
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


def handle_address_request(
    org_id: str,
    text: str,
) -> dict:
    text_lower = text.lower()

    # naïf pour v1 : détecter ville
    possible_cities = [
        "kinshasa",
        "goma",
        "bukavu",
        "douala",
        "accra",
        "kampala",
        "nairobi",
        "guangzhou",
        "yiwu",
    ]

    detected_city = None

    for city in possible_cities:
        if city in text_lower:
            detected_city = city
            break

    office = None

    if detected_city:
        office = find_office(
            org_id=org_id,
            city=detected_city,
        )

    if not office:
        return {
            "message": (
                "Merci de préciser la ville où vous souhaitez trouver notre bureau."
            ),
            "found": False,
        }

    return {
        "message": format_office_response(office),
        "found": True,
        "city": detected_city,
    }