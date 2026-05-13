from app.db.goods_repository import search_goods_rules


def find_goods_rule_answer(
    org_id: str,
    text: str,
) -> dict:
    if not text or not text.strip():
        return {
            "found": False,
            "rule": None,
            "rules": [],
            "answer": None,
        }

    rules = search_goods_rules(
        org_id=org_id,
        query=text,
        limit=5,
    )

    if not rules:
        return {
            "found": False,
            "rule": None,
            "rules": [],
            "answer": None,
        }

    rule = rules[0]

    answer = build_goods_rule_answer(rule)

    return {
        "found": True,
        "rule": rule,
        "rules": rules,
        "answer": answer,
    }


def build_goods_rule_answer(rule: dict) -> str:
    goods_name = rule.get("goods_name") or "Cette marchandise"
    category = rule.get("category")
    accepted = rule.get("accepted")
    pricing_mode = rule.get("pricing_mode")
    price_note = rule.get("price_note")
    handling_note = rule.get("handling_note")
    restriction_note = rule.get("restriction_note")
    requires_manual_validation = rule.get("requires_manual_validation")

    lines = []

    lines.append(f"Concernant : {goods_name}")

    if category:
        lines.append(f"Catégorie : {category}")

    if accepted is True:
        lines.append("Statut : accepté par l’agence")
    elif accepted is False:
        lines.append("Statut : non accepté par l’agence")

    if pricing_mode:
        lines.append(f"Mode de tarification : {pricing_mode}")

    if price_note:
        lines.append(f"Prix / règle : {price_note}")

    if handling_note:
        lines.append(f"Traitement : {handling_note}")

    if restriction_note:
        lines.append(f"Restriction : {restriction_note}")

    if requires_manual_validation:
        lines.append("Cette marchandise nécessite une validation de l’équipe avant confirmation.")

    return "\n".join(lines)


def build_goods_reply(
    org_name: str,
    answer: str,
) -> str:
    return (
        f"{org_name} vous informe :\n\n"
        f"{answer}"
    )
