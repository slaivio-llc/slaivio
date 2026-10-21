"use client";

import Link from "next/link";
import { RefreshCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { usePermissions } from "@/components/permissions/permission-provider";
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
  const { permissions } = usePermissions();
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
  const canChooseScope = permissions.includes("network.overview");

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams(queryKey);
    const query: CargoQuery = {
      preset: params.get("preset") || "month",
      comparison: params.get("comparison") || "previous",
      scope: params.get("scope") || "office",
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

  const changeFilter = (key: "preset" | "scope", value: string) => {
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
      <button type="button" onClick={() => setRefresh(v => v + 1)} disabled={loading} aria-label={t("Actualiser", "Refresh")} className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"><RefreshCcw size={16} className={loading ? "animate-spin" : ""}/></button>
    </header>

    <section className="flex flex-wrap items-end justify-between gap-3" aria-label={t("Filtres du tableau de bord", "Dashboard filters")}>
      <div className="flex flex-wrap gap-3">
        {canChooseScope && <label className="grid gap-1 text-xs font-medium text-slate-600">{t("Bureau", "Office")}<select className={`${inputClass} w-56`} value={search.get("scope") || "office"} onChange={e => changeFilter("scope", e.target.value)}><option value="office">{t("Bureau actif", "Active office")}</option><option value="network">{t("Tous les bureaux autorisés", "All authorized offices")}</option></select></label>}
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

    <section className="min-w-0 rounded-xl border border-slate-200 bg-white">
      <nav className="flex max-w-full gap-1 overflow-x-auto border-b border-slate-200 px-3 pt-3" aria-label={t("Sections du tableau de bord", "Dashboard sections")}>
        {tabs.map(tab => <button key={tab.id} type="button" onClick={() => setSection(tab.id)} aria-current={section === tab.id ? "page" : undefined} className={`shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${section === tab.id ? "border-emerald-700 text-emerald-800" : "border-transparent text-slate-600 hover:text-slate-900"}`}>{t(tab.fr, tab.en)}</button>)}
      </nav>
      <div className="min-w-0 p-4 sm:p-5">
        {section === "operations" && <div><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-semibold">{t("Flux des marchandises", "Cargo flows")}</h2><p className="mt-1 text-xs text-slate-500">{t("Volumes datés sur la période sélectionnée", "Dated volumes during the selected period")}</p></div><Link className="text-sm font-medium text-emerald-800 hover:underline" href="/app/operations">{t("Ouvrir les opérations →", "Open operations →")}</Link></div>
          {data && <div className="mt-5 grid gap-4 sm:grid-cols-3">{[[t("Reçus", "Received"), data.flows.received], [t("Expédiés", "Shipped"), data.flows.shipped], [t("Livrés", "Delivered"), data.flows.delivered]].map(([label, value]) => <div key={String(label)} className="rounded-lg bg-slate-50 p-4"><p className="text-xs text-slate-500">{label}</p><strong className="mt-2 block text-xl tabular-nums">{number(Number(value))}</strong></div>)}</div>}
          <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">{data && <><StateRow label={t("Poids reçu", "Received weight")} value={t("Détail non fourni par cette vue", "Not provided by this view")}/><StateRow label={t("État actuel", "Current state")} value={`${number(data.states.in_transit)} ${t("en transit", "in transit")} · ${number(data.states.blocked)} ${t("bloqués", "blocked")}`}/></>}</div>
          {!data && <p className="mt-4 text-sm text-slate-500">{loading ? t("Chargement…", "Loading…") : t("Aucun flux disponible.", "No flow data available.")}</p>}
        </div>}
        {section === "finance" && <div><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-semibold">{t("Situation financière", "Financial overview")}</h2><p className="mt-1 text-xs text-slate-500">{t("Encaissements de la période et soldes courants, par devise", "Period collections and current balances, by currency")}</p></div><Link className="text-sm font-medium text-emerald-800 hover:underline" href="/app/finance">{t("Voir les finances →", "Open finance →")}</Link></div>
          {financialTotals.length ? <div className="mt-4 divide-y divide-slate-100">{financialTotals.map(entry => <div key={entry.currency} className="grid gap-2 py-3 text-sm sm:grid-cols-3"><StateRow label={`${t("Encaissé", "Collected")} · ${entry.currency}`} value={money(entry.collected, entry.currency)}/><StateRow label={`${t("À recouvrer", "Outstanding")} · ${entry.currency}`} value={money(entry.outstanding, entry.currency)}/><StateRow label={`${t("En retard", "Overdue")} · ${entry.currency}`} value={money(entry.overdue, entry.currency)}/></div>)}</div> : <Empty text={t("Aucun indicateur financier disponible pour cette période.", "No financial indicators available for this period.")}/>}
        </div>}
        {section === "clients" && <div><h2 className="font-semibold">{t("Activité clients", "Customer activity")}</h2><p className="mt-1 text-xs text-slate-500">{t("Le service de données actuel ne fournit pas encore les clients actifs ou nouveaux pour cette période.", "The current data service does not yet provide active or new customer counts for this period.")}</p><Link className="mt-4 inline-flex text-sm font-medium text-emerald-800 hover:underline" href="/app/clients">{t("Consulter les clients →", "Open clients →")}</Link></div>}
        {section === "quality" && <div><h2 className="font-semibold">{t("Qualité et délais", "Quality and timing")}</h2><p className="mt-1 text-xs text-slate-500">{t("Aucun taux de livraison à temps ni délai moyen vérifiable n’est fourni par l’API. Les réceptions sans dates fiables sont exclues.", "No verifiable on-time delivery rate or average transit time is provided by the API. Receipts without reliable dates are excluded.")}</p>{data?.upcoming && <div className="mt-4"><h3 className="text-sm font-medium">{t("Arrivées estimées · 7 prochains jours", "Estimated arrivals · next 7 days")}</h3>{data.upcoming.length ? <ul className="mt-2 divide-y divide-slate-100">{data.upcoming.slice(0, 5).map(item => <li key={item.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span>{item.reference} · {[item.destination_city, item.destination_country].filter(Boolean).join(", ") || t("Destination inconnue", "Unknown destination")}</span><span className="text-slate-500">{item.eta_at ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: data.period.timezone }).format(new Date(item.eta_at)) : t("Date non renseignée", "No date")}</span></li>)}</ul> : <p className="mt-2 text-sm text-slate-500">{t("Aucune arrivée estimée.", "No estimated arrivals.")}</p>}</div>}</div>}
      </div>
    </section>
    {data && <p className="text-[11px] text-slate-500">{t("Calculé le", "Calculated")}: {new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short", timeZone: data.period.timezone }).format(new Date(data.generated_at))} · {t("Les indicateurs non fournis par la source restent non renseignés.", "Metrics not supplied by the data source remain unavailable.")}</p>}
  </main>;
}

function StateRow({ label, value }: { label: string; value: string }) { return <div className="flex min-w-0 items-center justify-between gap-3"><span className="text-slate-600">{label}</span><strong className="text-right font-medium tabular-nums">{value}</strong></div>; }
function Empty({ text }: { text: string }) { return <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">{text}</p>; }
