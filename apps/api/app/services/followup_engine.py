def _humanize_missing_field(field: str) -> str:
    mapping = {
        "origin": "le pays ou la ville d’origine",
        "destination": "le pays ou la ville de destination",
        "goods_type": "le type de marchandise",
        "weight_or_volume": "le poids ou le volume approximatif",
        "tracking_id": "le numéro de tracking",
        "supplier_payment_amount": "le montant fournisseur",
        "supplier_payment_currency": "la devise du paiement",
    }

    return mapping.get(field, field)


def build_followup_for_business_action(
    org_name: str,
    business_action: dict,
    dossier: dict | None,
) -> dict | None:
    action_type = business_action.get("action_type")
    missing_fields = business_action.get("missing_fields", [])

    human_missing = [
        _humanize_missing_field(field)
        for field in missing_fields
    ]

    missing_text = ", ".join(human_missing)

    if action_type in [
        "CONTINUE_SHIPPING_INTAKE",
        "CONTINUE_TRANSITAIRE_INTAKE",
        "CHECK_PRICING_REQUIREMENTS",
    ]:
        return {
            "followup_type": "MISSING_INFO_REMINDER",
            "due_minutes": 1440,
            "message": (
                f"Bonjour 👋\n\n"
                f"Petit rappel de {org_name}.\n\n"
                "Pour continuer votre dossier, merci de nous envoyer :\n"
                f"- {missing_text}\n\n"
                "Dès réception, notre équipe pourra poursuivre le traitement."
            ),
        }

    if action_type == "CONTINUE_SUPPLIER_PAYMENT_INTAKE":
        return {
            "followup_type": "SUPPLIER_PAYMENT_INFO_REMINDER",
            "due_minutes": 1440,
            "message": (
                f"Bonjour 👋\n\n"
                f"Petit rappel de {org_name}.\n\n"
                "Pour continuer votre demande de paiement fournisseur, merci d’envoyer :\n"
                "- le montant\n"
                "- la devise\n"
                "- les informations du fournisseur\n\n"
                "Exemple : 2500 RMB via WeChat Pay."
            ),
        }

    if action_type == "REQUIRE_TRACKING_ID":
        return {
            "followup_type": "TRACKING_ID_REMINDER",
            "due_minutes": 720,
            "message": (
                f"Bonjour 👋\n\n"
                f"Petit rappel de {org_name}.\n\n"
                "Merci de nous envoyer votre numéro de tracking afin que nous puissions vérifier le statut du colis."
            ),
        }

    if action_type == "READY_FOR_SHIPPING_REVIEW":
        return {
            "followup_type": "PACKAGE_DROP_REMINDER",
            "due_minutes": 2880,
            "message": (
                f"Bonjour 👋\n\n"
                f"Votre dossier est bien enregistré chez {org_name}.\n\n"
                "Nous attendons maintenant le dépôt du colis au bureau ou à l’entrepôt."
            ),
        }

    return None
