def _merge_fields(dossier: dict, understanding: dict | None):
    fields = {}

    # 1. mémoire dossier
    if dossier:
        fields.update({
            "origin_country": dossier.get("origin_country"),
            "origin_city": dossier.get("origin_city"),
            "destination_country": dossier.get("destination_country"),
            "destination_city": dossier.get("destination_city"),
            "goods_type": dossier.get("goods_type"),
            "estimated_weight_kg": dossier.get("estimated_weight_kg"),
            "estimated_volume_cbm": dossier.get("estimated_volume_cbm"),
            "shipping_mode": dossier.get("shipping_mode"),
            "tracking_id": dossier.get("tracking_id"),
        })

    # 2. AI override si présent
    if understanding and understanding.get("ai_result"):
        ai_fields = understanding["ai_result"].get("extracted_fields") or {}
        for k, v in ai_fields.items():
            if v:
                fields[k] = v

    return fields

def _get_extracted_fields(understanding: dict | None) -> dict:
    if not understanding:
        return {}

    ai_result = understanding.get("ai_result")

    if not ai_result:
        return {}

    return ai_result.get("extracted_fields") or {}


def _format_known_fields(fields: dict) -> str:
    lines = []

    origin = fields.get("origin_country") or fields.get("origin_city")
    destination = fields.get("destination_city") or fields.get("destination_country")
    goods_type = fields.get("goods_type")
    weight = fields.get("estimated_weight_kg")
    volume = fields.get("estimated_volume_cbm")
    shipping_mode = fields.get("shipping_mode")

    if origin:
        lines.append(f"- Origine : {origin}")

    if destination:
        lines.append(f"- Destination : {destination}")

    if goods_type:
        lines.append(f"- Marchandise : {goods_type}")

    if weight:
        lines.append(f"- Poids estimé : {weight} kg")

    if volume:
        lines.append(f"- Volume estimé : {volume} CBM")

    if shipping_mode:
        lines.append(f"- Mode souhaité : {shipping_mode}")

    if not lines:
        return ""

    return "J’ai bien noté :\n" + "\n".join(lines) + "\n\n"


def _missing_shipping_fields(fields: dict) -> list[str]:
    missing = []

    origin = fields.get("origin_country") or fields.get("origin_city")
    destination = fields.get("destination_country") or fields.get("destination_city")
    goods_type = fields.get("goods_type")
    weight = fields.get("estimated_weight_kg")
    volume = fields.get("estimated_volume_cbm")

    if not origin:
        missing.append("le pays ou la ville d’origine")

    if not destination:
        missing.append("le pays ou la ville de destination")

    if not goods_type:
        missing.append("le type de marchandise")

    if not weight and not volume:
        missing.append("le poids ou volume approximatif")

    return missing


def _format_missing_questions(missing_fields: list[str]) -> str:
    if not missing_fields:
        return "Nous avons les premières informations. L’équipe pourra vérifier les détails et vous confirmer la suite."

    lines = [f"{index}. {field}" for index, field in enumerate(missing_fields, start=1)]

    return "Merci de préciser aussi :\n" + "\n".join(lines)


def generate_reply(
        intent: str, 
        org_name: str, 
        understanding: dict | None = None,
        dossier: dict | None = None,
        ) -> dict:
    fields = _merge_fields(dossier or {}, understanding)
    known_fields_text = _format_known_fields(fields)

    if intent == "GREETING":
        return {
            "reply_type": "greeting",
            "should_escalate": False,
            "message": (
                f"Bonjour 👋, merci d’avoir contacté {org_name}.\n\n"
                "Comment pouvons-nous vous aider aujourd’hui ?\n"
                "Vous pouvez écrire par exemple :\n"
                "- Je veux envoyer un colis\n"
                "- Je veux connaître le prix\n"
                "- Je veux suivre mon colis\n"
                "- Je veux utiliser votre service transitaire"
            ),
        }

    if intent == "SEND_CARGO_REQUEST":
        missing = _missing_shipping_fields(fields)

        return {
            "reply_type": "guided_intake",
            "should_escalate": False,
            "message": (
                f"Merci d’avoir contacté {org_name}.\n\n"
                f"{known_fields_text}"
                f"{_format_missing_questions(missing)}"
            ),
        }

    if intent == "TRANSITAIRE_REQUEST":
        missing = _missing_shipping_fields(fields)

        if not fields.get("supplier_mentioned"):
            missing.append("si votre fournisseur a déjà préparé le colis")

        return {
            "reply_type": "guided_intake",
            "should_escalate": False,
            "message": (
                f"Merci d’avoir contacté {org_name}.\n\n"
                f"{known_fields_text}"
                "Pour préparer votre dossier transitaire, voici ce qu’il nous faut.\n\n"
                f"{_format_missing_questions(missing)}"
            ),
        }

    if intent == "PRICE_REQUEST":
        missing = _missing_shipping_fields(fields)

        return {
            "reply_type": "qualification_needed",
            "should_escalate": False,
            "message": (
                f"{org_name} 📦\n\n"
                f"{known_fields_text}"
                "Pour vous donner une information correcte sur le prix, merci de préciser :\n"
                + "\n".join(f"{index}. {field}" for index, field in enumerate(missing, start=1))
            ),
        }

    if intent == "SUPPLIER_PAYMENT_REQUEST":
        amount = fields.get("supplier_payment_amount")
        currency = fields.get("supplier_payment_currency")

        known_payment = ""
        if amount and currency:
            known_payment = f"J’ai bien noté le montant : {amount} {currency}.\n\n"

        return {
            "reply_type": "supplier_payment_intake",
            "should_escalate": False,
            "message": (
                f"Merci d’avoir contacté {org_name}.\n\n"
                f"{known_payment}"
                "Pour le paiement fournisseur, merci de préciser :\n"
                "1. Le montant exact\n"
                "2. La devise\n"
                "3. Le moyen souhaité si connu : WeChat Pay, Alipay ou autre\n"
                "4. Les informations du fournisseur"
            ),
        }

    if intent == "TRACKING_REQUEST":
        tracking_id = fields.get("tracking_id")

        if tracking_id:
            message = (
                f"Merci d’avoir contacté {org_name}.\n\n"
                f"J’ai bien reçu votre numéro de suivi : {tracking_id}.\n"
                "Nous allons vérifier le statut de votre colis."
            )
        else:
            message = (
                f"Merci d’avoir contacté {org_name}.\n\n"
                "Veuillez nous envoyer votre numéro de tracking afin que nous puissions vérifier le statut de votre colis."
            )

        return {
            "reply_type": "tracking_lookup_needed",
            "should_escalate": False,
            "message": message,
        }

    if intent == "WAREHOUSE_ADDRESS_REQUEST":
        return {
            "reply_type": "needs_agency_knowledge",
            "should_escalate": False,
            "message": (
                f"Merci d’avoir contacté {org_name}.\n\n"
                "Pour vous donner la bonne adresse, nous devons vérifier les informations exactes configurées par l’agence."
            ),
        }

    if intent == "DEPARTURE_SCHEDULE_REQUEST":
        return {
            "reply_type": "needs_agency_knowledge",
            "should_escalate": False,
            "message": (
                f"Merci d’avoir contacté {org_name}.\n\n"
                "Nous devons vérifier le prochain départ disponible afin de vous donner une information correcte."
            ),
        }

    if intent == "HUMAN_HELP_REQUEST":
        return {
            "reply_type": "human_requested",
            "should_escalate": True,
            "message": (
                f"D’accord. {org_name} transmet votre demande à un membre de l’équipe."
            ),
        }

    return {
        "reply_type": "unknown",
        "should_escalate": False,
        "message": (
            f"Merci d’avoir contacté {org_name}.\n\n"
            "Pouvez-vous préciser votre besoin ?\n"
            "Par exemple : envoyer un colis, connaître le prix, suivre un colis, ou utiliser le service transitaire."
        ),
    }