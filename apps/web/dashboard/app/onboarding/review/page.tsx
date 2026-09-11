"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, MapPin, MessageCircle, Sparkles } from "lucide-react";

import { OnboardingError, OnboardingFooter, OnboardingHeading, OnboardingLoading, OnboardingShell, onboardingPrimaryButtonClass } from "@/components/onboarding/OnboardingShell";
import { useOnboardingState } from "@/components/onboarding/use-onboarding-state";
import { completeOnboardingStep } from "@/services/onboarding-experience";
import { getOnboardingStatus, type AgencyProfile } from "@/services/onboarding";
import { getPilotSettings, type PilotSettingsData } from "@/services/organization-admin";

export default function OnboardingReviewPage(){
  const router=useRouter(); const {state,error:stateError,reload}=useOnboardingState(); const [profile,setProfile]=useState<AgencyProfile|null>(null); const [settings,setSettings]=useState<PilotSettingsData|null>(null); const [saving,setSaving]=useState(false); const [error,setError]=useState("");
  useEffect(()=>{Promise.all([getOnboardingStatus(),getPilotSettings()]).then(([onboarding,pilot])=>{setProfile(onboarding.profile);setSettings(pilot);}).catch(()=>setError("La synthèse ne peut pas être chargée."));},[]);
  async function finish(){setSaving(true);setError("");try{await completeOnboardingStep("REVIEW");await completeOnboardingStep("GO_LIVE");router.push("/app");}catch{setError("La configuration ne peut pas être finalisée pour le moment.");setSaving(false);}}
  if(!state)return stateError?<OnboardingError message={stateError} retry={()=>void reload()}/>:<OnboardingLoading/>;
  if(!settings)return error?<OnboardingError message={error} retry={()=>window.location.reload()}/>:<OnboardingLoading/>;
  const number=settings.whatsapp_numbers.find(item=>item.connection_status==="CONNECTED");
  const parcel=profile?.business_type==="PARCEL_FREIGHT"||state.business_type==="PARCEL_FREIGHT";
  const rows=[{icon:<Building2 size={18}/>,title:"Entreprise",value:profile?.brand_name||settings.organization.organization_name,detail:parcel?"Colis et fret":"Importation de véhicules",href:"/onboarding/agency-profile"},{icon:<MapPin size={18}/>,title:parcel?"Dépôt principal":"Bureau principal",value:settings.locations[0]?.name||"À configurer plus tard",detail:settings.locations[0]?[settings.locations[0].city,settings.locations[0].country].filter(Boolean).join(", "):"Disponible depuis les paramètres",href:"/onboarding/operations"},{icon:<MessageCircle size={18}/>,title:"WhatsApp",value:number?.display_phone_number||"À connecter plus tard",detail:number?"Connexion active":"Disponible depuis les paramètres",href:"/onboarding/whatsapp"},{icon:<Sparkles size={18}/>,title:"Réponses IA",value:settings.knowledge.published_count?modeLabel(settings.ai.pilot_response_mode):"À configurer plus tard",detail:`${settings.knowledge.published_count} information(s) publiée(s)`,href:"/onboarding/ai-knowledge"}];
  const ready=Boolean(profile?.brand_name&&profile?.business_type);
  const deferred=!settings.locations.length||!number||!settings.knowledge.published_count;
  return <OnboardingShell state={state} currentStep="REVIEW"><OnboardingHeading eyebrow="Étape 5 sur 5" title="Vérifiez votre configuration" description="Voici ce qui sera utilisé au démarrage. Vous pourrez modifier tous ces réglages plus tard dans SLAIVIO."/>
    <section className="overflow-hidden rounded-[10px] border border-[#e0e4e7]">{rows.map(row=><a key={row.title} href={row.href} className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 border-b border-[#edf0f2] px-4 py-4 last:border-0 hover:bg-[#fafbfb]"><span className="grid h-9 w-9 place-items-center rounded-[8px] bg-[#f1f3f4] text-[#65717a]">{row.icon}</span><span className="min-w-0"><strong className="block text-[13px] font-semibold">{row.title}</strong><span className="mt-1 block truncate text-[12px] text-[#77828a]">{row.value} · {row.detail}</span></span><span className="text-[12px] font-medium text-[#5548e7]">Modifier</span></a>)}</section>
    {ready&&<div className="mt-6 flex items-start gap-3 rounded-[8px] bg-[#edf8f2] p-4"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#1aa263] text-white"><Check size={14}/></span><div><p className="text-[13px] font-semibold text-[#235d43]">Votre espace {parcel?"colis et fret":"véhicules"} est prêt</p><p className="mt-1 text-[12px] leading-5 text-[#537061]">Vous pouvez accéder au tableau de bord. {deferred?"Les éléments reportés pourront être configurés plus tard dans SLAIVIO.":"Tous les éléments de démarrage sont configurés."}</p></div></div>}
    {!ready&&<p className="mt-6 rounded-[8px] bg-[#fff7e8] p-4 text-[13px] text-[#755d25]">Le nom de l’entreprise et son type d’activité sont nécessaires pour créer le bon espace de travail.</p>}{error&&<p role="alert" className="mt-5 text-[13px] text-[#a33a32]">{error}</p>}<OnboardingFooter backHref="/onboarding/ai-knowledge"><button type="button" onClick={finish} disabled={!ready||saving} className={onboardingPrimaryButtonClass}>{saving?"Ouverture…":"Accéder à SLAIVIO"}</button></OnboardingFooter>
  </OnboardingShell>;
}
function modeLabel(value:string){return ({SUGGESTION_ONLY:"Suggestions uniquement",CONTROLLED_AUTO:"Mode automatique",PAUSED:"En pause"} as Record<string,string>)[value]||value}
