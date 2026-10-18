"use client";

import { ArrowRight, BellRing, Bot, Radio } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { OperationContent } from "@/components/ui/operation-primitives";
import { OperationPageHeader } from "@/components/ui/operation-page-header";
import { PilotSettingsPage } from "@/components/settings/pilot-settings-page";

const cards = [
  { title: "Canaux", description: "Connectez et gérez les comptes WhatsApp de l’agence.", section: "channels", icon: Radio },
  { title: "Assistant IA", description: "Choisissez le mode de réponse et les préférences de l’assistant.", section: "ai", icon: Bot },
  { title: "Notifications", description: "Gérez les alertes et préférences de communication.", section: "notifications", icon: BellRing },
];

export function CommunicationSettingsHub() {
  const params = useSearchParams();
  if (params.has("section")) return <PilotSettingsPage scope="communication"/>;
  return <div className="min-h-full bg-white"><OperationPageHeader title="Paramètres de communication" description="Les réglages des canaux, de l’assistant et des notifications restent propres au module Communication." backHref="/app/communication"/><OperationContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{cards.map(({title,description,section,icon:Icon})=><Link key={section} href={`/app/communication/settings?section=${section}`} className="group min-h-[138px] rounded-[9px] border border-[#dfe3e7] p-5 transition-colors hover:border-[#b9c6c0] hover:bg-[#fbfcfb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9ccdb8]"><div className="flex items-center justify-between"><span className="grid h-9 w-9 place-items-center rounded-[8px] bg-[#eef6f2] text-[#16704b]"><Icon size={18}/></span><ArrowRight size={16} className="text-[#9aa2a9] group-hover:text-[#16704b]"/></div><h2 className="mt-4 text-[14px] font-semibold text-[#30373d]">{title}</h2><p className="mt-1 text-[12px] leading-5 text-[#747e86]">{description}</p></Link>)}</OperationContent></div>;
}
