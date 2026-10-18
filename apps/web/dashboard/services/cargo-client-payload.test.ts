import { expect,it } from 'vitest';
import { cargoClientPayload } from './cargo-client-payload';

it('submits the contact, country and internal note while leaving unrelated finance fields untouched',()=>{
  const form=new FormData();form.set('name',' Jean ');form.set('phone','+243812345678');
  const payload=cargoClientPayload(form,3);
  expect(payload.name).toBe('Jean');expect(payload.row_version).toBe(3);
  for(const key of ['credit_enabled','credit_limit','payment_amount_due','payment_amount_paid','city','preferred_language']) expect(payload).not.toHaveProperty(key);
  expect(payload).toMatchObject({country:'',notes:''});
  expect(payload.email).toBe('');
});
it('separates company identity from personal name',()=>{
  const form=new FormData();form.set('customer_type','business');form.set('company_name','LUZA');
  expect(cargoClientPayload(form)).toMatchObject({company_name:'LUZA',name:'',display_name:'LUZA',phone:''});
});
