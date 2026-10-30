"""Reconcile an accepted invitation using Clerk's authenticated membership list.

A query parameter, a matching email or a pending invitation alone grants nothing.
"""
import os
from urllib.parse import quote
import requests
from fastapi import HTTPException
from app.organizations.repositories.organization_repository import get_organization_by_clerk_org_id,get_organization_member
from app.organizations.services.membership_role_service import sync_membership_with_role
from app.tenant.services.tenant_service import switch_tenant


def verified_memberships(user_id):
    secret=os.getenv('CLERK_SECRET_KEY')
    if not secret:raise HTTPException(503,'invitation_provider_not_configured')
    records=[]
    for offset in range(0,1000,100):
        try:
            response=requests.get(f'https://api.clerk.com/v1/users/{quote(user_id,safe="")}/organization_memberships',
                headers={'Authorization':f'Bearer {secret}'},params={'limit':100,'offset':offset},timeout=10)
            response.raise_for_status()
            payload=response.json()
        except (requests.RequestException,ValueError) as exc:
            raise HTTPException(503,'invitation_membership_verification_unavailable') from exc
        batch=payload.get('data') if isinstance(payload,dict) else None
        if not isinstance(batch,list):raise HTTPException(503,'invitation_provider_invalid_response')
        records.extend(batch)
        if len(batch)<100:return records
    raise HTTPException(503,'invitation_membership_verification_unavailable')


def complete_invitation(manager,org_id=None):
    user_id=str(manager.get('user_id') or manager.get('id'))
    candidates=[]
    for membership in verified_memberships(user_id):
        organization=membership.get('organization') or {}
        clerk_org_id=organization.get('id')
        if not membership.get('id') or not clerk_org_id:continue
        local=get_organization_by_clerk_org_id(clerk_org_id)
        if local and (org_id is None or local['id']==org_id):
            candidates.append((local,membership))
    if not candidates:raise HTTPException(403,'invitation_membership_not_confirmed')
    if org_id is None and len(candidates)>1:
        return {'status':'select_agency','agencies':[{'id':o['id'],'name':o.get('organization_name') or o.get('name')} for o,_ in candidates]}
    org,membership=candidates[0]
    if org.get('status','ACTIVE')!='ACTIVE':raise HTTPException(403,'organization_access_suspended')
    existing=get_organization_member(org['id'],user_id)
    if existing and existing['status']!='ACTIVE':raise HTTPException(403,'organization_membership_inactive')
    data=membership.get('public_user_data') or {}
    if data.get('user_id') and data['user_id']!=user_id:raise HTTPException(503,'invitation_provider_invalid_response')
    sync_membership_with_role(clerk_membership_id=membership['id'],clerk_user_id=user_id,
        clerk_org_id=membership['organization']['id'],org_id=org['id'],
        user_email=data.get('identifier'),user_display_name=' '.join(filter(None,[data.get('first_name'),data.get('last_name')])),
        default_role_code=existing['role_code'] if existing else 'SUPPORT')
    # The agency is selected only after the provider-confirmed membership exists.
    switch_tenant(user_id,org['id'])
    return {'status':'ok','org_id':org['id']}
