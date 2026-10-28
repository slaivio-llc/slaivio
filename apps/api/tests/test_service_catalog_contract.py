from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
def read(p):return (ROOT/p).read_text(encoding='utf-8')
def test_service_catalog_schema_links_sources_without_copying():
 sql=read('infra/sql/085_service_catalog_operations.sql')
 for table in ('service_route_offerings','service_options','service_bundles','service_bundle_items','service_documents','service_alerts','service_audit_events','service_settings'):
  assert f'create table if not exists {table}' in sql
 assert 'route_id uuid not null references shipping_routes(id)' in sql
 assert "pricing_grid" not in sql or "create table if not exists pricing_grid" not in sql
 assert 'services.suspend' in sql and 'services.finance' in sql
def test_service_api_enforces_permissions_and_relationships():
 api=read('apps/api/app/api/service_catalog.py')
 for route in ('"/recommend"','"/analytics"','"/{service_id}/routes"','"/{service_id}/conditions"','"/{service_id}/documents"','"/{service_id}/options"'):
  assert route in api
 assert "require_permission('services.routes')" in api
 assert "require_permission('services.conditions')" in api
def test_recommendation_uses_live_route_pricing_and_restrictions():
 repo=read('apps/api/app/service_catalog/repository.py')
 assert 'service_route_offerings' in repo
 assert 'pricing_grids' in repo
 assert 'service_goods_policies' in repo
 assert "decision='PROHIBITED'" in repo
def test_service_detail_uses_service_goods_policy_foreign_key():
 repo=read('apps/api/app/service_catalog/repository.py')
 schema=read('infra/sql/051_routes_services_completion.sql')
 assert 'shipping_service_id uuid not null references shipping_services(id)' in schema
 assert 'from service_goods_policies where org_id=:o and shipping_service_id=:s' in repo
def test_dashboard_configures_real_services_in_management():
 ui=read('apps/web/dashboard/components/settings/organization-transport-settings.tsx')
 for label in ('getServiceDetail(', 'transitionService(', 'createCatalogService(', 'getServiceCatalog(', 'Unité de facturation habituelle'):
  assert label in ui
