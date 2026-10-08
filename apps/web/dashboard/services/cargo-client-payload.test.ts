import { expect,it } from 'vitest';
import { cargoClientPayload } from './cargo-client-payload';

it('does not overwrite finance, geography, language or notes when editing',()=>{
  const form=new FormData();form.set('name',' Jean ');form.set('phone','+243812345678');
  const payload=cargoClientPayload(form,3);
  expect(payload.name).toBe('Jean');expect(payload.row_version).toBe(3);
  for(const key of ['credit_enabled','credit_limit','payment_amount_due','payment_amount_paid','country','city','notes','preferred_language']) expect(payload).not.toHaveProperty(key);
  expect(payload.email).toBe('');
});
it('separates company identity from personal name',()=>{
  const form=new FormData();form.set('customer_type','business');form.set('company_name','LUZA');
  expect(cargoClientPayload(form)).toMatchObject({company_name:'LUZA',name:'',display_name:'LUZA',phone:''});
});
