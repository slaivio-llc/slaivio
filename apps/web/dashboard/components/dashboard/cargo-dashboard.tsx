"use client";

import Link from "next/link";
import { RefreshCcw } from "lucide-react";
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
  const data = result?.key === queryKey ? result.data : null;
  const error = failure === queryKey;
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams(queryKey);
    const query: CargoQuery = { preset: params.get("preset") || "30d", comparison: params.get("comparison") || "previous", scope: params.get("scope") || "office" };
    for (const key of ["start", "end", "compare_start", "compare_end"] as const) if (params.get(key)) query[key] = params.get(key)!;
    getCargoDashboard(query, controller.signal).then((next) => {
      if (!controller.signal.aborted) { setResult({ key: queryKey, data: next }); setFailure(null); }
    }).catch(() => { if (!controller.signal.aborted) setFailure(queryKey); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [queryKey, revision]);
  function refresh() { setLoading(true); setFailure(null); setRevision(value => value + 1); }
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
    {error && <div role="alert" className="rounded-md border border-amber-300 p-4 text-sm">{t("Données indisponibles : vérifiez vos droits, les dates et la connexion. Les valeurs ne sont pas remplacées par des zéros.", "Data unavailable: check permissions, dates and connection. Values are not replaced with zeros.")} <button type="button" onClick={refresh} className="font-semibold underline">{t("Réessayer", "Retry")}</button></div>}
    {!data && !error && <p role="status" className="py-8 text-sm text-slate-500">{t("Chargement des opérations…", "Loading operations…")}</p>}
    {data && <>
      <p className="text-xs text-slate-500" role="status">{error ? t("Dernières données connues", "Last known data") : t("Calculé le", "Calculated at")} {new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "medium", timeZone: data.period.timezone }).format(new Date(data.generated_at))} · {data.period.timezone} · {t("Périmètre : cet accueil uniquement", "Scope: this overview only")}</p>
      <section><h2 className="font-semibold">{t("Flux de la période", "Period flows")}</h2><p className="mt-1 text-xs text-slate-500">{day(data.period.current.start)} — {day(data.period.current.end)}{data.period.previous && ` · ${t("Comparaison", "Comparison")} : ${day(data.period.previous.start)} — ${day(data.period.previous.end)}`}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">{([['received',t('Colis reçus','Parcels received')],['shipped',t('Colis expédiés','Parcels dispatched')],['delivered',t('Colis livrés','Parcels delivered')]] as const).map(([key,label]) => {
          const previous = data.previous_flows?.[key]; const value = data.flows[key];
          return <Metric key={key} label={label} value={number(value)} detail={previous === undefined ? t("Date du jalon enregistrée", "Recorded milestone date") : `${t("Précédent", "Previous")}: ${number(previous)} · ${previous === 0 ? t("Variation non calculable", "Change not calculable") : `${new Intl.NumberFormat(locale,{style:'percent',maximumFractionDigits:1,signDisplay:'always'}).format((value-previous)/previous)}`}`}/>;
        })}</div><p className="mt-2 text-xs text-slate-500">{t("Les jalons sans date ne sont pas comptés. Un changement de statut n’est pas une date de réception.", "Milestones without dates are excluded. A status is not a receipt date.")}</p>
      </section>
      <section><h2 className="font-semibold">{t("Situation actuelle", "Current state")}</h2><p className="mt-1 text-xs text-slate-500">{t("Indépendante de la période sélectionnée", "Independent of the selected period")}</p><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{([['warehoused',t('En entrepôt','In warehouse')],['in_transit',t('En acheminement','In transit')],['ready_for_pickup',t('À retirer','Ready for pickup')],['blocked',t('Bloqués','Blocked')]] as const).map(([key,label]) => <Metric key={key} label={label} value={number(data.states[key])} detail={t('État au moment du calcul','State at calculation time')}/>)}</div></section>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title={t("À traiter maintenant · 10 premiers", "Needs attention · first 10")}><ParcelList items={data.attention} locale={locale}/></Panel>
        <Panel title={t("Dernières réceptions de la période · 8 premières", "Latest receipts in period · first 8")}><ParcelList items={data.recent} locale={locale}/></Panel>
      </div>
      <Panel title={t("Destinations des colis reçus · 8 premières", "Destinations of received parcels · first 8")}>
        <p className="mb-3 text-xs text-slate-500">{t("Colis reçus pendant la période et déjà livrés à ce jour. Ce ratio n’est pas un taux de ponctualité.", "Parcels received in the period and delivered to date. This is not an on-time delivery rate.")}</p>
        {!data.destinations.length && <p className="text-sm text-slate-500">{t("Aucune réception pour cette période.", "No receipts in this period.")}</p>}
        <div className="grid gap-3 sm:grid-cols-2">{data.destinations.map(item => <div key={`${item.country}:${item.city}`} className="rounded-md bg-slate-50 p-3 text-sm"><strong>{[item.country,item.city].filter(Boolean).join(' / ') || t('Destination non renseignée','Destination not provided')}</strong><p className="mt-1 text-slate-600">{number(item.received)} {t('reçus','received')} · {number(item.delivered)} {t('livrés à ce jour','delivered to date')}</p></div>)}</div>
      </Panel>
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
function Metric({label,value,detail}:{label:string;value:string;detail:string}) {return <div className="rounded-lg border border-slate-200 p-4"><h3 className="text-sm text-slate-600">{label}</h3><p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p><p className="mt-2 text-xs text-slate-500">{detail}</p></div>;}
function Panel({title,children}:{title:string;children:ReactNode}) {return <section className="min-w-0 rounded-lg border border-slate-200 p-4"><h2 className="mb-4 text-sm font-semibold">{title}</h2>{children}</section>;}
function ParcelList({items,locale}:{items:CargoParcel[];locale:string}) {
  if (!items.length) return <p className="text-sm text-slate-500">{locale==='fr'?'Aucun colis correspondant.':'No matching parcels.'}</p>;
  return <ul className="grid gap-2">{items.map(item=>{const content=<><strong className="text-sm">{item.reference}</strong><p className="text-xs text-slate-500">{[item.destination_country,item.destination_city].filter(Boolean).join(' / ')} · {item.status}</p>{item.reason && <p className="mt-1 text-xs text-amber-700">{item.reason==='blocked'?(locale==='fr'?'Colis bloqué':'Blocked parcel'):(locale==='fr'?'Échéance dépassée, livraison non terminée':'ETA passed, delivery incomplete')}</p>}</>;return <li key={item.id}>{item.href?<Link href={item.href} className="block rounded-md p-2 hover:bg-slate-50 focus-visible:outline-emerald-600">{content}</Link>:<div className="p-2">{content}<p className="text-xs text-slate-500">{locale==='fr'?'Ouvrez le bureau propriétaire pour consulter la fiche.':'Switch to the owning office to open this record.'}</p></div>}</li>;})}</ul>;
}
