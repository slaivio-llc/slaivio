from sqlalchemy import text

from app.db.database import engine


def list_pricing_plans():
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                select
                    *,
                    code as plan_code,
                    name as plan_name
                from pricing_plans
                where active = true
                order by monthly_price_minor asc
            """),
        ).fetchall()

        entries=conn.execute(text("""select plan_code,entitlement_key,limit_value
            from plan_entitlements where entitlement_type='LIMIT'
            and entitlement_key in ('max_monthly_packages','max_users','max_offices','max_warehouses','max_whatsapp_numbers')""")).fetchall()
        limits={}
        for entry in entries:
            data=dict(entry._mapping)
            limits.setdefault(data['plan_code'],{})[data['entitlement_key']]=data['limit_value']
        plans=[]
        for row in rows:
            plan=dict(row._mapping)
            plan['limits']=limits.get(plan['code'],{})
            pro=plan['code']=='PRO'
            business=plan['code'] in ('ENTERPRISE','BUSINESS')
            plan['positioning']='Piloter son réseau' if business else 'Automatiser sa croissance' if pro else 'Organiser son agence'
            plan['recommended']=pro
            plan['included_features']=(['Tout Pro, avec une capacité multisite supérieure','Accès des équipes par bureau et entrepôt']
                if business else ['Tout Starter, avec davantage de capacité','Relances clients programmées','Annonces de départ aux contacts consentants']
                if pro else ['Colis, expéditions et tarifs par marchandise','Paiements, factures et étiquettes','Tracking public avec photos','Confirmations clients automatiques'])
            plans.append(plan)
        return plans


def get_pricing_plan(
    plan_code: str,
):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                select
                    *,
                    code as plan_code,
                    name as plan_name
                from pricing_plans
                where code = :plan_code
                  and active = true
                limit 1
            """),
            {
                "plan_code": plan_code,
            },
        ).fetchone()

        return dict(row._mapping) if row else None
