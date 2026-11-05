"use client";

import { useRouter } from "next/navigation";
import Link from 'next/link';
import {dashboardText,useDashboardMessages} from '@/components/i18n/dashboard-messages';

import { SlaivioBrand } from "@/components/ui/slaivio-brand";
import { onboardingPrimaryButtonClass } from "@/components/onboarding/OnboardingShell";

export default function OnboardingWelcomePage() {
  useDashboardMessages();
  const router = useRouter();
  function start() { router.push("/onboarding/agency-profile"); }
  return <main className="min-h-screen bg-[#fafbf9] text-[#27332d]">
    <header className="border-b border-[#e4e8e2] bg-white">
      <div className="mx-auto flex h-[72px] max-w-[1200px] items-center justify-between gap-5 px-5 sm:px-8">
        <SlaivioBrand/>
        <Link href="mailto:support@slaivio.com" className="text-[12px] font-medium text-[#66726a] underline-offset-4 hover:text-[#087f4f] hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#087f4f]">{dashboardText('Besoin d’un coup de main ?')}</Link>
      </div>
    </header>
    <section aria-labelledby="welcome-title" className="mx-auto grid w-full max-w-[1040px] gap-10 px-5 py-12 sm:px-8 sm:py-16 lg:min-h-[calc(100svh-72px)] lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center lg:gap-16 lg:py-20">
      <div className="max-w-[520px]">
        <p className="text-[12px] font-medium text-[#087f4f]">{dashboardText('Bienvenue sur Slaivio')}</p>
        <h1 id="welcome-title" className="mt-5 text-[34px] font-semibold leading-[1.16] tracking-[-.035em] text-[#23372b] sm:text-[44px]">{dashboardText('Installons votre agence, simplement.')}</h1>
        <p className="mt-6 max-w-[440px] text-[15px] leading-7 text-[#657168]">{dashboardText('Commençons par votre agence et votre dépôt. Nous préparerons ensuite votre espace pour suivre vos colis et échanger avec vos clients.')}</p>
        <div className="mt-8 border-l-2 border-[#c9d8c7] pl-4">
          <p className="text-[13px] font-medium text-[#3b4e40]">{dashboardText('Vous n’avez pas besoin de tout décider maintenant.')}</p>
          <p className="mt-2 max-w-[390px] text-[13px] leading-6 text-[#687465]">{dashboardText('Vos services, vos routes et votre équipe pourront être ajoutés depuis les paramètres, à votre rythme.')}</p>
        </div>
        <div className="mt-9">
          <button type="button" onClick={start} className={`${onboardingPrimaryButtonClass} h-11 w-full px-6 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#087f4f] sm:w-auto`}>{dashboardText('Configurer mon agence')}</button>
          <p className="mt-3 text-[11px] leading-5 text-[#687465]">{dashboardText('Vous pourrez modifier ces informations par la suite.')}</p>
        </div>
      </div>
      <aside aria-labelledby="welcome-steps" className="w-full rounded-[8px] border border-[#e0e6dc] bg-white px-5 py-6 sm:px-7 sm:py-7">
        <p className="text-[11px] text-[#687465]">{dashboardText('Votre espace, étape par étape')}</p>
        <h2 id="welcome-steps" className="mt-2 text-[17px] font-semibold tracking-[-.02em] text-[#344636]">{dashboardText('Ce que nous allons préparer')}</h2>
        <ol className="mt-5 divide-y divide-[#edf0ea]">
          {[
            ['Votre agence','Son nom et ses coordonnées.'],
            ['Votre dépôt principal','Le lieu où vous recevez les colis.'],
            ['Votre WhatsApp','Le numéro utilisé avec vos clients.'],
            ['Vos réponses clients','Les informations utiles sur votre activité.'],
            ['Une dernière vérification','Vous relisez, puis vous ouvrez votre espace.'],
          ].map(([title,description],index)=><li key={title} className="flex gap-4 py-4 first:pt-1 last:pb-0">
            <span aria-hidden="true" className="w-4 shrink-0 pt-0.5 text-[11px] tabular-nums text-[#8c9787]">{String(index+1).padStart(2,'0')}</span>
            <div className="min-w-0"><h3 className="text-[13px] font-medium text-[#3d4d3f]">{dashboardText(title)}</h3><p className="mt-1 text-[12px] leading-5 text-[#687465]">{dashboardText(description)}</p></div>
          </li>)}
        </ol>
      </aside>
    </section>
  </main>;
}
