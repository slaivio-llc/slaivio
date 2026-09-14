import json

from sqlalchemy import text

from app.db.database import engine


DEFAULT_MODE = "SUGGESTION_ONLY"


def get_pilot_ai_settings(org_id: str) -> dict:
    with engine.begin() as conn:
        conn.execute(text("insert into ai_settings(org_id) values(:org_id) on conflict(org_id) do nothing"), {"org_id": org_id})
        row = conn.execute(text("""
          select settings.enabled, settings.provider, settings.model_name, settings.temperature, settings.max_tokens,
                 auto_reply_min_confidence, pilot_response_mode,system_prompt,
                 user_prompt_template,communication_style,prompt_row_version,
                 pilot_require_published_knowledge, settings.updated_at,
                 organization.name organization_name
          from ai_settings settings
          join organizations organization on organization.id=settings.org_id
          where settings.org_id=:org_id
        """), {"org_id": org_id}).mappings().one()
        return dict(row)


def update_pilot_ai_settings(org_id: str, mode: str, actor_id: str) -> dict:
    with engine.begin() as conn:
        conn.execute(text("insert into ai_settings(org_id) values(:org_id) on conflict(org_id) do nothing"), {"org_id": org_id})
        previous_mode = conn.execute(text("""
          select pilot_response_mode from ai_settings
          where org_id=:org_id for update
        """), {"org_id": org_id}).scalar_one()
        row = conn.execute(text("""
          update ai_settings
          set pilot_response_mode=:mode,
              auto_reply_enabled=(:mode = 'CONTROLLED_AUTO'),
              enabled=case when :mode = 'PAUSED' then enabled else true end,
              pilot_updated_by=:actor_id,
              updated_at=now()
          where org_id=:org_id
          returning enabled, provider, model_name, temperature, max_tokens,
                    auto_reply_min_confidence, pilot_response_mode,
                    pilot_require_published_knowledge, updated_at
        """), {"org_id": org_id, "mode": mode, "actor_id": actor_id}).mappings().one()
        if previous_mode != mode:
            conn.execute(text("""
              insert into pilot_inbox_ai_setting_events(org_id,previous_mode,new_mode,actor_id)
              values(:org_id,:previous_mode,:new_mode,:actor_id)
            """), {
                "org_id": org_id, "previous_mode": previous_mode,
                "new_mode": mode, "actor_id": actor_id,
            })
        return dict(row)


def conversation_ai_context(org_id: str, client_phone: str) -> dict | None:
    with engine.connect() as conn:
        row = conn.execute(text("""
          select assignment.client_id, assignment.dossier_id,
                 coalesce(client.display_name, client.name) client_name,
                 client.preferred_language,
                 client.client_reference,
                 dossier.dossier_reference, dossier.title dossier_title,
                 organization.name organization_name,
                 message.id source_message_id,
                 message.text_body source_message,
                 message.created_at source_message_at
          from conversation_assignments assignment
          join organizations organization on organization.id=assignment.org_id
          left join clients client
            on client.org_id=assignment.org_id and client.id=assignment.client_id
          left join dossiers dossier
            on dossier.org_id=assignment.org_id and dossier.id=assignment.dossier_id
          left join lateral (
            select candidate.id, candidate.text_body, candidate.created_at
            from messages candidate
            where candidate.org_id=assignment.org_id
              and candidate.from_phone=assignment.client_phone
              and candidate.direction='inbound'
            order by candidate.created_at desc
            limit 1
          ) message on true
          where assignment.org_id=:org_id and assignment.client_phone=:phone
        """), {"org_id": org_id, "phone": client_phone}).mappings().first()
        if not row:
            return None
        context = dict(row)
        context["recent_messages"] = [dict(item) for item in conn.execute(text("""
          select direction, text_body, created_at
          from (
            select direction, text_body, created_at
            from messages
            where org_id=:org_id and (from_phone=:phone or to_phone=:phone)
            order by created_at desc limit 12
          ) recent order by created_at
        """), {"org_id": org_id, "phone": client_phone}).mappings()]
        context["packages"] = []
        context["finance_summary"] = None
        is_parcel_agency = conn.execute(text("""
          select organization_type='PARCEL_FREIGHT'
          from organizations where id=:org_id
        """), {"org_id": org_id}).scalar()
        if context.get("client_id") and is_parcel_agency and conn.execute(
            text("select to_regclass('public.cargo_packages')")
        ).scalar():
            has_departures = bool(conn.execute(text("""
              select to_regclass('public.departure_package_allocations') is not null
                 and to_regclass('public.cargo_departures') is not null
            """)).scalar())
            departure_columns = "null::text departure_code, null::timestamptz departure_scheduled_at, null::text departure_status"
            departure_join = ""
            if has_departures:
                departure_columns = "departure.departure_code, departure.scheduled_at departure_scheduled_at, departure.status departure_status"
                departure_join = """
                  left join lateral (
                    select d.departure_code,d.scheduled_at,d.status
                    from departure_package_allocations allocation
                    join cargo_departures d on d.id=allocation.departure_id and d.org_id=allocation.org_id
                    where allocation.org_id=package.org_id and allocation.package_id=package.id
                      and allocation.status<>'REMOVED'
                    order by allocation.created_at desc limit 1
                  ) departure on true
                """
            context["packages"] = [dict(item) for item in conn.execute(text(f"""
              select package.package_reference,package.tracking_id,package.status,
                     package.destination_city,package.destination_country,package.eta_at,
                     package.received_at,package.dispatched_at,package.delivered_at,
                     package.last_scan_location,{departure_columns}
              from cargo_packages package
              {departure_join}
              where package.org_id=:org_id and package.client_id=:client_id
                and package.deleted_at is null
              order by package.updated_at desc limit 10
            """), {"org_id": org_id, "client_id": context["client_id"]}).mappings()]
        if (context.get("client_id") and is_parcel_agency and
                conn.execute(text("select to_regclass('public.finance_documents')")).scalar()):
            context["finance_summary"] = dict(conn.execute(text("""
              select coalesce(sum(balance_due) filter(where status not in ('VOID','PAID')),0) balance_due,
                     coalesce(sum(amount_paid),0) amount_paid, max(currency) currency
              from finance_documents
              where org_id=:org_id and client_id=:client_id
            """), {"org_id": org_id, "client_id": context["client_id"]}).mappings().one())
        return context


def log_ai_run(
    *, org_id: str, client_phone: str, event_key: str, response_mode: str,
    outcome: str, client_id=None, dossier_id=None, source_message_id=None,
    intent=None, confidence=None, risk_level="REVIEW", reason=None,
    source_ids=None, draft_id=None, outbound_message_id=None, metadata=None,
) -> dict:
    with engine.begin() as conn:
        row = conn.execute(text("""
          insert into pilot_inbox_ai_runs(
            org_id,client_phone,client_id,dossier_id,source_message_id,event_key,
            response_mode,outcome,intent,confidence,risk_level,reason,source_ids,
            draft_id,outbound_message_id,metadata
          ) values(
            :org_id,:client_phone,cast(:client_id as uuid),cast(:dossier_id as uuid),
            cast(:source_message_id as uuid),:event_key,:response_mode,:outcome,
            :intent,:confidence,:risk_level,:reason,cast(:source_ids as uuid[]),
            cast(:draft_id as uuid),cast(:outbound_message_id as uuid),cast(:metadata as jsonb)
          )
          on conflict(org_id,event_key) do update set
            outcome=excluded.outcome, intent=excluded.intent,
            confidence=excluded.confidence, risk_level=excluded.risk_level,
            reason=excluded.reason, source_ids=excluded.source_ids,
            draft_id=coalesce(pilot_inbox_ai_runs.draft_id,excluded.draft_id),
            outbound_message_id=coalesce(pilot_inbox_ai_runs.outbound_message_id,excluded.outbound_message_id),
            metadata=pilot_inbox_ai_runs.metadata || excluded.metadata
          returning *
        """), {
            "org_id": org_id, "client_phone": client_phone,
            "client_id": client_id, "dossier_id": dossier_id,
            "source_message_id": source_message_id, "event_key": event_key,
            "response_mode": response_mode, "outcome": outcome,
            "intent": intent, "confidence": confidence,
            "risk_level": risk_level, "reason": reason,
            "source_ids": source_ids or [], "draft_id": draft_id,
            "outbound_message_id": outbound_message_id,
            "metadata": json.dumps(metadata or {}, default=str),
        }).mappings().one()
        return dict(row)


def get_ai_run(org_id: str, event_key: str) -> dict | None:
    with engine.connect() as conn:
        row = conn.execute(text("""
          select * from pilot_inbox_ai_runs
          where org_id=:org_id and event_key=:event_key
        """), {"org_id": org_id, "event_key": event_key}).mappings().first()
        return dict(row) if row else None


def list_conversation_ai_runs(org_id: str, client_phone: str, limit: int = 20) -> list[dict]:
    with engine.connect() as conn:
        return [dict(row) for row in conn.execute(text("""
          select id,response_mode,outcome,intent,confidence,risk_level,reason,
                 source_ids,draft_id,outbound_message_id,created_at
          from pilot_inbox_ai_runs
          where org_id=:org_id and client_phone=:phone
          order by created_at desc limit :limit
        """), {"org_id": org_id, "phone": client_phone, "limit": min(limit, 50)}).mappings()]
