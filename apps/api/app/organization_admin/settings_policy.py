"""Validated agency policies shared by settings and operational commands."""
from decimal import Decimal
from typing import Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field, StrictBool
from sqlalchemy import text
from app.customer_automation.policy import CustomerAutomation


class Policy(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class ReceiptRules(Policy):
    category_required: StrictBool = True
    packaging_required: StrictBool = True
    allow_unmeasured: StrictBool = True
    allow_photos: StrictBool = True
    auto_rate_lookup: StrictBool = True


class DeliveryRules(Policy):
    delivery_proof: StrictBool = True
    arrival_notice: StrictBool = True
    pickup_delay_days: int = Field(default=14, ge=0, le=365, strict=True)


class GoodsRestrictions(Policy):
    regulated_goods_check: StrictBool = True
    agent_instructions: str = Field(default="", max_length=2000)


class ClientConditions(Policy):
    allow_customer_credit: StrictBool = False


class DocumentPreferences(Policy):
    label_format: Literal["THERMAL_100_150", "THERMAL_100_100", "A4"] = "THERMAL_100_150"
    show_agency_logo: StrictBool = True
    show_office_details: StrictBool = True
    invoice_layout: Literal['CLASSIC','COMPACT'] = 'CLASSIC'
    invoice_accent_color: str = Field(default='#20272e',pattern=r'^#[0-9a-fA-F]{6}$')
    invoice_title: str = Field(default='Facture',min_length=1,max_length=80)
    invoice_footer: str = Field(default='',max_length=2000)
    show_client_phone: StrictBool = True
    show_client_email: StrictBool = True
    show_due_date: StrictBool = True


class PublicTrackingPage(Policy):
    enabled: StrictBool = True
    slug: str = Field(min_length=2, max_length=80, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    welcome_message: str = Field(default="", max_length=1000)
    show_brand: StrictBool = True
    show_support: StrictBool = True
    show_history: StrictBool = True
    show_pricing: StrictBool = False


class AgencyHours(Policy):
    text: str = Field(min_length=1, max_length=300)


class CustomerNotifications(Policy):
    package_received: StrictBool = True
    departure_confirmed: StrictBool = True
    package_arrived: StrictBool = True
    ready_for_pickup: StrictBool = True


POLICIES = {
    "customer_automation": CustomerAutomation,
    "parcel_receipt_rules": ReceiptRules,
    "shipment_delivery_rules": DeliveryRules,
    "goods_restrictions": GoodsRestrictions,
    "client_conditions": ClientConditions,
    "document_preferences": DocumentPreferences,
    "public_tracking_page": PublicTrackingPage,
    "agency_hours": AgencyHours,
    "customer_milestone_notifications": CustomerNotifications,
}


def validate_policies(value):
    # Other existing settings belong to their respective modules.
    return {key: POLICIES[key].model_validate(item).model_dump() if key in POLICIES else item
            for key, item in value.items()}


def validate_timezone(value):
    try:
        ZoneInfo(value)
    except (ZoneInfoNotFoundError, ValueError):
        raise ValueError("invalid_timezone") from None
    return value


def load_policies(connection, org_id):
    result = connection.execute(text("select settings from organization_settings where org_id=:org_id"),
                                {"org_id": org_id}).scalar()
    return result if isinstance(result, dict) else {}


def validate_receipt(policies, package):
    # Unconfigured legacy agencies retain their existing behavior.
    if "parcel_receipt_rules" not in policies:
        return
    rules = ReceiptRules.model_validate(policies["parcel_receipt_rules"])
    if rules.category_required and not (package.get("category") or package.get("goods_classification")):
        raise HTTPException(422, "package_category_required")
    if rules.packaging_required and not package.get("package_type"):
        raise HTTPException(422, "package_packaging_required")
    if not rules.allow_unmeasured and not any(Decimal(str(package.get(key) or 0)) > 0
                                            for key in ("weight_kg", "volume_cbm")):
        raise HTTPException(422, "package_measurement_required")


def require_photos_allowed(connection, org_id):
    rules = load_policies(connection, org_id).get("parcel_receipt_rules", {})
    if rules.get("allow_photos") is False:
        raise HTTPException(409, "package_photos_disabled")


def require_credit_allowed(connection, org_id, enabled):
    if enabled and not load_policies(connection, org_id).get("client_conditions", {}).get("allow_customer_credit", False):
        raise HTTPException(409, "customer_credit_disabled")


def require_delivery_proof(connection, org_id, package):
    rules = load_policies(connection, org_id).get("shipment_delivery_rules", {})
    if rules.get("delivery_proof") is True:
        proof = connection.execute(text("""select 1 from package_delivery_proofs
            where org_id=:org_id and package_id=:package_id limit 1"""),
            {"org_id": org_id, "package_id": package["id"]}).first()
        if not proof:
            raise HTTPException(409, "delivery_proof_required")
    from app.customer_automation.repository import check_release
    cfg=connection.execute(text('select require_payment from pickup_settings where org_id=:o'),{'o':org_id}).mappings().first()
    check_release(connection,org_id,[str(package['id'])],require_payment=cfg.get('require_payment',True) if cfg else True)


def check_regulated_goods(connection, org_id, package, *, receiving=False):
    policy = load_policies(connection, org_id).get("goods_restrictions", {})
    if policy.get("regulated_goods_check") is not True:
        return
    rules = connection.execute(text("""select accepted, requires_manual_validation
        from goods_rules where org_id=:org_id and is_active=true
          and (lower(category)=lower(:category) or lower(goods_name)=lower(:description))"""),
        {"org_id": org_id, "category": str(package.get("goods_classification") or package.get("category") or "").strip(),
         "description": str(package.get("description") or "").strip()}).mappings().all()
    if any(not row["accepted"] for row in rules):
        raise HTTPException(422, "goods_not_accepted")
    if any(row["requires_manual_validation"] for row in rules) and package.get("validation_status") != "VALIDATED":
        if receiving:
            package['validation_status']='NEEDS_REVIEW'
            return
        raise HTTPException(409, "regulated_goods_review_required")
