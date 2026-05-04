import uuid
from sqlalchemy import text
from app.db.database import engine


def generate_tracking_id():
    return "SLAIVO-" + str(uuid.uuid4())[:8].upper()


def create_shipment(
    org_id: str,
    dossier: dict,
):
    tracking_id = generate_tracking_id()

    with engine.connect() as conn:
        result = conn.execute(
            text("""
                insert into shipments (
                    org_id,
                    dossier_id,
                    client_id,
                    tracking_id,

                    origin_country,
                    origin_city,
                    destination_country,
                    destination_city,

                    goods_type,
                    weight_kg,
                    volume_cbm,
                    shipping_mode
                )
                values (
                    :org_id,
                    :dossier_id,
                    :client_id,
                    :tracking_id,

                    :origin_country,
                    :origin_city,
                    :destination_country,
                    :destination_city,

                    :goods_type,
                    :weight_kg,
                    :volume_cbm,
                    :shipping_mode
                )
                returning *
            """),
            {
                "org_id": org_id,
                "dossier_id": dossier["id"],
                "client_id": dossier["client_id"],
                "tracking_id": tracking_id,

                "origin_country": dossier.get("origin_country"),
                "origin_city": dossier.get("origin_city"),
                "destination_country": dossier.get("destination_country"),
                "destination_city": dossier.get("destination_city"),

                "goods_type": dossier.get("goods_type"),
                "weight_kg": dossier.get("estimated_weight_kg"),
                "volume_cbm": dossier.get("estimated_volume_cbm"),
                "shipping_mode": dossier.get("shipping_mode"),
            },
        )

        conn.commit()

        row = result.fetchone()

        return dict(row._mapping)