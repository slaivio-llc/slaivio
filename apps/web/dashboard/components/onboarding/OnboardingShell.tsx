import type { ReactNode } from "react";
import Link from "next/link";
import { Check, Clock3, LifeBuoy } from "lucide-react";

import { SlaivioBrand } from "@/components/ui/slaivio-brand";
import { SlaivioLogoLoader } from "@/components/ui/slaivio-logo-loader";
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
  VEHICLE_IMPORT: {
    AGENCY_PROFILE: "Entreprise",
    OPERATIONS: "Bureau principal",
    WHATSAPP: "WhatsApp",
    AI_KNOWLEDGE: "Réponses dossiers",
    REVIEW: "Vérification",
  },
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
  const steps = visibleSteps.map((key) => state.steps.find((step) => step.step_key === key)).filter(Boolean);
  const active = currentStep || state.current_step?.step_key || "AGENCY_PROFILE";
  const currentIndex = Math.max(0, visibleSteps.indexOf(active));

  return <main className="min-h-screen bg-white text-[#1f2933]">
    <header className="border-b border-[#e8ebed] bg-white">
      <div className="mx-auto flex h-[68px] max-w-[1440px] items-center justify-between px-5 sm:px-8">
        <Link href="/landing" aria-label="SLAIVIO"><SlaivioBrand /></Link>
        <Link href="mailto:support@slaivio.com" className="inline-flex items-center gap-2 text-[13px] font-medium text-[#65717b] hover:text-[#168456]"><LifeBuoy size={16}/>Besoin d’aide ?</Link>
      </div>
      <nav aria-label="Progression de la configuration" className="mx-auto max-w-[900px] overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <ol className="flex min-w-[720px] items-center justify-center pb-4 pt-3">
          {steps.map((step, index) => {
            if (!step) return null;
            const skipped = step.status === "SKIPPED";
            const complete = step.status === "COMPLETED" || skipped || index < currentIndex;
            const selected = step.step_key === active;
            const canOpen = complete || selected;
            const label = journeyLabels[state.business_type]?.[step.step_key as keyof typeof journeyLabels.VEHICLE_IMPORT] || step.step_name;
            const content = <><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border text-[12px] font-semibold ${skipped ? "border-[#cbd2d7] bg-[#f4f6f7] text-[#69747c]" : complete ? "border-[#19a463] bg-[#19a463] text-white" : selected ? "border-[#4f46e5] bg-[#4f46e5] text-white" : "border-[#d9dee2] bg-[#f6f7f8] text-[#68737c]"}`}>{skipped ? <Clock3 size={13}/> : complete ? <Check size={14}/> : index + 1}</span><span className={`ml-2 whitespace-nowrap text-[13px] font-medium ${selected ? "text-[#4338ca]" : complete ? "text-[#34414a]" : "text-[#7b858e]"}`}>{label}</span></>;
            return <li key={step.step_key} className="flex items-center">
              {canOpen ? <Link href={routes[step.step_key]} className="flex items-center rounded-md px-1 py-1 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/20">{content}</Link> : <span className="flex items-center px-1 py-1">{content}</span>}
              {index < steps.length - 1 && (
                <span className={`mx-3 h-px w-8 ${complete ? "bg-[#42b983]" : "bg-[#dfe3e6]"}`}/>
              )}
            </li>;
          })}
        </ol>
      </nav>
    </header>
    <div className="mx-auto w-full max-w-[900px] px-5 py-10 sm:px-8 sm:py-14">{children}</div>
  </main>;
}

export function OnboardingHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <header className="mb-9"><p className="text-[12px] font-semibold uppercase tracking-[.12em] text-[#4f46e5]">{eyebrow}</p><h1 className="mt-2 text-[28px] font-semibold tracking-[-.025em] text-[#111827] sm:text-[34px]">{title}</h1><p className="mt-3 max-w-[680px] text-[14px] leading-6 text-[#68737d]">{description}</p></header>;
}

export function OnboardingFooter({ backHref, children }: { backHref?: string; children: ReactNode }) {
  return <footer className="mt-10 flex flex-col-reverse gap-3 border-t border-[#eceff1] pt-6 sm:flex-row sm:items-center sm:justify-between">{backHref ? <Link href={backHref} className="inline-flex h-10 items-center justify-center rounded-[7px] px-4 text-[13px] font-semibold text-[#59656e] hover:bg-[#f4f6f6]">Retour</Link> : <span/>}<div className="flex justify-end gap-3">{children}</div></footer>;
}

export function OnboardingLoading() {
  return <SlaivioLogoLoader label="Chargement de votre configuration" />;
}

export function OnboardingError({ message, retry }: { message: string; retry: () => void }) {
  return <main className="grid min-h-screen place-items-center bg-white px-5"><div className="max-w-md text-center"><SlaivioBrand/><h1 className="mt-7 text-[20px] font-semibold text-[#202a32]">Configuration indisponible</h1><p className="mt-2 text-[13px] leading-5 text-[#717c84]">{message}</p><button type="button" onClick={retry} className={`${onboardingPrimaryButtonClass} mt-6`}>Réessayer</button></div></main>;
}

export const onboardingInputClass = "h-11 w-full rounded-[7px] border border-[#d7dde1] bg-white px-3 text-[14px] text-[#26323a] outline-none transition placeholder:text-[#a0a8ae] focus:border-[#635bdf] focus:ring-2 focus:ring-[#635bdf]/10";
export const onboardingPrimaryButtonClass = "inline-flex h-10 items-center justify-center rounded-[7px] bg-[#5548e7] px-5 text-[13px] font-semibold text-white transition hover:bg-[#493dd4] disabled:cursor-not-allowed disabled:opacity-50";
export const onboardingSkipButtonClass = "inline-flex h-10 items-center justify-center rounded-[7px] px-4 text-[13px] font-semibold text-[#68737c] transition hover:bg-[#f3f5f6] hover:text-[#303b43] disabled:cursor-not-allowed disabled:opacity-50";
