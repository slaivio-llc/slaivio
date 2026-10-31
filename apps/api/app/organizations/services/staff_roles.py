"""Roles available for new staff invitations and assignments, not legacy grants."""
from typing import Literal, get_args
from fastapi import HTTPException

StaffRole = Literal['MANAGER', 'OPERATOR', 'WAREHOUSE', 'SUPPORT', 'FINANCE']
STAFF_ROLES = get_args(StaffRole)


def validate_staff_role(role_code: str):
    if role_code not in STAFF_ROLES:
        raise HTTPException(422, 'staff_role_not_available')
