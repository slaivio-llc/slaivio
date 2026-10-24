-- SLAIVIO monthly catalogue. Existing invoices and checkout amounts are frozen
-- and must never be rewritten by a catalogue price change.
begin;

update pricing_plans
set name = case code when 'STARTER' then 'Starter' when 'PRO' then 'Pro' else 'Business' end,
    monthly_price_minor = case code when 'STARTER' then 11900 when 'PRO' then 22900 else 79900 end,
    currency_code = 'USD',
    quarterly_price_minor = null,
    semiannual_price_minor = null,
    yearly_price_minor = null,
    updated_at = now()
where code in ('STARTER', 'PRO', 'ENTERPRISE', 'BUSINESS');

-- Keep the legacy ENTERPRISE identifier so existing subscriptions, plan
-- features and foreign keys remain attached to the same Business offering.
commit;
