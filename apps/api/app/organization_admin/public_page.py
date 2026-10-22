from fastapi import HTTPException
from sqlalchemy import text
from app.db.database import engine


def public_agency(slug):
    with engine.connect() as connection:
        row=connection.execute(text("""select o.organization_name,o.logo_url,o.primary_color,o.secondary_color,
            o.phone,s.settings from organizations o join organization_settings s on s.org_id=o.id
            where s.settings->'public_tracking_page'->>'slug'=:slug
              and coalesce((s.settings->'public_tracking_page'->>'enabled')::boolean,true)
              and o.status='ACTIVE' limit 1"""),{'slug':slug}).mappings().first()
    if not row:
        raise HTTPException(404,'public_agency_not_found')
    policies=row['settings'] or {}
    page=policies.get('public_tracking_page',{})
    show_brand=page.get('show_brand',True)
    show_support=page.get('show_support',True)
    return {'agency_name':row['organization_name'] if show_brand else None,
            'agency_logo_url':row['logo_url'] if show_brand else None,
            'primary_color':row['primary_color'] if show_brand else None,
            'secondary_color':row['secondary_color'] if show_brand else None,
            'favicon_url':policies.get('brand_favicon_url') if show_brand else None,
            'agency_support_phone':row['phone'] if show_support else None,
            'agency_hours':policies.get('agency_hours',{}).get('text') if show_support else None,
            'tracking_page':page}
