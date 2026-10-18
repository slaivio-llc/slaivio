"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PackageCheck } from "lucide-react";

import { OnboardingError, OnboardingFooter, OnboardingHeading, OnboardingLoading, OnboardingShell, onboardingInputClass, onboardingPrimaryButtonClass } from "@/components/onboarding/OnboardingShell";
import { useOnboardingState } from "@/components/onboarding/use-onboarding-state";
import { completeOnboardingStep } from "@/services/onboarding-experience";
import { getOnboardingStatus, saveAgencyProfile, type AgencyProfilePayload } from "@/services/onboarding";
import { apiErrorDetail } from "@/services/api";
import { GeographyFields } from "@/components/ui/geography-fields";

const empty: AgencyProfilePayload = { legal_name:"", brand_name:"", country:"", city:"", address:"", phone:"", email:"", website:"", default_language:"fr", default_currency:"USD", business_type:"PARCEL_FREIGHT" };

export default function AgencyProfilePage() {
  const router = useRouter();
  const { state, error: stateError, reload } = useOnboardingState();
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { getOnboardingStatus().then(({profile}) => { if (profile) setForm({...empty,...profile,business_type:"PARCEL_FREIGHT"}); }).catch(()=>undefined); }, []);
  const set = (key:keyof AgencyProfilePayload,value:string) => setForm(current=>({...current,[key]:value}));
  async function submit(event:FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try { await saveAgencyProfile({...form,business_type:"PARCEL_FREIGHT"}); await completeOnboardingStep("WELCOME"); await completeOnboardingStep("AGENCY_PROFILE"); router.push("/onboarding/operations"); }
    catch (cause) { setError(apiErrorDetail(cause) || "L’enregistrement du profil de l’agence a échoué. Réessayez dans un instant."); setSaving(false); }
  }
  if (!state) return stateError?<OnboardingError message={stateError} retry={()=>void reload()}/>:<OnboardingLoading/>;
  return <OnboardingShell state={state} currentStep="AGENCY_PROFILE"><form onSubmit={submit}>
    <OnboardingHeading eyebrow="Étape 1 sur 5" title="Parlez-nous de votre entreprise" description="Ces informations apparaîtront dans votre espace de travail et permettront à SLAIVIO d’adapter les modules à votre activité."/>
    <section className="mb-9 rounded-[9px] border border-[#dce8e1] bg-[#f7fbf8] p-4"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-[8px] bg-[#e7f5ed] text-[#128352]"><PackageCheck size={20}/></span><div><h2 className="text-[14px] font-semibold text-[#26323a]">Espace Colis et fret</h2><p className="mt-1 text-[12px] leading-5 text-[#6f7a83]">SLAIVIO configure les colis, les expéditions, les départs, la finance et le suivi de votre agence.</p></div></div></section>
    <section className="grid gap-5 sm:grid-cols-2"><Field label="Nom commercial" required><input className={onboardingInputClass} required value={form.brand_name} onChange={e=>set("brand_name",e.target.value)}/></Field><Field label="Raison sociale" hint="Si elle est différente"><input className={onboardingInputClass} value={form.legal_name} onChange={e=>set("legal_name",e.target.value)}/></Field><GeographyFields required cityRequired={false} className={onboardingInputClass} country={form.country} city={form.city} onCountryChange={value=>set("country",value)} onCityChange={value=>set("city",value)}/><Field label="Téléphone"><input className={onboardingInputClass} type="tel" value={form.phone} onChange={e=>set("phone",e.target.value)} autoComplete="tel"/></Field><Field label="Email professionnel"><input className={onboardingInputClass} type="email" value={form.email} onChange={e=>set("email",e.target.value)} autoComplete="email"/></Field><Field label="Adresse"><input className={onboardingInputClass} value={form.address} onChange={e=>set("address",e.target.value)} autoComplete="street-address"/></Field><Field label="Site web"><input className={onboardingInputClass} type="url" placeholder="https://" value={form.website} onChange={e=>set("website",e.target.value)}/></Field><Field label="Langue"><select className={onboardingInputClass} value={form.default_language} onChange={e=>set("default_language",e.target.value)}><option value="fr">Français</option><option value="en">English</option></select></Field><Field label="Devise"><select className={onboardingInputClass} value={form.default_currency} onChange={e=>set("default_currency",e.target.value)}><option>USD</option><option>EUR</option><option>CDF</option><option>GBP</option><option>CNY</option><option>AED</option><option>XAF</option><option>GHS</option><option>KES</option></select></Field></section>
    {error&&<p role="alert" className="mt-6 rounded-[7px] bg-[#fff3f1] px-4 py-3 text-[13px] text-[#a33a32]">{error}</p>}
    <OnboardingFooter backHref="/onboarding/welcome"><button disabled={saving} className={onboardingPrimaryButtonClass}>{saving?"Enregistrement…":"Continuer"}</button></OnboardingFooter>
  </form></OnboardingShell>;
}

function Field({label,hint,required,children}:{label:string;hint?:string;required?:boolean;children:React.ReactNode}) { return <label className="block"><span className="mb-2 flex items-center gap-2 text-[13px] font-medium text-[#344049]">{label}{required&&<span className="text-[#9c3b35]">*</span>}{hint&&<span className="text-[11px] font-normal text-[#8a949b]">{hint}</span>}</span>{children}</label> }
