import csv, hashlib, io, json, math
from decimal import Decimal, ROUND_CEILING
from fastapi import HTTPException
from sqlalchemy import text
from app.db.database import engine

def _rows(result): return [dict(x) for x in result.mappings().all()]
def _money(v): return Decimal(str(v or 0)).quantize(Decimal("0.01"))
def _json(v): return json.dumps(v, default=str)
def _audit(c,o,g,event,a,n,new=None,old=None,reason=None):
 c.execute(text("insert into pricing_audit_events(org_id,grid_id,event_type,old_values,new_values,reason,actor_id,actor_name) values(:o,cast(:g as uuid),:e,cast(:old as jsonb),cast(:new as jsonb),:r,:a,:n)"),{"o":o,"g":g,"e":event,"old":_json(old) if old else None,"new":_json(new) if new else None,"r":reason,"a":a,"n":n})

def dashboard(o):
 with engine.connect() as c:
  stats=dict(c.execute(text("""select count(*) filter(where status='ACTIVE')::int active_grids,count(distinct route_id) filter(where status='ACTIVE')::int priced_routes,count(distinct shipping_service_id) filter(where status='ACTIVE')::int priced_services,(select count(*)::int from pricing_grid_rules where org_id=:o and active) special_rules,(select count(*)::int from pricing_promotions where org_id=:o and status='ACTIVE' and effective_from<=now() and (effective_until is null or effective_until>now())) active_promotions,count(*) filter(where status='ACTIVE' and effective_until between now() and now()+interval '30 days')::int expiring_soon,max(updated_at) last_modified from pricing_grids where org_id=:o and archived_at is null"""),{"o":o}).mappings().one())
  settings=dict(c.execute(text("select * from pricing_settings where org_id=:o"),{"o":o}).mappings().first() or {})
  alerts=_rows(c.execute(text("select * from pricing_alerts where org_id=:o and status='OPEN' order by severity desc,created_at desc limit 20"),{"o":o}))
  grids=_rows(c.execute(text("""select g.*,r.route_name,r.origin_city,r.origin_country,r.destination_city,r.destination_country,s.service_name,s.shipping_mode,
   (select x.amount from pricing_grid_rules x where x.org_id=g.org_id and x.grid_id=g.id and x.active and x.action_type='SET_PRICE' and x.category_id is null and x.client_id is null and x.client_segment is null order by x.priority desc limit 1) base_price,
   (select coalesce(x.calculation_method,g.calculation_method) from pricing_grid_rules x where x.org_id=g.org_id and x.grid_id=g.id and x.active and x.action_type='SET_PRICE' and x.category_id is null and x.client_id is null and x.client_segment is null order by x.priority desc limit 1) base_price_method,
   (select count(*) from pricing_grid_rules x where x.grid_id=g.id and x.active)::int rule_count,
   (select count(*) from pricing_tiers x where x.grid_id=g.id)::int tier_count,
   (select count(*) from pricing_fees x where x.grid_id=g.id and x.active)::int fee_count
   from pricing_grids g join shipping_routes r on r.id=g.route_id and r.org_id=g.org_id join shipping_services s on s.id=g.shipping_service_id and s.org_id=g.org_id where g.org_id=:o and g.archived_at is null order by g.status='ACTIVE' desc,g.updated_at desc limit 100"""),{"o":o}))
  return {"stats":stats,"settings":settings,"alerts":alerts,"grids":grids}

def create_grid(o,a,n,p):
 initial_price=p.pop('initial_price',None)
 with engine.begin() as c:
  service=c.execute(text("""select s.id from shipping_services s
   where s.org_id=:o and s.id=cast(:s as uuid) and s.active
   and s.status in('ACTIVE','LIMITED') and s.archived_at is null
   and (s.route_id=cast(:r as uuid) or exists(
    select 1 from service_route_offerings x where x.org_id=s.org_id and x.service_id=s.id
    and x.route_id=cast(:r as uuid) and x.availability in('AVAILABLE','LIMITED')
    and x.effective_from<=now() and (x.effective_until is null or x.effective_until>now())
   )) and exists(select 1 from shipping_routes r where r.org_id=s.org_id and r.id=cast(:r as uuid)
    and r.active and r.status in('ACTIVE','LIMITED') and r.archived_at is null)"""),{"o":o,"s":p['shipping_service_id'],"r":p['route_id']}).first()
  if not service: raise HTTPException(422,"route_service_mismatch")
  row=dict(c.execute(text("""insert into pricing_grids(org_id,workspace_id,grid_code,name,description,route_id,shipping_service_id,currency_code,calculation_method,visibility,status,effective_from,effective_until,volumetric_divisor,chargeable_weight_rule,rounding_increment,minimum_weight_kg,minimum_cbm,maximum_weight_kg,maximum_cbm,maximum_declared_value,tax_inclusive,tax_rate,requires_approval,created_by,updated_by) values(:o,:workspace_id,:grid_code,:name,:description,cast(:route_id as uuid),cast(:shipping_service_id as uuid),upper(:currency_code),:calculation_method,:visibility,'DRAFT',:effective_from,:effective_until,:volumetric_divisor,:chargeable_weight_rule,:rounding_increment,:minimum_weight_kg,:minimum_cbm,:maximum_weight_kg,:maximum_cbm,:maximum_declared_value,:tax_inclusive,:tax_rate,:requires_approval,:a,:a) returning *"""),{"o":o,"a":a,**p}).mappings().one())
  _audit(c,o,str(row['id']),'GRID_CREATED',a,n,new=row)
  if initial_price is not None:
   rule=dict(c.execute(text("""insert into pricing_grid_rules(
      org_id,grid_id,rule_code,name,conditions,action_type,calculation_method,amount,
      percentage,priority,stackable,active,effective_from)
     values(:o,:g,:code,'Tarif de base','{}'::jsonb,'SET_PRICE',:method,:amount,
      null,100,false,true,:effective_from) returning *"""),{
       "o":o,"g":row["id"],"code":f"BASE-{p['grid_code']}",
       "method":p["calculation_method"],"amount":initial_price,
       "effective_from":p["effective_from"],
   }).mappings().one())
   _audit(c,o,str(row['id']),'RULE_CREATED',a,n,new=rule)
  return row

def create_category(o,p,a,n):
 code=p['code'].strip().upper()
 if not code: raise HTTPException(422,"pricing_category_code_required")
 with engine.begin() as c:
  row=c.execute(text("""insert into pricing_categories(org_id,code,name,description,risk_class)
   values(:o,:code,:name,:description,:risk_class)
   on conflict(org_id,code) do nothing returning *"""),
   {"o":o,"code":code,"name":p['name'].strip(),"description":p.get('description'),"risk_class":p.get('risk_class') or "ORDINARY"}).mappings().first()
  if not row: raise HTTPException(409,"pricing_category_code_exists")
  _audit(c,o,None,'CATEGORY_CREATED',a,n,new=dict(row))
  return dict(row)

def create_version(o,g,effective_from,a,n):
 with engine.begin() as c:
  old=c.execute(text("select * from pricing_grids where org_id=:o and id=cast(:g as uuid) and archived_at is null for update"),{"o":o,"g":g}).mappings().first()
  if not old: raise HTTPException(404,"pricing_grid_not_found")
  version=c.execute(text("select coalesce(max(version),0)+1 from pricing_grids where org_id=:o and grid_code=:code"),{"o":o,"code":old['grid_code']}).scalar_one()
  params={"o":o,"g":g,"a":a,"version":version,"effective_from":effective_from}
  row=dict(c.execute(text("""insert into pricing_grids
   (org_id,workspace_id,grid_code,name,description,route_id,shipping_service_id,currency_code,calculation_method,visibility,status,effective_from,effective_until,volumetric_divisor,chargeable_weight_rule,rounding_increment,minimum_weight_kg,minimum_cbm,maximum_weight_kg,maximum_cbm,maximum_declared_value,weight_volume_switch_kg_per_cbm,tax_inclusive,tax_rate,requires_approval,version,created_by,updated_by)
   select org_id,workspace_id,grid_code,name,description,route_id,shipping_service_id,currency_code,calculation_method,visibility,'DRAFT',:effective_from,null,volumetric_divisor,chargeable_weight_rule,rounding_increment,minimum_weight_kg,minimum_cbm,maximum_weight_kg,maximum_cbm,maximum_declared_value,weight_volume_switch_kg_per_cbm,tax_inclusive,tax_rate,requires_approval,:version,:a,:a
   from pricing_grids where org_id=:o and id=cast(:g as uuid) returning *"""),params).mappings().one())
  c.execute(text("""with copied as (
   insert into pricing_grid_rules(org_id,grid_id,rule_code,name,category_id,client_id,client_segment,warehouse_id,office_id,min_weight_kg,max_weight_kg,min_cbm,max_cbm,min_value,max_value,min_units,max_units,conditions,action_type,calculation_method,amount,percentage,priority,stackable,active,effective_from,effective_until)
   select org_id,:new,rule_code,name,category_id,client_id,client_segment,warehouse_id,office_id,min_weight_kg,max_weight_kg,min_cbm,max_cbm,min_value,max_value,min_units,max_units,conditions,action_type,calculation_method,amount,percentage,priority,stackable,active,:effective_from,effective_until
   from pricing_grid_rules where org_id=:o and grid_id=cast(:g as uuid) returning id,rule_code
  )
  insert into pricing_tiers(org_id,grid_id,rule_id,basis,min_quantity,max_quantity,unit_price,priority,calculation_method)
  select t.org_id,:new,c.id,t.basis,t.min_quantity,t.max_quantity,t.unit_price,t.priority,t.calculation_method
  from pricing_tiers t left join pricing_grid_rules old_rule on old_rule.id=t.rule_id and old_rule.org_id=t.org_id
  left join copied c on c.rule_code=old_rule.rule_code
  where t.org_id=:o and t.grid_id=cast(:g as uuid)"""),{**params,"new":row['id']})
  c.execute(text("""insert into pricing_fees(org_id,grid_id,fee_code,name,fee_type,calculation_method,amount,conditions,taxable,active,priority)
   select org_id,:new,fee_code,name,fee_type,calculation_method,amount,conditions,taxable,active,priority
   from pricing_fees where org_id=:o and grid_id=cast(:g as uuid)"""),{**params,"new":row['id']})
  c.execute(text("""insert into pricing_internal_costs(org_id,grid_id,cost_code,cost_type,calculation_method,amount,currency_code,effective_from,effective_until,created_by)
   select org_id,:new,cost_code,cost_type,calculation_method,amount,currency_code,:effective_from,effective_until,:a
   from pricing_internal_costs where org_id=:o and grid_id=cast(:g as uuid)"""),{**params,"new":row['id']})
  _audit(c,o,str(row['id']),'GRID_VERSION_CREATED',a,n,new=row,old={"grid_id":g,"version":old["version"]})
  return row

def detail(o,g):
 with engine.connect() as c:
  row=c.execute(text("select g.*,r.route_name,s.service_name,s.shipping_mode from pricing_grids g join shipping_routes r on r.id=g.route_id join shipping_services s on s.id=g.shipping_service_id where g.org_id=:o and g.id=cast(:g as uuid)"),{"o":o,"g":g}).mappings().first()
  if not row: raise HTTPException(404,"pricing_grid_not_found")
  return {"grid":dict(row),"rules":_rows(c.execute(text("select x.*,cat.name category_name from pricing_grid_rules x left join pricing_categories cat on cat.id=x.category_id where x.org_id=:o and x.grid_id=:g order by x.priority desc"),{"o":o,"g":g})),"tiers":_rows(c.execute(text("select * from pricing_tiers where org_id=:o and grid_id=:g order by basis,min_quantity"),{"o":o,"g":g})),"fees":_rows(c.execute(text("select * from pricing_fees where org_id=:o and grid_id=:g order by priority"),{"o":o,"g":g})),"costs":_rows(c.execute(text("select * from pricing_internal_costs where org_id=:o and grid_id=:g order by created_at desc"),{"o":o,"g":g})),"audit":_rows(c.execute(text("select * from pricing_audit_events where org_id=:o and grid_id=:g order by created_at desc limit 100"),{"o":o,"g":g}))}

def add_child(o,g,kind,p,a,n):
 with engine.begin() as c:
  if not c.execute(text("select 1 from pricing_grids where org_id=:o and id=cast(:g as uuid) and archived_at is null and status='DRAFT'"),{"o":o,"g":g}).first(): raise HTTPException(409,"pricing_grid_not_editable")
  if kind=='rule' and p.get('category_id') and not c.execute(text("select 1 from pricing_categories where org_id=:o and id=cast(:category as uuid) and active"),{"o":o,"category":p['category_id']}).first(): raise HTTPException(422,"pricing_category_not_found")
  if kind=='tier':
   minimum=Decimal(str(p['min_quantity']))
   maximum=Decimal(str(p['max_quantity'])) if p.get('max_quantity') is not None else None
   if maximum is not None and maximum<=minimum: raise HTTPException(422,"invalid_pricing_tier_range")
   overlap=c.execute(text("""select 1 from pricing_tiers where org_id=:o and grid_id=cast(:g as uuid)
    and basis=:basis and rule_id is not distinct from cast(:rule_id as uuid)
    and (:max is null or min_quantity<:max) and (max_quantity is null or :min<max_quantity) limit 1"""),
    {"o":o,"g":g,"basis":p['basis'],"rule_id":p.get('rule_id'),"min":minimum,"max":maximum}).first()
   if overlap: raise HTTPException(409,"pricing_tier_range_overlap")
  if kind=='rule': sql="insert into pricing_grid_rules(org_id,grid_id,rule_code,name,category_id,client_id,client_segment,warehouse_id,office_id,min_weight_kg,max_weight_kg,min_cbm,max_cbm,min_value,max_value,min_units,max_units,conditions,action_type,calculation_method,amount,percentage,priority,stackable,effective_from,effective_until) values(:o,:g,:rule_code,:name,cast(:category_id as uuid),cast(:client_id as uuid),:client_segment,cast(:warehouse_id as uuid),cast(:office_id as uuid),:min_weight_kg,:max_weight_kg,:min_cbm,:max_cbm,:min_value,:max_value,:min_units,:max_units,cast(:conditions as jsonb),:action_type,:calculation_method,:amount,:percentage,:priority,:stackable,:effective_from,:effective_until) returning *"; p={**p,"conditions":_json(p.get('conditions') or {})}
  elif kind=='tier': sql="insert into pricing_tiers(org_id,grid_id,rule_id,basis,min_quantity,max_quantity,unit_price,priority,calculation_method) values(:o,:g,cast(:rule_id as uuid),:basis,:min_quantity,:max_quantity,:unit_price,:priority,:calculation_method) returning *"
  elif kind=='fee': sql="insert into pricing_fees(org_id,grid_id,fee_code,name,fee_type,calculation_method,amount,conditions,taxable,priority) values(:o,:g,:fee_code,:name,:fee_type,:calculation_method,:amount,cast(:conditions as jsonb),:taxable,:priority) returning *"; p={**p,"conditions":_json(p.get('conditions') or {})}
  elif kind=='cost': sql="insert into pricing_internal_costs(org_id,grid_id,cost_code,cost_type,calculation_method,amount,currency_code,effective_from,effective_until,created_by) values(:o,:g,:cost_code,:cost_type,:calculation_method,:amount,:currency_code,:effective_from,:effective_until,:a) returning *"
  else: raise HTTPException(422,"invalid_pricing_child")
  row=dict(c.execute(text(sql),{"o":o,"g":g,"a":a,**p}).mappings().one()); c.execute(text("update pricing_grids set row_version=row_version+1,updated_by=:a,updated_at=now() where id=:g and org_id=:o"),{"a":a,"g":g,"o":o}); _audit(c,o,g,kind.upper()+'_CREATED',a,n,new=row); return row

def transition(o,g,status,a,n,reason=None):
 allowed={'DRAFT':{'SCHEDULED','ACTIVE','ARCHIVED'},'SCHEDULED':{'ACTIVE','SUSPENDED','ARCHIVED'},'ACTIVE':{'SUSPENDED','EXPIRED','ARCHIVED'},'SUSPENDED':{'ACTIVE','ARCHIVED'},'EXPIRED':{'ARCHIVED'},'ARCHIVED':set()}
 with engine.begin() as c:
  old=c.execute(text("select * from pricing_grids where org_id=:o and id=cast(:g as uuid) for update"),{"o":o,"g":g}).mappings().first()
  if not old: raise HTTPException(404,"pricing_grid_not_found")
  if status not in allowed.get(old['status'],set()): raise HTTPException(409,"invalid_pricing_transition")
  if status=='ACTIVE' and old['requires_approval'] and not old['approved_at']: raise HTTPException(409,"pricing_approval_required")
  if status in ('ACTIVE','SCHEDULED'):
   if status=='SCHEDULED' and not old['approved_at']: raise HTTPException(409,"pricing_approval_required")
   if not _grid_has_price(c,o,g,old['calculation_method']): raise HTTPException(409,"pricing_grid_has_no_price_rules")
  if status=='ACTIVE':
   future=c.execute(text("""select 1 from pricing_grids where org_id=:o and id<>cast(:g as uuid)
    and route_id=:route and shipping_service_id=:service and status='ACTIVE'
    and effective_from>=:starts and (effective_until is null or effective_until>:starts) limit 1"""),
    {"o":o,"g":g,"route":old['route_id'],"service":old['shipping_service_id'],"starts":old['effective_from']}).first()
   if future: raise HTTPException(409,"pricing_version_overlap")
   c.execute(text("""update pricing_grids set effective_until=:starts,status='EXPIRED',updated_at=now()
    where org_id=:o and id<>cast(:g as uuid) and route_id=:route and shipping_service_id=:service
      and status='ACTIVE' and effective_from<:starts
      and (effective_until is null or effective_until>:starts)"""),
    {"o":o,"g":g,"route":old['route_id'],"service":old['shipping_service_id'],"starts":old['effective_from']})
  row=dict(c.execute(text("update pricing_grids set status=:s,effective_until=case when :s='EXPIRED' and (effective_until is null or effective_until>now()) then now() else effective_until end,archived_at=case when :s='ARCHIVED' then now() else archived_at end,row_version=row_version+1,updated_by=:a,updated_at=now() where org_id=:o and id=:g returning *"),{"s":status,"a":a,"o":o,"g":g}).mappings().one());_audit(c,o,g,'GRID_'+status,a,n,new=row,old=dict(old),reason=reason);return row

def _grid_has_price(c,o,g,method):
 rules=c.execute(text("""select 1 from pricing_grid_rules where org_id=:o and grid_id=cast(:g as uuid)
  and active and action_type='SET_PRICE' limit 1"""),{"o":o,"g":g}).first()
 if rules: return True
 if method=='TIERED':
  return bool(c.execute(text("select 1 from pricing_tiers where org_id=:o and grid_id=cast(:g as uuid) limit 1"),{"o":o,"g":g}).first())
 return False

def approve(o,g,a,n,note=None):
 with engine.begin() as c:
  row=c.execute(text("update pricing_grids set approved_by=:a,approved_at=now(),updated_by=:a,updated_at=now(),row_version=row_version+1 where org_id=:o and id=cast(:g as uuid) and status in('DRAFT','SCHEDULED','SUSPENDED') returning *"),{"a":a,"o":o,"g":g}).mappings().first()
  if not row: raise HTTPException(409,"grid_not_approvable")
  c.execute(text("insert into pricing_approvals(org_id,grid_id,status,reason,requested_by,decided_by,decision_note,decided_at) values(:o,:g,'APPROVED','Direct approval',:a,:a,:note,now())"),{"o":o,"g":g,"a":a,"note":note});_audit(c,o,g,'GRID_APPROVED',a,n,new=dict(row),reason=note);return dict(row)

def duplicate(o,g,a,n):
 with engine.begin() as c:
  old=c.execute(text("select * from pricing_grids where org_id=:o and id=cast(:g as uuid)"),{"o":o,"g":g}).mappings().first()
  if not old: raise HTTPException(404,"pricing_grid_not_found")
  code=f"{old['grid_code']}-COPY-{str(old['id'])[:4]}"
  row=dict(c.execute(text("""insert into pricing_grids(org_id,workspace_id,grid_code,name,description,route_id,shipping_service_id,currency_code,calculation_method,visibility,status,effective_from,effective_until,volumetric_divisor,chargeable_weight_rule,rounding_increment,minimum_weight_kg,minimum_cbm,maximum_weight_kg,maximum_cbm,maximum_declared_value,tax_inclusive,tax_rate,requires_approval,created_by,updated_by) select org_id,workspace_id,:code,name||' — copie',description,route_id,shipping_service_id,currency_code,calculation_method,visibility,'DRAFT',now(),null,volumetric_divisor,chargeable_weight_rule,rounding_increment,minimum_weight_kg,minimum_cbm,maximum_weight_kg,maximum_cbm,maximum_declared_value,tax_inclusive,tax_rate,requires_approval,:a,:a from pricing_grids where org_id=:o and id=:g returning *"""),{"o":o,"g":g,"code":code,"a":a}).mappings().one())
  c.execute(text("insert into pricing_grid_rules(org_id,grid_id,rule_code,name,category_id,client_id,client_segment,warehouse_id,office_id,min_weight_kg,max_weight_kg,min_cbm,max_cbm,min_value,max_value,min_units,max_units,conditions,action_type,calculation_method,amount,percentage,priority,stackable,active,effective_from,effective_until) select org_id,:new,rule_code,name,category_id,client_id,client_segment,warehouse_id,office_id,min_weight_kg,max_weight_kg,min_cbm,max_cbm,min_value,max_value,min_units,max_units,conditions,action_type,calculation_method,amount,percentage,priority,stackable,active,now(),null from pricing_grid_rules where org_id=:o and grid_id=:old"),{"new":row['id'],"o":o,"old":g});c.execute(text("insert into pricing_tiers(org_id,grid_id,basis,min_quantity,max_quantity,unit_price,priority) select org_id,:new,basis,min_quantity,max_quantity,unit_price,priority from pricing_tiers where org_id=:o and grid_id=:old"),{"new":row['id'],"o":o,"old":g});c.execute(text("insert into pricing_fees(org_id,grid_id,fee_code,name,fee_type,calculation_method,amount,conditions,taxable,active,priority) select org_id,:new,fee_code,name,fee_type,calculation_method,amount,conditions,taxable,active,priority from pricing_fees where org_id=:o and grid_id=:old"),{"new":row['id'],"o":o,"old":g});_audit(c,o,str(row['id']),'GRID_DUPLICATED',a,n,new={"source_grid_id":g});return row

def create_promotion(o,p,a,n):
 with engine.begin() as c:
  row=dict(c.execute(text("""insert into pricing_promotions(org_id,workspace_id,code,name,discount_type,discount_value,route_ids,service_ids,client_ids,client_segments,conditions,stackable,usage_limit,status,effective_from,effective_until,created_by) values(:o,:workspace_id,upper(:code),:name,:discount_type,:discount_value,:route_ids,:service_ids,:client_ids,:client_segments,cast(:conditions as jsonb),:stackable,:usage_limit,:status,:effective_from,:effective_until,:a) returning *"""),{"o":o,"a":a,**p,"conditions":_json(p.get('conditions') or {})}).mappings().one());_audit(c,o,None,'PROMOTION_CREATED',a,n,new=row);return row

def save_settings(o,p,a,n):
 with engine.begin() as c:
  old=dict(c.execute(text("select * from pricing_settings where org_id=:o for update"),{"o":o}).mappings().first() or {})
  row=dict(c.execute(text("""insert into pricing_settings(org_id,default_currency,minimum_margin_percent,max_agent_discount_percent,approval_required,allow_discount_stacking,default_volumetric_divisor,updated_by) values(:o,:default_currency,:minimum_margin_percent,:max_agent_discount_percent,:approval_required,:allow_discount_stacking,:default_volumetric_divisor,:a) on conflict(org_id) do update set default_currency=excluded.default_currency,minimum_margin_percent=excluded.minimum_margin_percent,max_agent_discount_percent=excluded.max_agent_discount_percent,approval_required=excluded.approval_required,allow_discount_stacking=excluded.allow_discount_stacking,default_volumetric_divisor=excluded.default_volumetric_divisor,updated_by=excluded.updated_by,updated_at=now() returning *"""),{"o":o,"a":a,**p}).mappings().one());_audit(c,o,None,'SETTINGS_UPDATED',a,n,old=old,new=row);return row

def detect_alerts(o):
 with engine.begin() as c:
  c.execute(text("""insert into pricing_alerts(org_id,grid_id,alert_type,severity,message) select g.org_id,g.id,'LOW_MARGIN','HIGH','La marge estimée est inférieure au seuil configuré.' from pricing_grids g join pricing_settings s on s.org_id=g.org_id join pricing_quote_snapshots q on q.grid_id=g.id and q.org_id=g.org_id where g.org_id=:o and g.status='ACTIVE' and (q.result_payload->>'margin_percent')::numeric<s.minimum_margin_percent and q.created_at>now()-interval '30 days' on conflict(org_id,grid_id,alert_type,status) do nothing"""),{"o":o});c.execute(text("""insert into pricing_alerts(org_id,grid_id,alert_type,severity,message) select org_id,id,'EXPIRING','MEDIUM','Cette grille expire dans moins de 30 jours.' from pricing_grids where org_id=:o and status='ACTIVE' and effective_until between now() and now()+interval '30 days' on conflict(org_id,grid_id,alert_type,status) do nothing"""),{"o":o});return {"detected":c.execute(text("select count(*) from pricing_alerts where org_id=:o and status='OPEN'"),{"o":o}).scalar_one()}

def _match(rule,p):
 checks=(('min_weight_kg','weight_kg',lambda a,b:b>=a),('max_weight_kg','weight_kg',lambda a,b:b<=a),('min_cbm','volume_cbm',lambda a,b:b>=a),('max_cbm','volume_cbm',lambda a,b:b<=a),('min_value','declared_value',lambda a,b:b>=a),('max_value','declared_value',lambda a,b:b<=a),('min_units','units',lambda a,b:b>=a),('max_units','units',lambda a,b:b<=a))
 for rk,pk,op in checks:
  if rule.get(rk) is not None and not op(Decimal(str(rule[rk])),Decimal(str(p.get(pk) or 0))): return False
 if rule.get('client_id') and str(rule['client_id'])!=str(p.get('client_id')): return False
 if rule.get('client_segment') and rule['client_segment']!=p.get('client_segment'): return False
 if rule.get('category_code') and rule['category_code']!=p.get('category_code'): return False
 return True

def quote(o,p,a):
 with engine.begin() as c:
  if p.get('freeze') and p.get('idempotency_key'):
   prior=c.execute(text("select input_payload,result_payload from pricing_quote_snapshots where org_id=:o and idempotency_key=:key"),{"o":o,"key":p['idempotency_key']}).mappings().first()
   if prior:
    saved_input=prior['input_payload'] if isinstance(prior['input_payload'],dict) else json.loads(prior['input_payload'])
    if saved_input!=json.loads(_json(p)): raise HTTPException(409,"pricing_idempotency_key_conflict")
    return prior['result_payload'] if isinstance(prior['result_payload'],dict) else json.loads(prior['result_payload'])
  grid=c.execute(text("""select g.* from pricing_grids g where g.org_id=:o and g.route_id=cast(:route as uuid)
   and g.shipping_service_id=cast(:service as uuid) and g.status in('ACTIVE','EXPIRED','SCHEDULED')
   and g.effective_from<=:at and (g.effective_until is null or g.effective_until>:at)
   and (g.status<>'SCHEDULED' or g.approved_at is not null)
   and (g.workspace_id is null or :workspace is null or g.workspace_id=:workspace)
   order by g.workspace_id is not null desc,g.version desc limit 1"""),{"o":o,"route":p['route_id'],"service":p['shipping_service_id'],"at":p['priced_at'],"workspace":p.get('workspace_id')}).mappings().first()
  if not grid: raise HTTPException(422,"no_active_pricing_grid")
  actual=Decimal(str(p.get('weight_kg') or 0)); cbm=Decimal(str(p.get('volume_cbm') or 0))
  if not cbm and p.get('length_cm') and p.get('width_cm') and p.get('height_cm'): cbm=Decimal(str(p['length_cm']))*Decimal(str(p['width_cm']))*Decimal(str(p['height_cm']))/Decimal('1000000')
  measured_cbm=cbm
  volumetric=(cbm*Decimal('1000000'))/Decimal(str(grid['volumetric_divisor']))
  chargeable={'ACTUAL':actual,'VOLUMETRIC':volumetric}.get(grid['chargeable_weight_rule'],max(actual,volumetric)); inc=Decimal(str(grid['rounding_increment'])); chargeable=(chargeable/inc).to_integral_value(rounding=ROUND_CEILING)*inc
  chargeable=max(chargeable,Decimal(str(grid['minimum_weight_kg'] or 0))); cbm=max(cbm,Decimal(str(grid['minimum_cbm'] or 0)))
  density_threshold=grid.get('weight_volume_switch_kg_per_cbm')
  density_switch=bool(density_threshold and measured_cbm and actual/measured_cbm>Decimal(str(density_threshold)))
  if density_switch:
   chargeable=(actual/inc).to_integral_value(rounding=ROUND_CEILING)*inc
   chargeable=max(chargeable,Decimal(str(grid['minimum_weight_kg'] or 0)))
  if (grid['maximum_weight_kg'] and actual>grid['maximum_weight_kg']) or (grid['maximum_cbm'] and cbm>grid['maximum_cbm']) or (grid['maximum_declared_value'] and Decimal(str(p.get('declared_value') or 0))>grid['maximum_declared_value']): raise HTTPException(422,"manual_quote_required")
  rules=_rows(c.execute(text("select x.*,cat.code category_code from pricing_grid_rules x left join pricing_categories cat on cat.id=x.category_id and cat.org_id=x.org_id where x.org_id=:o and x.grid_id=:g and x.active and x.effective_from<=:at and (x.effective_until is null or x.effective_until>:at) order by (x.client_id is not null) desc,(x.client_segment is not null) desc,(x.category_id is not null) desc,x.priority desc"),{"o":o,"g":grid['id'],"at":p['priced_at']}))
  matched=[r for r in rules if _match(r,p)]; blockers=[r for r in matched if r['action_type'] in('PROHIBIT','MANUAL_QUOTE')]
  if blockers: raise HTTPException(422,blockers[0]['action_type'].lower())
  base_rule=next((r for r in matched if r['action_type']=='SET_PRICE'),None)
  if not base_rule and grid['calculation_method']!='TIERED':
   category_prices=[r for r in rules if r['action_type']=='SET_PRICE' and r.get('category_id')]
   if category_prices and not p.get('category_code'): raise HTTPException(422,{"code":"pricing_input_required","field":"category_code"})
   if category_prices: raise HTTPException(422,"no_matching_pricing_rule")
   raise HTTPException(422,"pricing_grid_has_no_price_rules")
  method=(base_rule or {}).get('calculation_method') or grid['calculation_method']
  if density_switch and method=='PER_CBM': method='PER_KG'
  unit_price=Decimal(str((base_rule or {}).get('amount') or 0))
  if method=='TIERED':
   basis='WEIGHT' if density_switch else ('CBM' if cbm else 'WEIGHT')
   qty=cbm if basis=='CBM' else chargeable
   tier=c.execute(text("select * from pricing_tiers where org_id=:o and grid_id=:g and basis=:b and rule_id is not distinct from cast(:rule as uuid) and min_quantity<=:q and (max_quantity is null or max_quantity>:q) order by priority desc,min_quantity desc limit 1"),{"o":o,"g":grid['id'],"b":basis,"rule":base_rule.get('id') if base_rule else None,"q":qty}).mappings().first()
   if not tier: raise HTTPException(422,"no_matching_pricing_tier")
   unit_price=Decimal(str(tier['unit_price'])); method=tier['calculation_method']
   if method=='PER_UNIT':
    method={'CBM':'PER_CBM','WEIGHT':'PER_KG','UNITS':'PER_UNIT','VALUE':'PERCENT_VALUE'}.get(basis)
    if not method: raise HTTPException(422,"manual_quote_required")
  quantities={'PER_KG':chargeable,'PER_CBM':cbm,'PER_PACKAGE':Decimal('1'),'PER_UNIT':Decimal(str(p.get('units') or 1)),'PERCENT_VALUE':Decimal(str(p.get('declared_value') or 0))/100,'FIXED':Decimal('1'),'CUSTOM':Decimal('1')}; qty=quantities[method]
  if method in ('PER_KG','PER_CBM','PERCENT_VALUE') and qty<=0: raise HTTPException(422,{"code":"pricing_input_required","field":{"PER_KG":"weight_kg","PER_CBM":"volume_cbm","PERCENT_VALUE":"declared_value"}[method]})
  subtotal=qty*unit_price
  breakdown=[{"type":"TRANSPORT","label":f"{qty} × {unit_price} ({method})","amount":float(_money(subtotal))}]
  if density_switch: breakdown.append({"type":"RULE","label":f"Facturation au poids : densité supérieure à {density_threshold} kg/CBM","amount":0})
  fees=[];taxable_fees=[]
  for f in _rows(c.execute(text("select * from pricing_fees where org_id=:o and grid_id=:g and active order by priority"),{"o":o,"g":grid['id']})):
   conditions=f.get('conditions') or {}
   if conditions and not _match(conditions,p): continue
   amount=Decimal(str(f['amount'])); calc=f['calculation_method']; value={'FIXED':amount,'PER_KG':amount*chargeable,'PER_CBM':amount*cbm,'PERCENT_SUBTOTAL':subtotal*amount/100,'PERCENT_VALUE':Decimal(str(p.get('declared_value') or 0))*amount/100}[calc];fees.append(value);breakdown.append({"type":"FEE","code":f['fee_code'],"label":f['name'],"amount":float(_money(value))})
   if f['taxable']:taxable_fees.append(value)
  discount=Decimal('0')
  for r in [x for x in matched if x['action_type']=='APPLY_DISCOUNT']:
   value=subtotal*Decimal(str(r.get('percentage') or 0))/100 if r.get('percentage') is not None else Decimal(str(r.get('amount') or 0));discount+=value;breakdown.append({"type":"DISCOUNT","code":r['rule_code'],"label":r['name'],"amount":-float(_money(value))});
   if not r['stackable']: break
  discount=min(discount,subtotal+sum(fees))
  before_tax=subtotal+sum(fees)-discount
  taxable_amount=max(Decimal('0'),subtotal+sum(taxable_fees)-discount)
  tax=Decimal('0') if grid['tax_inclusive'] else taxable_amount*Decimal(str(grid['tax_rate']))/100; total=_money(before_tax+tax)
  if tax: breakdown.append({"type":"TAX","label":f"Taxe {grid['tax_rate']}%","amount":float(_money(tax))})
  costs=c.execute(text("select calculation_method,amount from pricing_internal_costs where org_id=:o and grid_id=:g and effective_from<=:at and (effective_until is null or effective_until>:at)"),{"o":o,"g":grid['id'],"at":p['priced_at']}).mappings().all();cost=sum((Decimal(str(x['amount']))*({'PER_KG':chargeable,'PER_CBM':cbm,'PERCENTAGE':subtotal/100,'FIXED':Decimal(1)}[x['calculation_method']]) for x in costs),Decimal(0));margin=total-cost; margin_pct=(margin/total*100) if total else Decimal(0)
  result={"grid_id":str(grid['id']),"grid_code":grid['grid_code'],"grid_version":grid['version'],"currency":grid['currency_code'],"actual_weight_kg":float(actual),"volumetric_weight_kg":float(volumetric),"chargeable_weight_kg":float(chargeable),"volume_cbm":float(cbm),"subtotal":float(_money(subtotal)),"fees_total":float(_money(sum(fees))),"discount_total":float(_money(discount)),"tax_total":float(_money(tax)),"total":float(total),"cost_total":float(_money(cost)),"margin":float(_money(margin)),"margin_percent":float(margin_pct.quantize(Decimal('.01'))),"breakdown":breakdown,"applied_rule_ids":[str(x['id']) for x in matched],"requires_confirmation":True}
  fingerprint=hashlib.sha256(_json({"input":p,"result":result}).encode()).hexdigest();result['fingerprint']=fingerprint
  if p.get('freeze'):
   c.execute(text("insert into pricing_quote_snapshots(org_id,workspace_id,grid_id,grid_version,client_id,dossier_id,input_payload,result_payload,currency_code,exchange_rate,fingerprint,idempotency_key,created_by) values(:o,:workspace,:g,:v,cast(:client as uuid),cast(:dossier as uuid),cast(:input as jsonb),cast(:result as jsonb),:currency,:rate,:fingerprint,:key,:a)"),{"o":o,"workspace":p.get('workspace_id'),"g":grid['id'],"v":grid['version'],"client":p.get('client_id'),"dossier":p.get('dossier_id'),"input":_json(p),"result":_json(result),"currency":grid['currency_code'],"rate":p.get('exchange_rate') or 1,"fingerprint":fingerprint,"key":p.get('idempotency_key'),"a":a})
  return result

def catalog(o):
 with engine.connect() as c:return {"routes":_rows(c.execute(text("select id,route_code,route_name,origin_country,origin_city,destination_country,destination_city from shipping_routes where org_id=:o and active and archived_at is null and status in('ACTIVE','LIMITED') order by route_name"),{"o":o})),"services":_rows(c.execute(text("""select distinct s.id,coalesce(x.route_id,s.route_id) route_id,s.service_code,s.service_name,s.shipping_mode
  from shipping_services s left join service_route_offerings x on x.org_id=s.org_id and x.service_id=s.id
   and x.availability in('AVAILABLE','LIMITED') and x.effective_from<=now()
   and (x.effective_until is null or x.effective_until>now())
  join shipping_routes r on r.org_id=s.org_id and r.id=coalesce(x.route_id,s.route_id) and r.active and r.archived_at is null and r.status in('ACTIVE','LIMITED')
  where s.org_id=:o and s.active and s.status in('ACTIVE','LIMITED') and s.archived_at is null and coalesce(x.route_id,s.route_id) is not null order by s.service_name"""),{"o":o})),"categories":_rows(c.execute(text("select * from pricing_categories where org_id=:o and active order by name"),{"o":o})),"promotions":_rows(c.execute(text("select * from pricing_promotions where org_id=:o order by created_at desc"),{"o":o}))}

def analytics(o):
 with engine.connect() as c:return {"by_route":_rows(c.execute(text("select r.route_name label,count(s.id)::int simulations,round(avg((s.result_payload->>'total')::numeric),2) average_price,round(avg((s.result_payload->>'margin_percent')::numeric),2) average_margin from pricing_quote_snapshots s join pricing_grids g on g.id=s.grid_id join shipping_routes r on r.id=g.route_id where s.org_id=:o group by r.id order by simulations desc"),{"o":o})),"by_category":_rows(c.execute(text("select coalesce(input_payload->>'category_code','Non classé') label,count(*)::int simulations,round(avg((result_payload->>'total')::numeric),2) average_price from pricing_quote_snapshots where org_id=:o group by 1 order by 2 desc"),{"o":o}))}

def save_view(o,u,name,filters):
 with engine.begin() as c:return dict(c.execute(text("insert into pricing_saved_views(org_id,user_id,name,filters) values(:o,:u,:n,cast(:f as jsonb)) on conflict(org_id,user_id,name) do update set filters=excluded.filters returning *"),{"o":o,"u":u,"n":name,"f":_json(filters)}).mappings().one())
def export_csv(o):
 data=dashboard(o)['grids'];out=io.StringIO();w=csv.writer(out);w.writerow(['code','name','route','service','method','currency','status','effective_from','effective_until','version'])
 for x in data:w.writerow([x['grid_code'],x['name'],x['route_name'],x['service_name'],x['calculation_method'],x['currency_code'],x['status'],x['effective_from'],x['effective_until'],x['version']])
 return '\ufeff'+out.getvalue()
