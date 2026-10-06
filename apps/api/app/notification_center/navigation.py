"""Resolve supported notification references without interpreting message text."""
from urllib.parse import quote


def notification_href(item: dict, permissions: list[str]) -> str:
    kind = item.get('resource_kind')
    identifier = item.get('resource_id')
    targets = {
        'DOSSIER': ('dossiers.read', '/app/dossiers/'),
        'CLIENT': ('clients.read', '/app/clients?open='),
    }
    target = targets.get(kind)
    if identifier and target and target[0] in permissions:
        return target[1] + quote(str(identifier), safe='')
    # Legacy shipment IDs are not cargo expedition IDs. Never fabricate a link.
    return '/app/notifications'
