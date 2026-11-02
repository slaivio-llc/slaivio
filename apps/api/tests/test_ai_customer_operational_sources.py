from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

from app.ai.repositories import pilot_inbox_ai_repository as repo
from app.ai.services.pilot_inbox_ai_service import _grounding_check


def test_live_catalog_covers_hours_multiple_routes_and_public_base_prices(monkeypatch):
    queries = []
    connection = MagicMock()
    def execute(statement, params):
        sql = str(statement)
        queries.append((sql, params))
        result = MagicMock()
        result.scalar.return_value = True
        rows = []
        if 'from organization_locations location' in sql:
            rows = [dict(id='office', name='Bureau client', location_type='OFFICE',
                         opening_hours={'lundi': '08:00–17:00'})]
        elif 'from shipping_services service' in sql:
            rows = [dict(id='service', route_id=route_id, service_name='Fret aérien',
                         route_name=route_id, shipping_mode='AIR', public_description='Dépôt sur rendez-vous',
                         origin_city='Guangzhou', destination_city=city, eta_min_days=None, eta_max_days=None)
                    for route_id, city in [('route-1', 'Kinshasa'), ('route-2', 'Abidjan')]]
        elif 'from pricing_grids grid' in sql:
            rows = [dict(id='price', service_name='Fret aérien', route_name='Guangzhou → Kinshasa',
                         amount='8.50', currency_code='USD', method='PER_KG', conditions={'package_type':'carton'})]
        result.mappings.return_value.all.return_value = rows
        return result
    connection.execute.side_effect = execute
    engine = MagicMock()
    engine.connect.return_value.__enter__.return_value = connection
    monkeypatch.setattr(repo, 'engine', engine)
    sources = repo.parcel_operational_knowledge('own-agency')
    assert '08:00–17:00' in sources[0]['content']
    services = [source for source in sources if source['id'].startswith('service:')]
    assert len(services) == 2
    assert services[0]['id'] != services[1]['id']
    assert 'Kinshasa' in services[0]['content'] and 'Abidjan' not in services[0]['content']
    assert 'Abidjan' in services[1]['content']
    assert 'None' not in services[0]['content']
    assert 'Dépôt sur rendez-vous' in services[0]['content']
    price = next(source for source in sources if source['id'].startswith('public-price:'))
    assert '8.50 USD par kilogramme facturable' in price['content']
    assert 'n’est pas un devis total' in price['content']
    assert 'uniquement au conditionnement: carton' in price['content']
    assert all(params == {'org_id': 'own-agency'} for _, params in queries)
    service_sql = next(sql for sql, _ in queries if 'from shipping_services service' in sql)
    assert 'service.public_visible' in service_sql and 'offering.public_visible' in service_sql
    assert 'offering.org_id=service.org_id' in service_sql
    assert 'public_offering.eta_min_days' in service_sql
    assert 'route.id=service.route_id' in service_sql
    price_sql = next(sql for sql, _ in queries if 'from pricing_grids grid' in sql)
    for guard in ["grid.visibility='PUBLIC'", "grid.status='ACTIVE'", 'grid.effective_from<=now()',
                  'rule.client_id is null', 'rule.client_segment is null', "rule.conditions - array['category_code','package_type']",
                  'grid.approved_at is not null', 'service.public_visible', 'not service.quote_only']:
        assert guard in price_sql
    assert 'pricing_internal_costs' not in price_sql
    assert 'finance_documents' not in price_sql


def test_live_active_information_is_not_expired_only_because_its_last_edit_is_old():
    old = datetime.now(timezone.utc) - timedelta(days=365)
    live = {'content': 'Le bureau ouvre à 8 heures.', 'updated_at': old, 'source_kind': 'OPERATIONAL'}
    assert _grounding_check('Le bureau ouvre à 8 heures.', [live]) == (True, None)
    stored_knowledge = dict(live, source_kind='KNOWLEDGE')
    assert _grounding_check('Le bureau ouvre à 8 heures.', [stored_knowledge]) == (False, 'connaissance_a_reverifier')


def test_french_decimal_format_does_not_make_a_sourced_price_look_invented():
    source = [{'content': 'Prix de base: 8.50 USD par kilogramme.'}]
    assert _grounding_check('Le prix de base est de 8,50 USD par kilogramme.', source) == (True, None)
    assert _grounding_check('Le prix est de 9,50 USD.', source) == (False, 'information_chiffree_non_sourcee')
