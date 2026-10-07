"""Office-owned financial reporting; never infer financial access from network visibility."""
from sqlalchemy import text


def finance_summary(conn, org_id, permissions, period):
    if 'finance.read' not in permissions:
        return None
    rows = conn.execute(text('''
        with receipts as (
          select currency, sum(amount) collected
          from finance_payments where org_id=:org_id and status='CONFIRMED'
            and paid_at>=:start and paid_at<:end group by currency
        ), balances as (
          select currency, sum(balance_due) outstanding,
            sum(case when due_date < :today then balance_due else 0 end) overdue
          from finance_documents where org_id=:org_id and document_type='INVOICE'
            and status in ('ISSUED','PARTIALLY_PAID','OVERDUE')
          group by currency
        )
        select coalesce(r.currency,b.currency) currency,
          coalesce(r.collected,0)::text collected,
          coalesce(b.outstanding,0)::text outstanding,
          coalesce(b.overdue,0)::text overdue
        from receipts r full join balances b on b.currency=r.currency
        order by 1
    '''), {'org_id': org_id, 'start': period['current']['start_utc'],
           'end': period['current']['end_utc'], 'today': period['as_of_date']}).mappings()
    return {'scope': 'office', 'org_id': org_id, 'currencies': [dict(row) for row in rows]}
