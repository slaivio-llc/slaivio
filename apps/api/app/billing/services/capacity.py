"""Capacity is enforced by database triggers, not browser counters."""
import json
from contextlib import contextmanager

from fastapi import HTTPException
from sqlalchemy import text

from app.db.database import engine

LABELS = {'max_monthly_packages': 'colis créés ce mois-ci', 'max_users': 'membres et invitations en attente',
          'max_offices': 'bureaux', 'max_warehouses': 'entrepôts', 'max_whatsapp_numbers': 'numéros WhatsApp'}


def limit_error(exc):
    """Only expose our own documented error, never arbitrary PostgreSQL details."""
    original = getattr(exc, 'orig', None)
    diagnostic = getattr(original, 'diag', None)
    if getattr(diagnostic, 'message_primary', None) != 'slaivio_plan_limit_reached':
        return None
    try:
        data = json.loads(diagnostic.message_detail)
        resource = data['resource']
        if resource not in LABELS:
            return None
        return {'code': 'plan_limit_reached', 'resource': resource, 'limit': int(data['limit']),
                'message': f"Votre offre a atteint la limite de {int(data['limit'])} {LABELS[resource]}. Passez à une offre supérieure pour en ajouter. Les éléments existants restent accessibles."}
    except (ValueError, TypeError, KeyError):
        return None


def overview(org_id):
    with engine.connect() as connection:
        return connection.execute(text('select billing_capacity(:org)'), {'org': org_id}).scalar_one()


@contextmanager
def invitation_capacity(org_id, email):
    # Reserve the last seat before contacting Clerk; keep the check, provider call
    # and local invitation record serialized with membership/invitation triggers.
    with engine.begin() as connection:
        duplicate = connection.execute(text("""select 1 from organization_invitations
            where org_id in (select billing_scope(:org)) and lower(trim(email))=:email
              and status='PENDING' limit 1"""), {'org': org_id, 'email': email}).first()
        if duplicate:
            raise HTTPException(409, 'invitation_already_pending')
        connection.execute(text("select billing_assert_capacity(:org,'max_users',1)"), {'org': org_id})
        yield connection
