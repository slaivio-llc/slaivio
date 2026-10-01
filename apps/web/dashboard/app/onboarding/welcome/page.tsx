"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";

import { SlaivioBrand } from "@/components/ui/slaivio-brand";
import { onboardingPrimaryButtonClass } from "@/components/onboarding/OnboardingShell";

export default function OnboardingWelcomePage() {
  const router = useRouter();
  function start() { router.push("/onboarding/agency-profile"); }
  return <main className="min-h-screen bg-white text-[#1f2933]">
    <header className="mx-auto flex h-[68px] max-w-[1440px] items-center px-5 sm:px-8"><SlaivioBrand/></header>
    <section className="mx-auto grid min-h-[calc(100vh-68px)] max-w-[1120px] items-center gap-12 px-5 py-12 sm:px-8 lg:grid-cols-[1fr_420px]">
      <div><p className="text-[13px] font-semibold text-[#4f46e5]">Bienvenue sur SLAIVIO</p><h1 className="mt-3 max-w-[650px] text-[38px] font-semibold leading-[1.12] tracking-[-.035em] text-[#111827] sm:text-[52px]">Préparons l’espace de travail de votre agence.</h1><p className="mt-5 max-w-[620px] text-[16px] leading-7 text-[#68737d]">Quelques informations suffisent pour adapter SLAIVIO à votre activité, connecter vos opérations et préparer les réponses clients.</p><div className="mt-8 grid gap-3 text-[14px] text-[#45515a]">{["Parcours adapté aux véhicules ou aux colis et au fret","Vos informations sont enregistrées à chaque étape","Vous gardez le contrôle sur WhatsApp et les réponses de l’IA"].map(item=><p key={item} className="flex items-center gap-3"><span className="grid h-6 w-6 place-items-center rounded-full bg-[#eaf8f1] text-[#168456]"><Check size={14}/></span>{item}</p>)}</div><button onClick={start} className={`${onboardingPrimaryButtonClass} mt-9 gap-2`}>Commencer<ArrowRight size={15}/></button></div>
      <aside className="rounded-[14px] bg-[#f7f7fb] p-7 sm:p-9"><p className="text-[12px] font-semibold uppercase tracking-[.1em] text-[#6b7280]">Configuration</p><ol className="mt-6 space-y-5">{[["01","Votre entreprise"],["02","Vos opérations"],["03","WhatsApp et IA"],["04","Vérification finale"]].map(([number,label])=><li key={number} className="flex items-center gap-4"><span className="grid h-9 w-9 place-items-center rounded-full border border-[#dedee8] bg-white text-[12px] font-semibold text-[#5548e7]">{number}</span><span className="text-[14px] font-medium text-[#303943]">{label}</span></li>)}</ol><p className="mt-7 border-t border-[#e6e6ee] pt-5 text-[12px] leading-5 text-[#747e87]">Temps moyen : environ 5 minutes. Les réglages avancés resteront disponibles dans le dashboard.</p></aside>
    </section>
  </main>;
}
