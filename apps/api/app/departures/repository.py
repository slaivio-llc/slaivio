import csv,io,json
from urllib.parse import quote
from datetime import datetime,timedelta,timezone
from uuid import uuid4
from fastapi import HTTPException
from sqlalchemy import text
from app.core.config import settings
from app.db.database import engine
def rows(r):return [dict(x) for x in r.mappings().all()]
def ev(c,o,d,t,a,n,p=None):c.execute(text("insert into departure_events(org_id,departure_id,event_type,actor_id,actor_name,payload) values(:o,:d,:t,:a,:n,cast(:p as jsonb))"),{"o":o,"d":d,"t":t,"a":a,"n":n,"p":json.dumps(p or {})})
def listing(o,start=None,end=None,status=None):
 f=['(d.org_id=:o or d.destination_org_id=:o)'];p={'o':o};
 if start:f.append('d.scheduled_at>=:start');p['start']=start
 if end:f.append('d.scheduled_at<:end');p['end']=end
 if status:f.append('d.status=:status');p['status']=status
 with engine.connect() as c:return rows(c.execute(text(f"select d.*,case when d.org_id=:o then 'ORIGIN' else 'DESTINATION' end office_role,s.service_name,s.shipping_mode,r.route_name,r.origin_city,r.origin_country,r.destination_city,r.destination_country,(select count(*) from departure_allocations a where a.departure_id=d.id and a.status<>'REMOVED')::int shipment_count from cargo_departures d join shipping_services s on s.id=d.shipping_service_id and s.org_id=d.org_id left join shipping_routes r on r.id=s.route_id where {' and '.join(f)} order by d.scheduled_at"),p))
def detail(o,d):
 with engine.connect() as c:
  item=c.execute(text("select d.*,case when d.org_id=:o then 'ORIGIN' else 'DESTINATION' end office_role,s.service_name,s.shipping_mode,r.route_name,r.origin_city,r.origin_country,r.destination_city,r.destination_country from cargo_departures d join shipping_services s on s.id=d.shipping_service_id and s.org_id=d.org_id left join shipping_routes r on r.id=s.route_id where (d.org_id=:o or d.destination_org_id=:o) and d.id=:d"),{'o':o,'d':d}).mappings().first()
  if not item:raise HTTPException(404,'departure_not_found')
  owner=item['org_id'];out=dict(item);out['allocations']=rows(c.execute(text("select a.*,e.expedition_reference from departure_allocations a left join expeditions e on e.id=a.shipment_id and e.org_id=a.org_id where a.org_id=:o and a.departure_id=:d and a.status<>'REMOVED' order by a.created_at"),{'o':owner,'d':d}));out['packages']=rows(c.execute(text("""select a.*,p.package_reference,p.tracking_id,p.client_name,p.status package_status,
    p.package_type,p.category,p.goods_classification,p.description,p.pieces_count,
    p.destination_country,p.destination_city,p.warehouse_name,p.payment_status,
    p.declared_value,p.declared_currency,c.phone client_phone,c.whatsapp_phone
    from departure_package_allocations a
    join cargo_packages p on p.id=a.package_id and p.org_id=a.org_id
    left join clients c on c.id=p.client_id and c.org_id=p.org_id
    where a.org_id=:o and a.departure_id=:d and a.status<>'REMOVED' order by a.created_at"""),{'o':owner,'d':d}));out['documents']=rows(c.execute(text("select * from departure_documents where org_id=:o and departure_id=:d order by created_at desc"),{'o':owner,'d':d}));out['events']=rows(c.execute(text("select * from departure_events where org_id=:o and departure_id=:d order by created_at desc"),{'o':owner,'d':d}));return out
def update(o,d,a,n,p):
 version=p.pop('expected_version');allowed={'scheduled_at','cutoff_at','estimated_arrival_at','capacity_weight_kg','capacity_cbm','capacity_packages','carrier_name','transport_reference','responsible_name','published','notes'};changes={k:v for k,v in p.items() if k in allowed}
 if not changes:raise HTTPException(422,'no_changes')
 sets=', '.join(f'{k}=:{k}' for k in changes)
 with engine.begin() as c:
  row=c.execute(text(f'update cargo_departures set {sets},row_version=row_version+1,updated_at=now() where org_id=:o and id=:d and row_version=:v returning *'),{'o':o,'d':d,'v':version,**changes}).mappings().first()
  if not row:raise HTTPException(409,'departure_version_conflict')
  result=dict(row);ev(c,o,d,'UPDATED',a,n,changes)
  result['_queued_notification_ids']=_queue_published_departure(c,o,result) if changes.get('published') is True else []
  return result
def checklist(o,d,a,n,p):
 if p['key'] not in {'packages','weight','documents','manifest','payments','carrier','final_approval'}:raise HTTPException(422,'invalid_checklist_key')
 with engine.begin() as c:
  row=c.execute(text("update cargo_departures set checklist=jsonb_set(checklist,array[:key],to_jsonb(cast(:completed as boolean))),row_version=row_version+1,updated_at=now() where org_id=:o and id=:d and row_version=:version returning *"),{'o':o,'d':d,**p}).mappings().first()
  if not row:raise HTTPException(409,'departure_version_conflict')
  ev(c,o,d,'CHECKLIST_UPDATED',a,n,{'key':p['key'],'completed':p['completed']});return dict(row)
def _departure_context(c,o,d,lock=False):
 suffix=' for update of d' if lock else ''
 return c.execute(text("""select d.*,s.route_id::text route_id,s.shipping_mode,s.service_name,
   r.route_name,r.origin_country,r.origin_city,r.destination_country,r.destination_city,
   r.status route_status,r.availability route_availability
   from cargo_departures d join shipping_services s on s.id=d.shipping_service_id and s.org_id=d.org_id
   left join shipping_routes r on r.id=s.route_id and r.org_id=s.org_id
   where d.org_id=:o and d.id=:d"""+suffix),{'o':o,'d':d}).mappings().first()

def _package_eligibility(c,o,dep,pkg,current_departure_id=None,include_capacity=True):
 reasons=[]
 def block(code,message):reasons.append({'code':code,'message':message})
 if dep['status'] in {'CANCELLED','DEPARTED','ARRIVED','COMPLETED'}:block('DEPARTURE_CLOSED','Ce départ ne permet plus d’ajouter des colis.')
 if str(dep.get('route_status') or 'ACTIVE').upper() not in {'ACTIVE','LIMITED'} or str(dep.get('route_availability') or 'AVAILABLE').upper() in {'FULL','SUSPENDED','UNAVAILABLE'}:block('ROUTE_UNAVAILABLE','La route est suspendue, complète ou indisponible.')
 if dep.get('cutoff_at') and c.execute(text('select now()>:cutoff'),{'cutoff':dep['cutoff_at']}).scalar():block('CUTOFF_PASSED','La date limite de réception de ce départ est dépassée.')
 if pkg.get('status') not in {'READY_FOR_DISPATCH','WAREHOUSE_PROCESSING','RECEIVED_AT_ORIGIN'}:block('PACKAGE_STATUS','Le colis n’est pas prêt à être expédié.')
 if str(pkg.get('validation_status') or 'PENDING').upper() in {'NEEDS_REVIEW','BLOCKED','REJECTED'}:block('PACKAGE_NOT_VALIDATED','Le contrôle du colis doit être validé avant son départ.')
 if pkg.get('shipment_id') and not current_departure_id:block('ALREADY_IN_SHIPMENT','Le colis appartient déjà à une expédition.')
 active=c.execute(text("select departure_id::text from departure_package_allocations where org_id=:o and package_id=:p and status<>'REMOVED' limit 1"),{'o':o,'p':pkg['id']}).scalar()
 if active and str(active)!=str(current_departure_id or ''):block('ALREADY_ALLOCATED','Le colis est déjà affecté à un départ.')
 if not pkg.get('client_id'):block('MISSING_CLIENT','Aucun client n’est associé au colis.')
 if not pkg.get('destination_country'):block('MISSING_DESTINATION','Le pays de destination du colis est manquant.')
 elif dep.get('destination_country') and str(pkg['destination_country']).casefold()!=str(dep['destination_country']).casefold():block('DESTINATION_COUNTRY_MISMATCH','Le pays de destination ne correspond pas à cette route.')
 if pkg.get('destination_city') and dep.get('destination_city') and str(pkg['destination_city']).casefold()!=str(dep['destination_city']).casefold():block('DESTINATION_CITY_MISMATCH','La ville de destination ne correspond pas à cette route.')
 if pkg.get('shipping_service_id') and str(pkg['shipping_service_id'])!=str(dep['shipping_service_id']):block('SERVICE_MISMATCH','Le service du colis ne correspond pas à celui du départ.')
 if pkg.get('route_id') and dep.get('route_id') and str(pkg['route_id'])!=str(dep['route_id']):block('ROUTE_MISMATCH','La route du colis ne correspond pas à celle du départ.')
 if pkg.get('warehouse_id') and dep.get('warehouse_id') and str(pkg['warehouse_id'])!=str(dep['warehouse_id']):block('WAREHOUSE_MISMATCH','Le colis ne se trouve pas dans l’entrepôt de départ.')
 if float(pkg.get('weight_kg') or 0)<=0:block('MISSING_WEIGHT','Le poids du colis doit être renseigné.')
 if str(dep.get('shipping_mode') or '').upper()=='SEA' and float(pkg.get('volume_cbm') or 0)<=0:block('MISSING_VOLUME','Le volume CBM est obligatoire pour un départ maritime.')
 require_payment=c.execute(text("select coalesce(require_payment_clearance,true) from parcel_operation_settings where org_id=:o"),{'o':o}).scalar()
 if require_payment is not False and str(pkg.get('payment_status') or 'UNKNOWN').upper() not in {'PAID','CLEARED'}:block('PAYMENT_NOT_CLEARED','Le paiement du colis n’est pas validé.')
 goods=str(pkg.get('goods_classification') or pkg.get('category') or '')
 policies=[]
 if goods:
  policies.extend(rows(c.execute(text("""select decision,required_documents from service_goods_policies
    where org_id=:o and shipping_service_id=:s and active and lower(goods_category)=lower(:goods)"""),{'o':o,'s':dep['shipping_service_id'],'goods':goods})))
  if dep.get('route_id'):policies.extend(rows(c.execute(text("""select decision,required_documents,max_weight_kg,max_volume_cbm,max_declared_value from route_restrictions
    where org_id=:o and route_id=cast(:route as uuid) and active and lower(goods_category)=lower(:goods)"""),{'o':o,'route':dep.get('route_id'),'goods':goods})))
 required=[]
 for policy in policies:
  if str(policy.get('decision') or '').upper()=='PROHIBITED':block('GOODS_PROHIBITED','Ce type de marchandise est interdit sur cette route.')
  if policy.get('max_weight_kg') and float(pkg.get('weight_kg') or 0)>float(policy['max_weight_kg']):block('GOODS_WEIGHT_LIMIT','Le poids dépasse la limite autorisée pour cette marchandise.')
  if policy.get('max_volume_cbm') and float(pkg.get('volume_cbm') or 0)>float(policy['max_volume_cbm']):block('GOODS_VOLUME_LIMIT','Le volume dépasse la limite autorisée pour cette marchandise.')
  if policy.get('max_declared_value') and float(pkg.get('declared_value') or 0)>float(policy['max_declared_value']):block('GOODS_VALUE_LIMIT','La valeur déclarée dépasse la limite autorisée sur cette route.')
  value=policy.get('required_documents') or []
  if isinstance(value,str):
   try:value=json.loads(value)
   except json.JSONDecodeError:value=[]
  required.extend(str(x) for x in value)
 if required:
  present={str(x).casefold() for x in c.execute(text("select document_type from package_documents where org_id=:o and package_id=:p and deleted_at is null"),{'o':o,'p':pkg['id']}).scalars().all()}
  missing=[x for x in dict.fromkeys(required) if x.casefold() not in present]
  if missing:block('MISSING_DOCUMENTS','Documents requis manquants : '+', '.join(missing)+'.')
 open_anomalies=c.execute(text("select count(*) from package_anomalies where org_id=:o and package_id=:p and status='OPEN' and severity in ('HIGH','CRITICAL')"),{'o':o,'p':pkg['id']}).scalar_one()
 if open_anomalies:block('OPEN_ANOMALY','Une anomalie importante doit être résolue avant l’expédition.')
 if include_capacity:
  nw=float(dep.get('reserved_weight_kg') or 0)+float(pkg.get('weight_kg') or 0);nv=float(dep.get('reserved_cbm') or 0)+float(pkg.get('volume_cbm') or 0);np=int(dep.get('reserved_packages') or 0)+1
  if dep.get('capacity_weight_kg') and nw>float(dep['capacity_weight_kg']):block('WEIGHT_CAPACITY_EXCEEDED','La capacité de poids du départ serait dépassée.')
  if dep.get('capacity_cbm') and nv>float(dep['capacity_cbm']):block('VOLUME_CAPACITY_EXCEEDED','La capacité CBM du départ serait dépassée.')
  if dep.get('capacity_packages') and np>int(dep['capacity_packages']):block('PACKAGE_CAPACITY_EXCEEDED','Le nombre maximal de colis serait dépassé.')
 return reasons

def _departure_package_blockers(c,o,dep):
 packages=rows(c.execute(text("""select p.* from departure_package_allocations allocation
   join cargo_packages p on p.id=allocation.package_id and p.org_id=allocation.org_id
   where allocation.org_id=:o and allocation.departure_id=:d and allocation.status<>'REMOVED' and p.deleted_at is null"""),{'o':o,'d':dep['id']}))
 blocked=[]
 for pkg in packages:
  reasons=_package_eligibility(c,o,dep,pkg,current_departure_id=dep['id'],include_capacity=False)
  if reasons:blocked.append({'package_id':str(pkg['id']),'package_reference':pkg.get('package_reference'),'reasons':reasons})
 return blocked

def compatible_packages(o,d):
 with engine.connect() as c:
  dep=_departure_context(c,o,d)
  if not dep:raise HTTPException(404,'departure_not_found')
  candidates=rows(c.execute(text("""select p.*,p.id::text id,p.route_id::text route_id,p.shipping_service_id::text shipping_service_id,
    p.warehouse_id::text warehouse_id
    from cargo_packages p where p.org_id=:o and p.deleted_at is null
    and p.status not in ('DELIVERED','CANCELLED','RETURNED')
    and not exists(select 1 from departure_package_allocations current_allocation
      where current_allocation.org_id=p.org_id and current_allocation.package_id=p.id
      and current_allocation.departure_id=:d and current_allocation.status<>'REMOVED')
    order by p.received_at desc nulls last,p.created_at desc limit 200"""),{'o':o,'d':d}))
  result=[]
  for pkg in candidates:
   reasons=_package_eligibility(c,o,dep,pkg);pkg['eligible']=not reasons;pkg['blocking_reasons']=reasons;result.append(pkg)
  return sorted(result,key=lambda pkg:(not pkg['eligible'],str(pkg.get('package_reference') or '')))
def allocate_package(o,d,a,n,p):
 with engine.begin() as c:
  old=c.execute(text('select * from departure_package_allocations where org_id=:o and idempotency_key=:k'),{'o':o,'k':p['idempotency_key']}).mappings().first()
  if old:return dict(old)
  dep=_departure_context(c,o,d,True);pkg=c.execute(text('select * from cargo_packages where org_id=:o and id=:p and deleted_at is null for update'),{'o':o,'p':p['package_id']}).mappings().first()
  if not dep or not pkg:raise HTTPException(404,'departure_or_package_not_found')
  reasons=_package_eligibility(c,o,dep,pkg)
  capacity_codes={'WEIGHT_CAPACITY_EXCEEDED','VOLUME_CAPACITY_EXCEEDED','PACKAGE_CAPACITY_EXCEEDED'}
  blocking=[reason for reason in reasons if not (p.get('override_capacity') and reason['code'] in capacity_codes)]
  if blocking:raise HTTPException(409,{'code':'package_not_eligible','reasons':blocking})
  nw=float(dep['reserved_weight_kg'])+float(pkg['weight_kg'] or 0);nv=float(dep['reserved_cbm'])+float(pkg['volume_cbm'] or 0);np=int(dep['reserved_packages'])+1
  if not p.get('override_capacity') and ((dep['capacity_weight_kg'] and nw>float(dep['capacity_weight_kg'])) or (dep['capacity_cbm'] and nv>float(dep['capacity_cbm'])) or (dep['capacity_packages'] and np>dep['capacity_packages'])):raise HTTPException(409,'departure_capacity_exceeded')
  removed=c.execute(text("select id from departure_package_allocations where org_id=:o and departure_id=:d and package_id=:package_id and status='REMOVED' for update"),{'o':o,'d':d,**p}).scalar()
  if removed:row=dict(c.execute(text("update departure_package_allocations set status='PLANNED',weight_kg=:w,volume_cbm=:v,idempotency_key=:idempotency_key,created_by=:a,created_at=now() where id=:id returning *"),{'id':removed,'w':pkg['weight_kg'] or 0,'v':pkg['volume_cbm'] or 0,'idempotency_key':p['idempotency_key'],'a':a}).mappings().one())
  else:row=dict(c.execute(text("insert into departure_package_allocations(org_id,departure_id,package_id,weight_kg,volume_cbm,idempotency_key,created_by) values(:o,:d,:package_id,:w,:v,:idempotency_key,:a) returning *"),{'o':o,'d':d,'a':a,'w':pkg['weight_kg'] or 0,'v':pkg['volume_cbm'] or 0,**p}).mappings().one())
  c.execute(text('update cargo_departures set reserved_weight_kg=:w,reserved_cbm=:v,reserved_packages=:p,row_version=row_version+1 where org_id=:o and id=:d'),{'o':o,'w':nw,'v':nv,'p':np,'d':d})
  c.execute(text("update cargo_packages set shipping_service_id=coalesce(shipping_service_id,cast(:service as uuid)),route_id=coalesce(route_id,cast(:route as uuid)),updated_at=now() where org_id=:o and id=:package"),{'o':o,'service':dep['shipping_service_id'],'route':dep.get('route_id'),'package':pkg['id']})
  ev(c,o,d,'PACKAGE_ALLOCATED',a,n,{'package_id':p['package_id'],'eligibility_checked':True});return row
def remove_package(o,d,p,a,n):
 with engine.begin() as c:
  row=c.execute(text("update departure_package_allocations set status='REMOVED' where org_id=:o and departure_id=:d and package_id=:p and status<>'REMOVED' returning weight_kg,volume_cbm"),{'o':o,'d':d,'p':p}).mappings().first()
  if not row:raise HTTPException(404,'allocation_not_found')
  c.execute(text('update cargo_departures set reserved_weight_kg=greatest(0,reserved_weight_kg-:w),reserved_cbm=greatest(0,reserved_cbm-:v),reserved_packages=greatest(0,reserved_packages-1),row_version=row_version+1 where org_id=:o and id=:d'),{'o':o,'d':d,'w':row['weight_kg'],'v':row['volume_cbm']});ev(c,o,d,'PACKAGE_REMOVED',a,n,{'package_id':p});return {'status':'removed'}
def manifest(o,d,a='system',n='Slaivio'):
 item=detail(o,d);out=io.StringIO();w=csv.writer(out);headers=['manifest','departure','route','mode','service','origin','destination','scheduled_at','eta_at','carrier','transport_reference','package','tracking','client','client_phone','package_type','goods','description','pieces','weight_kg','cbm','declared_value','currency','payment_status','warehouse','package_status'];w.writerow(headers)
 origin=', '.join(x for x in [item.get('origin_city'),item.get('origin_country')] if x);destination=', '.join(x for x in [item.get('destination_city'),item.get('destination_country')] if x);manifest_reference=f"MAN-{item['departure_code']}"
 for p in item['packages']:w.writerow([manifest_reference,item['departure_code'],item.get('route_name'),item.get('shipping_mode'),item.get('service_name'),origin,destination,item.get('scheduled_at'),item.get('estimated_arrival_at'),item.get('carrier_name'),item.get('transport_reference'),p.get('package_reference'),p.get('tracking_id'),p.get('client_name'),p.get('whatsapp_phone') or p.get('client_phone'),p.get('package_type'),p.get('goods_classification') or p.get('category'),p.get('description'),p.get('pieces_count'),p.get('weight_kg'),p.get('volume_cbm'),p.get('declared_value'),p.get('declared_currency'),p.get('payment_status'),p.get('warehouse_name'),p.get('package_status')])
 w.writerow([manifest_reference,item['departure_code'],'TOTAL','','','','','','','','',len(item['packages']),'','','','','','',sum(int(p.get('pieces_count') or 0) for p in item['packages']),sum(float(p.get('weight_kg') or 0) for p in item['packages']),sum(float(p.get('volume_cbm') or 0) for p in item['packages'])])
 with engine.begin() as c:ev(c,item['org_id'],d,'MANIFEST_GENERATED',a,n,{'manifest_reference':manifest_reference,'packages':len(item['packages']),'weight_kg':sum(float(p.get('weight_kg') or 0) for p in item['packages']),'volume_cbm':sum(float(p.get('volume_cbm') or 0) for p in item['packages']),'generated_from_org_id':o})
 return '\ufeff'+out.getvalue()
def analytics(o):
 with engine.connect() as c:return {'routes':rows(c.execute(text("select coalesce(r.route_name,'Sans route') label,count(*)::int departures,round(avg(case when d.capacity_weight_kg>0 then d.reserved_weight_kg/d.capacity_weight_kg*100 end),1) fill_rate,count(*) filter(where d.status='DELAYED')::int delayed from cargo_departures d join shipping_services s on s.id=d.shipping_service_id left join shipping_routes r on r.id=s.route_id where d.org_id=:o group by 1 order by departures desc"),{'o':o}))}
def templates(o):
 with engine.connect() as c:return rows(c.execute(text("select t.*,s.service_name,r.route_name from departure_templates t join shipping_services s on s.id=t.shipping_service_id and s.org_id=t.org_id left join shipping_routes r on r.id=s.route_id where t.org_id=:o and t.active order by t.template_name"),{'o':o}))
def create_template(o,a,p):
 with engine.begin() as c:return dict(c.execute(text("insert into departure_templates(org_id,template_name,shipping_service_id,timezone,capacity_weight_kg,capacity_cbm,capacity_packages,checklist,created_by) values(:o,:template_name,:shipping_service_id,:timezone,:capacity_weight_kg,:capacity_cbm,:capacity_packages,cast(:checklist as jsonb),:a) returning *"),{'o':o,'a':a,'checklist':json.dumps(p.get('checklist') or {}),**p}).mappings().one())
def recurrences(o):
 with engine.connect() as c:return rows(c.execute(text("select x.*,s.service_name,r.route_name from departure_recurrences x join shipping_services s on s.id=x.shipping_service_id and s.org_id=x.org_id left join shipping_routes r on r.id=s.route_id where x.org_id=:o and x.active order by x.created_at desc"),{'o':o}))
def create_recurrence(o,a,p):
 with engine.begin() as c:return dict(c.execute(text("insert into departure_recurrences(org_id,template_id,shipping_service_id,frequency,weekdays,local_time,timezone,cutoff_hours,horizon_days,next_generation_at,created_by) values(:o,cast(:template_id as uuid),:shipping_service_id,:frequency,:weekdays,:local_time,:timezone,:cutoff_hours,:horizon_days,now(),:a) returning *"),{'o':o,'a':a,**p}).mappings().one())
def run_automation(o=None):
 generated=reminders=0;where='and x.org_id=:o' if o else '';params={'o':o} if o else {}
 with engine.begin() as c:
  rules=rows(c.execute(text(f"select x.*,t.capacity_weight_kg,t.capacity_cbm,t.capacity_packages from departure_recurrences x left join departure_templates t on t.id=x.template_id where x.active and coalesce(x.next_generation_at,now())<=now() {where}"),params))
  for rule in rules:
   now=datetime.now(timezone.utc);days=range(0,min(int(rule['horizon_days']),14)+1)
   for offset in days:
    day=now+timedelta(days=offset)
    if rule['frequency']=='WEEKLY' and rule['weekdays'] and day.weekday() not in rule['weekdays']:continue
    scheduled=day.replace(hour=rule['local_time'].hour,minute=rule['local_time'].minute,second=0,microsecond=0)
    exists=c.execute(text('select 1 from cargo_departures where org_id=:o and shipping_service_id=:s and scheduled_at=:at'),{'o':rule['org_id'],'s':rule['shipping_service_id'],'at':scheduled}).first()
    if not exists:
     code=f"DEP-{scheduled:%Y%m%d}-{uuid4().hex[:4].upper()}";c.execute(text("insert into cargo_departures(org_id,shipping_service_id,departure_code,scheduled_at,cutoff_at,status,timezone,capacity_weight_kg,capacity_cbm,capacity_packages,created_by) values(:o,:s,:code,:at,:cutoff,'PLANNED',:tz,:w,:v,:p,'automation')"),{'o':rule['org_id'],'s':rule['shipping_service_id'],'code':code,'at':scheduled,'cutoff':scheduled-timedelta(hours=rule['cutoff_hours']),'tz':rule['timezone'],'w':rule.get('capacity_weight_kg'),'v':rule.get('capacity_cbm'),'p':rule.get('capacity_packages')});generated+=1
   c.execute(text("update departure_recurrences set next_generation_at=now()+interval '1 day' where id=:id"),{'id':rule['id']})
  due=rows(c.execute(text(f"select d.id,d.org_id,d.departure_code,d.scheduled_at from cargo_departures d where d.status in ('PLANNED','PENDING_CONFIRMATION','CONFIRMED','LOADING','READY_TO_DEPART') and d.scheduled_at between now() and now()+interval '2 days' {'and d.org_id=:o' if o else ''}"),params))
  for dep in due:
   key='DEPARTURE_2H' if dep['scheduled_at']<=datetime.now(timezone.utc)+timedelta(hours=2) else 'DEPARTURE_24H'
   already=c.execute(text("select 1 from departure_events where org_id=:o and departure_id=:d and event_type=:k"),{'o':dep['org_id'],'d':dep['id'],'k':key}).first()
   if not already:ev(c,dep['org_id'],str(dep['id']),key,'automation','Slaivio',{'scheduled_at':str(dep['scheduled_at'])});reminders+=1
 return {'generated':generated,'reminders':reminders}
def stats(o):
 with engine.connect() as c:return dict(c.execute(text("""select count(*) filter(where scheduled_at::date=current_date)::int today,count(*) filter(where scheduled_at>=date_trunc('week',now()) and scheduled_at<date_trunc('week',now())+interval '7 days')::int this_week,count(*) filter(where status='CONFIRMED')::int confirmed,count(*) filter(where status in ('OPEN','PLANNED','PENDING_CONFIRMATION'))::int pending,count(*) filter(where status='DELAYED')::int delayed,count(*) filter(where capacity_weight_kg>0 and reserved_weight_kg>=capacity_weight_kg)::int full,coalesce(sum(reserved_packages),0)::int packages,coalesce(sum(reserved_weight_kg),0)::float weight_kg,coalesce(sum(reserved_cbm),0)::float cbm from cargo_departures where org_id=:o"""),{'o':o}).mappings().one())
def create(o,a,n,p):
 with engine.begin() as c:
  service=c.execute(text('select service.id,route.destination_org_id from shipping_services service left join shipping_routes route on route.id=service.route_id and route.org_id=service.org_id where service.id=:s and service.org_id=:o and service.active'),{'s':p['shipping_service_id'],'o':o}).mappings().first()
  if not service:raise HTTPException(422,'service_not_found')
  p['departure_code']=p.get('departure_code') or f"DEP-{uuid4().hex[:8].upper()}";existing=c.execute(text("select * from cargo_departures where org_id=:o and departure_code=:code"),{'o':o,'code':p['departure_code']}).mappings().first()
  if existing:return dict(existing)
  row=dict(c.execute(text("insert into cargo_departures(org_id,destination_org_id,shipping_service_id,departure_code,scheduled_at,cutoff_at,estimated_arrival_at,status,capacity_weight_kg,capacity_cbm,capacity_packages,carrier_name,transport_reference,timezone,responsible_name,warehouse_id,destination_office,published,notes,created_by) values(:o,:destination_org_id,:shipping_service_id,:departure_code,:scheduled_at,:cutoff_at,:estimated_arrival_at,'PLANNED',:capacity_weight_kg,:capacity_cbm,:capacity_packages,:carrier_name,:transport_reference,:timezone,:responsible_name,cast(:warehouse_id as uuid),:destination_office,:published,:notes,:a) returning *"),{'o':o,'a':a,'destination_org_id':service.get('destination_org_id'),**p}).mappings().one());ev(c,o,str(row['id']),'CREATED',a,n)
  row['_queued_notification_ids']=_queue_published_departure(c,o,row) if row.get('published') else []
  return row

def _queue_published_departure(c,o,dep):
 enabled=c.execute(text("select coalesce(notify_next_departure,true) from parcel_operation_settings where org_id=:o"),{'o':o}).scalar()
 if enabled is False:return []
 service=c.execute(text("""select s.service_name,s.shipping_mode,r.route_name,r.origin_country,r.origin_city,r.destination_country,r.destination_city
   from shipping_services s left join shipping_routes r on r.id=s.route_id and r.org_id=s.org_id
   where s.org_id=:o and s.id=:s"""),{'o':o,'s':dep['shipping_service_id']}).mappings().first() or {}
 recipients=rows(c.execute(text("""
   select distinct on(normalized_phone) client_id,dossier_id,normalized_phone,display_name
   from (
     select client.id client_id,package.dossier_id,
       regexp_replace(coalesce(client.whatsapp_phone,client.phone,''),'[^0-9]','','g') normalized_phone,
       coalesce(client.display_name,client.name,'Client') display_name,1 priority
     from cargo_packages package
     join clients client on client.org_id=package.org_id and client.id=package.client_id and client.deleted_at is null
     where package.org_id=:o and package.deleted_at is null
       and package.status not in('DELIVERED','CANCELLED','RETURNED')
       and (package.shipping_service_id=:service_id
         or (package.shipping_service_id is null and (:destination_country is null or package.destination_country is null or lower(package.destination_country)=lower(:destination_country))))
     union all
     select journey.client_id,null::uuid,
       regexp_replace(journey.conversation_phone,'[^0-9]','','g'),
       coalesce(journey.full_name,'Prospect WhatsApp'),2
     from parcel_customer_journeys journey
     where journey.org_id=:o and journey.stage not in('NOT_INTERESTED','CLOSED')
       and (journey.transport_mode is null or :shipping_mode is null or lower(journey.transport_mode)=lower(:shipping_mode))
       and (journey.route_interest is null or :route_name is null or journey.route_interest ilike '%'||:route_name||'%'
         or :destination_country is null or journey.route_interest ilike '%'||:destination_country||'%')
   ) audience
   where normalized_phone<>''
   order by normalized_phone,priority
 """),{'o':o,'service_id':dep['shipping_service_id'],'shipping_mode':service.get('shipping_mode'),'route_name':service.get('route_name'),'destination_country':service.get('destination_country')}))
 route=service.get('route_name') or f"{service.get('origin_city') or service.get('origin_country') or 'Origine'} → {service.get('destination_city') or service.get('destination_country') or 'Destination'}"
 scheduled=dep.get('scheduled_at')
 message=f"Prochain départ {route} prévu le {scheduled:%d/%m/%Y à %H:%M} ({service.get('service_name') or 'service fret'}). Répondez à ce message si vous souhaitez préparer un envoi."
 queued=[]
 for recipient in recipients:
  notification_type=f"NEXT_DEPARTURE:{dep['id']}:{recipient['normalized_phone']}"
  item=c.execute(text("""insert into notification_outbox(org_id,client_id,dossier_id,channel,recipient_phone,notification_type,message)
    select :o,:client_id,:dossier_id,'whatsapp',:phone,:notification_type,:message
    where not exists(select 1 from notification_outbox where org_id=:o and notification_type=:notification_type)
    returning id::text"""),{'o':o,'client_id':recipient.get('client_id'),'dossier_id':recipient.get('dossier_id'),'phone':recipient['normalized_phone'],'notification_type':notification_type,'message':message}).first()
  if item:queued.append(str(item[0]))
 ev(c,o,str(dep['id']),'ANNOUNCEMENT_QUEUED','automation','Slaivio',{'recipients':len(queued)})
 return queued
def allocate(o,d,a,n,p):
 with engine.begin() as c:
  old=c.execute(text('select * from departure_allocations where org_id=:o and idempotency_key=:k'),{'o':o,'k':p['idempotency_key']}).mappings().first()
  if old:return dict(old)
  dep=c.execute(text("select * from cargo_departures where id=:d and org_id=:o and status='OPEN' for update"),{'d':d,'o':o}).mappings().first()
  if not dep:raise HTTPException(409,'departure_not_open')
  if dep['cutoff_at'] and c.execute(text('select now()>:x'),{'x':dep['cutoff_at']}).scalar():raise HTTPException(409,'departure_cutoff_passed')
  if dep['reserved_weight_kg']+p['weight_kg']>(dep['capacity_weight_kg'] or 10**12) or dep['reserved_cbm']+p['volume_cbm']>(dep['capacity_cbm'] or 10**12):raise HTTPException(409,'departure_capacity_exceeded')
  row=dict(c.execute(text("insert into departure_allocations(org_id,departure_id,shipment_id,weight_kg,volume_cbm,idempotency_key,created_by) values(:o,:d,:shipment_id,:weight_kg,:volume_cbm,:idempotency_key,:a) returning *"),{'o':o,'d':d,'a':a,**p}).mappings().one());c.execute(text('update cargo_departures set reserved_weight_kg=reserved_weight_kg+:w,reserved_cbm=reserved_cbm+:v,row_version=row_version+1,updated_at=now() where id=:d'),{'w':p['weight_kg'],'v':p['volume_cbm'],'d':d});ev(c,o,d,'SHIPMENT_ALLOCATED',a,n,p);return row
def transition(o,d,a,n,status,version,reason=None):
 allowed={'DRAFT':{'PLANNED','CANCELLED'},'OPEN':{'CONFIRMED','CANCELLED'},'PLANNED':{'PENDING_CONFIRMATION','CONFIRMED','DELAYED','CANCELLED'},'PENDING_CONFIRMATION':{'CONFIRMED','DELAYED','CANCELLED'},'CONFIRMED':{'LOADING','DELAYED','CANCELLED'},'CLOSED':{'LOADING','CANCELLED'},'LOADING':{'READY_TO_DEPART','DEPARTED','DELAYED'},'READY_TO_DEPART':{'DEPARTED','DELAYED'},'DELAYED':{'CONFIRMED','LOADING','CANCELLED'},'DEPARTED':{'ARRIVED'},'ARRIVED':{'COMPLETED'}}
 queued_notification_ids=[]
 with engine.begin() as c:
  cur=c.execute(text('select * from cargo_departures where id=:d and org_id=:o for update'),{'d':d,'o':o}).mappings().first()
  if not cur:raise HTTPException(404,'departure_not_found')
  if status in {'CONFIRMED','LOADING','DEPARTED'}:
   allocated=c.execute(text("select count(*) from departure_package_allocations where org_id=:o and departure_id=:d and status<>'REMOVED'"),{'o':o,'d':d}).scalar_one()
   if not allocated:raise HTTPException(409,{'code':'departure_has_no_packages','message':'Aucun colis n’est affecté à ce départ.'})
   dep=_departure_context(c,o,d);blocked_packages=_departure_package_blockers(c,o,dep)
   if blocked_packages:raise HTTPException(409,{'code':'departure_packages_not_eligible','packages':blocked_packages})
  if status in {'LOADING','DEPARTED'}:
   blocked=c.execute(text("select count(*) from departure_allocations da left join compliance_checks cc on cc.org_id=da.org_id and cc.entity_type='SHIPMENT' and cc.entity_id=da.shipment_id where da.departure_id=:d and da.status<>'REMOVED' and coalesce(cc.status,'BLOCKED')<>'CLEAR'"),{'d':d}).scalar_one()
   if blocked:raise HTTPException(409,'departure_compliance_blocked')
  if status=='DEPARTED' and not all((cur.get('checklist') or {}).values()):raise HTTPException(409,'departure_checklist_incomplete')
  if version!=cur['row_version'] or status not in allowed.get(cur['status'],set()):raise HTTPException(409,'departure_state_conflict')
  if status=='CANCELLED' and not reason:raise HTTPException(422,'cancellation_reason_required')
  row=dict(c.execute(text("update cargo_departures set status=:s,row_version=row_version+1,notes=concat_ws(E'\\n',notes,:r),delay_reason=case when :s='DELAYED' then :r else delay_reason end,actual_departure_at=case when :s='DEPARTED' then now() else actual_departure_at end,actual_arrival_at=case when :s='ARRIVED' then now() else actual_arrival_at end,updated_at=now() where id=:d returning *"),{'s':status,'r':reason,'d':d}).mappings().one())
  ev(c,o,d,status,a,n,{'reason':reason})
  _sync_operations(c,o,row,a,n,status,reason,queued_notification_ids)
 if queued_notification_ids:row['_queued_notification_ids']=queued_notification_ids
 return row
def _sync_operations(c,o,dep,a,n,status,reason,queued_notification_ids):
 if status not in {'CONFIRMED','DELAYED','DEPARTED','ARRIVED','CANCELLED'}:return
 route=c.execute(text("select s.service_name,s.shipping_mode,r.route_name,r.origin_country,r.origin_city,r.destination_country,r.destination_city from shipping_services s left join shipping_routes r on r.id=s.route_id where s.org_id=:o and s.id=:s"),{'o':o,'s':dep['shipping_service_id']}).mappings().first() or {}
 reference=f"EXP-{dep['departure_code']}"
 exp=c.execute(text('select id::text,status from cargo_expeditions where org_id=:o and expedition_reference=:r for update'),{'o':o,'r':reference}).mappings().first()
 if not exp and status in {'CONFIRMED','DEPARTED'}:
  exp=c.execute(text("""insert into cargo_expeditions(org_id,expedition_reference,title,status,mode,service_type,origin_country,origin_city,destination_country,destination_city,route_label,carrier_name,flight_number,vessel_name,container_number,batch_reference,manifest_reference,owner_name,planned_departure_at,departed_at,eta_at,created_by,updated_by) values(:o,:ref,:title,:status,:mode,:service,:oc,:ocity,:dc,:dcity,:route,:carrier,:flight,:vessel,:container,:batch,:manifest,:owner,:planned,:departed,:eta,:a,:a) returning id::text,status"""),{'o':o,'ref':reference,'title':dep['departure_code'],'status':'DISPATCHED' if status=='DEPARTED' else 'PREPARING','mode':route.get('shipping_mode') or 'OTHER','service':route.get('service_name'),'oc':route.get('origin_country'),'ocity':route.get('origin_city'),'dc':route.get('destination_country'),'dcity':route.get('destination_city'),'route':route.get('route_name'),'carrier':dep.get('carrier_name'),'flight':dep.get('flight_number'),'vessel':dep.get('vessel_name'),'container':dep.get('container_number'),'batch':dep.get('batch_reference'),'manifest':f"MAN-{dep['departure_code']}",'owner':dep.get('responsible_name'),'planned':dep.get('scheduled_at'),'departed':dep.get('actual_departure_at'),'eta':dep.get('estimated_arrival_at'),'a':a}).mappings().one()
 if not exp:return
 exp_status={'CONFIRMED':'PREPARING','DELAYED':'PREPARING','DEPARTED':'DISPATCHED','ARRIVED':'ARRIVED_DESTINATION','CANCELLED':'CANCELLED'}[status]
 c.execute(text('update cargo_expeditions set status=:s,is_delayed=:delayed,delay_reason=coalesce(:reason,delay_reason),departed_at=case when :s=\'DISPATCHED\' then coalesce(departed_at,now()) else departed_at end,arrived_at=case when :s=\'ARRIVED_DESTINATION\' then coalesce(arrived_at,now()) else arrived_at end,updated_by=:a,updated_at=now() where org_id=:o and id=:id'),{'s':exp_status,'delayed':status=='DELAYED','reason':reason,'a':a,'o':o,'id':exp['id']})
 c.execute(text("insert into expedition_events(org_id,expedition_id,event_type,title,description,new_status,metadata,actor_id,actor_name,idempotency_key) values(:o,:id,:event,:title,:description,:status,cast(:meta as jsonb),:a,:n,:key) on conflict(idempotency_key) do nothing"),{'o':o,'id':exp['id'],'event':f'DEPARTURE_{status}','title':f'Départ {status.lower()}','description':reason,'status':exp_status,'meta':json.dumps({'departure_id':str(dep['id']),'departure_code':dep['departure_code']}),'a':a,'n':n,'key':f"departure:{dep['id']}:{status}:{dep['row_version']}"})
 milestones_enabled=c.execute(text("select coalesce(notify_package_milestones,true) from parcel_operation_settings where org_id=:o"),{'o':o}).scalar()
 agency_name=c.execute(text("select coalesce(nullif(organization_name,''),nullif(name,''),'Notre agence') from organizations where id=:o"),{'o':o}).scalar() or 'Notre agence'
 packages=rows(c.execute(text("select p.*,cl.phone client_phone,cl.whatsapp_phone client_whatsapp_phone from departure_package_allocations da join cargo_packages p on p.id=da.package_id and p.org_id=da.org_id left join clients cl on cl.id=p.client_id and cl.org_id=p.org_id where da.org_id=:o and da.departure_id=:d and da.status<>'REMOVED' and p.deleted_at is null"),{'o':o,'d':dep['id']}))
 for pkg in packages:
  c.execute(text("insert into expedition_packages(org_id,expedition_id,package_id,added_by) values(:o,:e,:p,:a) on conflict(org_id,expedition_id,package_id) where removed_at is null do nothing"),{'o':o,'e':exp['id'],'p':pkg['id'],'a':a})
  package_status={'CONFIRMED':'READY_FOR_DISPATCH','DELAYED':'READY_FOR_DISPATCH','DEPARTED':'IN_TRANSIT','ARRIVED':'ARRIVED_DESTINATION','CANCELLED':'READY_FOR_DISPATCH'}[status]
  c.execute(text('update cargo_packages set shipment_id=:e,status=:s,current_status=:s,updated_at=now() where org_id=:o and id=:p'),{'e':exp['id'] if status!='CANCELLED' else None,'s':package_status,'o':o,'p':pkg['id']})
  c.execute(text("insert into package_events(org_id,package_id,event_type,title,description,new_status,metadata,actor_id) values(:o,:p,:event,:title,:description,:status,cast(:meta as jsonb),:a)"),{'o':o,'p':pkg['id'],'event':f'DEPARTURE_{status}','title':f'Départ {status.lower()}','description':reason,'status':package_status,'meta':json.dumps({'departure_id':str(dep['id']),'expedition_id':exp['id']}),'a':a})
  if milestones_enabled is not False and status in {'DELAYED','DEPARTED','ARRIVED','CANCELLED'} and pkg.get('client_id') and (pkg.get('client_phone') or pkg.get('client_whatsapp_phone')):
   when=dep.get('scheduled_at')
   tracking=pkg.get('tracking_id') or pkg.get('package_reference');tracking_url=f"{settings.public_web_base_url.rstrip('/')}/track?reference={quote(str(tracking),safe='')}"
   body=(f"Votre départ {dep['departure_code']} a été retardé. Nouvelle date prévue : {when}. Motif : {reason}." if status=='DELAYED' else f"Votre colis {pkg.get('package_reference')} a quitté l'origine.\n\nSuivez son évolution ici : {tracking_url}\nNuméro de suivi : {tracking}." if status=='DEPARTED' else f"Votre colis {pkg.get('package_reference')} est arrivé à destination.\n\nSuivi : {tracking_url}\nNuméro de suivi : {tracking}." if status=='ARRIVED' else f"Le départ {dep['departure_code']} a été annulé. Votre colis sera réaffecté au prochain départ compatible.")
   if status in {'DELAYED','CANCELLED'}:
    body += f"\n\nSuivi : {tracking_url}\nNuméro de suivi : {tracking}."
   message=f"{agency_name}\n\n{body}"
   notification_type=f"DEPARTURE_{status}:{dep['id']}:{pkg['id']}"
   queued=c.execute(text("insert into notification_outbox(org_id,client_id,dossier_id,channel,recipient_phone,notification_type,message) select :o,:client,:dossier,'whatsapp',:phone,:type,:message where not exists(select 1 from notification_outbox where org_id=:o and notification_type=:type) returning id::text"),{'o':o,'client':pkg['client_id'],'dossier':pkg['dossier_id'],'phone':pkg.get('client_whatsapp_phone') or pkg.get('client_phone'),'type':notification_type,'message':message}).first()
   if queued:queued_notification_ids.append(str(queued[0]))
 c.execute(text("update cargo_expeditions set packages_count=(select count(*) from expedition_packages where org_id=:o and expedition_id=:e and removed_at is null),clients_count=(select count(distinct p.client_id) from expedition_packages ep join cargo_packages p on p.id=ep.package_id where ep.org_id=:o and ep.expedition_id=:e and ep.removed_at is null),total_weight_kg=(select coalesce(sum(p.weight_kg),0) from expedition_packages ep join cargo_packages p on p.id=ep.package_id where ep.org_id=:o and ep.expedition_id=:e and ep.removed_at is null),total_volume_cbm=(select coalesce(sum(p.volume_cbm),0) from expedition_packages ep join cargo_packages p on p.id=ep.package_id where ep.org_id=:o and ep.expedition_id=:e and ep.removed_at is null) where org_id=:o and id=:e"),{'o':o,'e':exp['id']})
