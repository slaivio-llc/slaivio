FIELD_LABELS = {
    "origin_country": "le pays de départ",
    "origin_city": "la ville de départ",
    "destination_country": "le pays de destination",
    "destination_city": "la ville de destination",
    "goods_type": "le type de marchandise",
    "weight_kg": "le poids estimé en kg",
    "tracking_id": "le numéro de tracking",
    "supplier_name": "le nom du fournisseur",
}


def build_missing_info_response(missing_fields: list[str]):
    labels = [
        FIELD_LABELS.get(field, field)
        for field in missing_fields
    ]

    if len(labels) == 1:
        return (
            "Merci pour votre message. "
            f"Pour vous aider correctement, pouvez-vous préciser {labels[0]} ?"
        )

    joined = ", ".join(labels[:-1])
    last = labels[-1]

    return (
        "Merci pour votre message. "
        f"Pour vous aider correctement, pouvez-vous préciser {joined} et {last} ?"
    )

