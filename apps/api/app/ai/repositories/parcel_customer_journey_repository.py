from __future__ import annotations

import json
from datetime import datetime

from sqlalchemy import text

from app.db.database import engine


PROFILE_FIELDS = ("full_name", "country", "city", "customer_type")


def is_parcel_organization(org_id: str) -> bool:
    with engine.connect() as conn:
        return bool(conn.execute(text("""
          select organization_type='PARCEL_FREIGHT' from organizations where id=:org_id
        """), {"org_id": org_id}).scalar())


def _missing(values: dict) -> list[str]:
    return [field for field in PROFILE_FIELDS if not str(values.get(field) or "").strip()]


def get_journey(org_id: str, phone: str) -> dict | None:
    with engine.connect() as conn:
        row = conn.execute(text("""
          select * from parcel_customer_journeys
          where org_id=:org_id and conversation_phone=:phone
        """), {"org_id": org_id, "phone": phone}).mappings().first()
        return dict(row) if row else None


def upsert_journey(org_id: str, phone: str, extracted: dict, *, inbound_at: datetime | None = None) -> dict:
    current = get_journey(org_id, phone) or {}
    values = {
        field: extracted.get(field) or current.get(field)
        for field in (*PROFILE_FIELDS, "service_interest", "route_interest", "transport_mode")
    }
    stage = str(extracted.get("stage") or current.get("stage") or "DISCOVERY").upper()
    allowed = {"DISCOVERY", "INTERESTED", "QUALIFYING", "QUALIFIED", "CONVERTED", "NOT_INTERESTED", "HUMAN_REVIEW", "CLOSED"}
    if stage not in allowed:
        stage = current.get("stage") or "DISCOVERY"
    missing = _missing(values)
    if stage == "QUALIFIED" and missing:
        stage = "QUALIFYING"
    metadata = dict(current.get("metadata") or {})
    metadata.update({"last_extraction": extracted})
    with engine.begin() as conn:
        settings = conn.execute(text("""
          insert into parcel_operation_settings(org_id) values(:org_id)
          on conflict(org_id) do update set org_id=excluded.org_id
          returning prospect_followup_delay_hours,incomplete_profile_followup_hours
        """), {"org_id": org_id}).mappings().one()
        delay = settings["incomplete_profile_followup_hours"] if stage == "QUALIFYING" else settings["prospect_followup_delay_hours"]
        schedule = stage in {"INTERESTED", "QUALIFYING"}
        row = conn.execute(text("""
          insert into parcel_customer_journeys(
            org_id,conversation_phone,stage,full_name,country,city,customer_type,
            service_interest,route_interest,transport_mode,missing_fields,last_intent,
            qualification_confidence,followup_status,next_followup_at,last_inbound_at,metadata
          ) values(
            :org_id,:phone,:stage,:full_name,:country,:city,:customer_type,
            :service_interest,:route_interest,:transport_mode,:missing_fields,:last_intent,
            :confidence,case when :schedule then 'SCHEDULED' else 'NONE' end,
            case when :schedule then now()+make_interval(hours=>:delay) end,
            coalesce(:inbound_at,now()),cast(:metadata as jsonb)
          )
          on conflict(org_id,conversation_phone) do update set
            stage=case when parcel_customer_journeys.stage='CONVERTED' then 'CONVERTED' else excluded.stage end,
            full_name=coalesce(excluded.full_name,parcel_customer_journeys.full_name),
            country=coalesce(excluded.country,parcel_customer_journeys.country),
            city=coalesce(excluded.city,parcel_customer_journeys.city),
            customer_type=coalesce(excluded.customer_type,parcel_customer_journeys.customer_type),
            service_interest=coalesce(excluded.service_interest,parcel_customer_journeys.service_interest),
            route_interest=coalesce(excluded.route_interest,parcel_customer_journeys.route_interest),
            transport_mode=coalesce(excluded.transport_mode,parcel_customer_journeys.transport_mode),
            missing_fields=excluded.missing_fields,last_intent=excluded.last_intent,
            qualification_confidence=excluded.qualification_confidence,
            followup_status=case when parcel_customer_journeys.stage='CONVERTED' then 'CANCELLED' else excluded.followup_status end,
            next_followup_at=case when parcel_customer_journeys.stage='CONVERTED' then null else excluded.next_followup_at end,
            last_inbound_at=excluded.last_inbound_at,metadata=parcel_customer_journeys.metadata||excluded.metadata,
            updated_at=now()
          returning *
        """), {
            "org_id": org_id, "phone": phone, "stage": stage, "missing_fields": missing,
            "last_intent": extracted.get("intent"), "confidence": extracted.get("confidence"),
            "schedule": schedule, "delay": int(delay), "inbound_at": inbound_at,
            "metadata": json.dumps(metadata, default=str), **values,
        }).mappings().one()
        journey = dict(row)
        conn.execute(text("""
          update followup_tasks set status='RESPONDED',responded_at=now(),updated_at=now()
          where org_id=:org_id and conversation_phone=:phone and status='WAITING_RESPONSE'
        """), {"org_id": org_id, "phone": phone})
        conn.execute(text("""
          update pilot_followup_recipients recipient
          set status='RESPONDED',replied_at=now(),updated_at=now()
          from followup_tasks task
          where task.org_id=:org_id and task.conversation_phone=:phone
            and task.pilot_recipient_id=recipient.id and task.status='RESPONDED'
        """), {"org_id": org_id, "phone": phone})
        conn.execute(text("""
          update followup_tasks set status='CANCELLED',cancelled_at=now(),updated_at=now()
          where org_id=:org_id and conversation_phone=:phone and status in('SCHEDULED','DUE','PENDING')
        """), {"org_id": org_id, "phone": phone})
        if schedule:
            names = {"full_name": "votre nom complet", "country": "votre pays", "city": "votre ville", "customer_type": "si vous êtes un particulier ou une entreprise"}
            requested = names.get(missing[0], "les informations nécessaires") if missing else "la suite de votre demande"
            conn.execute(text("""
              insert into followup_tasks(
                org_id,client_id,followup_type,message,due_at,status,reference,subject_type,
                subject_id,subject_reference,reason,channel,priority,consent_type,
                idempotency_key,condition_snapshot,conversation_phone,journey_id
              ) values(
                :org_id,cast(:client_id as uuid),'PARCEL_PROSPECT',:message,:due_at,'SCHEDULED',
                'FUP-'||upper(substr(gen_random_uuid()::text,1,8)),'PROSPECT',:journey_id,
                :phone,'Prospect WhatsApp non finalisé','WHATSAPP','NORMAL','OPERATIONAL',
                :idempotency_key,cast(:snapshot as jsonb),:phone,:journey_id
              ) on conflict(org_id,idempotency_key) where idempotency_key is not null do nothing
            """), {
                "org_id": org_id, "client_id": journey.get("client_id"), "journey_id": journey["id"],
                "phone": phone, "due_at": journey["next_followup_at"],
                "message": f"Bonjour, souhaitez-vous poursuivre votre demande ? Il nous manque {requested}.",
                "idempotency_key": f"parcel-journey:{journey['id']}:{journey['next_followup_at'].isoformat()}",
                "snapshot": json.dumps({"missing_fields": missing, "stage": stage}),
            })
        return journey


def convert_journey(org_id: str, phone: str, actor_id: str = "slaivio-ai") -> dict | None:
    with engine.begin() as conn:
        journey = conn.execute(text("""
          select * from parcel_customer_journeys
          where org_id=:org_id and conversation_phone=:phone for update
        """), {"org_id": org_id, "phone": phone}).mappings().first()
        if not journey or journey["stage"] not in {"QUALIFIED", "QUALIFYING"}:
            return None
        missing = _missing(dict(journey))
        if missing:
            return None
        client = conn.execute(text("""
          select id::text,client_reference,coalesce(display_name,name) display_name
          from clients where org_id=:org_id and deleted_at is null
            and (normalized_phone=:phone or phone=:phone or whatsapp_phone=:phone)
          order by created_at limit 1
        """), {"org_id": org_id, "phone": phone}).mappings().first()
        if not client:
            client = conn.execute(text("""
              insert into clients(
                org_id,name,display_name,phone,whatsapp_phone,normalized_phone,country,city,
                customer_type,lifecycle_status,source,preferred_language,credit_enabled,
                credit_limit,current_balance,total_spent,last_activity_at,created_by,updated_by
              ) values(
                :org_id,:name,:name,:phone,:phone,:phone,:country,:city,
                case when :customer_type='company' then 'business' else :customer_type end,
                'lead','whatsapp','FR',false,0,0,0,now(),:actor,:actor
              ) returning id::text,client_reference,display_name
            """), {"org_id": org_id, "name": journey["full_name"], "phone": phone,
                     "country": journey["country"], "city": journey["city"],
                     "customer_type": journey["customer_type"], "actor": actor_id}).mappings().one()
        conn.execute(text("""
          update parcel_customer_journeys set client_id=cast(:client_id as uuid),stage='CONVERTED',
            followup_status='CANCELLED',next_followup_at=null,converted_at=coalesce(converted_at,now()),updated_at=now()
          where id=:journey_id
        """), {"client_id": client["id"], "journey_id": journey["id"]})
        conn.execute(text("""
          update conversation_assignments set client_id=cast(:client_id as uuid),updated_at=now()
          where org_id=:org_id and client_phone=:phone
        """), {"org_id": org_id, "phone": phone, "client_id": client["id"]})
        conn.execute(text("""
          update followup_tasks set client_id=cast(:client_id as uuid),status='CANCELLED',cancelled_at=now(),updated_at=now()
          where org_id=:org_id and conversation_phone=:phone and status in('SCHEDULED','DUE','PENDING')
        """), {"org_id": org_id, "phone": phone, "client_id": client["id"]})
        return dict(client)
