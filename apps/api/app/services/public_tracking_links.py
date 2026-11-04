"""Public routing identifiers, not authentication secrets or tenant access grants."""
import hashlib
from urllib.parse import urlencode

from app.core.config import settings


def public_agency_key(org_id: str) -> str:
    # MD5 is only a stable non-secret routing label (also available in PostgreSQL).
    return 'agency-' + hashlib.md5(org_id.encode('utf-8'), usedforsecurity=False).hexdigest()


def agency_match_sql(org_id: str, settings_json: str) -> str:
    # Expressions below are fixed source-code aliases, never request values.
    return f"(:slug is null or {settings_json}->'public_tracking_page'->>'slug'=:slug or 'agency-'||md5({org_id})=:slug)"


def legacy_agency_name_sql(name: str, settings_json: str) -> str:
    # Compatibility for formerly advertised, never-saved name-based links.
    # The caller must still reject multiple matches, never choose the first one.
    normalized = f"trim(both '-' from regexp_replace(translate(lower({name}),'àâäéèêëîïôöùûüçÿñ','aaaeeeeiioouuucyn'),'[^a-z0-9]+','-','g'))"
    return f"(nullif({settings_json}->'public_tracking_page'->>'slug','') is null and {normalized}=:slug)"


def package_tracking_url(org_id: str, reference: str) -> str:
    return settings.public_web_base_url.rstrip('/') + '/track?' + urlencode({'reference': reference, 'agency': public_agency_key(org_id)})
