import json


def to_jsonb(value):
    if value is None:
        return None

    return json.dumps(value, default=str)
