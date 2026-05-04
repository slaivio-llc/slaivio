def get_missing_intake_fields(dossier: dict) -> list:
    required = [
        "client_full_name",
        "destination_country",
        "destination_city",
        "shipping_mode",
        "goods_type",
    ]

    missing = []

    for field in required:
        if not dossier.get(field):
            missing.append(field)

    return missing


def build_intake_question(missing_fields: list) -> str:
    questions = {
        "client_full_name": "Quel est votre nom complet ?",
        "destination_country": "Quel est le pays de destination ?",
        "destination_city": "Quelle est la ville de destination ?",
        "shipping_mode": "Quel mode d’envoi souhaitez-vous (AIR ou SEA) ?",
        "goods_type": "Quel type de marchandise souhaitez-vous envoyer ?",
    }

    lines = ["Merci pour votre confirmation 🙏\n"]

    for field in missing_fields:
        lines.append(f"- {questions[field]}")

    return "\n".join(lines)