"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useDashboardLocale } from "@/components/i18n/dashboard-language";
import { getCargoDashboard, type CargoDashboardData, type CargoQuery } from "@/services/cargo-dashboard";

type Section = "operations" | "finance" | "clients" | "quality";
const tabs: { id: Section; fr: string; en: string }[] = [
  { id: "operations", fr: "Opérations", en: "Operations" },
  { id: "finance", fr: "Finance", en: "Finance" },
  { id: "clients", fr: "Clients", en: "Clients" },
  { id: "quality", fr: "Qualité & délais", en: "Quality & timing" },
];
const inputClass = "h-10 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-emerald-600";

export function CargoHomeOverview() {
  const locale = useDashboardLocale();
  const t = (fr: string, en: string) => locale === "fr" ? fr : en;
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const queryKey = search.toString();
  const [result, setResult] = useState<{ key: string; data: CargoDashboardData } | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [section, setSection] = useState<Section>("operations");
  const data = result?.key === queryKey ? result.data : null;

  useEffect(() => {
    const refreshForOffice = () => setRefresh(value => value + 1);
    window.addEventListener("slaivio:office-context-changed", refreshForOffice);
    return () => window.removeEventListener("slaivio:office-context-changed", refreshForOffice);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams(queryKey);
    const query: CargoQuery = {
      preset: params.get("preset") || "month",
      comparison: params.get("comparison") || "previous",
      scope: "office",
    };
    for (const key of ["start", "end", "compare_start", "compare_end"] as const) {
      const value = params.get(key);
      if (value) query[key] = value;
    }
    setLoading(true);
    getCargoDashboard(query, controller.signal).then((next) => {
      if (!controller.signal.aborted) { setResult({ key: queryKey, data: next }); setError(false); }
    }).catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [queryKey, refresh]);

  const changeFilter = (key: "preset", value: string) => {
    const params = new URLSearchParams(queryKey);
    params.set(key, value);
    params.delete("metric"); params.delete("page");
    if (key === "preset") { params.delete("start"); params.delete("end"); }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };
  const number = (value: number) => new Intl.NumberFormat(locale).format(value);
  const money = (value: string, currency: string) => new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(value));
  const financialTotals = useMemo(() => data?.finance?.currencies ?? [], [data]);
  const periodLabel = data ? `${new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${data.period.current.start}T12:00:00Z`))} – ${new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${data.period.current.end}T12:00:00Z`))}` : "";

  const metrics = [
    { label: t("Colis reçus", "Parcels received"), value: data ? number(data.flows.received) : "—", note: t("Sur la période", "In selected period"), href: "/app/operations" },
    { label: t("Expéditions", "Shipments"), value: data ? number(data.flows.shipped) : "—", note: t("Expédiées sur la période", "Shipped in period"), href: "/app/operations" },
    { label: t("Colis livrés", "Parcels delivered"), value: data ? number(data.flows.delivered) : "—", note: t("Livrés sur la période", "Delivered in period"), href: "/app/operations" },
    { label: t("En transit", "In transit"), value: data ? number(data.states.in_transit) : "—", note: t("État actuel", "Current state"), href: "/app/operations" },
    { label: t("En entrepôt", "In warehouse"), value: data ? number(data.states.warehoused) : "—", note: t("État actuel", "Current state"), href: "/app/operations" },
    { label: t("À retirer", "Ready for pickup"), value: data ? number(data.states.ready_for_pickup) : "—", note: t("État actuel", "Current state"), href: "/app/operations" },
  ];

  return <main className="mx-auto grid w-full max-w-[1280px] gap-5 px-4 py-6 sm:px-7 lg:px-8">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-[24px] font-semibold tracking-tight text-slate-900">{t("Vue d’ensemble", "Overview")}</h1>
        <p className="mt-1 text-sm text-slate-600">{t("Performance et activité de votre organisation Cargo", "Cargo organization performance and activity")}</p>
        {data && <p className="mt-2 text-xs text-slate-500">{data.workspace.name}{data.scope === "network" ? ` · ${data.office_count} ${t("bureaux autorisés", "authorized offices")}` : ""}</p>}
      </div>
    </header>

    <section className="flex flex-wrap items-end justify-between gap-3" aria-label={t("Filtres du tableau de bord", "Dashboard filters")}>
      <div className="flex flex-wrap gap-3">
        <label className="grid gap-1 text-xs font-medium text-slate-600">{t("Période", "Period")}<select className={`${inputClass} w-56`} value={search.get("preset") || "month"} onChange={e => changeFilter("preset", e.target.value)}>
          <option value="today">{t("Aujourd’hui", "Today")}</option><option value="7d">{t("7 derniers jours", "Last 7 days")}</option><option value="30d">{t("30 derniers jours", "Last 30 days")}</option><option value="month">{t("Ce mois", "This month")}</option><option value="quarter">{t("Ce trimestre", "This quarter")}</option><option value="year">{t("Cette année", "This year")}</option>
        </select></label>
      </div>
      {data && <span className="pb-2 text-xs text-slate-500">{periodLabel} · {data.period.timezone}</span>}
    </section>

    {error && <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">{t("Les données du tableau de bord n’ont pas pu être chargées. Aucune valeur fictive n’est affichée.", "Dashboard data could not be loaded. No sample values are shown.")} <button className="ml-2 font-semibold underline" onClick={() => setRefresh(v => v + 1)}>{t("Réessayer", "Retry")}</button></div>}

    <section aria-labelledby="home-metrics-title">
      <div className="mb-2 flex items-center justify-between"><h2 id="home-metrics-title" className="text-sm font-semibold">{t("Indicateurs principaux", "Key indicators")}</h2>{data && <span className="text-xs text-slate-500">{t("Données réelles · calculées", "Live data · calculated")}</span>}</div>
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map(metric => <Link key={metric.label} href={metric.href} className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-emerald-300 hover:bg-slate-50"><span className="block text-xs text-slate-500">{metric.label}</span><strong className="mt-2 block text-[22px] font-semibold tabular-nums text-slate-900">{metric.value}</strong><span className="mt-1 block text-xs text-slate-500">{metric.note}</span></Link>)}
      </div>
    </section>

    <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="text-sm font-semibold">{t("Encaissements et soldes", "Collections and balances")}</h2><p className="mt-1 text-xs text-slate-500">{t("Les montants restent séparés par devise ; aucun taux de change n’est appliqué.", "Amounts stay separated by currency; no exchange rate is applied.")}</p></div></div>
      {financialTotals.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{financialTotals.map(entry => {
        const collected = Number(entry.collected) || 0; const outstanding = Number(entry.outstanding) || 0;
        const rate = collected + outstanding > 0 ? collected / (collected + outstanding) * 100 : 0;
        return <article key={entry.currency} className="rounded-lg border border-slate-200 p-4"><div className="flex justify-between gap-3"><div><p className="text-xs text-slate-500">{t("Montant encaissé", "Collected")}</p><p className="mt-1 font-semibold tabular-nums">{money(entry.collected, entry.currency)}</p></div><p className="text-xs font-semibold text-slate-700">{rate.toFixed(1)}%</p></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-600" style={{ width: `${Math.min(100, rate)}%` }}/></div><div className="mt-2 flex justify-between gap-2 text-[11px] text-slate-500"><span>{t("Recouvrement indicatif", "Collection ratio")}</span><span>{t("À recouvrer", "Outstanding")}: {money(entry.outstanding, entry.currency)}</span></div></article>;
      })}</div> : <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">{data ? t("Aucune donnée financière disponible pour ce périmètre.", "No financial data for this scope.") : t("Les montants apparaîtront après chargement des données.", "Amounts will appear after data loads.")}</p>}
    </section>

    <section className="min-w-0 overflow-hidden rounded-[14px] border border-[#e4e8e6] bg-white shadow-[0_2px_8px_rgba(25,35,30,.035)]">
      <nav className="flex max-w-full gap-1 overflow-x-auto border-b border-[#edf0ee] px-4 py-3" aria-label={t("Sections du tableau de bord", "Dashboard sections")}>
        {tabs.map(tab => <button key={tab.id} type="button" onClick={() => setSection(tab.id)} aria-current={section === tab.id ? "page" : undefined} className={`shrink-0 rounded-full px-3.5 py-2 text-[12px] font-medium transition-colors ${section === tab.id ? "bg-[#151817] text-white" : "text-[#59635e] hover:bg-[#f2f5f3] hover:text-[#202622]"}`}>{t(tab.fr, tab.en)}</button>)}
      </nav>
      <div className="min-w-0 bg-[#fcfdfc] p-4 sm:p-5">
        {section === "operations" && <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-[15px] font-semibold text-[#202622]">{t("Flux des marchandises", "Cargo flows")}</h2><p className="mt-1 text-[12px] text-[#737d77]">{t("Volumes enregistrés pendant la période sélectionnée", "Volumes recorded during the selected period")}</p></div><Link className="rounded-full border border-[#dce2de] bg-white px-3.5 py-2 text-[11px] font-medium text-[#303a34] transition hover:border-[#aebbb3] hover:bg-[#f7f9f7]" href="/app/operations">{t("Ouvrir les opérations", "Open operations")} <span aria-hidden="true">→</span></Link></div>
          <div className="grid gap-3 sm:grid-cols-3">{[[t("Colis reçus", "Received parcels"), data ? number(data.flows.received) : "—", "#eaf5ee"], [t("Expéditions", "Shipments"), data ? number(data.flows.shipped) : "—", "#eff2fa"], [t("Colis livrés", "Delivered parcels"), data ? number(data.flows.delivered) : "—", "#f3f1fb"]].map(([label, value, tint]) => <article key={label} className="rounded-[11px] border border-[#e7ebe8] bg-white p-4"><span className="mb-3 grid h-8 w-8 place-items-center rounded-[8px] text-[12px] font-semibold text-[#42534a]" style={{backgroundColor:tint}} aria-hidden="true">{label===t("Colis reçus","Received parcels")?"R":label===t("Expéditions","Shipments")?"E":"L"}</span><p className="text-[11px] text-[#737d77]">{label}</p><strong className="mt-1.5 block text-[22px] font-semibold tabular-nums text-[#202622]">{value}</strong></article>)}</div>
          <div className="rounded-[11px] border border-[#e7ebe8] bg-white p-4"><div className="mb-3 flex items-center justify-between"><h3 className="text-[12px] font-semibold text-[#303a34]">{t("Situation des colis", "Parcel status")}</h3><span className="text-[10px] text-[#858d88]">{t("État actuel", "Current state")}</span></div><div className="grid gap-3 sm:grid-cols-3">{[[t("En transit","In transit"),data?number(data.states.in_transit):"—"],[t("En entrepôt","In warehouse"),data?number(data.states.warehoused):"—"],[t("Bloqués","Blocked"),data?number(data.states.blocked):"—"]].map(([label,value])=><div key={label} className="flex items-center justify-between border-t border-[#f0f2f0] pt-3"><span className="text-[11px] text-[#69736d]">{label}</span><strong className="text-[14px] font-semibold tabular-nums text-[#252d28]">{value}</strong></div>)}</div></div>
          {!data && <p className="text-[11px] text-[#7a847e]">{loading?t("Chargement des données…","Loading data…"):t("Aucun flux disponible.","No flow data available.")}</p>}
        </div>}
        {section === "finance" && <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-[15px] font-semibold text-[#202622]">{t("Situation financière", "Financial overview")}</h2><p className="mt-1 text-[12px] text-[#737d77]">{t("Encaissements et soldes affichés séparément par devise", "Collections and balances shown separately by currency")}</p></div><Link className="rounded-full border border-[#dce2de] bg-white px-3.5 py-2 text-[11px] font-medium text-[#303a34] hover:bg-[#f7f9f7]" href="/app/finance">{t("Voir les finances", "Open finance")} <span aria-hidden="true">→</span></Link></div>
          {financialTotals.length ? <div className="grid gap-3 lg:grid-cols-2">{financialTotals.map(entry => {const collected=Number(entry.collected)||0;const outstanding=Number(entry.outstanding)||0;const rate=collected+outstanding>0?collected/(collected+outstanding)*100:0;return <article key={entry.currency} className="rounded-[11px] border border-[#e7ebe8] bg-white p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[.08em] text-[#7b857f]">{entry.currency} · {t("Encaissé", "Collected")}</p><strong className="mt-1.5 block text-[20px] font-semibold tabular-nums text-[#202622]">{money(entry.collected,entry.currency)}</strong></div><span className="rounded-full bg-[#eaf5ee] px-2.5 py-1 text-[10px] font-semibold text-[#28744b]">{rate.toFixed(1)}%</span></div><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#edf1ee]"><div className="h-full rounded-full bg-[#43a276]" style={{width:`${Math.min(100,rate)}%`}}/></div><div className="mt-3 grid grid-cols-2 gap-3 border-t border-[#f0f2f0] pt-3"><div><p className="text-[10px] text-[#7b857f]">{t("À recouvrer", "Outstanding")}</p><p className="mt-1 text-[12px] font-medium tabular-nums text-[#303a34]">{money(entry.outstanding,entry.currency)}</p></div><div><p className="text-[10px] text-[#7b857f]">{t("En retard", "Overdue")}</p><p className="mt-1 text-[12px] font-medium tabular-nums text-[#303a34]">{money(entry.overdue,entry.currency)}</p></div></div></article>;})}</div> : <div className="rounded-[11px] border border-dashed border-[#dce2de] bg-white px-4 py-8 text-center"><p className="text-[12px] font-medium text-[#3d4741]">{data?t("Aucune donnée financière pour ce bureau et cette période.","No financial data for this office and period."):t("Les données financières se chargent…","Financial data is loading…")}</p></div>}
        </div>}
        {section === "clients" && <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-[15px] font-semibold text-[#202622]">{t("Activité clients", "Customer activity")}</h2><p className="mt-1 text-[12px] text-[#737d77]">{t("Indicateurs clients de la période sélectionnée", "Customer indicators for the selected period")}</p></div><Link className="rounded-full border border-[#dce2de] bg-white px-3.5 py-2 text-[11px] font-medium text-[#303a34] hover:bg-[#f7f9f7]" href="/app/clients">{t("Consulter les clients", "Open clients")} <span aria-hidden="true">→</span></Link></div>
          <div className="grid gap-3 sm:grid-cols-2"><article className="rounded-[11px] border border-[#e7ebe8] bg-white p-4"><p className="text-[11px] text-[#737d77]">{t("Clients actifs", "Active customers")}</p><strong className="mt-2 block text-[22px] font-semibold text-[#727d76]">—</strong><p className="mt-1 text-[10px] text-[#89928d]">{t("Indicateur indisponible dans cette source", "Metric unavailable from this data source")}</p></article><article className="rounded-[11px] border border-[#e7ebe8] bg-white p-4"><p className="text-[11px] text-[#737d77]">{t("Nouveaux clients", "New customers")}</p><strong className="mt-2 block text-[22px] font-semibold text-[#727d76]">—</strong><p className="mt-1 text-[10px] text-[#89928d]">{t("Indicateur indisponible dans cette source", "Metric unavailable from this data source")}</p></article></div>
          <p className="rounded-[9px] bg-[#f2f5f3] px-3.5 py-3 text-[11px] leading-5 text-[#626d66]">{t("Les volumes clients ne sont pas fournis par le service de synthèse actuel. Aucun chiffre estimé n’est affiché.", "Customer counts are not supplied by the current summary service. No estimated values are shown.")}</p>
        </div>}
        {section === "quality" && <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-[15px] font-semibold text-[#202622]">{t("Qualité et délais", "Quality and timing")}</h2><p className="mt-1 text-[12px] text-[#737d77]">{t("Indicateurs de ponctualité et arrivées attendues", "On-time indicators and expected arrivals")}</p></div></div>
          <div className="grid gap-3 sm:grid-cols-3">{[[t("Livraisons à temps","On-time deliveries"),t("Non renseigné","Not available")],[t("Délai moyen","Average transit time"),t("Non renseigné","Not available")],[t("Incidents","Incidents"),t("Non renseigné","Not available")]].map(([label,value])=><article key={label} className="rounded-[11px] border border-[#e7ebe8] bg-white p-4"><p className="text-[11px] text-[#737d77]">{label}</p><p className="mt-2 text-[15px] font-semibold text-[#737d77]">{value}</p></article>)}</div>
          <p className="text-[10px] leading-4 text-[#858d88]">{t("La source actuelle ne fournit pas de jalons de livraison datés suffisants pour calculer ces indicateurs de façon fiable.", "The current data source does not provide enough dated delivery milestones to calculate these indicators reliably.")}</p>
          <div className="rounded-[11px] border border-[#e7ebe8] bg-white p-4"><div className="flex items-center justify-between gap-2"><div><h3 className="text-[12px] font-semibold text-[#303a34]">{t("Arrivées estimées", "Estimated arrivals")}</h3><p className="mt-1 text-[10px] text-[#7b857f]">{t("7 prochains jours", "Next 7 days")}</p></div><span className="rounded-full bg-[#f2f5f3] px-2.5 py-1 text-[9px] text-[#657068]">{data?.upcoming?.length || 0}</span></div>{data?.upcoming?.length ? <ul className="mt-3 divide-y divide-[#f0f2f0]">{data.upcoming.slice(0,5).map(item=><li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-3"><span><strong className="block text-[11px] font-medium text-[#303a34]">{item.reference}</strong><span className="mt-0.5 block text-[10px] text-[#7b857f]">{[item.destination_city,item.destination_country].filter(Boolean).join(", ")||t("Destination inconnue","Unknown destination")}</span></span><span className="text-[10px] text-[#69736d]">{item.eta_at?new Intl.DateTimeFormat(locale,{dateStyle:"medium",timeZone:data.period.timezone}).format(new Date(item.eta_at)):t("Date non renseignée","No date")}</span></li>)}</ul>:<p className="mt-3 rounded-[8px] bg-[#f7f9f7] px-3 py-4 text-[11px] text-[#7b857f]">{t("Aucune arrivée estimée dans les 7 prochains jours.","No estimated arrivals in the next 7 days.")}</p>}</div>
        </div>}
      </div>
    </section>
  </main>;
}

