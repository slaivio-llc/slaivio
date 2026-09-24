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
          select assignment.org_id, assignment.client_id, assignment.dossier_id,
                 coalesce(client.display_name, client.name) client_name,
                 client.preferred_language,
                 client.client_reference,
                 dossier.dossier_reference, dossier.title dossier_title,
                 organization.name organization_name,
                 message.id source_message_id,
                 message.text_body source_message,
                 message.sender_jid source_sender_jid,
                 message.created_at source_message_at
          from conversation_assignments assignment
          join organizations organization on organization.id=assignment.org_id
          left join clients client
            on client.org_id=assignment.org_id and client.id=assignment.client_id
          left join dossiers dossier
            on dossier.org_id=assignment.org_id and dossier.id=assignment.dossier_id
          left join lateral (
            select candidate.id, candidate.text_body, candidate.sender_jid, candidate.created_at
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


def parcel_operational_knowledge(org_id: str) -> list[dict]:
    """Expose active parcel configuration as customer-safe grounding sources.

    These records are maintained by the agency and are authoritative in the
    same way as published knowledge, without copying them into free-text
    knowledge entries that could become stale.
    """
    with engine.connect() as conn:
        is_parcel = conn.execute(text("""
          select organization_type='PARCEL_FREIGHT'
          from organizations where id=:org_id
        """), {"org_id": org_id}).scalar()
        if not is_parcel:
            return []
        sources: list[dict] = []
        locations = conn.execute(text("""
          select location.id::text,location.name,location.location_type,
                 location.country,location.city,location.address,
                 coalesce(nullif(location.whatsapp,''),nullif(location.phone,'')) contact,
                 (select string_agg(concat(contact.label, ': ', contact.contact_value), '; ' order by contact.is_primary desc,contact.label)
                    from organization_location_contacts contact
                   where contact.org_id=location.org_id and contact.location_id=location.id and contact.active) additional_contacts,
                 opening_hours,services,updated_at
          from organization_locations location
          where location.org_id=:org_id and location.status='ACTIVE'
          order by location.name limit 40
        """), {"org_id": org_id}).mappings().all()
        for item in locations:
            content = "; ".join(filter(None, [
                f"Bureau ou site: {item['name']}",
                f"Type: {str(item['location_type']).replace('_', ' ').lower()}",
                f"Adresse: {item.get('address')}" if item.get('address') else None,
                f"Ville: {item.get('city')}" if item.get('city') else None,
                f"Pays: {item.get('country')}" if item.get('country') else None,
                f"Contact: {item.get('contact')}" if item.get('contact') else None,
                f"Autres contacts: {item.get('additional_contacts')}" if item.get('additional_contacts') else None,
                f"Services: {', '.join(item.get('services') or [])}" if item.get('services') else None,
            ]))
            sources.append({"id": f"location:{item['id']}", "title": item["name"], "content": content,
                            "matched_content": content, "updated_at": item.get("updated_at"), "rank": 1.0,
                            "source_kind": "OPERATIONAL"})
        services = conn.execute(text("""
          select service.id::text,service.service_name,service.shipping_mode,
                 service.service_type,service.eta_min_days,service.eta_max_days,
                 service.currency_code,route.route_name,route.origin_country,
                 route.origin_city,route.destination_country,route.destination_city,
                 rate.goods_label,rate.goods_category,rate.billing_unit,
                 rate.amount_minor,rate.currency_code rate_currency,rate.express,
                 greatest(service.updated_at,rate.updated_at) updated_at
          from shipping_services service
          join shipping_routes route on route.id=service.route_id and route.org_id=service.org_id
          left join service_goods_rates rate on rate.shipping_service_id=service.id
            and rate.org_id=service.org_id and rate.active and rate.effective_from<=now()
            and (rate.effective_until is null or rate.effective_until>now())
          where service.org_id=:org_id and service.active and route.archived_at is null
            and route.active and coalesce(route.public_visible,true)
          order by route.route_name,service.priority,rate.goods_label
          limit 200
        """), {"org_id": org_id}).mappings().all()
        grouped: dict[str, dict] = {}
        for item in services:
            source = grouped.setdefault(item["id"], {
                "id": f"service:{item['id']}", "title": item["service_name"], "lines": [],
                "updated_at": item.get("updated_at"), "rank": 1.0, "source_kind": "OPERATIONAL",
            })
            if not source["lines"]:
                origin = ", ".join(filter(None, [item.get("origin_city"), item.get("origin_country")]))
                destination = ", ".join(filter(None, [item.get("destination_city"), item.get("destination_country")]))
                source["lines"].append(
                    f"Service: {item['service_name']}; route: {origin} vers {destination}; "
                    f"voie: {item['shipping_mode']}; délai annoncé: {item['eta_min_days']} à {item['eta_max_days']} jours."
                )
            if item.get("goods_label"):
                amount = float(item["amount_minor"] or 0) / 100
                source["lines"].append(
                    f"{item['goods_label']}: {amount:g} {item.get('rate_currency') or item.get('currency_code')} "
                    f"par {str(item['billing_unit']).lower()}{'; express' if item.get('express') else ''}."
                )
        for source in grouped.values():
            content = "\n".join(source.pop("lines"))
            source.update(content=content, matched_content=content)
            sources.append(source)

        departures = conn.execute(text("""
          select departure.id::text,departure.departure_code,departure.scheduled_at,
                 departure.cutoff_at,departure.estimated_arrival_at,departure.status,
                 service.service_name,service.shipping_mode,route.route_name,
                 route.origin_country,route.origin_city,route.destination_country,
                 route.destination_city,departure.updated_at
          from cargo_departures departure
          join shipping_services service on service.id=departure.shipping_service_id
            and service.org_id=departure.org_id
          left join shipping_routes route on route.id=service.route_id
            and route.org_id=service.org_id
          where departure.org_id=:org_id and departure.published
            and departure.status in ('OPEN','PLANNED','PENDING_CONFIRMATION','CONFIRMED')
            and departure.scheduled_at>=now()
          order by departure.scheduled_at limit 30
        """), {"org_id": org_id}).mappings().all()
        for item in departures:
            origin = ", ".join(filter(None, [item.get("origin_city"), item.get("origin_country")]))
            destination = ", ".join(filter(None, [item.get("destination_city"), item.get("destination_country")]))
            content = "; ".join(filter(None, [
                f"Prochain départ publié: {item['departure_code']}",
                f"Service: {item.get('service_name')}" if item.get("service_name") else None,
                f"Route: {origin} vers {destination}" if origin or destination else item.get("route_name"),
                f"Mode: {item.get('shipping_mode')}" if item.get("shipping_mode") else None,
                f"Départ prévu: {item['scheduled_at'].isoformat()}",
                f"Date limite de dépôt: {item['cutoff_at'].isoformat()}" if item.get("cutoff_at") else None,
                f"Arrivée estimée: {item['estimated_arrival_at'].isoformat()}" if item.get("estimated_arrival_at") else None,
            ]))
            sources.append({"id": f"departure:{item['id']}", "title": f"Départ {item['departure_code']}",
                            "content": content, "matched_content": content,
                            "updated_at": item.get("updated_at"), "rank": 1.0,
                            "source_kind": "OPERATIONAL"})

        payment_methods = conn.execute(text("""
          select id::text,display_name,method_type,provider,created_at
          from payment_methods
          where org_id=:org_id and is_active
          order by display_name limit 30
        """), {"org_id": org_id}).mappings().all()
        if payment_methods:
            labels = [str(item.get("display_name") or item.get("method_type") or item.get("provider"))
                      for item in payment_methods]
            content = "Moyens de paiement acceptés par l’agence: " + ", ".join(labels) + "."
            sources.append({"id": "payment-methods", "title": "Modalités de paiement",
                            "content": content, "matched_content": content,
                            "updated_at": max((item.get("created_at") for item in payment_methods), default=None),
                            "rank": 1.0, "source_kind": "OPERATIONAL"})
        return sources


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
