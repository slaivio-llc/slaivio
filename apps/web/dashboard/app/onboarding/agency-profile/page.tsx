"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CarFront, PackageCheck } from "lucide-react";

import { OnboardingError, OnboardingFooter, OnboardingHeading, OnboardingLoading, OnboardingShell, onboardingInputClass, onboardingPrimaryButtonClass } from "@/components/onboarding/OnboardingShell";
import { useOnboardingState } from "@/components/onboarding/use-onboarding-state";
import { completeOnboardingStep } from "@/services/onboarding-experience";
import { getOnboardingStatus, saveAgencyProfile, type AgencyProfilePayload } from "@/services/onboarding";
import { apiErrorDetail } from "@/services/api";

const empty: AgencyProfilePayload = { legal_name:"", brand_name:"", country:"", city:"", address:"", phone:"", email:"", website:"", default_language:"fr", default_currency:"USD", business_type:"VEHICLE_IMPORT" };

export default function AgencyProfilePage() {
  const router = useRouter();
  const { state, error: stateError, reload } = useOnboardingState();
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { getOnboardingStatus().then(({profile}) => { if (profile) setForm({...empty,...profile}); }).catch(()=>undefined); }, []);
  const set = (key:keyof AgencyProfilePayload,value:string) => setForm(current=>({...current,[key]:value}));
  async function submit(event:FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try { await saveAgencyProfile(form); await completeOnboardingStep("WELCOME"); await completeOnboardingStep("AGENCY_PROFILE"); router.push("/onboarding/operations"); }
    catch (cause) { setError(apiErrorDetail(cause) || "L’enregistrement du profil de l’agence a échoué. Réessayez dans un instant."); setSaving(false); }
  }
  if (!state) return stateError?<OnboardingError message={stateError} retry={()=>void reload()}/>:<OnboardingLoading/>;
  return <OnboardingShell state={state} currentStep="AGENCY_PROFILE"><form onSubmit={submit}>
    <OnboardingHeading eyebrow="Étape 1 sur 5" title="Parlez-nous de votre entreprise" description="Ces informations apparaîtront dans votre espace de travail et permettront à SLAIVIO d’adapter les modules à votre activité."/>
    <section className="mb-9"><h2 className="text-[14px] font-semibold text-[#26323a]">Quelle est votre activité principale ?</h2><div className="mt-3 grid gap-3 sm:grid-cols-2">
      <Choice checked={form.business_type==="VEHICLE_IMPORT"} icon={<CarFront size={20}/>} title="Importation de véhicules" description="Dossiers, clients et suivi des véhicules importés." onClick={()=>setForm(current=>({...current,business_type:"VEHICLE_IMPORT"}))}/>
      <Choice checked={form.business_type==="PARCEL_FREIGHT"} icon={<PackageCheck size={20}/>} title="Colis et fret" description="Colis, départs, manifestes, paiements et suivi client." onClick={()=>setForm(current=>({...current,business_type:"PARCEL_FREIGHT"}))}/>
    </div></section>
    <section className="grid gap-5 sm:grid-cols-2"><Field label="Nom commercial" required><input className={onboardingInputClass} required value={form.brand_name} onChange={e=>set("brand_name",e.target.value)}/></Field><Field label="Raison sociale" hint="Si elle est différente"><input className={onboardingInputClass} value={form.legal_name} onChange={e=>set("legal_name",e.target.value)}/></Field><Field label="Pays" required><input className={onboardingInputClass} required value={form.country} onChange={e=>set("country",e.target.value)} autoComplete="country-name"/></Field><Field label="Ville"><input className={onboardingInputClass} value={form.city} onChange={e=>set("city",e.target.value)} autoComplete="address-level2"/></Field><Field label="Téléphone"><input className={onboardingInputClass} type="tel" value={form.phone} onChange={e=>set("phone",e.target.value)} autoComplete="tel"/></Field><Field label="Email professionnel"><input className={onboardingInputClass} type="email" value={form.email} onChange={e=>set("email",e.target.value)} autoComplete="email"/></Field><Field label="Adresse"><input className={onboardingInputClass} value={form.address} onChange={e=>set("address",e.target.value)} autoComplete="street-address"/></Field><Field label="Site web"><input className={onboardingInputClass} type="url" placeholder="https://" value={form.website} onChange={e=>set("website",e.target.value)}/></Field><Field label="Langue"><select className={onboardingInputClass} value={form.default_language} onChange={e=>set("default_language",e.target.value)}><option value="fr">Français</option><option value="en">English</option></select></Field><Field label="Devise"><select className={onboardingInputClass} value={form.default_currency} onChange={e=>set("default_currency",e.target.value)}><option>USD</option><option>EUR</option><option>CDF</option></select></Field></section>
    {error&&<p role="alert" className="mt-6 rounded-[7px] bg-[#fff3f1] px-4 py-3 text-[13px] text-[#a33a32]">{error}</p>}
    <OnboardingFooter backHref="/onboarding/welcome"><button disabled={saving} className={onboardingPrimaryButtonClass}>{saving?"Enregistrement…":"Continuer"}</button></OnboardingFooter>
  </form></OnboardingShell>;
}

function Choice({checked,icon,title,description,onClick}:{checked:boolean;icon:React.ReactNode;title:string;description:string;onClick:()=>void}) { return <button type="button" role="radio" aria-checked={checked} onClick={onClick} className={`flex min-h-[96px] items-start gap-4 rounded-[9px] border p-4 text-left transition ${checked?"border-[#655be7] bg-[#f7f6ff] ring-1 ring-[#655be7]":"border-[#dce1e4] bg-white hover:border-[#b8c0c6]"}`}><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-[8px] ${checked?"bg-[#e8e6ff] text-[#5045d6]":"bg-[#f2f4f4] text-[#68737b]"}`}>{icon}</span><span><strong className="block text-[14px] font-semibold text-[#202a32]">{title}</strong><span className="mt-1 block text-[12px] leading-5 text-[#6f7a83]">{description}</span></span></button> }
function Field({label,hint,required,children}:{label:string;hint?:string;required?:boolean;children:React.ReactNode}) { return <label className="block"><span className="mb-2 flex items-center gap-2 text-[13px] font-medium text-[#344049]">{label}{required&&<span className="text-[#9c3b35]">*</span>}{hint&&<span className="text-[11px] font-normal text-[#8a949b]">{hint}</span>}</span>{children}</label> }
