"use client";

import { ArrowRight, BellRing, BookOpen, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import { OperationContent } from "@/components/ui/operation-primitives";
import { OperationPageHeader } from "@/components/ui/operation-page-header";
import { listFollowups, type FollowupStats } from "@/services/followups";
import { getPilotSettings, type PilotSettingsData } from "@/services/organization-admin";

export function ParcelCommunicationHub(){
  const [followups,setFollowups]=useState<FollowupStats|null>(null);
  const [settings,setSettings]=useState<PilotSettingsData|null>(null);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{let active=true;Promise.allSettled([listFollowups({page:1,page_size:1}),getPilotSettings()]).then(results=>{if(!active)return;if(results[0].status==="fulfilled")setFollowups(results[0].value.stats);if(results[1].status==="fulfilled")setSettings(results[1].value);setLoading(false);});return()=>{active=false};},[]);
  const connected=settings?.whatsapp_numbers.some(number=>number.is_default&&number.connection_status==="CONNECTED")??false;
  return <div className="min-h-full bg-white"><OperationPageHeader title="Communication" description="Centralisez WhatsApp, les relances commerciales et les connaissances utilisées par l’IA."/><OperationContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    <ModuleCard href="/app/inbox" icon={<MessageCircle size={18}/>} title="Messagerie WhatsApp" value={connected?"Connecté":"À connecter"} detail="Conversations clients, réponses automatiques et reprise manuelle." loading={loading}/>
    <ModuleCard href="/app/followups" icon={<BellRing size={18}/>} title="Annonces et relances" value={String((followups?.due_today??0)+(followups?.overdue??0))} detail={`${followups?.due_today??0} aujourd’hui · ${followups?.overdue??0} en retard`} loading={loading}/>
    <ModuleCard href="/app/knowledge" icon={<BookOpen size={18}/>} title="Connaissances" value={String(settings?.knowledge.whatsapp_ready_count??0)} detail="Informations publiées et utilisables par l’IA avec les clients." loading={loading}/>
  </OperationContent></div>;
}

function ModuleCard({href,icon,title,value,detail,loading}:{href:string;icon:ReactNode;title:string;value:string;detail:string;loading:boolean}){
  return <Link href={href} className="group min-h-[144px] rounded-[9px] border border-[#dfe3e7] bg-white p-5 transition-colors hover:border-[#b9c6c0] hover:bg-[#fbfcfb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9ccdb8]">
    <div className="flex items-center justify-between"><span className="grid h-9 w-9 place-items-center rounded-[8px] bg-[#eef6f2] text-[#16704b]">{icon}</span><ArrowRight size={16} className="text-[#9aa2a9] transition-transform group-hover:translate-x-0.5 group-hover:text-[#16704b]"/></div>
    <strong className="mt-4 block text-[18px] font-semibold text-[#25292e]">{loading?"—":value}</strong><h2 className="mt-1 text-[14px] font-semibold text-[#30373d]">{title}</h2><p className="mt-1 text-[12px] leading-5 text-[#747e86]">{detail}</p>
  </Link>;
}
