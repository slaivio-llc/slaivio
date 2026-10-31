-- New catalogue price only: preserve existing invoices and checkout snapshots.
begin;

update pricing_plans
set monthly_price_minor = 29900,
    currency_code = 'USD',
    updated_at = now()
where code = 'PRO';

commit;
