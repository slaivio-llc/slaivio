"use client";
import {useEffect,useState,useRef} from 'react';
import {MessageCircle} from 'lucide-react';
import {PermissionGuard} from '@/components/permissions/permission-guard';
import {dashboardText} from '@/components/i18n/dashboard-messages';
import {invoiceWhatsAppStatus,sendInvoiceWhatsApp,type InvoiceWhatsAppStatus} from '@/services/finance';

const labels:Record<InvoiceWhatsAppStatus['state'],string>={
  NOT_SENT:'PDF non envoyé',QUEUED:'PDF en attente d’envoi',SENDING:'Envoi du PDF en cours…',
  SENT:'PDF envoyé à WhatsApp',FAILED:'Le PDF n’a pas été envoyé. Vérifiez le numéro du client et votre connexion WhatsApp.',
  CHECK_REQUIRED:'Le résultat de l’envoi n’a pas été confirmé. Vérifiez la conversation WhatsApp avant de contacter le support.',
};
export function InvoiceWhatsApp({documentId}:{documentId:string}) {
  const [data,setData]=useState<InvoiceWhatsAppStatus|null>(null);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  // Reuse the key after a lost HTTP response, even if the first request committed.
  const key=useRef<string|null>(null);
  useEffect(()=>{
    let mounted=true;
    async function load(){
      try {const next=await invoiceWhatsAppStatus(documentId);if(mounted){setData(next);setError('');}}
      catch{if(mounted)setError('Le suivi de l’envoi est indisponible. Réessayez.');}
    }
    key.current=null;void load();
    const timer=setInterval(()=>void load(),5000);
    return ()=>{mounted=false;clearInterval(timer);};
  },[documentId]);
  async function send(){
    if(busy)return;
    if(data?.state==='SENT' && !window.confirm('Envoyer à nouveau ce PDF au client sur WhatsApp ?'))return;
    setBusy(true);setError('');
    key.current ??= crypto.randomUUID();
    try {setData(await sendInvoiceWhatsApp(documentId,key.current));key.current=null;}
    catch(cause){
      const detail=(cause as {response?:{data?:{detail?:unknown}}}).response?.data?.detail;
      setError(detail==='Vérifiez le numéro WhatsApp du client et son accord pour recevoir vos messages.'
        ? detail:'L’envoi n’a pas pu être confirmé. Actualisez le suivi avant de réessayer.');
    } finally{setBusy(false);}
  }
  const blocked=!data || ['QUEUED','SENDING','CHECK_REQUIRED'].includes(data.state);
  return <section aria-label={dashboardText('Facture WhatsApp')} className="rounded-lg border border-[#dfe9e3] bg-[#f8fcf9] p-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="flex items-center gap-2 text-xs font-semibold text-[#226b4c]"><MessageCircle size={15}/>{dashboardText('Facture WhatsApp')}</h3>
        <p role="status" className="mt-1 text-xs text-[#606a72]">{data?dashboardText(labels[data.state]):dashboardText('Chargement du suivi…')}</p>
        {data?.automatic && <p className="mt-1 text-[11px] text-[#78828a]">{dashboardText('Envoi automatique activé pour les nouvelles factures émises.')}</p>}
      </div>
      <PermissionGuard permission="finance.issue"><button type="button" onClick={()=>void send()} disabled={busy||blocked}
        className="rounded-full border border-[#b8d8c6] bg-white px-3 py-2 text-xs font-medium text-[#226b4c] disabled:opacity-50">
        {dashboardText(busy?'Préparation…':data?.state==='SENT'?'Renvoyer le PDF':'Envoyer le PDF')}
      </button></PermissionGuard>
    </div>
    {error && <p role="alert" className="mt-2 text-xs text-[#9d352d]">{dashboardText(error)}</p>}
  </section>;
}
