HIGH_RISK_INTENTS = {
    "COMPLAINT",
    "HUMAN_AGENT_REQUEST",
}

NEGATIVE_WORDS = [
    "retard",
    "arnaque",
    "colère",
    "colere",
    "fâché",
    "fache",
    "fatigué",
    "fatigue",
    "problème",
    "probleme",
    "refund",
    "urgent",
    "responsable",
]


def compute_escalation_score(
    message: str,
    intent: str,
    confidence: float,
):
    score = 0.0
    triggered = []

    if intent in HIGH_RISK_INTENTS:
        score += 0.5
        triggered.append("HIGH_RISK_INTENT")

    if confidence < 0.50:
        score += 0.3
        triggered.append("LOW_CONFIDENCE")

    lower = message.lower()
    negative_hits = sum(1 for word in NEGATIVE_WORDS if word in lower)

    if negative_hits:
        score += min(negative_hits * 0.10, 0.40)
        triggered.append("NEGATIVE_SENTIMENT")

    return {
        "score": min(score, 1.0),
        "rules": triggered,
    }

