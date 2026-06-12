from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import text

from app.billing.repositories.plan_repository import list_pricing_plans
from app.db.database import engine


router = APIRouter()


class DemoRequest(BaseModel):
    full_name: str
    email: str
    agency_name: str | None = None
    phone: str | None = None
    country: str | None = None
    monthly_shipments: str | None = None
    message: str | None = None


class TrialLeadRequest(BaseModel):
    email: str
    agency_name: str | None = None


def _fetch_landing_metrics():
    try:
        with engine.connect() as conn:
            rows = conn.execute(
                text("""
                    select
                        metric_key,
                        metric_label,
                        metric_value
                    from landing_metrics
                    where is_active = true
                    order by display_order asc, metric_label asc
                """),
            ).fetchall()
    except Exception:
        return []

    return [dict(row._mapping) for row in rows]


def _fetch_testimonials():
    try:
        with engine.connect() as conn:
            rows = conn.execute(
                text("""
                    select
                        agency_name,
                        country,
                        owner_name,
                        quote
                    from landing_testimonials
                    where is_active = true
                    order by display_order asc, created_at desc
                """),
            ).fetchall()
    except Exception:
        return []

    return [dict(row._mapping) for row in rows]


def _fetch_pricing():
    try:
        return list_pricing_plans()
    except Exception:
        return []


@router.get("/public/landing")
def get_public_landing():
    return {
        "status": "ok",
        "metrics": _fetch_landing_metrics(),
        "pricing": _fetch_pricing(),
        "testimonials": _fetch_testimonials(),
    }


@router.post("/public/demo-requests")
def create_demo_request(body: DemoRequest):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                insert into landing_demo_requests (
                    full_name,
                    email,
                    agency_name,
                    phone,
                    country,
                    monthly_shipments,
                    message
                )
                values (
                    :full_name,
                    :email,
                    :agency_name,
                    :phone,
                    :country,
                    :monthly_shipments,
                    :message
                )
                returning *
            """),
            body.model_dump(),
        ).fetchone()
        conn.commit()

    return {
        "status": "ok",
        "demo_request": dict(row._mapping),
    }


@router.post("/public/trial-leads")
def create_trial_lead(body: TrialLeadRequest):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                insert into landing_trial_leads (
                    email,
                    agency_name
                )
                values (
                    :email,
                    :agency_name
                )
                returning *
            """),
            body.model_dump(),
        ).fetchone()
        conn.commit()

    return {
        "status": "ok",
        "trial_lead": dict(row._mapping),
        "redirect_url": "/sign-up",
    }
