"""Minimal customer identity for the current agency and verified WhatsApp phone."""
import re
from contextlib import nullcontext
from sqlalchemy import text
from app.clients.phone import normalize_contact_phone
from app.db.database import engine

FIELDS = ('full_name', 'country', 'city', 'customer_type')


def known_profile(org_id, phone, *, connection=None):
    try:
        normalized = normalize_contact_phone(phone)
    except ValueError:
        return {}
    if not normalized: return {}
    with (nullcontext(connection) if connection is not None else engine.connect()) as conn:
        matches = conn.execute(text("""select id::text client_id,
            coalesce(nullif(trim(display_name),''),name) full_name,country,city,customer_type
            from clients where org_id=:org and deleted_at is null and (
              normalized_phone=:phone
              or regexp_replace(phone,'[^0-9]','','g')=:digits
              or regexp_replace(whatsapp_phone,'[^0-9]','','g')=:digits)
            order by created_at limit 2"""),
            {'org':org_id,'phone':normalized,'digits':normalized.lstrip('+')}).mappings().all()
    # Shared numbers must not expose or arbitrarily select somebody else's profile.
    if len(matches) != 1: return {}
    return clean_profile(dict(matches[0]))


def clean_profile(profile):
    result = dict(profile or {})
    for field in FIELDS:
        value=result.get(field)
        result[field]=value.strip() if isinstance(value,str) and value.strip() else None
    name = str(result.get('full_name') or '').strip()
    if (name.casefold() in {'client','client whatsapp','prospect','inconnu','unknown','customer'}
            or re.fullmatch(r'[+\d ()\-.]+', name)
            or re.fullmatch(r'client\s+\+?[\d ()\-.]+',name,re.IGNORECASE)):
        result['full_name'] = None
    if result.get('customer_type') not in {'individual','company'}:
        result['customer_type'] = None
    return result


def merge_profile(extracted, current, known):
    """New explicit declarations override memory; missing values never erase it."""
    extracted,current,known=(clean_profile(value) for value in (extracted,current,known))
    return {field:extracted.get(field) or current.get(field) or known.get(field) for field in FIELDS}
