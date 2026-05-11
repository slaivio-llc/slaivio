REQUIRED_INTAKE_FIELDS = [
    "client_full_name",
    "destination_country",
    "destination_city",
    "shipping_mode",
    "goods_type",
]


def get_missing_intake_fields(dossier: dict | None) -> list[str]:
    if not dossier:
        return REQUIRED_INTAKE_FIELDS.copy()

    missing = []

    for field in REQUIRED_INTAKE_FIELDS:
        if not dossier.get(field):
            missing.append(field)

    return missing


def build_human_intake_message(
    missing_fields: list[str],
    org_name: str,
    case_type: str | None = None,
) -> str:
    human_labels = {
        "client_full_name": "votre nom complet",
        "destination_country": "le pays de destination",
        "destination_city": "la ville de destination",
        "shipping_mode": "le mode d’envoi souhaité, par exemple avion ou maritime",
        "goods_type": "le type de marchandise",
    }

    needed = [
        human_labels[field]
        for field in missing_fields
        if field in human_labels
    ]

    if not needed:
        return (
            f"Parfait chef 🙏\n\n"
            f"Votre dossier chez {org_name} est bien confirmé.\n\n"
            "Nous attendons maintenant que le colis soit déposé au bureau "
            "ou reçu à notre entrepôt par votre fournisseur."
        )

    if case_type == "TRANSITAIRE":
        context = (
            "Pour bien préparer votre dossier transitaire, envoyez-nous simplement "
            "les informations restantes en un seul message."
        )
    else:
        context = (
            "Pour bien enregistrer votre dossier, envoyez-nous simplement "
            "les informations restantes en un seul message."
        )

    lines = [
        "D’accord chef, c’est noté 🙏",
        "",
        context,
        "",
        "Il nous manque encore :",
    ]

    for item in needed:
        lines.append(f"- {item}")

    lines.extend([
        "",
        "Vous pouvez écrire par exemple :",
        "Jean Mbala, Douala Cameroun, avion, vêtements.",
        "",
        "Dès qu’on reçoit ça, votre dossier sera prêt et l’équipe pourra suivre la suite.",
    ])

    return "\n".join(lines)


def is_intake_in_progress(dossier: dict | None) -> bool:
    if not dossier:
        return False

    return (
        dossier.get("validation_status") == "CONFIRMED_BY_CLIENT"
        and dossier.get("intake_status") == "PARTIAL"
    )


def get_intake_completion_status(dossier: dict | None) -> str:
    missing = get_missing_intake_fields(dossier)

    if not missing:
        return "COMPLETE"

    return "PARTIAL"
