import test from 'node:test';
import assert from 'node:assert/strict';
import {validateInvoiceDocument,deliverInvoiceDocument} from '../src/invoice-document.js';
const payload=()=>({org_id:'agency',dispatch_id:'00000000-0000-4000-8000-000000000001',
  to:'+243812345678',mime_type:'application/pdf',filename:'Facture-1.pdf',message:'Votre facture',
  content_base64:Buffer.from('%PDF-test').toString('base64')});
for(const [key,value] of [['to','123@g.us'],['to','243812345678@s.whatsapp.net'],['org_id','other'],
  ['filename','../../secret.pdf'],['content_base64','not base64'],['mime_type','text/html'],
  ['content_base64',Buffer.from('<html>not a pdf</html>').toString('base64')]]){
  test(`rejects unsafe ${key}: ${value}`,()=>assert.throws(()=>validateInvoiceDocument({...payload(),[key]:value},'agency')));
}
test('rejects oversized attachment before decoding',()=>assert.throws(()=>validateInvoiceDocument({...payload(),content_base64:'a'.repeat(6990512)},'agency')));
test('real PDF buffer is delivered privately and claim precedes send',async()=>{
  const events=[];
  const pool={query:async(sql,params)=>{events.push(sql.startsWith('update finance_invoice_deliveries d')?'claim':'persist');assert.equal(params[1],'agency');return{rows:[{id:'delivery'}]};}};
  const session={orgId:'agency',status:'CONNECTED',socket:{sendMessage:async(to,body)=>{
    events.push('send');assert.equal(to,'243812345678@s.whatsapp.net');assert.equal(body.mimetype,'application/pdf');
    assert.equal(body.document.toString(),'%PDF-test');return{key:{id:'provider-id'}};
  }}};
  assert.equal((await deliverInvoiceDocument(session,payload(),pool)).provider_message_id,'provider-id');
  assert.deepEqual(events,['claim','send','persist']);
});
test('disconnected session never claims or sends',async()=>{
  const pool={query:()=>assert.fail('must not query')};
  assert.equal((await deliverInvoiceDocument({orgId:'agency',status:'DISCONNECTED'},payload(),pool)).success,false);
});
test('an uncertain earlier claim is never sent again',async()=>{
  const pool={query:async()=>({rows:[]})};
  const session={orgId:'agency',status:'CONNECTED',socket:{sendMessage:()=>assert.fail('duplicate')}};
  await assert.rejects(deliverInvoiceDocument(session,payload(),pool),/reconciliation/);
});
test('accepted replay returns stored confirmation without sending again',async()=>{
  let calls=0;const pool={query:async()=>({rows:++calls===1?[]:[{gateway_message_id:'accepted'}]})};
  const session={orgId:'agency',status:'CONNECTED',socket:{sendMessage:()=>assert.fail('duplicate')}};
  assert.equal((await deliverInvoiceDocument(session,payload(),pool)).provider_message_id,'accepted');
});
