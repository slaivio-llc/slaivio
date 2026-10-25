"use client";

import { useState } from "react";
import Link from "next/link";
import { useClerk } from "@clerk/nextjs";
import { ArrowRight, LogOut } from "lucide-react";
import { SlaivioLogoLoader } from "@/components/ui/slaivio-logo-loader";

export function AuthSessionState({
  title = "Votre espace est prêt",
  description = "Votre compte est connecté. Retrouvez vos colis et vos expéditions là où vous les avez laissés.",
}: {
  title?: string;
  description?: string;
}) {
  const { signOut } = useClerk();
  const [signingOut, setSigningOut] = useState(false);

  async function signOutAccount() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut({ redirectUrl: "/sign-in" });
    } catch {
      setSigningOut(false);
    }
  }

  return (
    <>
      {signingOut ? <SlaivioLogoLoader overlay label="Déconnexion…" /> : null}
      <div className="space-y-4">
      <div className="rounded-xl border border-[#e3e6e5] bg-[#fafbfa] p-4 text-left">
        <h2 className="text-[15px] font-medium text-[#25292e]">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {description}
        </p>
      </div>

      <Link
        href="/app"
        className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#16855f] px-4 text-sm font-medium text-white transition-colors hover:bg-[#126c4e]"
      >
        Reprendre mon activité
        <ArrowRight size={16} />
      </Link>

        <button
          type="button"
          disabled={signingOut}
          onClick={() => void signOutAccount()}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-lg px-4 text-sm text-[#69717a] transition-colors hover:bg-[#f4f5f4] disabled:pointer-events-none disabled:opacity-60"
        >
          <LogOut size={16} />
          Se déconnecter
        </button>
      </div>
    </>
  );
}
