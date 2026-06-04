REQUIRED_DOSSIER_FIELDS = [
    "origin_country",
    "destination_city",
    "goods_type",
]


def get_dossier_missing_fields(entities: dict):
    missing = []

    for field in REQUIRED_DOSSIER_FIELDS:
        value = entities.get(field)
        if value is None or value == "":
            missing.append(field)

    return missing

