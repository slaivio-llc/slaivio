from datetime import datetime, timedelta


# mémoire V1 simple
# plus tard → Redis/Postgres
_seen_messages: dict[str, datetime] = {}

# fenêtre anti-duplicate
DEDUPLICATION_WINDOW_SECONDS = 300


def _cleanup_old_keys():
    now = datetime.utcnow()

    expired = []

    for key, created_at in _seen_messages.items():
        age = now - created_at

        if age > timedelta(seconds=DEDUPLICATION_WINDOW_SECONDS):
            expired.append(key)

    for key in expired:
        del _seen_messages[key]


def is_duplicate(dedupe_key: str) -> bool:
    _cleanup_old_keys()

    return dedupe_key in _seen_messages


def mark_as_seen(dedupe_key: str) -> None:
    _cleanup_old_keys()

    _seen_messages[dedupe_key] = datetime.utcnow()
