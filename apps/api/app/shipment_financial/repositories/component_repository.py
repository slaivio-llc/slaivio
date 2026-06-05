from sqlalchemy import text

from app.db.database import engine
from app.financial.repositories.json_utils import to_jsonb


def create_shipment_financial_component(
    org_id: str,
    shipment_id: str,
    component_type: str,
    component_code: str,
    amount_minor: int,
    currency_code: str = "USD",
    description: str | None = None,
    metadata: dict | None = None,
):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                insert into shipment_financial_components (
                    org_id,
                    shipment_id,
                    component_type,
                    component_code,
                    component_name,
                    amount_minor,
                    currency_code,
                    metadata
                )
                values (
                    :org_id,
                    :shipment_id,
                    :component_type,
                    :component_code,
                    :component_name,
                    :amount_minor,
                    :currency_code,
                    cast(:metadata as jsonb)
                )
                returning *
            """),
            {
                "org_id": org_id,
                "shipment_id": shipment_id,
                "component_type": component_type,
                "component_code": component_code,
                "component_name": description or component_code,
                "amount_minor": amount_minor,
                "currency_code": currency_code,
                "metadata": to_jsonb(metadata),
            },
        ).fetchone()

        conn.commit()

        return dict(row._mapping) if row else None


def list_shipment_financial_components(
    shipment_id: str,
):
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                select *
                from shipment_financial_components
                where shipment_id = :shipment_id
                order by created_at asc
            """),
            {
                "shipment_id": shipment_id,
            },
        ).fetchall()

        return [dict(row._mapping) for row in rows]
