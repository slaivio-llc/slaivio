"use client";
import {dashboardText,useDashboardMessages} from '@/components/i18n/dashboard-messages';


import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, Clock3, LifeBuoy } from "lucide-react";

import { SlaivioBrand } from "@/components/ui/slaivio-brand";
import { ReconnectButton } from '@/components/auth/reconnect-button';

import type { OnboardingExperienceState } from "@/services/onboarding-experience";

const visibleSteps = ["AGENCY_PROFILE", "OPERATIONS", "WHATSAPP", "AI_KNOWLEDGE", "REVIEW"];
const routes: Record<string, string> = {
  AGENCY_PROFILE: "/onboarding/agency-profile",
  OPERATIONS: "/onboarding/operations",
  WHATSAPP: "/onboarding/whatsapp",
  AI_KNOWLEDGE: "/onboarding/ai-knowledge",
  REVIEW: "/onboarding/review",
};

const journeyLabels = {
  PARCEL_FREIGHT: {
    AGENCY_PROFILE: "Entreprise",
    OPERATIONS: "Dépôt principal",
    WHATSAPP: "WhatsApp",
    AI_KNOWLEDGE: "Réponses colis",
    REVIEW: "Vérification",
  },
} as const;

export function OnboardingShell({ children, state, currentStep }: {
  children: ReactNode;
  state: OnboardingExperienceState;
  currentStep?: string;
}) {
  useDashboardMessages();
  const steps = visibleSteps.map((key) => state.steps.find((step) => step.step_key === key)).filter(Boolean);
  const active = currentStep || state.current_step?.step_key || "AGENCY_PROFILE";
  return <main className="min-h-screen bg-white text-[#1f2933]">
    <OnboardingHeader steps={steps.filter((step): step is NonNullable<typeof step> => Boolean(step))} active={active}/>
    <div className="mx-auto w-full max-w-[900px] px-5 py-10 sm:px-8 sm:py-14">{children}</div>
  </main>;
}

function OnboardingHeader({ steps, active, pending = false }: {
  steps: Array<{ step_key: string; step_name: string; status: string }>;
  active: string;
  pending?: boolean;
}) {
  useDashboardMessages();
  const currentIndex = Math.max(0, visibleSteps.indexOf(active));
  return (
    <header className="border-b border-[#e8ebed] bg-white">
      <div className="mx-auto flex h-[68px] max-w-[1440px] items-center justify-between px-5 sm:px-8">
        <Link href="/landing" aria-label={dashboardText("SLAIVIO")}><SlaivioBrand /></Link>
        <Link href="mailto:support@slaivio.com" className="inline-flex items-center gap-2 text-[13px] font-medium text-[#65717b] hover:text-[#168456]"><LifeBuoy size={16}/>{dashboardText("Besoin d’aide ?")}</Link>
      </div>
      <nav aria-label={dashboardText("Progression de la configuration")} className="mx-auto max-w-[900px] overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <ol className="flex min-w-[720px] items-center justify-center pb-4 pt-3">
          {steps.map((step, index) => {
            if (!step) return null;
            const skipped = step.status === "SKIPPED";
            const complete = !pending && (step.status === "COMPLETED" || skipped || index < currentIndex);
            const selected = step.step_key === active;
            const canOpen = !pending && (complete || selected);
            const label = journeyLabels.PARCEL_FREIGHT[step.step_key as keyof typeof journeyLabels.PARCEL_FREIGHT] || step.step_name;
            const content = <><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border text-[12px] font-semibold ${skipped ? "border-[#cbd2d7] bg-[#f4f6f7] text-[#69747c]" : complete ? "border-[#19a463] bg-[#19a463] text-white" : selected ? "border-[#087f4f] bg-[#087f4f] text-white" : "border-[#d9dee2] bg-[#f6f7f8] text-[#68737c]"}`}>{skipped ? <Clock3 size={13}/> : complete ? <Check size={14}/> : index + 1}</span><span className={`ml-2 whitespace-nowrap text-[13px] font-medium ${selected ? "text-[#087f4f]" : complete ? "text-[#34414a]" : "text-[#7b858e]"}`}>{dashboardText(label)}</span></>;
            return <li key={step.step_key} className="flex items-center">
              {canOpen ? <Link href={routes[step.step_key]} className="flex items-center rounded-md px-1 py-1 focus:outline-none focus:ring-2 focus:ring-[#087f4f]/20">{content}</Link> : <span className="flex items-center px-1 py-1">{content}</span>}
              {index < steps.length - 1 && (
                <span className={`mx-3 h-px w-8 ${complete ? "bg-[#42b983]" : "bg-[#dfe3e6]"}`}/>
              )}
            </li>;
          })}
        </ol>
      </nav>
    </header>
  );
}

export function OnboardingHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  useDashboardMessages();
  return <header className="mb-9"><p className="text-[12px] font-semibold uppercase tracking-[.12em] text-[#087f4f]">{eyebrow}</p><h1 className="mt-2 text-[28px] font-semibold tracking-[-.025em] text-[#111827] sm:text-[34px]">{title}</h1><p className="mt-3 max-w-[680px] text-[14px] leading-6 text-[#68737d]">{description}</p></header>;
}

export function OnboardingFooter({ backHref, children }: { backHref?: string; children: ReactNode }) {
  useDashboardMessages();
  return <footer className="mt-10 flex flex-col-reverse gap-3 border-t border-[#eceff1] pt-6 sm:flex-row sm:items-center sm:justify-between">{backHref ? <Link href={backHref} className="inline-flex h-10 items-center justify-center rounded-[7px] px-4 text-[13px] font-semibold text-[#59656e] hover:bg-[#f4f6f6]">{dashboardText("Retour")}</Link> : <span/>}<div className="flex justify-end gap-3">{children}</div></footer>;
}

export function OnboardingLoading() {
  useDashboardMessages();
  const pathname = usePathname();
  const active = visibleSteps.find(key => routes[key] === pathname) || "AGENCY_PROFILE";
  return <main className="min-h-screen bg-white text-[#1f2933]" aria-busy="true">
    <OnboardingHeader active={active} pending steps={visibleSteps.map(key => ({step_key:key,step_name:journeyLabels.PARCEL_FREIGHT[key as keyof typeof journeyLabels.PARCEL_FREIGHT],status:"PENDING"}))}/>
    <div role="status" aria-live="polite" className="sr-only">{dashboardText("Préparation de votre espace")}</div>
    <div aria-hidden="true" className="mx-auto w-full max-w-[900px] px-5 py-10 sm:px-8 sm:py-14">
      <div className="motion-safe:animate-pulse">
        <div className="mb-9 space-y-4"><div className="h-3 w-24 rounded bg-[#e7f2eb]"/><div className="h-9 w-4/5 max-w-[460px] rounded-md bg-[#edf0ee]"/><div className="h-4 w-full max-w-[600px] rounded bg-[#f1f3f2]"/></div>
        <div className="mb-9 h-[86px] rounded-[9px] border border-[#e5ece7] bg-[#f7faf8]"/>
        <div className="grid gap-5 sm:grid-cols-2">{Array.from({length:6},(_,index)=><div key={index} className="space-y-3"><div className="h-3 w-28 rounded bg-[#edf0ee]"/><div className="h-11 rounded-[7px] border border-[#e8ece9] bg-[#f8faf9]"/></div>)}</div>
        <div className="mt-10 flex justify-between border-t border-[#eceff1] pt-6"><div className="h-10 w-20 rounded-[7px] bg-[#f3f5f4]"/><div className="h-10 w-28 rounded-[7px] bg-[#e5f2e9]"/></div>
      </div>
    </div>
  </main>;
}

export function OnboardingError({ message, retry, authenticationRequired=false }: { message: string; retry: () => void; authenticationRequired?:boolean }) {
  useDashboardMessages();
  const pathname=usePathname();
  return <main className="grid min-h-screen place-items-center bg-white px-5"><div className="max-w-md text-center"><SlaivioBrand/><h1 className="mt-7 text-[20px] font-semibold text-[#202a32]">{authenticationRequired?dashboardText("Retrouvons votre connexion"):dashboardText("Configuration indisponible")}</h1><p className="mt-2 text-[13px] leading-5 text-[#717c84]">{message}</p>{authenticationRequired?<ReconnectButton returnTo={pathname} className="mt-6"/>:<button type="button" onClick={retry} className={`${onboardingPrimaryButtonClass} mt-6`}>{dashboardText("Réessayer")}</button>}</div></main>;
}

export const onboardingInputClass = "h-11 w-full rounded-[7px] border border-[#d7dde1] bg-white px-3 text-[14px] text-[#26323a] outline-none transition placeholder:text-[#a0a8ae] focus:border-[#12a865] focus:ring-2 focus:ring-[#12a865]/10";
export const onboardingPrimaryButtonClass = "inline-flex h-10 items-center justify-center rounded-[7px] bg-[#087f4f] px-5 text-[13px] font-semibold text-white transition hover:bg-[#06683f] disabled:cursor-not-allowed disabled:opacity-50";
export const onboardingSkipButtonClass = "inline-flex h-10 items-center justify-center rounded-[7px] px-4 text-[13px] font-semibold text-[#68737c] transition hover:bg-[#f3f5f6] hover:text-[#303b43] disabled:cursor-not-allowed disabled:opacity-50";
