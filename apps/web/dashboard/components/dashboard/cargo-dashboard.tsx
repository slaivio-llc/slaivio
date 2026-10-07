"use client";

import Link from "next/link";
import { RefreshCcw } from "lucide-react";
import { dashboardCsv } from "@/services/cargo-dashboard-export";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { usePermissions } from "@/components/permissions/permission-provider";
import { useDashboardLocale } from "@/components/i18n/dashboard-language";
import { getCargoDashboard, type CargoDashboardData, type CargoParcel, type CargoQuery } from "@/services/cargo-dashboard";

const presets = [
  ["today", "Aujourd’hui", "Today"], ["yesterday", "Hier", "Yesterday"],
  ["7d", "7 derniers jours", "Last 7 days"], ["30d", "30 derniers jours", "Last 30 days"],
  ["90d", "90 derniers jours", "Last 90 days"], ["week", "Cette semaine", "This week"],
  ["last_week", "Semaine dernière", "Last week"], ["month", "Ce mois", "This month"],
  ["last_month", "Mois dernier", "Last month"], ["quarter", "Ce trimestre", "This quarter"],
  ["last_quarter", "Trimestre précédent", "Last quarter"], ["year", "Cette année", "This year"],
  ["last_year", "Année précédente", "Last year"], ["custom", "Personnalisée", "Custom"],
];
const control = "h-9 min-w-0 max-w-full rounded-md border border-slate-300 bg-white px-2 text-sm focus-visible:outline-emerald-600";

export function CargoDashboard() {
  const locale = useDashboardLocale();
  const t = (fr: string, en: string) => locale === "fr" ? fr : en;
  const { permissions } = usePermissions();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const queryKey = search.toString();
  const [result, setResult] = useState<{ key: string; data: CargoDashboardData } | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update); window.addEventListener('offline', update);
    const timer = window.setInterval(() => {
      if (navigator.onLine && document.visibilityState === 'visible') setRevision(value => value + 1);
    }, 60000);
    return () => { window.clearInterval(timer); window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  const data = result?.key === queryKey ? result.data : null;
  const error = failure === queryKey;
  useEffect(() => {
    if (!online) return;
    const controller = new AbortController();
    const params = new URLSearchParams(queryKey);
    const query: CargoQuery = { preset: params.get("preset") || "30d", comparison: params.get("comparison") || "previous", scope: params.get("scope") || "office" };
    for (const key of ["start", "end", "compare_start", "compare_end", "metric", "page"] as const) if (params.get(key)) query[key] = params.get(key)!;
    getCargoDashboard(query, controller.signal).then((next) => {
      if (!controller.signal.aborted) { setResult({ key: queryKey, data: next }); setFailure(null); }
    }).catch(() => { if (!controller.signal.aborted) setFailure(queryKey); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [queryKey, revision, online]);
  function exportSummary() {
    if (!data || error) return;
    const url = URL.createObjectURL(new Blob([dashboardCsv(data)], {type:'text/csv;charset=utf-8'}));
    const link = document.createElement('a'); link.href=url; link.download='cargo-dashboard-summary.csv';
    document.body.appendChild(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url),1000);
  }
  function refresh() { setLoading(true); setFailure(null); setRevision(value => value + 1); }
  function openMetric(metric: string | null, page = 1) {
    const params = new URLSearchParams(queryKey);
    if (metric) { params.set('metric', metric); params.set('page', String(page)); }
    else { params.delete('metric'); params.delete('page'); }
    if (params.toString() === queryKey) return;
    setLoading(true); setFailure(null);
    router.replace(`${pathname}?${params}`, { scroll: false });
  }
  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    for (const key of ["preset", "comparison", "scope", "start", "end", "compare_start", "compare_end"]) {
      const value = String(form.get(key) || "");
      if (value) params.set(key, value);
    }
    setLoading(true); setFailure(null);
    if (params.toString() === queryKey) refresh();
    else router.replace(`${pathname}?${params}`, { scroll: false });
  }
  const number = (value: number) => new Intl.NumberFormat(locale).format(value);
  const day = (value: string) => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
  return <main className="mx-auto grid w-full max-w-[1200px] gap-6 bg-white px-6 py-8 sm:px-8 lg:py-12">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-[22px] font-semibold">{t("Accueil", "Overview")}</h1><p className="mt-2 text-sm text-slate-600">{t("Vos opérations, leur évolution et les colis nécessitant votre attention.", "Your operations, trends and parcels requiring attention.")}</p>
        {data && <p className="mt-3 text-sm font-medium">{data.workspace.name} · {data.scope === "network" ? t(`${data.office_count} bureaux autorisés`, `${data.office_count} authorized offices`) : [data.workspace.country, data.workspace.city].filter(Boolean).join(" / ") || t("Bureau actif", "Active office")}</p>}
      </div>
      <button type="button" className={`${control} w-9 px-0 grid place-items-center`} onClick={refresh} disabled={loading} aria-label={t("Actualiser", "Refresh")}><RefreshCcw size={16} className={loading ? "animate-spin" : ""}/></button>
    </header>
    <PeriodForm key={queryKey} search={new URLSearchParams(queryKey)} apply={apply} locale={locale} network={permissions.includes("network.overview")} />
    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500"><span role="status">{online ? t('Actualisation toutes les 60 secondes lorsque cet onglet est visible.','Refresh every 60 seconds while this tab is visible.') : t('Hors connexion : les dernières données affichées ne sont plus actualisées.','Offline: displayed data is no longer refreshed.')}</span><button type="button" className={control} onClick={exportSummary} disabled={!data || error}>{t('Exporter la synthèse CSV','Export summary CSV')}</button></div>
    {error && <div role="alert" className="rounded-md border border-amber-300 p-4 text-sm">{t("Données indisponibles : vérifiez vos droits, les dates et la connexion. Les valeurs ne sont pas remplacées par des zéros.", "Data unavailable: check permissions, dates and connection. Values are not replaced with zeros.")} <button type="button" onClick={refresh} className="font-semibold underline">{t("Réessayer", "Retry")}</button></div>}
    {!data && !error && <p role="status" className="py-8 text-sm text-slate-500">{online ? t("Chargement des opérations…", "Loading operations…") : t('Aucune donnée disponible hors connexion.','No data available offline.')}</p>}
    {data && <>
      <p className="text-xs text-slate-500" role="status">{error ? t("Dernières données connues", "Last known data") : t("Calculé le", "Calculated at")} {new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "medium", timeZone: data.period.timezone }).format(new Date(data.generated_at))} · {data.period.timezone} · {t("Périmètre : cet accueil uniquement", "Scope: this overview only")}</p>
      <section><h2 className="font-semibold">{t("Flux de la période", "Period flows")}</h2><p className="mt-1 text-xs text-slate-500">{day(data.period.current.start)} — {day(data.period.current.end)}{data.period.previous && ` · ${t("Comparaison", "Comparison")} : ${day(data.period.previous.start)} — ${day(data.period.previous.end)}`}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">{([['received',t('Colis reçus','Parcels received')],['shipped',t('Colis expédiés','Parcels dispatched')],['delivered',t('Colis livrés','Parcels delivered')]] as const).map(([key,label]) => {
          const previous = data.previous_flows?.[key]; const value = data.flows[key];
          return <Metric key={key} active={search.get("metric") === key} onClick={() => openMetric(key)} label={label} value={number(value)} detail={previous === undefined ? t("Date du jalon enregistrée", "Recorded milestone date") : `${t("Précédent", "Previous")}: ${number(previous)} · ${previous === 0 ? t("Variation non calculable", "Change not calculable") : `${new Intl.NumberFormat(locale,{style:'percent',maximumFractionDigits:1,signDisplay:'always'}).format((value-previous)/previous)}`}`}/>;
        })}</div><p className="mt-2 text-xs text-slate-500">{t("Les jalons sans date ne sont pas comptés. Un changement de statut n’est pas une date de réception.", "Milestones without dates are excluded. A status is not a receipt date.")}</p>
      </section>
      <section><h2 className="font-semibold">{t("Situation actuelle", "Current state")}</h2><p className="mt-1 text-xs text-slate-500">{t("Indépendante de la période sélectionnée", "Independent of the selected period")}</p><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{([['warehoused',t('En entrepôt','In warehouse')],['in_transit',t('En acheminement','In transit')],['ready_for_pickup',t('À retirer','Ready for pickup')],['blocked',t('Bloqués','Blocked')]] as const).map(([key,label]) => <Metric key={key} active={search.get("metric") === key} onClick={() => openMetric(key)} label={label} value={number(data.states[key])} detail={t('État au moment du calcul','State at calculation time')}/>)}</div></section>
      <div className="grid gap-5 lg:grid-cols-2">
        {data.drilldown && <section className="rounded-lg border border-emerald-300 p-4 lg:col-span-2" aria-label={t('Colis de l’indicateur sélectionné','Parcels matching selected metric')}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">{t('Résultats de l’indicateur','Metric results')} · {number(data.drilldown.total)} {t('colis','parcels')}</h2><button type="button" className={control} onClick={() => openMetric(null)}>{t('Fermer','Close')}</button></div>
          <ParcelList items={data.drilldown.items} locale={locale}/>
          <div className="mt-4 flex items-center justify-end gap-3"><button type="button" className={control} disabled={data.drilldown.page <= 1} onClick={() => openMetric(data.drilldown!.metric, data.drilldown!.page-1)}>{t('Précédent','Previous')}</button><span className="text-xs">{data.drilldown.page} / {Math.max(1, Math.ceil(data.drilldown.total/data.drilldown.page_size))}</span><button type="button" className={control} disabled={data.drilldown.page*data.drilldown.page_size >= data.drilldown.total} onClick={() => openMetric(data.drilldown!.metric, data.drilldown!.page+1)}>{t('Suivant','Next')}</button></div>
        </section>}
        <Panel title={t("À traiter maintenant · 10 premiers", "Needs attention · first 10")}><ParcelList items={data.attention} locale={locale}/></Panel>
        <Panel title={t("Dernières réceptions de la période · 8 premières", "Latest receipts in period · first 8")}><ParcelList items={data.recent} locale={locale}/></Panel>
      </div>
      <Panel title={t("Destinations des colis reçus · 8 premières", "Destinations of received parcels · first 8")}>
        <p className="mb-3 text-xs text-slate-500">{t("Colis reçus pendant la période et déjà livrés à ce jour. Ce ratio n’est pas un taux de ponctualité.", "Parcels received in the period and delivered to date. This is not an on-time delivery rate.")}</p>
        {!data.destinations.length && <p className="text-sm text-slate-500">{t("Aucune réception pour cette période.", "No receipts in this period.")}</p>}
        <div className="grid gap-3 sm:grid-cols-2">{data.destinations.map(item => <div key={`${item.country}:${item.city}`} className="rounded-md bg-slate-50 p-3 text-sm"><strong>{[item.country,item.city].filter(Boolean).join(' / ') || t('Destination non renseignée','Destination not provided')}</strong><p className="mt-1 text-slate-600">{number(item.received)} {t('reçus','received')} · {number(item.delivered)} {t('livrés à ce jour','delivered to date')}</p></div>)}</div>
      </Panel>
      <Panel title={t('Évolution des réceptions','Receipt trend')}>
        <p className="mb-3 text-xs text-slate-500">{t('Réceptions par jour dans le fuseau affiché. Les jours sans réception sont omis.','Daily receipts in the displayed timezone. Days without receipts are omitted.')}</p>
        <div className="max-h-72 overflow-auto"><ul className="grid gap-2">{(data.trend || []).map(item=><li key={item.day} className="grid grid-cols-[8rem_minmax(0,1fr)_3rem] items-center gap-3 text-xs"><span>{day(item.day)}</span><span className="h-3 rounded bg-slate-100" aria-hidden="true"><span className="block h-3 rounded bg-emerald-600" style={{width:`${100*item.received/Math.max(1,...(data.trend || []).map(row=>row.received))}%`}}/></span><span className="text-right tabular-nums">{number(item.received)}</span></li>)}</ul></div>
        {!data.trend?.length && <p className="text-sm text-slate-500">{t('Aucune réception pour cette période.','No receipts in this period.')}</p>}
      </Panel>
      {data.finance && <Panel title={t('Finance · bureau actif uniquement','Finance · active office only')}>
        <p className="mb-3 text-xs text-slate-500">{t('Encaissements confirmés de la période ; soldes et retards actuels. Aucune conversion ni addition entre devises.','Confirmed receipts in the period; current outstanding and overdue balances. No currency conversion or cross-currency totals.')}</p>
        <div className="grid gap-3 sm:grid-cols-2">{data.finance.currencies.map(entry => <div key={entry.currency} className="rounded-md border border-slate-200 p-3"><h3 className="font-semibold">{entry.currency}</h3><dl className="mt-2 grid grid-cols-2 gap-2 text-sm">{(['collected','outstanding','overdue'] as const).map(key => <div key={key} className="col-span-2 flex justify-between gap-3"><dt>{key==='collected'?t('Encaissé','Collected'):key==='outstanding'?t('À payer','Outstanding'):t('En retard','Overdue')}</dt><dd className="font-medium tabular-nums">{entry[key]} {entry.currency}</dd></div>)}</dl></div>)}</div>
        {!data.finance.currencies.length && <p className="text-sm text-slate-500">{t('Aucun encaissement ni solde correspondant.','No matching receipts or balances.')}</p>}
        <Link href="/app/finance" className="mt-3 inline-block text-sm font-medium text-emerald-700">{t('Ouvrir la finance du bureau','Open office finance')}</Link>
      </Panel>}
      <Panel title={t('Arrivées attendues · 7 prochains jours · 10 premières','Expected arrivals · next 7 days · first 10')}>
        <p className="mb-3 text-xs text-slate-500">{t('Dates estimées enregistrées sur les colis, indépendantes de la période analysée. Ce ne sont pas des confirmations d’arrivée.','Estimated parcel arrival dates, independent of the reporting period. These are not arrival confirmations.')}</p>
        {(data.upcoming || []).map(item => <div key={item.id} className="mb-2 rounded-md border border-slate-100 p-2"><span className="text-xs font-medium">{item.eta_at && new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short',timeZone:data.period.timezone}).format(new Date(item.eta_at))}</span><ParcelList items={[item]} locale={locale}/></div>)}
        {!data.upcoming?.length && <p className="text-sm text-slate-500">{t('Aucune arrivée estimée dans les 7 prochains jours.','No estimated arrival in the next 7 days.')}</p>}
      </Panel>
      {data.departures && <Panel title={t('Départs planifiés · 7 prochains jours · 10 premiers','Scheduled departures · next 7 days · first 10')}>
        <ul className="grid gap-3 sm:grid-cols-2">{data.departures.map(item => <li key={item.id} className="rounded-md border border-slate-200 p-3"><strong className="text-sm">{item.departure_code}</strong><p className="mt-1 text-sm">{new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short',timeZone:data.period.timezone}).format(new Date(item.scheduled_at))}</p><p className="text-xs text-slate-500">{item.status}</p>{item.cutoff_at && <p className="mt-1 text-xs text-slate-600">{t('Clôture des dépôts','Drop-off cutoff')} : {new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short',timeZone:data.period.timezone}).format(new Date(item.cutoff_at))}</p>}</li>)}</ul>
        {!data.departures.length && <p className="text-sm text-slate-500">{t('Aucun départ planifié dans les 7 prochains jours.','No scheduled departure in the next 7 days.')}</p>}
        <Link href="/app/departures" className="mt-3 inline-block text-sm font-medium text-emerald-700">{t('Ouvrir les départs du bureau actif','Open active office departures')}</Link>
      </Panel>}
    </>}
  </main>;
}

function PeriodForm({search,apply,locale,network}:{search:URLSearchParams;apply:(event:FormEvent<HTMLFormElement>)=>void;locale:string;network:boolean}) {
  const [preset,setPreset]=useState(search.get('preset')||'30d');
  const [comparison,setComparison]=useState(search.get('comparison')||'previous');
  const t=(fr:string,en:string)=>locale==='fr'?fr:en;
  return <form onSubmit={apply} className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 p-4">
    <label className="grid gap-1 text-xs">{t('Période','Period')}<select name="preset" value={preset} onChange={e=>setPreset(e.target.value)} className={control}>{presets.map(([key,fr,en])=><option key={key} value={key}>{t(fr,en)}</option>)}</select></label>
    <label className="grid gap-1 text-xs">{t('Comparer','Compare')}<select name="comparison" value={comparison} onChange={e=>setComparison(e.target.value)} className={control}>{[['none','Sans comparaison','No comparison'],['previous','Période précédente','Previous period'],['year','Année précédente','Previous year'],['custom','Personnalisée','Custom']].map(([key,fr,en])=><option key={key} value={key}>{t(fr,en)}</option>)}</select></label>
    {network && <label className="grid gap-1 text-xs">{t('Périmètre','Scope')}<select name="scope" defaultValue={search.get('scope')||'office'} className={control}><option value="office">{t('Bureau actif','Active office')}</option><option value="network">{t('Bureaux autorisés','Authorized offices')}</option></select></label>}
    {preset==='custom' && <><DateField name="start" label={t('Du','From')} search={search}/><DateField name="end" label={t('Au','To')} search={search}/></>}
    {comparison==='custom' && <><DateField name="compare_start" label={t('Comparer du','Compare from')} search={search}/><DateField name="compare_end" label={t('Comparer au','Compare to')} search={search}/></>}
    <button className="h-9 rounded-md bg-emerald-700 px-4 text-sm font-medium text-white" type="submit">{t('Appliquer','Apply')}</button>
  </form>;
}
function DateField({name,label,search}:{name:string;label:string;search:URLSearchParams}) {return <label className="grid gap-1 text-xs">{label}<input type="date" name={name} required defaultValue={search.get(name)||''} className={control}/></label>;}
function Metric({label,value,detail,active,onClick}:{label:string;value:string;detail:string;active:boolean;onClick:()=>void}) {return <button type="button" aria-pressed={active} onClick={onClick} className={`rounded-lg border p-4 text-left focus-visible:outline-emerald-600 ${active ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200 hover:border-emerald-400'}`}><span className="block text-sm text-slate-600">{label}</span><span className="mt-2 block text-2xl font-semibold tabular-nums">{value}</span><span className="mt-2 block text-xs text-slate-500">{detail}</span></button>;}
function Panel({title,children}:{title:string;children:ReactNode}) {return <section className="min-w-0 rounded-lg border border-slate-200 p-4"><h2 className="mb-4 text-sm font-semibold">{title}</h2>{children}</section>;}
function ParcelList({items,locale}:{items:CargoParcel[];locale:string}) {
  if (!items.length) return <p className="text-sm text-slate-500">{locale==='fr'?'Aucun colis correspondant.':'No matching parcels.'}</p>;
  return <ul className="grid gap-2">{items.map(item=>{const content=<><strong className="text-sm">{item.reference}</strong><p className="text-xs text-slate-500">{[item.destination_country,item.destination_city].filter(Boolean).join(' / ')} · {item.status}</p>{item.reason && <p className="mt-1 text-xs text-amber-700">{item.reason==='blocked'?(locale==='fr'?'Colis bloqué':'Blocked parcel'):(locale==='fr'?'Échéance dépassée, livraison non terminée':'ETA passed, delivery incomplete')}</p>}</>;return <li key={item.id}>{item.href?<Link href={item.href} className="block rounded-md p-2 hover:bg-slate-50 focus-visible:outline-emerald-600">{content}</Link>:<div className="p-2">{content}<p className="text-xs text-slate-500">{locale==='fr'?'Ouvrez le bureau propriétaire pour consulter la fiche.':'Switch to the owning office to open this record.'}</p></div>}</li>;})}</ul>;
}
