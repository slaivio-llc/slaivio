"""Resolve the payer from the authenticated account, never from checkout input."""
import os
import re
from urllib.parse import quote

import requests
from fastapi import HTTPException


def billing_identity(manager: dict) -> dict:
    email = manager.get('email')
    name = manager.get('full_name') or manager.get('name')
    if not email:
        # Clerk's default session token does not necessarily contain an email.
        user_id = manager.get('user_id') or manager.get('id')
        secret = os.getenv('CLERK_SECRET_KEY')
        if not user_id or not secret:
            raise HTTPException(503, 'billing_account_identity_unavailable')
        try:
            response = requests.get(
                f'https://api.clerk.com/v1/users/{quote(str(user_id), safe="")}',
                headers={'Authorization': f'Bearer {secret}'}, timeout=10,
            )
            response.raise_for_status()
            user = response.json()
            primary = user.get('primary_email_address_id')
            address = next((item for item in user.get('email_addresses', []) if item.get('id') == primary), {})
            email = address.get('email_address')
            name = ' '.join(filter(None, [user.get('first_name'), user.get('last_name')])) or name
        except (requests.RequestException, ValueError, TypeError, AttributeError) as exc:
            raise HTTPException(503, 'billing_account_identity_unavailable') from exc
    if not isinstance(email, str) or len(email) > 254 or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', email):
        raise HTTPException(503, 'billing_account_identity_unavailable')
    return {'email': email, 'name': str(name or email)[:120]}
