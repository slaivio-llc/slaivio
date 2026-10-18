"""Communication safety contracts; no live provider, database or outbound send."""
import json

import pytest

from app.ai.services import pilot_inbox_ai_service as service
from app.ai.repositories.parcel_customer_journey_repository import _missing


def test_manual_draft_respects_conversation_pause_override(monkeypatch):
    monkeypatch.setattr(service, 'get_pilot_ai_settings', lambda _: {'pilot_response_mode': 'SUGGESTION_ONLY'})
    monkeypatch.setattr(service, 'effective_ai_mode', lambda *_: 'PAUSED')
    monkeypatch.setattr(service, 'conversation_ai_context', lambda *_: pytest.fail('Paused conversation must stop before context generation'))

    result = service.prepare_pilot_suggestion(org_id='agency', client_phone='+123')

    assert result == {'status': 'skipped', 'reason': 'ai_paused', 'mode': 'PAUSED'}


def test_conversation_summary_respects_conversation_pause_override(monkeypatch):
    monkeypatch.setattr(service, 'get_pilot_ai_settings', lambda _: {'pilot_response_mode': 'CONTROLLED_AUTO'})
    monkeypatch.setattr(service, 'effective_ai_mode', lambda *_: 'PAUSED')
    monkeypatch.setattr(service, 'conversation_ai_context', lambda *_: pytest.fail('Paused conversation must not be read for summary'))
    monkeypatch.setattr(service, '_provider_response', lambda *args, **kwargs: pytest.fail('Paused conversation must not call AI'))

    result = service.summarize_pilot_conversation('agency', '+123')

    assert result == {'status': 'skipped', 'reason': 'ai_paused'}


@pytest.mark.parametrize('action', ['draft', 'summary'])
def test_manual_ai_actions_respect_agency_wide_disable(monkeypatch, action):
    monkeypatch.setattr(service, 'get_pilot_ai_settings', lambda _: {'enabled': False, 'pilot_response_mode': 'CONTROLLED_AUTO'})
    monkeypatch.setattr(service, 'effective_ai_mode', lambda *_: 'CONTROLLED_AUTO')
    monkeypatch.setattr(service, 'conversation_ai_context', lambda *_: pytest.fail('Disabled AI must not read the conversation'))
    monkeypatch.setattr(service, '_provider_response', lambda *args, **kwargs: pytest.fail('Disabled AI must not call provider'))

    if action == 'draft':
        result = service.prepare_pilot_suggestion(org_id='agency', client_phone='+123')
        assert result == {'status': 'skipped', 'reason': 'ai_paused', 'mode': 'CONTROLLED_AUTO'}
    else:
        result = service.summarize_pilot_conversation('agency', '+123')
        assert result == {'status': 'skipped', 'reason': 'ai_paused'}


def test_contextual_router_receives_previous_route(monkeypatch):
    captured = {}

    def generate(settings, system, message, **kwargs):
        captured['message'] = message
        return {'success': True, 'content': 'KNOWLEDGE_QUERY|tarif Chine Kinshasa'}

    monkeypatch.setattr(service, '_provider_response', generate)
    result = service._route_customer_message({}, 'Et combien ?', organization_name='Agence',
        style='WARM', recent_messages=[{'direction': 'inbound', 'text_body': 'Chine Kinshasa ?'}])
    assert 'Chine Kinshasa' in captured['message']
    assert result['query'] == 'tarif Chine Kinshasa'


@pytest.mark.parametrize('message', ['My parcel arrived broken', 'Je veux parler à votre équipe'])
def test_semantic_handoff_in_preview_has_no_mutations(monkeypatch, message):
    monkeypatch.setattr(service, 'get_pilot_ai_settings', lambda _: {})
    monkeypatch.setattr(service, '_provider_response', lambda *args, **kwargs: {
        'success': True, 'content': 'HUMAN_REVIEW|'})
    monkeypatch.setattr(service, 'search_knowledge', lambda *args, **kwargs: pytest.fail('No retrieval needed'))
    monkeypatch.setattr(service, '_parcel_qualification', lambda *args: pytest.fail('Preview cannot mutate CRM'))
    result = service.preview_pilot_response(org_id='agency', message=message)
    assert result['decision'] == 'REVIEW_REQUIRED'
    assert result['reason'] == 'prise_en_charge_humaine'


def test_semantic_handoff_blocks_auto_reply_and_conversion(monkeypatch):
    monkeypatch.setattr(service, 'get_pilot_ai_settings', lambda _: {})
    monkeypatch.setattr(service, 'conversation_ai_context', lambda *args: {
        'org_id': 'agency', 'source_message': 'My parcel arrived broken',
        'source_message_id': 'message', 'organization_name': 'Agence'})
    monkeypatch.setattr(service, '_provider_response', lambda *args, **kwargs: {
        'success': True, 'content': 'HUMAN_REVIEW|'})
    monkeypatch.setattr(service, 'log_ai_run', lambda **kwargs: {})
    monkeypatch.setattr(service, '_parcel_qualification', lambda *args: pytest.fail('Must not convert'))
    result = service.prepare_pilot_suggestion(org_id='agency', client_phone='+123', response_mode='CONTROLLED_AUTO')
    assert not result['eligible_for_auto']
    assert result['intent'] == 'HUMAN_REVIEW'
    assert result['reason'] == 'prise_en_charge_humaine'


@pytest.mark.parametrize('message', ['Je veux un remboursement', 'Modifier mon dossier'])
def test_sensitive_requests_never_qualify_or_convert(monkeypatch, message):
    monkeypatch.setattr(service, 'get_pilot_ai_settings', lambda _: {})
    monkeypatch.setattr(service, 'conversation_ai_context', lambda *args: {
        'org_id': 'agency', 'source_message': message, 'source_message_id': 'message',
        'organization_name': 'Agence'})
    monkeypatch.setattr(service, 'log_ai_run', lambda **kwargs: {})
    monkeypatch.setattr(service, '_parcel_qualification', lambda *args: pytest.fail('Must not mutate CRM'))
    result = service.prepare_pilot_suggestion(org_id='agency', client_phone='+123', response_mode='CONTROLLED_AUTO')
    assert not result['eligible_for_auto']
    assert result['risk_level'] != 'SAFE'


def test_manual_suggestion_does_not_create_client(monkeypatch):
    monkeypatch.setattr(service, 'get_pilot_ai_settings', lambda _: {})
    monkeypatch.setattr(service, 'conversation_ai_context', lambda *args: {
        'org_id': 'agency', 'source_message': 'Bonjour', 'source_message_id': 'message',
        'organization_name': 'Agence'})
    monkeypatch.setattr(service, '_route_customer_message', lambda *args, **kwargs: {'kind': 'SOCIAL', 'response': 'Bonjour !'})
    monkeypatch.setattr(service, '_parcel_qualification', lambda *args: pytest.fail('Must not mutate CRM'))
    monkeypatch.setattr(service, 'create_ai_draft', lambda **kwargs: {'id': 'draft'})
    monkeypatch.setattr(service, 'log_ai_run', lambda **kwargs: {})
    assert service.prepare_pilot_suggestion(org_id='agency', client_phone='+123', response_mode='SUGGESTION_ONLY')['status'] == 'ok'


@pytest.mark.parametrize('confirmed,confidence', [(False, 1), (True, 0.5), (True, True), (True, 2)])
def test_registration_requires_confirmed_intent_and_valid_confidence(monkeypatch, confirmed, confidence):
    monkeypatch.setattr(service, 'is_parcel_organization', lambda _: True)
    monkeypatch.setattr(service, '_provider_response', lambda *args, **kwargs: {
        'success': True, 'content': json.dumps({'stage': 'QUALIFIED', 'customer_type': 'individual',
            'full_name': 'Jean Mukendi', 'service_intent_confirmed': confirmed, 'confidence': confidence})})
    monkeypatch.setattr(service, 'upsert_journey', lambda org, phone, values, **kwargs: values)
    monkeypatch.setattr(service, 'convert_journey', lambda *args: pytest.fail('No confirmed registration'))
    result = service._parcel_qualification({}, {'org_id': 'agency'}, '+123')
    assert result['journey']['stage'] == 'INTERESTED'


def test_individual_location_is_not_mandatory():
    assert _missing({'full_name': 'Jean Mukendi', 'customer_type': 'individual'}) == []


def test_confirmed_individual_can_convert_without_country_or_city(monkeypatch):
    monkeypatch.setattr(service, 'is_parcel_organization', lambda _: True)
    extracted = {'stage': 'QUALIFIED', 'customer_type': 'individual', 'full_name': 'Jean Mukendi',
                 'service_intent_confirmed': True, 'confidence': 0.95}
    monkeypatch.setattr(service, '_provider_response', lambda *args, **kwargs: {
        'success': True, 'content': json.dumps(extracted)})
    monkeypatch.setattr(service, 'upsert_journey', lambda org, phone, values, **kwargs: {
        **values, 'missing_fields': _missing(values)})
    captured = []
    monkeypatch.setattr(service, 'convert_journey', lambda org, phone: captured.append((org, phone)) or {'id': 'client'})
    result = service._parcel_qualification({}, {'org_id': 'agency'}, '+123')
    assert result['client']['id'] == 'client'
    assert captured == [('agency', '+123')]


def test_rejected_answer_cannot_be_promoted_by_qualification(monkeypatch):
    monkeypatch.setattr(service, 'get_pilot_ai_settings', lambda _: {})
    monkeypatch.setattr(service, 'conversation_ai_context', lambda *args: {
        'org_id': 'agency', 'source_message': 'Quels délais ?', 'source_message_id': 'message',
        'organization_name': 'Agence'})
    monkeypatch.setattr(service, '_route_customer_message', lambda *args, **kwargs: {'kind': 'KNOWLEDGE', 'query': 'délais'})
    monkeypatch.setattr(service, 'search_knowledge', lambda *args, **kwargs: [
        {'id': 'knowledge', 'title': 'Délai', 'content': 'Délai : 12 jours', 'rank': 1}])
    monkeypatch.setattr(service, 'parcel_operational_knowledge', lambda _: [])
    monkeypatch.setattr(service, '_provider_response', lambda *args, **kwargs: {'success': True, 'content': 'Dans 5 jours.'})
    monkeypatch.setattr(service, '_parcel_qualification', lambda *args: pytest.fail('Rejected answer cannot qualify'))
    monkeypatch.setattr(service, 'log_ai_run', lambda **kwargs: {})
    result = service.prepare_pilot_suggestion(org_id='agency', client_phone='+123', response_mode='CONTROLLED_AUTO')
    assert not result['eligible_for_auto']
    assert result['reason'] == 'information_chiffree_non_sourcee'


def test_audit_keeps_operational_provenance_outside_uuid_array(monkeypatch):
    from app.ai.repositories import pilot_inbox_ai_repository as repository
    captured = {}

    class Connection:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

        def execute(self, query, params):
            captured.update(params)
            return self

        def mappings(self):
            return self

        def one(self):
            return {'id': 'run'}

    class Engine:
        def begin(self):
            return Connection()

    monkeypatch.setattr(repository, 'engine', Engine())
    knowledge_id = 'f4ac8e09-4b6e-4d8e-91ba-dc13ca18af3a'
    repository.log_ai_run(org_id='agency', client_phone='+123', event_key='event',
        response_mode='CONTROLLED_AUTO', outcome='AUTO_SENT',
        source_ids=[knowledge_id, 'service:123', 'location:456'])
    assert captured['source_ids'] == [knowledge_id]
    assert json.loads(captured['metadata'])['operational_source_ids'] == ['service:123', 'location:456']


def test_human_takeover_during_generation_prevents_send(monkeypatch):
    modes = iter(['CONTROLLED_AUTO', 'PAUSED'])
    monkeypatch.setattr(service, 'effective_ai_mode', lambda *args: next(modes))
    monkeypatch.setattr(service, 'get_ai_run', lambda *args: None)
    monkeypatch.setattr(service, 'get_pilot_ai_settings', lambda _: {'enabled': True})
    monkeypatch.setattr(service, 'conversation_ai_context', lambda *args: {})
    monkeypatch.setattr(service, 'prepare_pilot_suggestion', lambda **kwargs: {
        'status': 'ok', 'eligible_for_auto': True, 'response_text': 'Bonjour', 'context': {}, 'draft': {'id': 'draft'}})
    monkeypatch.setattr(service, 'resolve_outbound_whatsapp_sender', lambda **kwargs: {'resolved': True, 'number': {}})
    monkeypatch.setattr(service, 'create_outbound_message', lambda **kwargs: {'id': 'outbound'})
    monkeypatch.setattr(service, 'mark_outbound_message_failed', lambda *args: {'id': 'outbound', 'send_status': 'FAILED'})
    monkeypatch.setattr(service, 'log_ai_run', lambda **kwargs: {})

    class Provider:
        def send_message(self, **kwargs):
            pytest.fail('Human took over; must not send')

    monkeypatch.setattr(service, 'get_whatsapp_provider', lambda **kwargs: Provider())
    result = service.process_pilot_inbound_ai(org_id='agency', client_phone='+123', event_key='event')
    assert result['status'] == 'skipped'
    assert result['reason'] == 'ai_mode_changed_before_send'
