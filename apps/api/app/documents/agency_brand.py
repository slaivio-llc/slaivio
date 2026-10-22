"""Agency document identity and display policy. Never fetch remote image URLs."""
import html
from urllib.parse import urlsplit

from sqlalchemy import text


def identity(connection, org_id, office_id=None):
    row = connection.execute(text("""select o.organization_name,o.name,o.legal_name,o.logo_url,
        o.brand_slogan,o.phone,o.email,o.address,o.primary_color,
        s.settings,s.language_code,s.timezone,
        l.name office_name,l.address office_address,l.phone office_phone
        from organizations o left join organization_settings s on s.org_id=o.id
        left join organization_locations l on l.org_id=o.id and l.id=cast(:office_id as uuid)
        where o.id=:org_id"""), {"org_id":org_id,"office_id":office_id}).mappings().first()
    result = dict(row or {})
    preferences = (result.pop('settings',None) or {}).get('document_preferences',{})
    if preferences.get('show_agency_logo') is False:
        result['logo_url'] = None
    if preferences.get('show_office_details') is False:
        for field in ('phone','email','address','office_name','office_address','office_phone'):
            result[field] = None
    result['label_format'] = preferences.get('label_format','THERMAL_100_150')
    return result


def logo_html(url):
    try:
        parsed=urlsplit(str(url or ''))
        if parsed.scheme=='https' and parsed.hostname and not parsed.username and not parsed.password:
            return '<img referrerpolicy="no-referrer" alt="Logo de l’agence" style="max-height:64px;max-width:160px" src="'+html.escape(url,quote=True)+'">'
    except ValueError:
        pass
    return ''


def label_html(package, brand, qr_svg=''):
    esc=lambda value:html.escape(str(value or ''),quote=True)
    size={'THERMAL_100_150':'100mm 150mm','THERMAL_100_100':'100mm 100mm','A4':'A4'}[brand['label_format']]
    reference=str(package.get('tracking_id') or package.get('package_reference') or '')
    return f'''<!doctype html><html lang="{esc(brand.get('language_code') or 'fr')}"><head><meta charset="utf-8">
<meta name="referrer" content="no-referrer"><title>{esc(package.get('package_reference'))}</title>
<style>@page{{size:{size};margin:6mm}}body{{font:14px system-ui;color:#20272e;margin:0}}header{{border-bottom:1px solid #ccc;padding-bottom:12px}}h1{{font-size:24px}}p{{overflow-wrap:anywhere}}footer{{margin-top:20px;font-size:12px}}</style>
</head><body><header>{logo_html(brand.get('logo_url'))}<strong>{esc(brand.get('organization_name') or brand.get('name'))}</strong><p>{esc(brand.get('brand_slogan'))}</p></header>
<h1>{esc(reference)}</h1><div aria-label="Code QR du colis">{qr_svg}</div><p>{esc(package.get('description'))}</p>
<p>{esc(package.get('origin_city'))} → {esc(package.get('destination_city'))}</p>
<p>{esc(package.get('pieces_count'))} colis · {esc(package.get('weight_kg'))} kg · {esc(package.get('volume_cbm'))} m³</p>
<footer>{esc(brand.get('office_name'))}<br>{esc(brand.get('office_address') or brand.get('address'))}<br>{esc(brand.get('office_phone') or brand.get('phone'))}</footer></body></html>'''


def invoice_html(document, settings, brand):
    esc=lambda value:html.escape(str(value if value is not None else '—'),quote=True)
    kind={'QUOTE':'Devis','INVOICE':'Facture','CREDIT_NOTE':'Avoir'}[document['document_type']]
    lines=''.join('<tr>'+''.join(f'<td>{esc(line.get(key))}</td>' for key in ('description','quantity','unit_price','line_total'))+'</tr>' for line in document['lines'])
    totals=''.join(f'<p>{label} : <strong>{esc(document.get(key))} {esc(document.get("currency"))}</strong></p>'
                   for key,label in [('subtotal','Sous-total'),('discount_total','Remise'),('tax_total','Taxes'),('total','Total'),('balance_due','Solde')])
    return f'''<!doctype html><html lang="{esc(brand.get('language_code') or 'fr')}"><head><meta charset="utf-8"><meta name="referrer" content="no-referrer">
<title>{esc(document['document_number'])}</title><style>@page{{size:A4;margin:15mm}}body{{font:14px system-ui;max-width:900px;margin:40px auto;color:#20272e}}header{{display:flex;justify-content:space-between;border-bottom:1px solid #bbb;padding-bottom:20px}}table{{width:100%;border-collapse:collapse;margin-top:24px}}td,th{{padding:12px;border-bottom:1px solid #ddd;text-align:left}}.totals{{text-align:right;margin-top:24px}}@media print{{button{{display:none}}}}</style></head>
<body><button onclick="window.print()">Imprimer / Enregistrer en PDF</button><header><div>{logo_html(brand.get('logo_url'))}
<h2>{esc(brand.get('legal_name') or brand.get('organization_name') or settings.get('legal_name'))}</h2>
<p>{esc(brand.get('office_name') or '')}<br>{esc(brand.get('office_address') or brand.get('address') or '')}<br>{esc(brand.get('office_phone') or brand.get('phone') or '')}</p>
<p>{esc(settings.get('tax_identifier') or '')}</p></div><div><h1>{kind}</h1><strong>{esc(document['document_number'])}</strong>
<p>Date : {esc(document.get('issue_date') or document.get('created_at'))}</p><p>Échéance : {esc(document.get('due_date'))}</p></div></header>
<h3>Client</h3><p>{esc(document.get('client_name'))}<br>{esc(document.get('client_phone') or '')}<br>{esc(document.get('client_email') or '')}</p>
<table><thead><tr><th>Description</th><th>Quantité</th><th>Prix</th><th>Total</th></tr></thead><tbody>{lines}</tbody></table><div class="totals">{totals}</div>
<p>{esc(document.get('terms') or '')}</p><footer>{esc(settings.get('document_footer') or '')}</footer></body></html>'''
