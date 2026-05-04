def build_followup_for_business_action(
    org_name: str,
    business_action: dict,
    dossier: dict,
) -> dict | None:
    action_type = business_action.get("action_type")
    missing_fields = business_action.get("missing_fields", [])

    if action_type in [
        "CONTINUE_SHIPPING_INTAKE",
        "CONTINUE_TRANSITAIRE_INTAKE",
        "CHECK_PRICING_REQUIREMENTS",
    ]:
        missing_text = ", ".join(missing_fields) if missing_fields else "les informations manquantes"

        return {
            "followup_type": "MISSING_INFO_REMINDER",
            "due_minutes": 1440,
            "message": (
                f"Bonjour 👋, rappel de {org_name}.\n\n"
                f"Pour continuer votre dossier, merci de nous envoyer : {missing_text}."
            ),
        }

    if action_type == "CONTINUE_SUPPLIER_PAYMENT_INTAKE":
        return {
            "followup_type": "SUPPLIER_PAYMENT_INFO_REMINDER",
            "due_minutes": 1440,
            "message": (
                f"Bonjour 👋, rappel de {org_name}.\n\n"
                "Pour continuer votre demande de paiement fournisseur, merci de préciser le montant, la devise et les informations du fournisseur."
            ),
        }

    if action_type == "REQUIRE_TRACKING_ID":
        return {
            "followup_type": "TRACKING_ID_REMINDER",
            "due_minutes": 720,
            "message": (
                f"Bonjour 👋, rappel de {org_name}.\n\n"
                "Pour vérifier votre colis, merci de nous envoyer votre numéro de tracking."
            ),
        }

    return None