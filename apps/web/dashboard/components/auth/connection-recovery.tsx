"use client";
import {dashboardText,useDashboardMessages} from '@/components/i18n/dashboard-messages';


import { WifiOff } from "lucide-react";
import Link from "next/link";
import { AuthShell } from "./auth-shell";

export function ConnectionRecovery() {
  useDashboardMessages();
  return <AuthShell title={dashboardText("Retrouvons votre connexion")} description={dashboardText("Votre espace colis et fret reste à la même adresse.")}>
    <div role="alert" className="rounded-xl border border-[#e3e6e5] bg-[#fafbfa] p-5">
      <WifiOff size={22} className="mb-4 text-[#69717a]" aria-hidden="true" />
      <h2 className="text-[15px] font-medium">{dashboardText("Connexion temporairement indisponible")}</h2>
      <p className="mt-2 text-[14px] leading-6 text-[#69717a]">{dashboardText("Nous n’arrivons pas à vérifier votre session. Vérifiez votre connexion internet, puis réessayez. Vous n’avez pas besoin de vous déconnecter.")}</p>
    </div>
    <button type="button" onClick={() => window.location.reload()} className="mt-5 h-11 w-full rounded-lg bg-[#16855f] text-sm font-medium text-white hover:bg-[#126c4e]">{dashboardText("Réessayer")}</button>
    <Link href="/fr" className="mt-4 block rounded-lg py-2 text-center text-[13px] text-[#69717a] hover:bg-[#f4f5f4]">{dashboardText("Retour à l’accueil")}</Link>
  </AuthShell>;
}
