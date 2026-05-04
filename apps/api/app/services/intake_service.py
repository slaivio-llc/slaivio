REQUIRED_INTAKE_FIELDS = [
    "client_full_name",
    "destination_country",
    "destination_city",
    "shipping_mode",
    "goods_type",
]


def get_missing_intake_fields(dossier: dict | None) -> list[str]:
    if not dossier:
        return REQUIRED_INTAKE_FIELDS

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
        "client_full_name": "Nom complet",
        "destination_country": "Pays de destination",
        "destination_city": "Ville de destination",
        "shipping_mode": "Mode d’envoi : avion ou maritime",
        "goods_type": "Type de marchandise",
    }

    needed = [
        human_labels[field]
        for field in missing_fields
        if field in human_labels
    ]

    if not needed:
        return (
            f"Parfait chef 🙏\n\n"
            f"Votre dossier chez {org_name} est bien confirmé. "
            "L’équipe va maintenant vérifier la suite."
        )

    intro = "D’accord chef, c’est noté 🙏"

    if case_type == "TRANSITAIRE":
        context = (
            "Pour bien préparer votre dossier transitaire, "
            "envoyez-nous simplement ces informations en un seul message :"
        )
    else:
        context = (
            "Pour bien enregistrer votre dossier, "
            "envoyez-nous simplement ces informations en un seul message :"
        )

    lines = [
        intro,
        "",
        context,
        "",
    ]

    for item in needed:
        lines.append(f"{item} :")

    lines.extend([
        "",
        "Exemple :",
        "Jean Mbala, Douala Cameroun, avion, vêtements.",
        "",
        "Dès que nous recevons ça, l’équipe pourra préparer la suite de votre dossier.",
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