import json
import re
from uuid import UUID

from sqlalchemy import text

from app.db.database import engine
from app.ai.repositories.customer_profile import known_profile


DEFAULT_MODE = "SUGGESTION_ONLY"


def get_pilot_ai_settings(org_id: str) -> dict:
    with engine.begin() as conn:
        conn.execute(text("insert into ai_settings(org_id) values(:org_id) on conflict(org_id) do nothing"), {"org_id": org_id})
        row = conn.execute(text("""
          select settings.enabled, settings.provider, settings.model_name, settings.temperature, settings.max_tokens,
                 auto_reply_min_confidence, pilot_response_mode,system_prompt,
                 user_prompt_template,communication_style,prompt_row_version,
                 pilot_require_published_knowledge,pilot_handoff_to_human,
                 pilot_use_organization_name,auto_create_qualified_whatsapp_clients,customer_intake_enabled, settings.updated_at,
                 organization.name organization_name
          from ai_settings settings
          join organizations organization on organization.id=settings.org_id
          where settings.org_id=:org_id
        """), {"org_id": org_id}).mappings().one()
        return dict(row)


def update_qualified_prospect_auto_create(org_id: str, enabled: bool, actor_id: str) -> dict:
    with engine.begin() as conn:
        conn.execute(text("insert into ai_settings(org_id) values(:org_id) on conflict(org_id) do nothing"), {"org_id": org_id})
        row = conn.execute(text("""
          update ai_settings
          set auto_create_qualified_whatsapp_clients=:enabled,
              pilot_updated_by=:actor_id,updated_at=now()
          where org_id=:org_id
          returning auto_create_qualified_whatsapp_clients,pilot_updated_by,updated_at
        """), {"org_id": org_id, "enabled": enabled, "actor_id": actor_id}).mappings().one()
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


def latest_inbound_message_id(org_id: str, client_phone: str) -> str | None:
    with engine.connect() as conn:
        return conn.execute(text("""select id::text from messages
          where org_id=:org_id and from_phone=:phone and direction='inbound'
          order by created_at desc limit 1"""), {"org_id": org_id, "phone": client_phone}).scalar()


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
                 message.message_type source_message_type,
                 message.media_analysis_status source_media_analysis_status,
                 message.provider source_provider,
                 message.sender_jid source_sender_jid,
                 message.created_at source_message_at
          from conversation_assignments assignment
          join organizations organization on organization.id=assignment.org_id
          left join clients client
            on client.org_id=assignment.org_id and client.id=assignment.client_id
          left join dossiers dossier
            on dossier.org_id=assignment.org_id and dossier.id=assignment.dossier_id
          left join lateral (
            select candidate.id,
              concat_ws(E'\n',nullif(candidate.text_body,''),
                case when candidate.media_analysis_status='COMPLETED'
                then '[Contenu fourni par le client, extrait automatiquement du média ; à confirmer] ' || candidate.media_analysis_text end) text_body,
              candidate.sender_jid,candidate.created_at,candidate.message_type,
              candidate.media_analysis_status,candidate.provider
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
        context['customer_profile'] = known_profile(org_id, client_phone, connection=conn)
        journey = conn.execute(text('''select full_name,country,city,customer_type,stage
            from parcel_customer_journeys where org_id=:org and conversation_phone=:phone'''),
            {'org':org_id,'phone':client_phone}).mappings().first()
        context['customer_journey'] = dict(journey or {})
        context["client_finance_access"] = False
        context["recent_messages"] = [dict(item) for item in conn.execute(text("""
          select direction, text_body, created_at, message_type
          from (
            select direction,
              concat_ws(E'\n',nullif(text_body,''),case when media_analysis_status='COMPLETED'
                then '[Média du client, extraction automatique] ' || media_analysis_text end) text_body,
              created_at,message_type
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
        # Capability URLs remain in the private message history, but the AI
        # provider does not need their bearer secret to understand the exchange.
        secret_link = re.compile(r'https?://[^\s<>]+/prepare-shipment#[A-Za-z0-9_-]{43}')
        if context.get('source_message'):
            context['source_message'] = secret_link.sub('[lien privé de préparation d’envoi]', context['source_message'])
        for message in context.get('recent_messages') or []:
            if message.get('text_body'):
                message['text_body'] = secret_link.sub('[lien privé de préparation d’envoi]', message['text_body'])
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
                f"Horaires: {json.dumps(item['opening_hours'], ensure_ascii=False, default=str)}" if item.get('opening_hours') else None,
                f"Services: {', '.join(item.get('services') or [])}" if item.get('services') else None,
            ]))
            sources.append({"id": f"location:{item['id']}", "title": item["name"], "content": content,
                            "matched_content": content, "updated_at": item.get("updated_at"), "rank": 1.0,
                            "source_kind": "OPERATIONAL"})
        services = conn.execute(text("""
          select service.id::text,service.service_name,service.shipping_mode,
                 service.service_type,service.public_description,
                 coalesce(public_offering.eta_min_days,service.eta_min_days,route.eta_min_days) eta_min_days,
                 coalesce(public_offering.eta_max_days,service.eta_max_days,route.eta_max_days) eta_max_days,
                 service.currency_code,route.id::text route_id,route.route_name,route.origin_country,
                 route.origin_city,route.destination_country,route.destination_city,
                 rate.goods_label,rate.goods_category,rate.billing_unit,
                 rate.amount_minor,rate.currency_code rate_currency,rate.express,
                 greatest(service.updated_at,rate.updated_at) updated_at
          from shipping_services service
          join shipping_routes route on route.org_id=service.org_id and (
            route.id=service.route_id or exists (
              select 1 from service_route_offerings offering
              where offering.org_id=service.org_id and offering.service_id=service.id
                and offering.route_id=route.id and offering.availability in ('AVAILABLE','LIMITED')
                and offering.public_visible
                and offering.effective_from<=now()
                and (offering.effective_until is null or offering.effective_until>now())
            )
          )
          left join lateral (
            select offering.eta_min_days,offering.eta_max_days from service_route_offerings offering
            where offering.org_id=service.org_id and offering.service_id=service.id and offering.route_id=route.id
              and offering.public_visible and offering.availability in ('AVAILABLE','LIMITED')
              and offering.effective_from<=now() and (offering.effective_until is null or offering.effective_until>now())
            order by offering.updated_at desc limit 1
          ) public_offering on true
          left join service_goods_rates rate on rate.shipping_service_id=service.id and route.id=service.route_id
            and rate.org_id=service.org_id and rate.active and rate.effective_from<=now()
            and (rate.effective_until is null or rate.effective_until>now())
          where service.org_id=:org_id and service.active and service.public_visible
            and service.status in ('ACTIVE','LIMITED') and service.archived_at is null
            and service.availability in ('AVAILABLE','LIMITED','QUOTE_ONLY')
            and route.archived_at is null
            and route.active and coalesce(route.public_visible,true)
          order by route.route_name,service.priority,rate.goods_label
          limit 200
        """), {"org_id": org_id}).mappings().all()
        grouped: dict[tuple, dict] = {}
        for item in services:
            source = grouped.setdefault((item["id"], item["route_id"]), {
                "id": f"service:{item['id']}:{item['route_id']}", "title": f"{item['service_name']} · {item['route_name']}", "lines": [],
                "updated_at": item.get("updated_at"), "rank": 1.0, "source_kind": "OPERATIONAL",
            })
            if not source["lines"]:
                origin = ", ".join(filter(None, [item.get("origin_city"), item.get("origin_country")]))
                destination = ", ".join(filter(None, [item.get("destination_city"), item.get("destination_country")]))
                minimum, maximum = item.get('eta_min_days'), item.get('eta_max_days')
                delay = (f"{minimum} à {maximum} jours" if minimum is not None and maximum is not None else
                         f"à partir de {minimum} jours" if minimum is not None else
                         f"jusqu’à {maximum} jours" if maximum is not None else "à confirmer auprès de l’agence")
                source["lines"].append(
                    f"Service: {item['service_name']}; route: {origin} vers {destination}; "
                    f"voie: {item['shipping_mode']}; délai annoncé: {delay}."
                )
                if item.get('public_description'):
                    source["lines"].append(f"Informations clients: {item['public_description']}")
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

        # Only explicitly public, effective, general base prices. Conditional,
        # negotiated and client-specific rules still require an actual quote.
        public_prices = conn.execute(text("""
          select grid.id::text,service.service_name,route.route_name,
                 rule.amount::text amount,coalesce(rule.calculation_method,grid.calculation_method) method,
                 grid.currency_code,rule.conditions,grid.minimum_billable_amount,grid.updated_at
          from pricing_grids grid
          join shipping_services service on service.id=grid.shipping_service_id and service.org_id=grid.org_id
          join shipping_routes route on route.id=grid.route_id and route.org_id=grid.org_id
          join pricing_grid_rules rule on rule.grid_id=grid.id and rule.org_id=grid.org_id
          where grid.org_id=:org_id and grid.status='ACTIVE' and grid.visibility='PUBLIC'
            and grid.archived_at is null and grid.effective_from<=now()
            and (grid.effective_until is null or grid.effective_until>now())
            and (not grid.requires_approval or grid.approved_at is not null)
            and service.public_visible and service.active and service.archived_at is null
            and service.status in ('ACTIVE','LIMITED') and service.availability in ('AVAILABLE','LIMITED') and not service.quote_only
            and route.active and route.archived_at is null and coalesce(route.public_visible,true)
            and rule.active and rule.action_type='SET_PRICE' and rule.amount is not null
            and (select count(*) from pricing_grid_rules candidate
                 where candidate.org_id=grid.org_id and candidate.grid_id=grid.id
                   and candidate.active and candidate.action_type='SET_PRICE')=1
            and rule.effective_from<=now() and (rule.effective_until is null or rule.effective_until>now())
            and rule.client_id is null and rule.client_segment is null and rule.category_id is null
            and rule.office_id is null and rule.warehouse_id is null
            and (rule.conditions - array['category_code','package_type'])='{}'::jsonb
            and rule.min_weight_kg is null and rule.max_weight_kg is null
            and rule.min_cbm is null and rule.max_cbm is null and rule.min_value is null and rule.max_value is null
            and rule.min_units is null and rule.max_units is null
            and grid.minimum_weight_kg is null and grid.minimum_cbm is null
            and grid.maximum_weight_kg is null and grid.maximum_cbm is null and grid.maximum_declared_value is null
            and coalesce(rule.calculation_method,grid.calculation_method) in ('PER_KG','PER_CBM','PER_PACKAGE','PER_UNIT','FIXED')
          order by grid.updated_at desc limit 40
        """), {"org_id": org_id}).mappings().all()
        units = {'PER_KG': 'par kilogramme facturable', 'PER_CBM': 'par mètre cube',
                 'PER_PACKAGE': 'par colis', 'PER_UNIT': 'par unité', 'FIXED': 'montant de base fixe'}
        for item in public_prices:
            conditions = item.get('conditions') or {}
            # Only the published category/packaging conditions are rendered;
            # unknown formats are not usable as a customer-facing price.
            categories = {'ORDINARY_GOODS':'marchandise ordinaire','TEXTILES':'vêtements et textiles',
                          'SENSITIVE_GOODS':'marchandise sensible','DANGEROUS_GOODS':'marchandise dangereuse',
                          'FRAGILE':'fragile','ELECTRONICS':'électronique','BATTERY':'batterie','LIQUID':'liquide',
                          'FOOD':'alimentaire','PHARMACEUTICAL':'pharmaceutique','HIGH_VALUE':'haute valeur'}
            packaging = {'carton':'carton','sac':'sac','caisse':'caisse','palette':'palette',
                         'document':'document','lot':'lot','other':'autre conditionnement'}
            if not isinstance(conditions, dict):
                continue
            category, package = conditions.get('category_code'), conditions.get('package_type')
            if (category is not None and (not isinstance(category, str) or category not in categories)) or (package is not None and (not isinstance(package, str) or package not in packaging)):
                continue
            content = (f"Tarif de base public: {item['service_name']}; route: {item['route_name']}; "
                       f"{item['amount']} {item['currency_code']} {units[item['method']]}. "
                       "Ce prix de base n’est pas un devis total. Les frais, taxes et conditions applicables doivent être confirmés par l’agence.")
            if conditions.get('category_code'):
                content += f" Applicable uniquement à la catégorie: {categories[conditions['category_code']]}."
            if conditions.get('package_type'):
                content += f" Applicable uniquement au conditionnement: {packaging[conditions['package_type']]}."
            if item.get('minimum_billable_amount') is not None:
                content += f" Minimum de facturation: {item['minimum_billable_amount']} {item['currency_code']}."
            sources.append({'id': f"public-price:{item['id']}", 'title': f"Tarif public · {item['service_name']}",
                            'content': content, 'matched_content': content, 'updated_at': item.get('updated_at'),
                            'rank': 1.0, 'source_kind': 'OPERATIONAL'})

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
    # Knowledge IDs are UUIDs; live operational sources use namespaced IDs.
    # Preserve provenance without attempting to cast service:/location: to uuid[].
    knowledge_ids = []
    operational_ids = []
    for source_id in source_ids or []:
        try:
            knowledge_ids.append(str(UUID(str(source_id))))
        except ValueError:
            operational_ids.append(str(source_id))
    audit_metadata = dict(metadata or {})
    if operational_ids:
        audit_metadata["operational_source_ids"] = operational_ids
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
            "source_ids": knowledge_ids, "draft_id": draft_id,
            "outbound_message_id": outbound_message_id,
            "metadata": json.dumps(audit_metadata, default=str),
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
