def generate_reply(intent: str) -> dict:
    if intent == "GREETING":
        return {
            "reply_type": "greeting",
            "should_escalate": False,
            "message": (
                "Bonjour 👋 Merci de nous avoir contactés.\n\n"
                "Comment pouvons-nous vous aider aujourd’hui ?\n"
                "Vous pouvez écrire par exemple :\n"
                "- Je veux envoyer un colis\n"
                "- Je veux connaître le prix\n"
                "- Je veux suivre mon colis\n"
                "- Je veux utiliser votre service transitaire"
            ),
        }

    if intent == "SEND_CARGO_REQUEST":
        return {
            "reply_type": "guided_intake",
            "should_escalate": False,
            "message": (
                "Merci. Pour préparer votre dossier d’envoi, merci de préciser :\n"
                "1. Pays d’origine\n"
                "2. Pays de destination\n"
                "3. Type de marchandise\n"
                "4. Poids ou volume approximatif"
            ),
        }

    if intent == "TRANSITAIRE_REQUEST":
        return {
            "reply_type": "guided_intake",
            "should_escalate": False,
            "message": (
                "Merci. Pour préparer votre dossier transitaire, merci de préciser :\n"
                "1. Pays de destination\n"
                "2. Type de produit ou marchandise\n"
                "3. Nom/contact du fournisseur si disponible\n"
                "4. Poids ou volume approximatif si connu"
            ),
        }

    if intent == "PRICE_REQUEST":
        return {
            "reply_type": "qualification_needed",
            "should_escalate": False,
            "message": (
                "Pour vous donner une information correcte, merci de préciser :\n"
                "1. Pays d’origine\n"
                "2. Pays de destination\n"
                "3. Type de marchandise\n"
                "4. Poids ou volume approximatif"
            ),
        }

    if intent == "TRACKING_REQUEST":
        return {
            "reply_type": "tracking_lookup_needed",
            "should_escalate": False,
            "message": (
                "Merci. Veuillez nous envoyer votre numéro de tracking afin que nous puissions vérifier le statut de votre colis."
            ),
        }

    if intent == "WAREHOUSE_ADDRESS_REQUEST":
        return {
            "reply_type": "needs_agency_knowledge",
            "should_escalate": False,
            "message": (
                "Merci. Pour vous donner la bonne adresse, je dois vérifier les informations exactes de l’agence."
            ),
        }

    if intent == "DEPARTURE_SCHEDULE_REQUEST":
        return {
            "reply_type": "needs_agency_knowledge",
            "should_escalate": False,
            "message": (
                "Merci. Je dois vérifier le prochain départ disponible afin de vous donner une information correcte."
            ),
        }

    if intent == "HUMAN_HELP_REQUEST":
        return {
            "reply_type": "human_requested",
            "should_escalate": True,
            "message": (
                "D’accord. Je transmets votre demande à un membre de l’équipe."
            ),
        }

    return {
        "reply_type": "unknown",
        "should_escalate": False,
        "message": (
            "Merci pour votre message. Pouvez-vous préciser votre besoin ?\n"
            "Par exemple : envoyer un colis, connaître le prix, suivre un colis, ou utiliser le service transitaire."
        ),
    }