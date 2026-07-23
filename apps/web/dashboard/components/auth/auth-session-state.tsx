"use client";

import Link from "next/link";
import { SignOutButton } from "@clerk/nextjs";
import { ArrowRight, LogOut } from "lucide-react";

export function AuthSessionState({
  title = "Vous êtes déjà connecté",
  description = "Votre session SLAIVIO est active. Vous pouvez ouvrir le dashboard ou vous déconnecter pour utiliser un autre compte.",
}: {
  title?: string;
  description?: string;
}) {
  return (
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

      <SignOutButton redirectUrl="/sign-in">
        <button className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:-translate-y-0.5 hover:border-red-200 hover:text-red-600">
          <LogOut size={16} />
          Se déconnecter
        </button>
      </SignOutButton>
    </div>
  );
}
