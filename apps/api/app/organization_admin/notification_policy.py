"""Recheck operational preferences immediately before transport dispatch."""
from sqlalchemy import text
from app.db.database import engine

MILESTONES={'RECEIVED':'package_received','RECEIVED_AT_ORIGIN':'package_received',
            'SHIPPED':'departure_confirmed','IN_TRANSIT':'departure_confirmed',
            'ARRIVED':'package_arrived','ARRIVED_DESTINATION':'package_arrived','READY_FOR_PICKUP':'ready_for_pickup'}


def can_dispatch(notification):
    milestone=MILESTONES.get(str(notification.get('notification_type') or '').rsplit(':',1)[-1])
    with engine.connect() as connection:
        row=connection.execute(text("""select s.settings,p.notify_package_milestones
            from organizations o left join organization_settings s on s.org_id=o.id
            left join parcel_operation_settings p on p.org_id=o.id
            where o.id=:org and o.status='ACTIVE'"""),{'org':notification['org_id']}).mappings().first()
        if not row or row['notify_package_milestones'] is False:
            return False
        preferences=row['settings'] or {}
        if milestone and preferences.get('customer_milestone_notifications',{}).get(milestone) is False:
            return False
        if milestone=='package_arrived' and preferences.get('shipment_delivery_rules',{}).get('arrival_notice') is False:
            return False
        excluded=connection.execute(text("""select 1 from broadcast_suppressions
            where org_id=:org and contact=:contact and upper(channel)='WHATSAPP'
            union all select 1 from broadcast_consents
            where org_id=:org and contact=:contact and upper(channel)='WHATSAPP' and consent_status='OPTED_OUT'
            limit 1"""),{'org':notification['org_id'],'contact':notification.get('recipient_phone') or notification.get('destination')}).first()
        return not bool(excluded)
