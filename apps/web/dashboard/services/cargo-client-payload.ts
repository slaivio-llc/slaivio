import type { ClientPayload } from './clients';

/** Only fields actually owned and edited by this form may be sent. */
export function cargoClientPayload(form: FormData, rowVersion?: number): ClientPayload {
  const value = (key: string) => String(form.get(key) || '').trim();
  const business = value('customer_type') === 'business';
  const name = value(business ? 'company_name' : 'name');
  return {
    customer_type: business ? 'business' : 'individual',
    name: business ? '' : name,
    company_name: business ? name : '',
    display_name: name,
    phone: value('phone'),
    whatsapp_phone: value('phone'),
    email: value('email'),
    address: value('address'),
    row_version: rowVersion,
  };
}
