"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { searchDashboardHome, type HomeSearchResult } from "@/services/dashboard";

const labels = {
  fr: { title: "Rechercher dans Slaivio", hint: "Nom, téléphone, suivi, expédition ou facture", scope: "Recherche dans le bureau actif, selon vos accès", loading: "Recherche en cours…", empty: "Aucun résultat. Vérifiez le numéro ou essayez le nom ou le téléphone du client.", error: "Recherche indisponible. Réessayez.", start: "Saisissez au moins deux caractères.", close: "Fermer la recherche", client: "Clients", package: "Colis", shipment: "Expéditions", dossier: "Dossiers", invoice: "Factures" },
  en: { title: "Search Slaivio", hint: "Name, phone, tracking, shipment or invoice", scope: "Searching the active office within your access rights", loading: "Searching…", empty: "No results. Check the reference or try the customer name or phone.", error: "Search unavailable. Please try again.", start: "Enter at least two characters.", close: "Close search", client: "Customers", package: "Parcels", shipment: "Shipments", dossier: "Cases", invoice: "Invoices" },
};

export function WorkspaceSearch({ close, locale }: { close: () => void; locale: "fr" | "en" }) {
  const router = useRouter();
  const dialog = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<HomeSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const t = labels[locale];
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    input.current?.focus();
    return () => previous?.focus();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setItems([]); setError(false);
    if (query.trim().length < 2) { setLoading(false); return; }
    setLoading(true);
    const timer = window.setTimeout(() => {
      searchDashboardHome(query.trim(), controller.signal)
        .then(results => { if (!controller.signal.aborted) setItems(results); })
        .catch(() => { if (!controller.signal.aborted) setError(true); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 300);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [query]);

  return <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/25 px-3 pt-[10vh]" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="workspace-search-title" className="flex max-h-[80dvh] w-full max-w-xl flex-col rounded-xl border border-[#d7dade] bg-white shadow-xl" onKeyDown={event => {
      if (event.key === "Escape") { event.stopPropagation(); close(); }
      if (event.key === "Tab") {
        const targets = dialog.current?.querySelectorAll<HTMLElement>('input,button,a[href]');
        if (!targets?.length) return;
        const first = targets[0], last = targets[targets.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }}>
      <h2 id="workspace-search-title" className="sr-only">{t.title}</h2>
      <div className="flex items-center gap-3 border-b p-3"><Search size={18} aria-hidden="true"/><input ref={input} value={query} maxLength={100} onChange={event => setQuery(event.target.value)} aria-label={t.title} placeholder={t.hint} className="h-10 min-w-0 flex-1 bg-white text-sm outline-none"/><button type="button" onClick={close} aria-label={t.close} className="grid h-9 w-9 place-items-center rounded-md hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-emerald-600"><X size={18}/></button></div>
      <p className="px-4 py-2 text-xs text-slate-500">{t.scope}</p>
      <div className="min-h-24 overflow-y-auto p-2" aria-busy={loading}>
        {error ? <p role="alert" className="p-4 text-sm text-red-700">{t.error}</p> : loading ? <p role="status" className="p-4 text-sm text-slate-500">{t.loading}</p> : !items.length ? <p role="status" className="p-4 text-sm text-slate-500">{query.trim().length < 2 ? t.start : t.empty}</p> :
          (["client", "package", "shipment", "dossier", "invoice"] as const).map(kind => {
            const group = items.filter(item => item.kind === kind);
            return group.length ? <section key={kind} aria-label={t[kind]}><h3 className="px-3 py-2 text-xs font-semibold text-slate-500">{t[kind]}</h3>{group.map(item => <button type="button" key={item.id} onClick={() => { close(); router.push(item.href); }} className="block w-full rounded-lg px-3 py-3 text-left hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"><span className="block text-sm font-medium">{item.title}</span><span className="block text-xs text-slate-500">{item.subtitle}</span></button>)}</section> : null;
          })}
      </div>
    </div>
  </div>;
}
