import json
from typing import Any


def json_dumps(value: Any) -> str:
    """Serialize application/database values for PostgreSQL JSONB fields."""
    return json.dumps(value, default=str)
