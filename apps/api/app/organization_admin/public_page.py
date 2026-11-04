from fastapi import HTTPException
from sqlalchemy import text
from app.db.database import engine
from app.services.public_tracking_links import agency_match_sql,legacy_agency_name_sql,public_agency_key


def public_agency(slug):
    with engine.connect() as connection:
        rows=connection.execute(text(f"""select o.id _org_id,coalesce(nullif(o.organization_name,''),o.name) organization_name,o.logo_url,o.primary_color,o.secondary_color,
            o.phone,s.settings from organizations o left join organization_settings s on s.org_id=o.id
            where ({agency_match_sql('o.id','s.settings')}
              or {legacy_agency_name_sql("coalesce(nullif(o.organization_name,''),o.name,'Agence')",'s.settings')})
              and coalesce((s.settings->'public_tracking_page'->>'enabled')::boolean,true)
              and o.status='ACTIVE' limit 2"""),{'slug':str(slug).strip().lower()}).mappings().all()
    if len(rows)!=1:
        raise HTTPException(404,'public_agency_not_found')
    row=rows[0]
    policies=row['settings'] or {}
    page=policies.get('public_tracking_page',{})
    show_brand=page.get('show_brand',True)
    show_support=page.get('show_support',True)
    return {'agency_key':public_agency_key(row['_org_id']),
            'agency_name':row['organization_name'] if show_brand else None,
            'agency_logo_url':row['logo_url'] if show_brand else None,
            'primary_color':row['primary_color'] if show_brand else None,
            'secondary_color':row['secondary_color'] if show_brand else None,
            'favicon_url':policies.get('brand_favicon_url') if show_brand else None,
            'agency_support_phone':row['phone'] if show_support else None,
            'agency_hours':policies.get('agency_hours',{}).get('text') if show_support else None,
            'tracking_page':{'enabled':True,'welcome_message':page.get('welcome_message') or 'Suivez votre colis en temps réel grâce à sa référence.',
              'show_brand':show_brand,'show_support':show_support,'show_history':page.get('show_history',True),
              'show_pricing':page.get('show_pricing',False)}}
