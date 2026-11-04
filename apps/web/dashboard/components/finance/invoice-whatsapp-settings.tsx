"use client";
import {useEffect,useState} from 'react';
import {PermissionGuard} from '@/components/permissions/permission-guard';
import {dashboardText} from '@/components/i18n/dashboard-messages';
import {getFinanceSettings,configureInvoiceWhatsApp} from '@/services/finance';

export function InvoiceWhatsAppSettings(){
  const [enabled,setEnabled]=useState<boolean|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{let mounted=true;getFinanceSettings().then(value=>{
    if(mounted)setEnabled(Boolean((value as typeof value & {invoice_whatsapp_enabled?:boolean}).invoice_whatsapp_enabled));
  }).catch(()=>{if(mounted)setError('Les réglages WhatsApp n’ont pas pu être chargés.');});return()=>{mounted=false;};},[]);
  async function change(value:boolean){
    setBusy(true);setError('');
    try{await configureInvoiceWhatsApp(value);setEnabled(value);}
    catch{setError('Le réglage n’a pas pu être enregistré. Réessayez depuis l’espace principal de l’agence.');}
    finally{setBusy(false);}
  }
  return <PermissionGuard permission="finance.settings"><section className="mt-4 rounded-lg border border-[#e0e3e5] p-4">
    <label className="flex items-start justify-between gap-4 text-xs font-medium text-[#303941]">
      <span>{dashboardText('Factures PDF par WhatsApp')}<span className="mt-1 block text-[11px] font-normal leading-5 text-[#78828a]">{dashboardText('Envoyer automatiquement le PDF au client à l’émission de sa facture. Nécessite un numéro WhatsApp connecté par code QR. Aucun envoi des anciennes factures.')}</span></span>
      <input type="checkbox" checked={enabled===true} disabled={busy||enabled===null} onChange={event=>void change(event.target.checked)} aria-label={dashboardText('Envoi automatique des factures PDF')} className="mt-1 h-4 w-4 accent-[#16855f]"/>
    </label>
    {error&&<p role="alert" className="mt-2 text-xs text-[#9d352d]">{dashboardText(error)}</p>}
  </section></PermissionGuard>;
}
