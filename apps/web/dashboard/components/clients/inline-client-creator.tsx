"use client";
import {dashboardText,useDashboardMessages} from '@/components/i18n/dashboard-messages';


import { FormEvent, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus } from 'lucide-react';
import { ClientFormModal, apiErrorMessage } from './clients-page';
import { cargoClientPayload } from '@/services/cargo-client-payload';
import { createClient, type ClientRecord } from '@/services/clients';
import { operationMenuItemClass } from '@/components/ui/operation-styles';

/** Nested creation never unmounts the calling form or submits its draft. */
export function InlineClientCreator({onCreated,initialPhone='',source='manual'}:{onCreated:(client:ClientRecord)=>void;initialPhone?:string;source?:'manual'|'whatsapp'}) {
  useDashboardMessages();
  const [open,setOpen]=useState(false);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const pending=useRef(false);
  const request=useRef<{signature:string;key:string}|null>(null);
  const trigger=useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    if(!open)return;
    const closeOnEscape=(event:KeyboardEvent)=>{
      if(event.key==='Escape') {event.preventDefault();event.stopImmediatePropagation();if(!pending.current){setOpen(false);trigger.current?.focus();}}
    };
    window.addEventListener('keydown',closeOnEscape,true);
    return ()=>window.removeEventListener('keydown',closeOnEscape,true);
  },[open]);
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();event.stopPropagation();
    if(pending.current)return;
    const payload=cargoClientPayload(new FormData(event.currentTarget));
    payload.source=source;
    const signature=JSON.stringify(payload);
    if(!request.current||request.current.signature!==signature)request.current={signature,key:crypto.randomUUID()};
    payload.idempotency_key=request.current.key;
    pending.current=true;setSaving(true);setError('');
    try {
      const client=await createClient(payload);
      setOpen(false);trigger.current?.focus();onCreated(client);
    } catch(cause){setError(apiErrorMessage(cause));}
    finally {pending.current=false;setSaving(false);}
  }
  return <>
    <button ref={trigger} type="button" className={`${operationMenuItemClass} !w-fit !text-emerald-800`} onClick={()=>{request.current=null;setError('');setOpen(true);}}><Plus size={14} aria-hidden="true"/>{dashboardText("Nouveau client")}</button>
    {open && createPortal(<ClientFormModal mode="create" client={null} initialPhone={initialPhone} parcelFreight saving={saving} error={error}
      onClose={()=>{if(!pending.current){setOpen(false);trigger.current?.focus();}}} onSubmit={submit}/>,document.body)}
  </>;
}
