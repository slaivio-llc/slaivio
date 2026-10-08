"""International CRM phone validation; does not imply WhatsApp availability."""
import re

import phonenumbers


def normalize_contact_phone(value: str | None, region: str | None = None) -> str | None:
    raw = (value or '').strip()
    if not raw:
        return None
    if not re.fullmatch(r'[+\d\s().-]+', raw, flags=re.ASCII):
        raise ValueError('invalid_phone')
    if raw.startswith('00'):
        raw = '+' + raw[2:]
    try:
        number = phonenumbers.parse(raw, region)
    except phonenumbers.NumberParseException as exc:
        raise ValueError('invalid_phone') from exc
    if number.extension or not phonenumbers.is_valid_number(number):
        raise ValueError('invalid_phone')
    return phonenumbers.format_number(number, phonenumbers.PhoneNumberFormat.E164)
