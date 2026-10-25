"""Business-facing copy, including legacy notification delivery events."""
import re


def present_notification(item):
    category=str(item.get('category') or '').upper()
    if item.get('source')=='DELIVERY' or category=='NOTIFICATION_UPDATED':
        status=str(item.get('delivery_status') or '').upper()
        copy={
            'SENT':('Message client envoyé','Le message a été envoyé au destinataire.'),
            'DELIVERED':('Message reçu par le destinataire','La réception du message a été confirmée.'),
            'READ':('Message lu','Le destinataire a lu le message.'),
            'FAILED':('Message client non envoyé','Le message n’a pas pu être envoyé. Vérifiez le numéro du destinataire et la connexion de messagerie avant de réessayer.'),
            'PENDING':('Message client en attente','Le message attend encore d’être envoyé. Son envoi n’est pas confirmé.'),
            'CANCELLED':('Envoi du message annulé','L’envoi de ce message a été annulé.'),
        }
        title,message=copy.get(status,('Suivi d’un message client','Une mise à jour de l’envoi d’un message client est disponible.'))
        recipient=item.get('recipient_phone')
        if recipient:message+=f' Destinataire : {recipient}.'
        content=str(item.get('notification_content') or '').strip()
        if content and not re.search(r'\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b',content):
            message+='\n\nMessage concerné :\n'+content
        item['title'],item['message']=title,message
    else:
        for key in ('title','message'):
            if re.search(r'\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b',str(item.get(key) or '')):
                item[key]='Mise à jour de votre activité' if key=='title' else 'Une mise à jour est disponible. Consultez l’élément concerné pour plus de détails.'
    # Provider diagnostics belong in restricted logs, never in agency copy.
    item.pop('error_message',None)
    item.pop('notification_content',None)
    item.pop('recipient_phone',None)
    return item
