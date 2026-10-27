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
            plan['positioning']=(
                'Coordonner vos équipes à l’origine et à destination, avec la capacité nécessaire à un réseau de sites.' if business else
                'Relancer les clients dans la durée et annoncer vos prochains départs, au-delà des confirmations de suivi.' if pro else
                'Structurer votre premier bureau et son entrepôt, de la réception du colis à son retrait.'
            )
            plan['recommended']=pro
            plan['value_highlights']=(
                ['Les mêmes automatisations que Pro pour un volume plus important',
                 'Des accès individuels pour les équipes de vos différents sites',
                 'Une capacité d’agence partagée entre bureaux et entrepôts'] if business else
                ['Relancer les colis attendus et les départs bloqués selon vos réglages',
                 'Rappeler le retrait et signaler les frais d’entreposage applicables',
                 'Annoncer les départs aux contacts autorisés à recevoir vos messages'] if pro else
                ['Retrouver le client, les mesures et les photos sur la fiche du colis',
                 'Suivre les règlements et le solde restant avant le retrait',
                 'Informer le client des étapes clés et lui partager son tracking']
            )
            plan['included_features']=(
                ['Toutes les fonctions de Pro', 'Capacité supérieure pour les colis, les équipes et les sites'] if business else
                ['Toutes les fonctions de Starter', 'Relances clients programmées', 'Annonces de départ aux contacts consentants'] if pro else
                ['Colis, expéditions et tarifs par marchandise', 'Paiements et documents clients',
                 'Tracking public et photos autorisées au partage', 'Confirmations clients automatiques selon vos réglages']
            )
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
