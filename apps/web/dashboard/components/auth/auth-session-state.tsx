"use client";

import { useState } from "react";
import Link from "next/link";
import { useClerk } from "@clerk/nextjs";
import { ArrowRight, LogOut } from "lucide-react";
import { SlaivioLogoLoader } from "@/components/ui/slaivio-logo-loader";

export function AuthSessionState({
  title = "Vous êtes déjà connecté",
  description = "Votre session SLAIVIO est active. Vous pouvez ouvrir le dashboard ou vous déconnecter pour utiliser un autre compte.",
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
      <div className="rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm">
        <h2 className="text-xl font-black tracking-tight text-slate-950">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {description}
        </p>
      </div>

      <Link
        href="/app"
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white shadow-lg shadow-slate-950/20 transition hover:-translate-y-0.5 hover:bg-slate-800"
      >
        Ouvrir le dashboard
        <ArrowRight size={16} />
      </Link>

        <button
          type="button"
          disabled={signingOut}
          onClick={() => void signOutAccount()}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:-translate-y-0.5 hover:border-red-200 hover:text-red-600 disabled:pointer-events-none disabled:opacity-60"
        >
          <LogOut size={16} />
          Se déconnecter
        </button>
      </div>
    </>
  );
}
