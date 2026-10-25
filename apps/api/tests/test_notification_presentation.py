import pytest

from app.notification_center.presentation import present_notification


@pytest.mark.parametrize('status,title',[('SENT','Message client envoyé'),('DELIVERED','Message reçu par le destinataire'),('FAILED','Message client non envoyé'),('PENDING','Message client en attente'),('CANCELLED','Envoi du message annulé')])
def test_historical_delivery_copy_uses_real_status_not_legacy_provider_text(status,title):
    result=present_notification({'source':'IN_APP','category':'NOTIFICATION_UPDATED',
        'title':'Message fournisseur envoyé','message':'provider_message_sent',
        'delivery_status':status,'recipient_phone':'+243123456789',
        'notification_content':'Votre colis est prêt à être retiré.', 'error_message':'API_PROVIDER_ERROR'})
    assert result['title']==title
    assert 'Votre colis est prêt à être retiré.' in result['message']
    assert '+243123456789' in result['message']
    assert 'fournisseur' not in result['message']
    assert 'error_message' not in result and 'notification_content' not in result


def test_unknown_delivery_status_never_claims_success():
    result=present_notification({'source':'IN_APP','category':'NOTIFICATION_UPDATED',
        'title':'Message fournisseur envoyé','message':'Message fournisseur envoyé'})
    assert result['title']=='Suivi d’un message client'
    assert 'a été envoyé' not in result['message']


def test_business_notifications_are_preserved_and_internal_codes_are_not_displayed():
    assert present_notification({'category':'PACKAGE_RECEIVED','title':'Colis réceptionné','message':'Le colis COL-123 est arrivé.'})['message']=='Le colis COL-123 est arrivé.'
    result=present_notification({'category':'OTHER','title':'INTERNAL_JOB_FAILED','message':'Reason: PROVIDER_INVALID_TOKEN'})
    assert '_' not in result['title']+result['message']
