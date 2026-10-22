"""Minimal agency receipts: escaped, immutable identity, no internal notes."""
import html
from urllib.parse import urlsplit

from fastapi import HTTPException
from sqlalchemy import text


def capture_identity(connection, org_id, document_id):
    row = connection.execute(text("""
        select coalesce(nullif(o.legal_name,''),o.name) agency_name, o.logo_url,
               coalesce(c.display_name,c.name,c.company_name,c.phone,'Client') client_name,
               d.document_number,d.office_id
        from finance_documents d
        join organizations o on o.id=d.org_id
        join clients c on c.id=d.client_id and c.org_id=d.org_id
        where d.org_id=:org_id and d.id=:document_id
    """), {'org_id': org_id, 'document_id': document_id}).mappings().first()
    if not row:
        raise HTTPException(409, 'receipt_identity_unavailable')
    from app.documents.agency_brand import identity
    brand=identity(connection,org_id,row.get('office_id'))
    return {'version': 1, **dict(row), 'logo_url':brand.get('logo_url'),
            'office_name':brand.get('office_name'),
            'office_address':brand.get('office_address') or brand.get('address'),
            'office_phone':brand.get('office_phone') or brand.get('phone')}


def render_receipt(payment):
    if payment['status'] != 'CONFIRMED':
        raise HTTPException(409, 'receipt_payment_not_confirmed')
    identity = payment.get('receipt_snapshot')
    if not isinstance(identity, dict) or identity.get('version') != 1:
        raise HTTPException(409, 'receipt_historical_identity_unavailable')
    esc = lambda value: html.escape(str(value or ''), quote=True)
    logo = ''
    url = str(identity.get('logo_url') or '')
    try:
        parsed = urlsplit(url)
        if parsed.scheme == 'https' and parsed.hostname and not parsed.username and not parsed.password:
            logo = f'<img referrerpolicy="no-referrer" src="{esc(url)}" alt="Logo de l’agence">'
    except ValueError:
        pass
    return f'''<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="referrer" content="no-referrer">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src https:; base-uri 'none'; form-action 'none'">
<title>{esc(payment['receipt_number'])}</title>
<style>body{{font:15px system-ui,sans-serif;color:#17202a;max-width:680px;margin:48px auto;padding:24px}}
header img{{max-width:120px;max-height:72px}}h1{{font-size:24px}}dl{{display:grid;grid-template-columns:1fr 1fr;gap:18px}}
dd{{margin:0;text-align:right}}footer{{margin-top:40px;color:#57616c}}@media print{{body{{margin:0}}}}</style>
</head><body><header>{logo}<h2>{esc(identity.get('agency_name'))}</h2></header>
<p>{esc(identity.get('office_name'))}<br>{esc(identity.get('office_address'))}<br>{esc(identity.get('office_phone'))}</p>
<h1>Reçu de paiement</h1><p>{esc(payment['receipt_number'])}</p>
<dl><dt>Client</dt><dd>{esc(identity.get('client_name'))}</dd>
<dt>Facture concernée</dt><dd>{esc(identity.get('document_number'))}</dd>
<dt>Montant reçu</dt><dd>{esc(payment['amount'])} {esc(payment['currency'])}</dd>
<dt>Date du paiement</dt><dd>{esc(payment['paid_at'])}</dd></dl>
<footer>Ce reçu atteste uniquement le paiement indiqué, pas le règlement intégral de la facture.
Utilisez la fonction Imprimer du navigateur pour l’enregistrer en PDF.</footer></body></html>'''
