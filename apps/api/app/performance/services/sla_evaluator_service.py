from app.performance.repositories.sla_repository import (
    create_sla_breach,
    get_active_policies,
)


def evaluate_metric_against_sla(
    org_id: str,
    metric: dict,
):
    policies = get_active_policies(
        org_id=org_id,
        metric_type=metric["metric_type"],
    )

    breaches = []

    for policy in policies:
        expected = None

        if policy.get("target_minutes") is not None:
            expected = policy["target_minutes"]
        elif policy.get("target_hours") is not None:
            expected = policy["target_hours"]
        elif policy.get("target_days") is not None:
            expected = policy["target_days"]

        if expected is None:
            continue

        actual = float(metric["metric_value"])

        if actual > float(expected):
            breach = create_sla_breach(
                org_id=org_id,
                sla_policy_id=str(policy["id"]),
                metric_id=str(metric["id"]),
                entity_type=metric.get("entity_type"),
                entity_id=metric.get("entity_id"),
                breach_type=metric["metric_type"],
                severity=policy["severity"],
                expected_value=float(expected),
                actual_value=actual,
            )
            breaches.append(breach)

    return breaches

