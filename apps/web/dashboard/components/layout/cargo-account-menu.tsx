"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";
import { Languages, LogOut, ShieldCheck } from "lucide-react";
import { operationMenuClass, operationMenuItemClass } from "@/components/ui/operation-styles";

export function CargoAccountMenu({ locale, close, preferences }: { locale: "fr" | "en"; close: () => void; preferences: () => void }) {
  const { user } = useUser();
  const { openUserProfile, signOut } = useClerk();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const en = locale === "en";
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    root.current?.querySelector('button')?.focus();
    return () => { previous?.focus(); };
  }, []);
  const itemClass = operationMenuItemClass;
  return <div ref={root} aria-label={en ? "Account" : "Compte"} className={`w-64 max-w-[calc(100vw-24px)] ${operationMenuClass}`} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); close(); } }}>
    <div className="px-2.5 py-2.5"><p className="truncate text-[13px] font-medium">{user?.fullName || user?.primaryEmailAddress?.emailAddress || (en ? 'My account' : 'Mon compte')}</p>{user?.fullName && <p className="mt-0.5 truncate text-xs text-slate-500">{user?.primaryEmailAddress?.emailAddress}</p>}</div>
    <button type="button" className={itemClass} onClick={() => { close(); openUserProfile(); }}><ShieldCheck size={16}/>{en ? "Profile and security" : "Profil et sécurité"}</button>
    <button type="button" className={itemClass} onClick={preferences}><Languages size={16}/>{en ? "Language" : "Langue"}</button>
    <button type="button" disabled={busy} className={itemClass} onClick={async () => { setBusy(true); setError(false); try { await signOut({ redirectUrl: "/sign-in" }); } catch { setError(true); setBusy(false); } }}><LogOut size={16}/>{busy ? (en ? "Signing out…" : "Déconnexion…") : (en ? "Sign out" : "Se déconnecter")}</button>
    {error && <p role="alert" className="px-3 py-2 text-xs text-red-700">{en ? "Sign out failed. Try again." : "Déconnexion impossible. Réessayez."}</p>}
  </div>;
}
