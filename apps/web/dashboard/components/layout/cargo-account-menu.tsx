"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { useState } from "react";
import { Languages, LogOut, ShieldCheck } from "lucide-react";

export function CargoAccountMenu({ locale, close, preferences }: { locale: "fr" | "en"; close: () => void; preferences: () => void }) {
  const { user } = useUser();
  const { openUserProfile, signOut } = useClerk();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const en = locale === "en";
  const itemClass = "flex min-h-10 w-full items-center gap-3 rounded-md px-3 text-left text-sm hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-emerald-600";
  return <div className="w-72 max-w-[calc(100vw-24px)] rounded-lg border bg-white p-2 shadow-xl">
    <div className="px-3 py-3"><p className="truncate text-sm font-semibold">{user?.fullName || user?.primaryEmailAddress?.emailAddress}</p><p className="truncate text-xs text-slate-500">{user?.primaryEmailAddress?.emailAddress}</p></div>
    <button type="button" className={itemClass} onClick={() => { close(); openUserProfile(); }}><ShieldCheck size={16}/>{en ? "Profile and security" : "Profil et sécurité"}</button>
    <button type="button" className={itemClass} onClick={preferences}><Languages size={16}/>{en ? "Language preferences" : "Préférences de langue"}</button>
    <button type="button" disabled={busy} className={itemClass} onClick={async () => { setBusy(true); setError(false); try { await signOut({ redirectUrl: "/sign-in" }); } catch { setError(true); setBusy(false); } }}><LogOut size={16}/>{busy ? (en ? "Signing out…" : "Déconnexion…") : (en ? "Sign out" : "Se déconnecter")}</button>
    {error && <p role="alert" className="px-3 py-2 text-xs text-red-700">{en ? "Sign out failed. Try again." : "Déconnexion impossible. Réessayez."}</p>}
  </div>;
}
