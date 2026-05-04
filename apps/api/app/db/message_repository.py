import json
from sqlalchemy import text
from app.db.database import engine


def insert_raw_message(
    org_id: str,
    phone: str,
    text_msg: str,
    payload: dict,
    client_id: str,
    dossier_id: str,
):
    with engine.connect() as conn:
        conn.execute(
            text("""
                insert into messages_raw (
                    org_id,
                    sender_phone,
                    message_text,
                    raw_payload,
                    client_id,
                    dossier_id
                )
                values (
                    :org_id,
                    :phone,
                    :text_msg,
                    CAST(:payload AS jsonb),
                    :client_id,
                    :dossier_id
                )
            """),
            {
                "org_id": org_id,
                "phone": phone,
                "text_msg": text_msg,
                "payload": json.dumps(payload),
                "client_id": client_id,
                "dossier_id": dossier_id,
            },
        )

        conn.commit()

def get_or_create_client(org_id: str, phone: str):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                select id
                from clients
                where org_id = :org_id
                  and phone = :phone
                limit 1
            """),
            {
                "org_id": org_id,
                "phone": phone,
            },
        ).fetchone()

        if result:
            return result[0]

        result = conn.execute(
            text("""
                insert into clients (org_id, phone)
                values (:org_id, :phone)
                returning id
            """),
            {
                "org_id": org_id,
                "phone": phone,
            },
        )

        conn.commit()

        return result.fetchone()[0]
    
def get_or_create_active_dossier(org_id: str, client_id: str):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                select id
                from dossiers
                where org_id = :org_id
                  and client_id = :client_id
                  and status_global not in ('COMPLETED', 'CLOSED', 'CANCELLED')
                order by created_at desc
                limit 1
            """),
            {
                "org_id": org_id,
                "client_id": client_id,
            },
        ).fetchone()

        if result:
            return result[0]

        result = conn.execute(
            text("""
                insert into dossiers (
                    org_id,
                    client_id,
                    case_type,
                    status_global,
                    intake_status,
                    validation_status,
                    primary_channel
                )
                values (
                    :org_id,
                    :client_id,
                    'UNKNOWN',
                    'LEAD',
                    'PARTIAL',
                    'PENDING',
                    'whatsapp'
                )
                returning id
            """),
            {
                "org_id": org_id,
                "client_id": client_id,
            },
        )

        conn.commit()

        return result.fetchone()[0]
    
def create_dossier_event(
    org_id: str,
    dossier_id: str,
    event_type: str,
    payload: dict,
):
    with engine.connect() as conn:
        conn.execute(
            text("""
                insert into dossier_events (
                    org_id,
                    dossier_id,
                    event_type,
                    payload
                )
                values (
                    :org_id,
                    :dossier_id,
                    :event_type,
                    CAST(:payload AS jsonb)
                )
            """),
            {
                "org_id": org_id,
                "dossier_id": dossier_id,
                "event_type": event_type,
                "payload": json.dumps(payload),
            },
        )

        conn.commit()

def update_dossier_from_intent(org_id: str, dossier_id: str, intent: str):
    case_type = None
    status_global = None

    if intent == "SEND_CARGO_REQUEST":
        case_type = "SEND_CARGO"
        status_global = "PARTIAL"

    elif intent == "TRANSITAIRE_REQUEST":
        case_type = "TRANSITAIRE"
        status_global = "PARTIAL"

    elif intent == "PRICE_REQUEST":
        case_type = "PRICE_INQUIRY"
        status_global = "LEAD"

    elif intent == "TRACKING_REQUEST":
        case_type = "TRACKING_SUPPORT"
        status_global = "ACTIVE"

    elif intent == "WAREHOUSE_ADDRESS_REQUEST":
        case_type = "INFO_REQUEST"
        status_global = "LEAD"

    elif intent == "DEPARTURE_SCHEDULE_REQUEST":
        case_type = "INFO_REQUEST"
        status_global = "LEAD"

    elif intent == "HUMAN_HELP_REQUEST":
        case_type = "SUPPORT"
        status_global = "NEEDS_HUMAN"

    elif intent == "GREETING":
        case_type = "GENERAL_CONVERSATION"
        status_global = "LEAD"

    else:
        return None

    fields = []
    params = {
        "org_id": org_id,
        "dossier_id": dossier_id,
    }

    if case_type:
        fields.append("case_type = :case_type")
        params["case_type"] = case_type

    if status_global:
        fields.append("status_global = :status_global")
        params["status_global"] = status_global

    fields.append("updated_at = now()")

    query = text(f"""
        update dossiers
        set {", ".join(fields)}
        where org_id = :org_id
          and id = :dossier_id
        returning id, case_type, status_global, intake_status, validation_status
    """)

    with engine.connect() as conn:
        result = conn.execute(query, params).fetchone()
        conn.commit()

        if not result:
            return None

        return {
            "id": result[0],
            "case_type": result[1],
            "status_global": result[2],
            "intake_status": result[3],
            "validation_status": result[4],
        }

def get_organization(org_id: str):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                select id, name, country, city
                from organizations
                where id = :org_id
                limit 1
            """),
            {"org_id": org_id}
        ).fetchone()

        if not result:
            return None

        return {
            "id": result[0],
            "name": result[1],
            "country": result[2],
            "city": result[3],
        }

def update_dossier_from_ai_fields(org_id: str, dossier_id: str, fields: dict):
    if not fields:
        return None

    query = """
        update dossiers
        set
            origin_country = coalesce(:origin_country, origin_country),
            origin_city = coalesce(:origin_city, origin_city),
            destination_country = coalesce(:destination_country, destination_country),
            destination_city = coalesce(:destination_city, destination_city),
            goods_type = coalesce(:goods_type, goods_type),
            estimated_weight_kg = coalesce(:estimated_weight_kg, estimated_weight_kg),
            estimated_volume_cbm = coalesce(:estimated_volume_cbm, estimated_volume_cbm),
            shipping_mode = coalesce(:shipping_mode, shipping_mode),
            tracking_id = coalesce(:tracking_id, tracking_id),
            supplier_payment_amount = coalesce(:supplier_payment_amount, supplier_payment_amount),
            supplier_payment_currency = coalesce(:supplier_payment_currency, supplier_payment_currency)
        where id = :dossier_id and org_id = :org_id
        returning *
    """

    with engine.connect() as conn:
        result = conn.execute(
            text(query),
            {
                "dossier_id": dossier_id,
                "org_id": org_id,
                **fields,
            },
        )

        conn.commit()

        row = result.fetchone()
        return dict(row._mapping) if row else None
    
def get_dossier_full(org_id: str, dossier_id: str):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                select *
                from dossiers
                where id = :dossier_id and org_id = :org_id
                limit 1
            """),
            {"dossier_id": dossier_id, "org_id": org_id}
        ).fetchone()

        if not result:
            return None

        return dict(result._mapping)
    
def update_dossier_from_action(org_id: str, dossier_id: str, action: dict):
    action_type = action.get("action_type")

    intake_status = None
    validation_status = None

    # mapping métier
    if action_type in [
        "CONTINUE_SHIPPING_INTAKE",
        "CONTINUE_TRANSITAIRE_INTAKE",
        "CONTINUE_SUPPLIER_PAYMENT_INTAKE",
        "CHECK_PRICING_REQUIREMENTS",
        "ASK_CLARIFICATION",
    ]:
        intake_status = "PARTIAL"

    if action_type in [
        "READY_FOR_SHIPPING_REVIEW",
        "READY_FOR_TRANSITAIRE_REVIEW",
        "READY_FOR_SUPPLIER_PAYMENT_REVIEW",
    ]:
        intake_status = "COMPLETE"
        validation_status = "READY_FOR_REVIEW"

    if action_type == "ESCALATE_TO_HUMAN":
        validation_status = "NEEDS_HUMAN"

    query = """
        update dossiers
        set
            intake_status = coalesce(:intake_status, intake_status),
            validation_status = coalesce(:validation_status, validation_status)
        where id = :dossier_id and org_id = :org_id
        returning *
    """

    with engine.connect() as conn:
        result = conn.execute(
            text(query),
            {
                "dossier_id": dossier_id,
                "org_id": org_id,
                "intake_status": intake_status,
                "validation_status": validation_status,
            },
        )

        conn.commit()

        row = result.fetchone()
        return dict(row._mapping) if row else None
    
def update_dossier_pricing(
    org_id: str,
    dossier_id: str,
    origin_country: str | None,
    destination_country: str | None,
    weight_kg: float | None,
    quoted_total: float | None,
    quoted_currency: str | None,
    pricing_status: str,
):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                update dossiers
                set
                    origin_country = coalesce(:origin_country, origin_country),
                    destination_country = coalesce(:destination_country, destination_country),
                    estimated_weight_kg = coalesce(:weight_kg, estimated_weight_kg),
                    quoted_total = :quoted_total,
                    quoted_currency = :quoted_currency,
                    pricing_status = :pricing_status,
                    updated_at = now()
                where id = :dossier_id
                  and org_id = :org_id
                returning *
            """),
            {
                "org_id": org_id,
                "dossier_id": dossier_id,
                "origin_country": origin_country,
                "destination_country": destination_country,
                "weight_kg": weight_kg,
                "quoted_total": quoted_total,
                "quoted_currency": quoted_currency,
                "pricing_status": pricing_status,
            },
        )

        conn.commit()
        row = result.fetchone()

        return dict(row._mapping) if row else None
    
def mark_dossier_confirmed(org_id: str, dossier_id: str):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                update dossiers
                set
                    validation_status = 'CONFIRMED_BY_CLIENT',
                    intake_status = 'PARTIAL',
                    updated_at = now()
                where id = :dossier_id
                  and org_id = :org_id
                returning *
            """),
            {
                "org_id": org_id,
                "dossier_id": dossier_id,
            },
        )

        conn.commit()
        row = result.fetchone()

        return dict(row._mapping) if row else None
    
def update_dossier_intake_fields(
    org_id: str,
    dossier_id: str,
    fields: dict,
):
    if not fields:
        return None

    with engine.connect() as conn:
        result = conn.execute(
            text("""
                update dossiers
                set
                    client_full_name = coalesce(:client_full_name, client_full_name),
                    destination_country = coalesce(:destination_country, destination_country),
                    destination_city = coalesce(:destination_city, destination_city),
                    shipping_mode = coalesce(:shipping_mode, shipping_mode),
                    goods_type = coalesce(:goods_type, goods_type),
                    updated_at = now()
                where id = :dossier_id
                  and org_id = :org_id
                returning *
            """),
            {
                "org_id": org_id,
                "dossier_id": dossier_id,
                "client_full_name": fields.get("client_full_name"),
                "destination_country": fields.get("destination_country"),
                "destination_city": fields.get("destination_city"),
                "shipping_mode": fields.get("shipping_mode"),
                "goods_type": fields.get("goods_type"),
            },
        )

        conn.commit()
        row = result.fetchone()

        return dict(row._mapping) if row else None
    
def mark_dossier_intake_complete(org_id: str, dossier_id: str):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                update dossiers
                set
                    intake_status = 'COMPLETE',
                    updated_at = now()
                where id = :dossier_id
                  and org_id = :org_id
                returning *
            """),
            {
                "org_id": org_id,
                "dossier_id": dossier_id,
            },
        )

        conn.commit()
        row = result.fetchone()

        return dict(row._mapping) if row else None