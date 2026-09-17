from __future__ import annotations

import json

from fastapi import HTTPException
from sqlalchemy import text

from app.db.database import engine
from app.organization_admin import repository as administration
from app.services.wazzap_activation_service import public_wazzap_configuration
from app.core.config import settings


def _dict(row):
    return dict(row._mapping) if row else None


def overview(org_id: str) -> dict:
    with engine.begin() as conn:
        conn.execute(
            text("insert into knowledge_settings(org_id) values(:org_id) on conflict(org_id) do nothing"),
            {"org_id": org_id},
        )
        conn.execute(
            text("insert into ai_settings(org_id) values(:org_id) on conflict(org_id) do nothing"),
            {"org_id": org_id},
        )
        organization = _dict(conn.execute(text("""
          select id,coalesce(organization_name,name) organization_name,legal_name,organization_type,
                 country,city,address,phone,email,website,logo_url,row_version,
                 whatsapp_group_on_dossier_create
          from organizations where id=:org_id
        """), {"org_id": org_id}).fetchone())
        responsible = _dict(conn.execute(text("""
          select id::text,member_display_name,member_email,role_code,status,last_seen_at
          from organization_memberships
          where org_id=:org_id and status='ACTIVE'
          order by case role_code when 'OWNER' then 0 when 'MANAGER' then 1 else 2 end,
                   created_at
          limit 1
        """), {"org_id": org_id}).fetchone())
        team = [dict(row._mapping) for row in conn.execute(text("""
          select id::text,member_display_name,member_email,role_code,status,last_seen_at
          from organization_memberships where org_id=:org_id
          order by case status when 'ACTIVE' then 0 else 1 end,created_at
        """), {"org_id": org_id}).fetchall()]
        locations = [dict(row._mapping) for row in conn.execute(text("""
          select id::text,name,code,location_type,country,city,address,phone,
                 whatsapp,email,manager_name,opening_hours,timezone,services,status,row_version
          from organization_locations where org_id=:org_id
          order by case status when 'ACTIVE' then 0 else 1 end,name
        """), {"org_id": org_id}).fetchall()]
        numbering = [dict(row._mapping) for row in conn.execute(text("""
          select document_type,prefix_format,next_number,row_version,updated_at
          from document_numbering_settings
          where org_id=:org_id and document_type in(
            'CLIENT','DOSSIER',
            case when :organization_type='PARCEL_FREIGHT' then 'PACKAGE' else 'DOSSIER' end
          )
          order by case document_type when 'CLIENT' then 0 when 'DOSSIER' then 1 else 2 end
        """), {
            "org_id": org_id,
            "organization_type": organization.get("organization_type"),
        }).fetchall()]
        numbers = [dict(row._mapping) for row in conn.execute(text("""
          select id::text,provider,phone_number_id,display_phone_number,verified_name,connection_status,
                 quality_rating,is_default,last_sync_at,auto_mark_read,group_replies_enabled
          from organization_whatsapp_numbers
          where org_id=:org_id and is_active=true
          order by is_default desc,created_at desc
        """), {"org_id": org_id}).fetchall()]
        ai = _dict(conn.execute(text("""
          select pilot_response_mode,pilot_require_published_knowledge,system_prompt,
                 user_prompt_template,communication_style,prompt_row_version,updated_at
          from ai_settings where org_id=:org_id
        """), {"org_id": org_id}).fetchone())
        knowledge = _dict(conn.execute(text("""
          select settings.default_language,settings.pilot_default_review_days,
                 settings.pilot_row_version,
                 count(entry.id) filter(where entry.status='PUBLISHED')::int published_count,
                 count(entry.id) filter(where entry.status<>'PUBLISHED' and entry.status<>'ARCHIVED')::int draft_count,
                 count(entry.id) filter(where entry.status='PUBLISHED'
                   and entry.ai_scope in('CLIENT','BOTH') and entry.sensitive=false
                   and (entry.expires_at is null or entry.expires_at>now())
                   and (entry.review_due_at is null or entry.review_due_at>now()))::int whatsapp_ready_count
          from knowledge_settings settings
          left join knowledge_entries entry on entry.org_id=settings.org_id
          where settings.org_id=:org_id
          group by settings.id
        """), {"org_id": org_id}).fetchone())
        parcel_operations = None
        if organization and organization.get("organization_type") == "PARCEL_FREIGHT":
            parcel_operations = _dict(conn.execute(text("""
              insert into parcel_operation_settings(org_id) values(:org_id)
              on conflict(org_id) do update set org_id=excluded.org_id
              returning package_number_pattern,prospect_followup_delay_hours,
                incomplete_profile_followup_hours,notify_next_departure,
                notify_package_milestones,require_payment_clearance,
                required_profile_fields,row_version,updated_at
            """), {"org_id": org_id}).fetchone())
    if not organization:
        raise HTTPException(404, "pilot_organization_not_found")
    return {
        "organization": organization,
        "responsible": responsible,
        "team": team,
        "locations": locations,
        "numbering": numbering,
        "whatsapp_numbers": numbers,
        "whatsapp_configuration": {
            **public_wazzap_configuration(),
            "qr_linked_device_available": bool(
                settings.whatsapp_qr_gateway_url
                and settings.whatsapp_qr_gateway_shared_secret
                and len(settings.whatsapp_qr_gateway_shared_secret) >= 32
            ),
        },
        "ai": ai,
        "knowledge": knowledge,
        "parcel_operations": parcel_operations,
    }


def save_parcel_operation_settings(org_id: str, actor_id: str, data: dict, expected_version: int) -> dict | None:
    with engine.begin() as conn:
        is_parcel = conn.execute(text("""
          select organization_type='PARCEL_FREIGHT' from organizations where id=:org_id
        """), {"org_id": org_id}).scalar()
        if not is_parcel:
            raise HTTPException(422, "parcel_operations_not_available")
        row = conn.execute(text("""
          update parcel_operation_settings set
            package_number_pattern=:package_number_pattern,
            prospect_followup_delay_hours=:prospect_followup_delay_hours,
            incomplete_profile_followup_hours=:incomplete_profile_followup_hours,
            notify_next_departure=:notify_next_departure,
            notify_package_milestones=:notify_package_milestones,
            require_payment_clearance=:require_payment_clearance,
            updated_by=:actor_id,updated_at=now(),row_version=row_version+1
          where org_id=:org_id and row_version=:expected_version
          returning *
        """), {"org_id": org_id, "actor_id": actor_id,
                 "expected_version": expected_version, **data}).mappings().first()
        return dict(row) if row else None


def _readiness_check(key: str, label: str, ready: bool, ready_text: str, missing_text: str, href: str) -> dict:
    return {
        "key": key,
        "label": label,
        "status": "READY" if ready else "ACTION_REQUIRED",
        "description": ready_text if ready else missing_text,
        "action_label": "Vérifier" if ready else "Compléter",
        "href": href,
    }


def readiness(org_id: str) -> dict:
    """Calculate go-live readiness only from tenant-owned source data."""
    with engine.connect() as conn:
        state = conn.execute(text("""
          select
            exists(
              select 1 from organizations organization
              where organization.id=:org_id
                and nullif(btrim(coalesce(organization.organization_name, organization.name, '')), '') is not null
                and nullif(btrim(coalesce(organization.country, '')), '') is not null
                and (nullif(btrim(coalesce(organization.phone, '')), '') is not null
                  or nullif(btrim(coalesce(organization.email, '')), '') is not null)
            ) company_ready,
            exists(
              select 1 from organization_memberships membership
              where membership.org_id=:org_id and membership.status='ACTIVE'
                and membership.role_code in ('OWNER','MANAGER')
            ) responsible_ready,
            (select count(distinct numbering.document_type)=
                      case when (select organization_type from organizations where id=:org_id)='PARCEL_FREIGHT'
                           then 3 else 2 end
             from document_numbering_settings numbering
             where numbering.org_id=:org_id and numbering.document_type in ('CLIENT','DOSSIER','PACKAGE')
               and nullif(btrim(numbering.prefix_format), '') is not null) identifiers_ready,
            exists(
              select 1 from organization_whatsapp_numbers number
              left join organization_whatsapp_accounts account
                on account.id=number.whatsapp_account_id and account.org_id=number.org_id
              where number.org_id=:org_id and number.is_active=true and number.is_default=true
                and number.connection_status='CONNECTED'
                and (
                  (upper(number.provider) in ('WAZZAP','QR_LINKED_DEVICE') and nullif(btrim(number.phone_number_id),'') is not null)
                  or (upper(number.provider)='META'
                    and account.connection_status='CONNECTED'
                    and account.webhook_subscription_status='SUBSCRIBED')
                )
            ) whatsapp_ready,
            coalesce((select settings.pilot_response_mode from ai_settings settings
                      where settings.org_id=:org_id), 'PAUSED') ai_mode,
            exists(
              select 1 from knowledge_entries entry
              where entry.org_id=:org_id and entry.status='PUBLISHED'
                and entry.ai_scope in ('CLIENT','BOTH') and entry.sensitive=false
                and (entry.effective_at is null or entry.effective_at<=now())
                and (entry.expires_at is null or entry.expires_at>now())
                and (entry.review_due_at is null or entry.review_due_at>now())
            ) knowledge_ready,
            (select count(*)::int from pilot_sync_operations operation
             where operation.org_id=:org_id and operation.status in ('CONFLICT','REJECTED')) sync_attention_count,
            (select count(*)::int from pilot_followup_recipients recipient
             where recipient.org_id=:org_id and recipient.status='FAILED'
               and recipient.updated_at>=now()-interval '30 days') failed_followup_count
        """), {"org_id": org_id}).mappings().one()

    checks = [
        _readiness_check("company", "Informations de l’entreprise", bool(state["company_ready"]),
                         "Le nom, le pays et un moyen de contact sont renseignés.",
                         "Complétez le nom, le pays et au moins un moyen de contact.",
                         "/app/settings?section=company"),
        _readiness_check("responsible", "Administration de l’agence", bool(state["responsible_ready"]),
                         "Un propriétaire ou responsable actif administre l’agence.",
                         "Ajoutez un propriétaire ou responsable actif avant la mise en service.",
                         "/app/settings?section=company"),
        _readiness_check("identifiers", "Identifiants automatiques", bool(state["identifiers_ready"]),
                         "Les références seront générées automatiquement.",
                         "Choisissez le format des identifiants de votre activité.",
                         "/app/settings?section=identifiers"),
        _readiness_check("whatsapp", "Numéro WhatsApp principal", bool(state["whatsapp_ready"]),
                         "Le numéro principal est connecté et sélectionné.",
                         "Connectez puis sélectionnez le numéro WhatsApp de l’entreprise.",
                         "/app/settings?section=communication"),
        _readiness_check("knowledge", "Réponses officielles", bool(state["knowledge_ready"]),
                         "Au moins une information publiée peut être utilisée avec les clients.",
                         "Publiez au moins une réponse officielle destinée aux clients.",
                         "/app/knowledge"),
        _readiness_check("synchronization", "Données à synchroniser", int(state["sync_attention_count"] or 0) == 0,
                         "Aucun conflit de synchronisation n’attend une décision.",
                         f'{int(state["sync_attention_count"] or 0)} opération(s) doivent être vérifiée(s).',
                         "/app/dossiers"),
    ]

    ai_paused = str(state["ai_mode"]) == "PAUSED"
    checks.append({
        "key": "ai_mode", "label": "Mode de réponse de l’IA",
        "status": "WARNING" if ai_paused else "READY",
        "description": ("L’IA est en pause. WhatsApp reste utilisable avec des réponses manuelles."
                        if ai_paused else "Le mode de réponse est configuré pour la Boîte de réception."),
        "action_label": "Voir le réglage", "href": "/app/settings?section=communication",
    })
    failed = int(state["failed_followup_count"] or 0)
    checks.append({
        "key": "followup_delivery", "label": "Envoi des relances",
        "status": "WARNING" if failed else "READY",
        "description": (f"{failed} relance(s) ont échoué durant les 30 derniers jours. Vérifiez-les avant le lancement."
                        if failed else "Aucun échec récent de relance n’a été détecté."),
        "action_label": "Voir les relances", "href": "/app/followups",
    })

    blocking = sum(item["status"] == "ACTION_REQUIRED" for item in checks)
    ready_count = sum(item["status"] == "READY" for item in checks)
    total = len(checks)
    return {
        "status": "READY" if blocking == 0 else "ACTION_REQUIRED",
        "score": round(ready_count * 100 / total),
        "ready_count": ready_count,
        "total_count": total,
        "action_required_count": blocking,
        "warning_count": sum(item["status"] == "WARNING" for item in checks),
        "checks": checks,
    }


def record_readiness_review(org_id: str, actor_id: str) -> dict:
    snapshot = readiness(org_id)
    with engine.begin() as conn:
        row = conn.execute(text("""
          insert into pilot_readiness_reviews(
            org_id,status,score,ready_count,total_count,checks,reviewed_by
          ) values(:org_id,:status,:score,:ready_count,:total_count,cast(:checks as jsonb),:actor_id)
          returning id::text,status,score,ready_count,total_count,reviewed_by,created_at
        """), {
            "org_id": org_id, "actor_id": actor_id, "status": snapshot["status"],
            "score": snapshot["score"], "ready_count": snapshot["ready_count"],
            "total_count": snapshot["total_count"],
            "checks": json.dumps(snapshot["checks"], ensure_ascii=False),
        }).mappings().one()
    return {**dict(row), "checks": snapshot["checks"]}


def select_whatsapp_number(org_id: str, actor_id: str, number_id: str) -> dict:
    with engine.begin() as conn:
        selected = conn.execute(text("""
          select id,provider,display_phone_number,verified_name,connection_status,is_default
          from organization_whatsapp_numbers
          where org_id=:org_id and id=:number_id and is_active=true
          for update
        """), {"org_id": org_id, "number_id": number_id}).mappings().first()
        if not selected:
            raise HTTPException(404, "pilot_whatsapp_number_not_found")
        if selected["connection_status"] != "CONNECTED":
            raise HTTPException(409, "pilot_whatsapp_number_not_connected")
        if not selected["is_default"]:
            conn.execute(
                text("update organization_whatsapp_numbers set is_default=false,updated_at=now() where org_id=:org_id and is_default=true"),
                {"org_id": org_id},
            )
            row = conn.execute(text("""
              update organization_whatsapp_numbers
              set is_default=true,number_role='SUPPORT',updated_at=now()
              where org_id=:org_id and id=:number_id
              returning id::text,provider,display_phone_number,verified_name,connection_status,
                        quality_rating,is_default,last_sync_at
            """), {"org_id": org_id, "number_id": number_id}).mappings().one()
            administration._audit(
                conn, org_id, actor_id, "PILOT_WHATSAPP_NUMBER_SELECTED",
                "whatsapp_number", number_id, dict(selected), dict(row),
            )
            return dict(row)
        return dict(selected)


def save_whatsapp_preferences(org_id: str, actor_id: str, number_id: str, auto_mark_read: bool, group_replies_enabled: bool, group_on_dossier_create: bool) -> dict:
    with engine.begin() as conn:
        row = conn.execute(text("""
          update organization_whatsapp_numbers set auto_mark_read=:auto_mark_read,
            group_replies_enabled=:group_replies_enabled,updated_at=now()
          where org_id=:org_id and id=cast(:number_id as uuid) and is_active=true
          returning id::text,phone_number_id,display_phone_number,connection_status,
                    auto_mark_read,group_replies_enabled
        """), {"org_id":org_id,"number_id":number_id,"auto_mark_read":auto_mark_read,
                "group_replies_enabled":group_replies_enabled}).mappings().first()
        if not row: raise HTTPException(404,"pilot_whatsapp_number_not_found")
        conn.execute(text("update organizations set whatsapp_group_on_dossier_create=:enabled,updated_at=now() where id=:org_id"),
                     {"org_id":org_id,"enabled":group_on_dossier_create})
        administration._audit(conn,org_id,actor_id,"PILOT_WHATSAPP_PREFERENCES_UPDATED","whatsapp_number",number_id,None,dict(row))
        return {**dict(row),"group_on_dossier_create":group_on_dossier_create}


def save_knowledge_defaults(
    org_id: str,
    actor_id: str,
    default_language: str,
    default_review_days: int,
    expected_version: int,
) -> dict:
    with engine.begin() as conn:
        old = conn.execute(text("""
          select default_language,pilot_default_review_days,pilot_row_version
          from knowledge_settings where org_id=:org_id for update
        """), {"org_id": org_id}).mappings().first()
        if not old:
            raise HTTPException(404, "pilot_knowledge_settings_not_found")
        row = conn.execute(text("""
          update knowledge_settings
          set default_language=:default_language,
              pilot_default_review_days=:default_review_days,
              pilot_row_version=pilot_row_version+1,
              updated_by=:actor_id,updated_at=now()
          where org_id=:org_id and pilot_row_version=:expected_version
          returning default_language,pilot_default_review_days,pilot_row_version,updated_at
        """), {
            "org_id": org_id,
            "actor_id": actor_id,
            "default_language": default_language,
            "default_review_days": default_review_days,
            "expected_version": expected_version,
        }).mappings().first()
        if not row:
            raise HTTPException(409, "pilot_knowledge_settings_modified")
        administration._audit(
            conn, org_id, actor_id, "PILOT_KNOWLEDGE_DEFAULTS_UPDATED",
            "knowledge_settings", org_id, dict(old), dict(row),
        )
        return dict(row)
