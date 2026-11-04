"""Render an immutable invoice snapshot. No network access or remote images."""
from decimal import Decimal
from html import escape
from io import BytesIO
import re


def filename(number):
    return 'Facture-' + re.sub(r'[^A-Za-z0-9_-]', '-', str(number))[:100] + '.pdf'


def render(snapshot):
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib.pagesizes import A4
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

    document, brand, settings = snapshot['document'], snapshot['brand'], snapshot['settings']
    preferences = brand.get('invoice_preferences') or {}
    styles = getSampleStyleSheet()
    style = styles['Normal']
    style.fontSize = 10
    style.leading = 14
    style.wordWrap = 'CJK'
    # Escape all agency/client text before giving it to ReportLab's markup parser.
    def paragraph(value, kind='Normal'):
        return Paragraph(escape(str(value if value is not None else '')).replace('\n', '<br/>'), styles[kind])
    currency = document['currency']
    def money(value):
        return f"{Decimal(str(value or 0)):,.2f} {currency}"
    accent = preferences.get('invoice_accent_color') or '#16855f'
    if not re.fullmatch(r'#[0-9a-fA-F]{6}', accent): accent = '#16855f'
    story = [paragraph(settings.get('legal_name') or brand.get('organization_name') or brand.get('name'), 'Heading1')]
    for value in (settings.get('billing_address') or brand.get('office_address') or brand.get('address'),
                  brand.get('office_phone') or brand.get('phone'), brand.get('email'), settings.get('tax_identifier')):
        if value: story.append(paragraph(value))
    story += [Spacer(1, 18), paragraph(f"Facture {document['document_number']}", 'Heading1'),
              paragraph(f"Émise le : {document.get('issue_date') or ''}"),
              paragraph(f"Client : {document.get('client_name') or ''}")]
    if preferences.get('show_client_phone') is not False:
        story.append(paragraph(document.get('client_phone')))
    if preferences.get('show_due_date') is not False and document.get('due_date'):
        story.append(paragraph(f"Échéance : {document['due_date']}"))
    story.append(Spacer(1, 16))
    data = [[paragraph(x) for x in ('Désignation', 'Quantité', 'Prix unitaire', 'Total')]]
    for line in document['lines']:
        data.append([paragraph(line['description']), paragraph(line['quantity']),
                     paragraph(money(line['unit_price'])), paragraph(money(line['line_total']))])
    table = Table(data, colWidths=[245, 50, 105, 105], repeatRows=1, hAlign='LEFT')
    table.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#eaf5ef')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'), ('BOTTOMPADDING', (0, 0), (-1, -1), 9),
        ('TOPPADDING', (0, 0), (-1, -1), 9), ('LINEBELOW', (0, 0), (-1, 0), 1, colors.HexColor(accent)),
        ('LINEBELOW', (0, 1), (-1, -1), .3, colors.HexColor('#dddddd'))]))
    story += [table, Spacer(1, 18)]
    for label, key in [('Sous-total', 'subtotal'), ('Remises', 'discount_total'), ('Taxes', 'tax_total'),
                       ('Total', 'total'), ('Déjà payé', 'amount_paid'), ('Solde', 'balance_due')]:
        story.append(paragraph(f'{label} : {money(document.get(key))}', 'Heading3' if key == 'total' else 'Normal'))
    for value in (document.get('terms'), settings.get('document_footer')):
        if value: story += [Spacer(1, 14), paragraph(value)]
    result = BytesIO()
    def page_number(canvas, _doc):
        canvas.setFont('Helvetica', 8)
        canvas.drawRightString(550, 24, f"Page {canvas.getPageNumber()}")
    SimpleDocTemplate(result, pagesize=A4, leftMargin=45, rightMargin=45,
                       topMargin=40, bottomMargin=45, title=f"Facture {document['document_number']}").build(
                           story, onFirstPage=page_number, onLaterPages=page_number)
    content = result.getvalue()
    if len(content) > 5 * 1024 * 1024: raise ValueError('invoice_pdf_too_large')
    return content
