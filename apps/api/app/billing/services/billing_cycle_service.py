from datetime import datetime, timedelta, timezone


def trial_window(
    days: int = 14,
):
    now = datetime.now(timezone.utc)

    return {
        "starts_at": now.isoformat(),
        "trial_ends_at": (now + timedelta(days=days)).isoformat(),
        "current_period_ends_at": (now + timedelta(days=days)).isoformat(),
    }


def monthly_window():
    now = datetime.now(timezone.utc)

    return {
        "starts_at": now.isoformat(),
        "current_period_ends_at": (now + timedelta(days=30)).isoformat(),
    }

