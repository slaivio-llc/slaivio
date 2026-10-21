"use client";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import Link from "next/link";
import { API_BASE_URL } from "@/services/api";
import { ChevronRight, Download, RefreshCcw, Save } from "lucide-react";
import {
  exportReport,
  getAnalytics,
  previewReport,
  saveReportView,
  type Analytics,
} from "@/services/reports";
import { PermissionGuard } from "@/components/permissions/permission-guard";
import { OperationPageHeader } from "@/components/ui/operation-page-header";
import { OperationMetrics, OperationToolbar } from "@/components/ui/operation-primitives";
import { OperationButton, OperationField, OperationFilterPopover, OperationMetric, OperationMetricGrid, OperationTab } from "@/components/ui/operation-controls";
import { ErrorState, LoadingState } from "@/components/ui/page-state";
import { getOfficeContext, type OfficeContext } from "@/services/organization-admin";
const button =
    "inline-flex h-9 items-center gap-2 rounded-full border border-[#d8dddf] bg-white px-3 text-[12px] font-medium text-[#30363a] hover:bg-[#f5f7f6]",
  primary =
    "inline-flex h-9 items-center gap-2 rounded-full bg-[#111111] px-3 text-[12px] font-semibold text-white hover:bg-[#303030]",
  input =
    "h-9 rounded-full border border-[#cfd4d6] bg-white px-3 text-[12px] outline-none focus:border-[#aeb8be]";
const today = new Date().toISOString().slice(0, 10),
  currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
  monthAgo = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10),
  reports = [
    ["clients", "Clients"],
    ["packages", "Colis"],
    ["shipments", "Expéditions"],
    ["finance", "Facturation"],
    ["pickups", "Retraits"],
  ] as const;
export function ReportsAnalyticsPage() {
  const [start, setStart] = useState(currentMonthStart),
    [end, setEnd] = useState(today),
    [data, setData] = useState<Analytics | null>(null),
    [tab, setTab] = useState("overview"),
    [officeContext, setOfficeContext] = useState<OfficeContext | null>(null),
    [officeId, setOfficeId] = useState(""),
    [activeMetric, setActiveMetric] = useState<string | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [report, setReport] = useState("packages"),
    [rows, setRows] = useState<Array<Record<string, unknown>>>([]),
    [packageRows, setPackageRows] = useState<Array<Record<string, unknown>>>([]),
    [packageRowsLoading, setPackageRowsLoading] = useState(false),
    [shipmentRows, setShipmentRows] = useState<Array<Record<string, unknown>>>([]),
    [shipmentRowsLoading, setShipmentRowsLoading] = useState(false),
    [clientRows, setClientRows] = useState<Array<Record<string, unknown>>>([]),
    [clientRowsLoading, setClientRowsLoading] = useState(false),
    [financeRows, setFinanceRows] = useState<Array<Record<string, unknown>>>([]),
    [financeRowsLoading, setFinanceRowsLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await getAnalytics(start, end, officeId || undefined));
    } catch (requestError) {
      setError(analyticsErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [start, end, officeId]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    let active = true;
    getOfficeContext().then((context) => {
      if (active) {
        setOfficeContext(context);
        setOfficeId(context.selected_office_id || "");
      }
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (tab !== "operations") return;
    let active = true;
    setPackageRowsLoading(true);
    previewReport("packages", start, end, officeId || undefined)
      .then((result) => { if (active) setPackageRows(result); })
      .catch(() => { if (active) setPackageRows([]); })
      .finally(() => { if (active) setPackageRowsLoading(false); });
    return () => { active = false; };
  }, [tab, start, end, officeId]);
  useEffect(() => {
    if (tab !== "clients") return;
    let active = true;
    setClientRowsLoading(true);
    previewReport("clients", start, end, officeId || undefined)
      .then((result) => { if (active) setClientRows(result); })
      .catch(() => { if (active) setClientRows([]); })
      .finally(() => { if (active) setClientRowsLoading(false); });
    return () => { active = false; };
  }, [tab, start, end, officeId]);
  useEffect(() => {
    if (tab !== "shipments") return;
    let active = true;
    setShipmentRowsLoading(true);
    previewReport("shipments", start, end, officeId || undefined)
      .then((result) => { if (active) setShipmentRows(result); })
      .catch(() => { if (active) setShipmentRows([]); })
      .finally(() => { if (active) setShipmentRowsLoading(false); });
    return () => { active = false; };
  }, [tab, start, end, officeId]);
  useEffect(() => {
    if (tab !== "finance") return;
    let active = true;
    setFinanceRowsLoading(true);
    previewReport("finance", start, end, officeId || undefined)
      .then((result) => { if (active) setFinanceRows(result); })
      .catch(() => { if (active) setFinanceRows([]); })
      .finally(() => { if (active) setFinanceRowsLoading(false); });
    return () => { active = false; };
  }, [tab, start, end, officeId]);
  async function openReport(key: string) {
    setReport(key);
    setRows(await previewReport(key, start, end, officeId || undefined));
    setTab("reports");
  }
  async function download(key: string) {
    const blob = await exportReport(key, start, end, officeId || undefined),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = `slaivio-${key}-${start}-${end}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  const hasPeriodActivity = Boolean(data && (
    ["clients", "packages", "shipments", "pickups", "weight_kg"].some((key) => data.kpis[key] > 0) ||
    data.finance.some((row) => row.invoices > 0 || !/^0+(?:\.0+)?$/.test(row.collected))
  ));
  const metricCards = data
    ? [["Nouveaux clients", data.kpis.clients], ["Colis reçus", data.kpis.packages], ["Expéditions", data.kpis.shipments], ["Retraits", data.kpis.pickups], ["Poids traité", `${Number(data.kpis.weight_kg).toLocaleString("fr-FR")} kg`]]
    : [];
  return (
    <div className="reports-page min-h-full min-w-0 w-full overflow-x-clip bg-white [&_[data-ui=operation-metrics]]:hidden [&_[data-ui=operation-toolbar]]:hidden [&_.operation-actions>label]:hidden [&_.operation-actions>button:first-of-type]:hidden">
      <OperationPageHeader
        wide
        title="Rapports & analyses"
        description="Suivez les performances de votre activité Cargo."
        actions={
          <>
            <label className="text-[11px] text-[#697178]">
              Du
              <input
                type="date"
                className={`${input} ml-2`}
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
            <label className="text-[11px] text-[#697178]">
              Au
              <input
                type="date"
                className={`${input} ml-2`}
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </label>
            <OperationButton onClick={load}>
              <RefreshCcw size={14} />
              Actualiser
            </OperationButton>
            {tab !== "operations" && tab !== "shipments" && tab !== "finance" && tab !== "clients" && tab !== "warehouses" && <PermissionGuard permission="reports.export"><OperationButton variant="primary" onClick={() => download("packages")}><Download size={14} />Exporter un rapport</OperationButton></PermissionGuard>}
          </>
        }
      />
      <OperationMetrics className="hidden">
        <OperationMetricGrid>
          {(loading
            ? Array.from({ length: 4 }, (_, index) => [String(index), ""])
            : metricCards
          ).map(([label, value]) => loading ? (
            <div key={String(label)} className="min-h-[72px] px-4 py-3.5">
              <div className="h-3 w-24 animate-pulse rounded bg-[#e8ecea]" />
              <div className="mt-3 h-7 w-16 animate-pulse rounded bg-[#e8ecea]" />
            </div>
          ) : (
            <OperationMetric key={String(label)} label={String(label)} value={value} active={activeMetric === String(label)} onClick={() => { setActiveMetric(String(label)); setTab(String(label).includes("Colis") || String(label).includes("Expéditions") ? "operations" : "overview"); }} />
          ))}
        </OperationMetricGrid>
      </OperationMetrics>
      <OperationToolbar filters={<OperationFilterPopover activeCount={tab === "overview" ? 0 : 1} onReset={() => setTab("overview")} title="Filtrer les rapports"><OperationField label="Vue"><select className={`${input} w-full`} value={tab} onChange={(event) => setTab(event.target.value)}><option value="overview">Vue exécutive</option><option value="operations">Opérations</option><option value="finance">Finance</option><option value="routes">Routes</option><option value="warehouses">Entrepôts</option><option value="reports">Rapports exportables</option></select></OperationField></OperationFilterPopover>} />
      <div className="mx-auto w-full max-w-[1200px] px-6 sm:px-8">
        <nav aria-label="Sections des rapports" className="operation-tabs mb-4 flex flex-nowrap items-center gap-0 overflow-x-auto pb-2">
          {[["overview", "Vue d’ensemble"], ["operations", "Colis"], ["shipments", "Expéditions"], ["clients", "Clients"], ["finance", "Finances"], ["warehouses", "Bureaux"]].map(([key, label]) => <OperationTab key={key} active={tab === key} onClick={() => setTab(key)}>{label}</OperationTab>)}
        </nav>
      </div>
      <main className={`reports-layout-main min-w-0 w-full px-0 pt-0 pb-4 ${tab === "overview" ? "reports-overview" : ""}`}>
        <div className="mb-3 grid gap-2 sm:grid-cols-2">
          <label className="text-[11px] text-[#697178]">Période<select aria-label="Période" className={`${input} mt-1 w-full`} value={`${start}|${end}`} onChange={(event) => { const [s, e] = event.target.value.split("|"); setStart(s); setEnd(e); }}>
            <option value={`${new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)}|${today}`}>Ce mois</option><option value={`${monthAgo}|${today}`}>30 derniers jours</option><option value={`${new Date(new Date().getFullYear(), new Date().getMonth() - 2, 1).toISOString().slice(0, 10)}|${today}`}>3 derniers mois</option><option value={`${new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10)}|${today}`}>Cette année</option>
          </select></label>
          <label className="text-[11px] text-[#697178]">Bureau<select aria-label="Bureau" className={`${input} mt-1 w-full`} value={officeId} onChange={(event) => setOfficeId(event.target.value)}><option value="">Tous les bureaux autorisés</option>{(officeContext?.offices || []).map((office) => <option key={office.location_id} value={office.location_id}>{office.city || office.name}</option>)}</select></label>
        </div>
        {data && tab === "overview" && <div className="mb-3 grid grid-cols-2 gap-2 xl:grid-cols-4"><Kpi title="Colis enregistrés" value={data.kpis.packages} change={change(data.kpis.packages, data.kpis.previous_packages)} /><Kpi title="Expéditions" value={data.kpis.shipments} change={change(data.kpis.shipments, data.kpis.previous_shipments)} /><Kpi title="Clients actifs" value={data.kpis.active_clients} change={change(data.kpis.active_clients, data.kpis.previous_active_clients)} /><Kpi title="Paiements reçus" value={data.finance.length ? data.finance.map((row) => `${Number(row.collected).toLocaleString("fr-FR")} ${row.currency}`).join(" · ") : "0"} change={data.finance.length > 1 ? null : change(Number(data.finance[0]?.collected || 0), Number(data.finance[0]?.previous_collected || 0))} /></div>}
        {error && data ? (
          <div className="mb-4 border border-[#e7c98d] bg-[#fffaf0] px-4 py-3 text-[12px] text-[#75530b]" role="alert">
            {error} Les derniers indicateurs disponibles restent affichés.
          </div>
        ) : null}
        {loading && !data ? (
          <LoadingState label="Calcul des indicateurs…" />
        ) : data ? (
          <>
            {!hasPeriodActivity && <div role="status" className="mb-4 border border-[#dfe3e4] bg-white px-4 py-3 text-[12px] text-[#697178]">Aucune opération n’a été enregistrée sur la période sélectionnée. Les vues d’état courant peuvent toutefois afficher le stock existant.</div>}
            {tab === "overview" && <Overview data={data} />}{" "}
            {tab === "operations" && <PackagesReport data={data} rows={packageRows} loading={packageRowsLoading} onExport={() => download("packages")} />} {" "}
            {tab === "finance" && <FinanceReport data={data} rows={financeRows} loading={financeRowsLoading} onExport={() => download("finance")} />}{" "}
            {tab === "routes" && <Routes data={data} />}{" "}
            {tab === "warehouses" && <OfficesReport data={data} onExport={() => exportOffices(data.offices, start, end)} />}{" "}
            {tab === "clients" && <ClientsReport data={data} rows={clientRows} loading={clientRowsLoading} onExport={() => download("clients")} />}
            {tab === "shipments" && <ShipmentsReport data={data} rows={shipmentRows} loading={shipmentRowsLoading} onExport={() => download("shipments")} />}
            {tab === "reports" && (
              <Reports
                report={report}
                rows={rows}
                open={openReport}
                download={download}
                start={start}
                end={end}
              />
            )}
          </>
        ) : (
          <ErrorState
            title="Analytics indisponibles"
            description={error || "Aucune donnée analytique n’a pu être chargée."}
            retry={load}
          />
        )}
      </main>
    </div>
  );
}
function analyticsErrorMessage(error: unknown) {
  if (!axios.isAxiosError(error)) {
    return "Le calcul des indicateurs n’a pas pu être terminé.";
  }
  if (!error.response) {
    if (error.code === "ECONNABORTED") {
      return "La requête Analytics a dépassé le délai d’attente. Vérifiez la disponibilité de l’API et réessayez.";
    }
    const target = API_BASE_URL ? `${API_BASE_URL}/reports/analytics` : "URL de l’API non configurée";
    return `Aucune réponse HTTP de l’API (${target}). Vérifiez l’URL publique du backend, sa disponibilité, le réseau, TLS et CORS.`;
  }
  if (error.response.status === 401) {
    return "Votre session a expiré. Reconnectez-vous pour consulter les indicateurs.";
  }
  if (error.response.status === 403) {
    return "Votre rôle ne possède pas l’autorisation de consulter les Analytics de cette agence.";
  }
  if (error.response.status === 422) {
    return "La période choisie n’est pas valide. Vérifiez les dates de début et de fin.";
  }
  return "Le serveur n’a pas pu calculer les indicateurs. Réessayez après le redéploiement de l’API.";
}
function change(current: number, previous: number): number | "new" | null {
  if (!previous && !current) return 0;
  if (!previous) return "new";
  return Math.round(((current - previous) / previous) * 100);
}
function Kpi({ title, value, change: delta }: { title: string; value: React.ReactNode; change: number | "new" | null }) {
  const detail = delta === "new" ? "Nouveau sur la période" : delta === null ? "Plusieurs devises" : `${delta > 0 ? "+" : ""}${delta}% vs période précédente`;
  return <section className="rounded-[8px] border border-[#dfe3e4] bg-white px-4 py-3"><p className="text-[11px] text-[#697178]">{title}</p><p className="mt-2 text-[20px] font-semibold text-[#25292e]">{value}</p><p className={`mt-1 text-[11px] ${delta === null ? "text-[#697178]" : delta === "new" || delta >= 0 ? "text-[#16855f]" : "text-[#bd5b3a]"}`}>{detail}</p></section>;
}
function ClientsReport({ data, rows, loading, onExport }: { data: Analytics; rows: Array<Record<string, unknown>>; loading: boolean; onExport: () => void }) {
  return <div className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-[16px] font-semibold text-[#25292e]">Rapport des clients</h2><p className="mt-1 text-[12px] text-[#697178]">Nouveaux clients et activité</p></div>
      <PermissionGuard permission="reports.export"><OperationButton onClick={onExport}><Download size={14} />Exporter</OperationButton></PermissionGuard>
    </div>
    <div className="grid grid-cols-2 gap-2">
      <section className="border border-[#dfe3e4] bg-white px-4 py-3"><p className="text-[11px] text-[#697178]">Clients actifs</p><p className="mt-2 text-[20px] font-semibold text-[#25292e]">{Number(data.kpis.active_clients || 0).toLocaleString("fr-FR")}</p></section>
      <section className="border border-[#dfe3e4] bg-white px-4 py-3"><p className="text-[11px] text-[#697178]">Nouveaux clients</p><p className="mt-2 text-[20px] font-semibold text-[#25292e]">{Number(data.kpis.clients || 0).toLocaleString("fr-FR")}</p></section>
    </div>
    <section className="border border-[#dfe3e4] bg-white p-4" aria-label="Évolution mensuelle des nouveaux clients">
      <ClientTrend data={data.monthly_trend || []} />
    </section>
    <section aria-labelledby="client-report-data">
      <h3 id="client-report-data" className="mb-2 text-[14px] font-semibold text-[#25292e]">Données du rapport</h3>
      {loading ? <LoadingState label="Chargement des clients…" /> : rows.length ? <div className="space-y-2">{rows.slice(0, 8).map((row, index) => {
        const reference = String(row.client_reference || `CLI-${String(index + 1).padStart(3, "0")}`),
          name = String(row.name || "Client"),
          status = row.lifecycle_status === "active" ? "Actif" : row.lifecycle_status ? String(row.lifecycle_status).replaceAll("_", " ") : "Nouveau";
        return <div key={String(row.id || `${reference}-${index}`)} className="flex items-center justify-between gap-3 border border-[#dfe3e4] bg-white px-3 py-3"><span><span className="block text-[12px] font-medium text-[#25292e]">{reference}</span><span className="mt-1 block text-[11px] text-[#697178]">{name}</span></span><span className="flex items-center gap-2 text-[11px] text-[#59636b]"><span className="bg-[#f1f2f1] px-2 py-1">{status}</span><ChevronRight size={14} /></span></div>;
      })}</div> : <p className="border border-[#dfe3e4] bg-white px-3 py-4 text-[12px] text-[#697178]">Aucun nouveau client sur cette période.</p>}
    </section>
  </div>;
}
function ClientTrend({ data }: { data: Analytics["monthly_trend"] }) {
  const maxValue = Math.max(0, ...data.map((item) => item.clients));
  const max = Math.max(6, Math.ceil(maxValue / 30) * 30);
  const left = 52, right = 680, top = 22, bottom = 230;
  const x = (index: number) => data.length <= 1 ? (left + right) / 2 : left + (index * (right - left)) / (data.length - 1);
  const y = (value: number) => bottom - (value / max) * (bottom - top);
  const points = data.map((item, index) => `${x(index)},${y(item.clients)}`).join(" ");
  return <><div className="mb-2 flex items-center justify-between"><h3 className="text-[14px] font-semibold text-[#25292e]">Nouveaux clients par mois</h3><span className="bg-[#f1f2f1] px-2 py-1 text-[10px] text-[#59636b]">6 mois</span></div><svg className="h-[320px] w-full" viewBox="0 0 700 270" role="img" aria-label="Nombre de nouveaux clients sur les six derniers mois">
    {Array.from({ length: 6 }, (_, index) => { const value = (max / 5) * (5 - index), lineY = top + index * ((bottom - top) / 5); return <g key={index}><line x1={left} y1={lineY} x2={right} y2={lineY} stroke="#edf0ef" strokeDasharray="2 4"/><text x={left - 10} y={lineY + 4} textAnchor="end" fontSize="10" fill="#687178">{Math.round(value)}</text></g>; })}
    <polyline fill="none" stroke="#ff784c" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" points={points}/>
    {data.map((item,index)=><g key={item.month}><circle cx={x(index)} cy={y(item.clients)} r="3.5" fill="#ff784c"/><text x={x(index)} y="252" textAnchor="middle" fontSize="10" fill="#687178">{new Date(`${item.month}T12:00:00`).toLocaleDateString("fr-FR",{month:"short"})}</text></g>)}
  </svg>{!data.length && <p className="text-center text-[12px] text-[#697178]">Aucune activité à afficher sur les six derniers mois.</p>}</>;
}
function Overview({ data }: { data: Analytics }) {
  return (
    <div className="grid gap-4">
      <Card title="Évolution de l’activité" subtitle="Colis et expéditions — 6 derniers mois">
        <MonthlyTrend data={data.monthly_trend || []} />
      </Card>
    </div>
  );
}
function MonthlyTrend({ data }: { data: Analytics["monthly_trend"] }) {
  const maxValue = Math.max(0, ...data.flatMap((item) => [item.packages, item.shipments]));
  const max = Math.max(4, Math.ceil(maxValue / 40) * 40);
  const left = 52, right = 680, top = 22, bottom = 210;
  const x = (index: number) => data.length <= 1 ? (left + right) / 2 : left + (index * (right - left)) / (data.length - 1);
  const y = (value: number) => bottom - (value / max) * (bottom - top);
  const points = (key: "packages" | "shipments") => data.map((item, index) => `${x(index)},${y(item[key])}`).join(" ");
  return <div className="bg-white p-4"><svg className="h-[300px] w-full" viewBox="0 0 700 250" role="img" aria-label="Évolution mensuelle du nombre de colis et d’expéditions sur les six derniers mois"><g>{Array.from({ length: 5 }, (_, index) => {
    const value = (max / 4) * (4 - index), lineY = top + index * ((bottom - top) / 4);
    return <g key={index}><line x1={left} y1={lineY} x2={right} y2={lineY} stroke="#edf0ef" strokeDasharray="2 4"/><text x={left - 10} y={lineY + 4} textAnchor="end" fontSize="10" fill="#687178">{Math.round(value)}</text></g>;
  })}</g><polyline fill="none" stroke="#ff784c" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" points={points("packages")}/><polyline fill="none" stroke="#f0c742" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" points={points("shipments")}/>{data.map((item,index)=><g key={item.month}><circle cx={x(index)} cy={y(item.packages)} r="3.5" fill="#ff784c"/><circle cx={x(index)} cy={y(item.shipments)} r="3.5" fill="#f0c742"/><text x={x(index)} y="232" textAnchor="middle" fontSize="10" fill="#687178">{new Date(`${item.month}T12:00:00`).toLocaleDateString("fr-FR",{month:"short"})}</text></g>)}</svg>{!data.length && <p className="text-center text-[12px] text-[#697178]">Aucune activité à afficher sur les six derniers mois.</p>}<div className="mt-1 flex justify-center gap-5 text-[11px]"><span className="text-[#ff784c]">● Colis</span><span className="text-[#d2a900]">● Expéditions</span></div></div>;
}
function Trend({ data }: { data: Analytics["trend"] }) {
  const max = Math.max(
    1,
    ...data.flatMap((x) => [x.clients, x.packages, x.shipments]),
  );
  return (
    <div className="flex h-56 items-end gap-1 overflow-x-auto border-b pb-1">
      {data.map((x) => (
        <div
          key={x.day}
          className="group flex h-full min-w-[20px] flex-1 items-end justify-center gap-[2px]"
          title={`${x.day}: ${x.clients} clients, ${x.packages} colis, ${x.shipments} expéditions`}
        >
          <i
            className="w-1/3 bg-[#b8d9ca]"
            style={{ height: `${Math.max(2, (x.clients / max) * 100)}%` }}
          />
          <i
            className="w-1/3 bg-[#167d57]"
            style={{ height: `${Math.max(2, (x.packages / max) * 100)}%` }}
          />
          <i
            className="w-1/3 bg-[#3d6f86]"
            style={{ height: `${Math.max(2, (x.shipments / max) * 100)}%` }}
          />
        </div>
      ))}
    </div>
  );
}
function PackagesReport({ data, rows, loading, onExport }: { data: Analytics; rows: Array<Record<string, unknown>>; loading: boolean; onExport: () => void }) {
  const counts = new Map((data.statuses.packages || []).map((item) => [String(item.label).toUpperCase(), Number(item.value)]));
  const total = (statuses: string[]) => statuses.reduce((sum, status) => sum + (counts.get(status) || 0), 0);
  const bars = [
    { label: "Reçus", value: Number(data.kpis.packages || 0) },
    { label: "Expédiés", value: total(["SHIPPED", "DEPARTED", "IN_TRANSIT", "CUSTOMS", "ARRIVED", "ARRIVED_DESTINATION", "CLEARED", "READY_FOR_PICKUP", "AVAILABLE_FOR_PICKUP", "OUT_FOR_DELIVERY", "DELIVERED"]) },
    { label: "Arrivés", value: total(["ARRIVED", "ARRIVED_DESTINATION", "CLEARED", "READY_FOR_PICKUP", "AVAILABLE_FOR_PICKUP", "OUT_FOR_DELIVERY", "DELIVERED"]) },
    { label: "Livrés", value: total(["DELIVERED"]) },
  ];
  const max = Math.max(4, Math.ceil(Math.max(...bars.map((item) => item.value), 0) / 4 / 10) * 10 * 4);
  const chartTop = 22, chartBottom = 230, chartHeight = chartBottom - chartTop;
  return <div className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-[16px] font-semibold text-[#25292e]">Rapport des colis</h2><p className="mt-1 text-[12px] text-[#697178]">Réception, expédition, arrivée et livraison</p></div>
      <PermissionGuard permission="reports.export"><OperationButton onClick={onExport}><Download size={14} />Exporter</OperationButton></PermissionGuard>
    </div>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {bars.map((item) => <section key={item.label} className="border border-[#dfe3e4] bg-white px-4 py-3"><p className="text-[11px] text-[#697178]">{item.label}</p><p className="mt-2 text-[20px] font-semibold text-[#25292e]">{item.value.toLocaleString("fr-FR")}</p></section>)}
    </div>
    <section className="border border-[#dfe3e4] bg-white p-4" aria-label="Graphique des colis par étape">
      <svg className="h-[340px] w-full" viewBox="0 0 700 280" role="img" aria-label="Nombre de colis reçus, expédiés, arrivés et livrés">
        {Array.from({ length: 5 }, (_, index) => {
          const value = (max / 4) * (4 - index), y = chartTop + index * (chartHeight / 4);
          return <g key={index}><line x1="58" y1={y} x2="680" y2={y} stroke="#edf0ef" strokeDasharray="2 4"/><text x="48" y={y + 4} textAnchor="end" fontSize="11" fill="#687178">{Math.round(value)}</text></g>;
        })}
        {bars.map((item, index) => {
          const width = 104, x = 92 + index * 148, height = (item.value / max) * chartHeight, y = chartBottom - height;
          return <g key={item.label}><rect x={x} y={y} width={width} height={height} rx="8" fill="#f28b55"><title>{`${item.label} : ${item.value}`}</title></rect><text x={x + width / 2} y="252" textAnchor="middle" fontSize="11" fill="#687178">{item.label}</text></g>;
        })}
      </svg>
    </section>
    <section aria-labelledby="package-report-data">
      <h3 id="package-report-data" className="mb-2 text-[14px] font-semibold text-[#25292e]">Données du rapport</h3>
      {loading ? <LoadingState label="Chargement des colis…" /> : rows.length ? <div className="space-y-2">{rows.slice(0, 8).map((row, index) => {
        const reference = String(row.package_reference || row.tracking_id || `Colis ${index + 1}`),
          status = packageStatusLabel(String(row.status || "")),
          href = row.id ? `/app/packages?open=${encodeURIComponent(String(row.id))}` : null,
          content = <><span><span className="block text-[12px] font-medium text-[#25292e]">{reference}</span><span className="mt-1 block text-[11px] text-[#697178]">{String(row.destination_country || row.warehouse_name || "Colis")}</span></span><span className="flex items-center gap-2 text-[11px] text-[#59636b]"><span className="bg-[#f1f2f1] px-2 py-1">{status}</span><ChevronRight size={14} /></span></>;
        return href ? <Link key={String(row.id)} href={href} className="flex items-center justify-between gap-3 border border-[#dfe3e4] bg-white px-3 py-3 hover:bg-[#fafbfb]">{content}</Link> : <div key={`${reference}-${index}`} className="flex items-center justify-between gap-3 border border-[#dfe3e4] bg-white px-3 py-3">{content}</div>;
      })}</div> : <p className="border border-[#dfe3e4] bg-white px-3 py-4 text-[12px] text-[#697178]">Aucun colis enregistré sur cette période.</p>}
    </section>
  </div>;
}
function packageStatusLabel(status: string) {
  const labels: Record<string, string> = { CREATED: "Créé", PENDING_VALIDATION: "À valider", CONFIRMED: "Confirmé", RECEIVED: "Reçu", RECEIVED_AT_ORIGIN: "Reçu", WAREHOUSED: "En entrepôt", WAREHOUSE_PROCESSING: "En traitement", READY_FOR_DISPATCH: "Prêt à expédier", READY_FOR_BATCH: "Prêt au groupage", BATCHED: "Groupé", SHIPPED: "Expédié", DEPARTED: "Expédié", IN_TRANSIT: "En transit", CUSTOMS: "En douane", ARRIVED: "Arrivé", ARRIVED_DESTINATION: "Arrivé", CLEARED: "Dédouané", READY_FOR_PICKUP: "Prêt au retrait", AVAILABLE_FOR_PICKUP: "Prêt au retrait", OUT_FOR_DELIVERY: "En livraison", DELIVERED: "Livré", BLOCKED: "Bloqué", CANCELLED: "Annulé", RETURNED: "Retourné" };
  return labels[status.toUpperCase()] || status.replaceAll("_", " ").toLowerCase();
}
function ShipmentsReport({ data, rows, loading, onExport }: { data: Analytics; rows: Array<Record<string, unknown>>; loading: boolean; onExport: () => void }) {
  const counts = new Map((data.statuses.shipments || []).map((item) => [String(item.label).toUpperCase(), Number(item.value)]));
  const total = (statuses: string[]) => statuses.reduce((sum, status) => sum + (counts.get(status) || 0), 0);
  const bars = [
    { label: "Prévues", value: total(["DRAFT", "PREPARING", "LOADING", "READY", "READY_FOR_DEPARTURE"]) },
    { label: "En transit", value: total(["DISPATCHED", "IN_TRANSIT", "CUSTOMS_CLEARANCE"]) },
    { label: "Arrivées", value: total(["ARRIVED", "ARRIVED_DESTINATION", "AVAILABLE_FOR_PICKUP", "OUT_FOR_DELIVERY", "DELIVERED"]) },
  ];
  const max = Math.max(4, Math.ceil(Math.max(...bars.map((item) => item.value), 0) / 4) * 4);
  const chartTop = 22, chartBottom = 230, chartHeight = chartBottom - chartTop;
  return <div className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-[16px] font-semibold text-[#25292e]">Rapport des expéditions</h2><p className="mt-1 text-[12px] text-[#697178]">Départs, arrivées et expéditions en transit</p></div>
      <PermissionGuard permission="reports.export"><OperationButton onClick={onExport}><Download size={14} />Exporter</OperationButton></PermissionGuard>
    </div>
    <div className="grid grid-cols-3 gap-2">
      {bars.map((item) => <section key={item.label} className="border border-[#dfe3e4] bg-white px-4 py-3"><p className="text-[11px] text-[#697178]">{item.label}</p><p className="mt-2 text-[20px] font-semibold text-[#25292e]">{item.value.toLocaleString("fr-FR")}</p></section>)}
    </div>
    <section className="border border-[#dfe3e4] bg-white p-4" aria-label="Graphique des expéditions par étape">
      <svg className="h-[340px] w-full" viewBox="0 0 700 280" role="img" aria-label="Nombre d’expéditions prévues, en transit et arrivées">
        {Array.from({ length: 5 }, (_, index) => {
          const value = (max / 4) * (4 - index), y = chartTop + index * (chartHeight / 4);
          return <g key={index}><line x1="58" y1={y} x2="680" y2={y} stroke="#edf0ef" strokeDasharray="2 4"/><text x="48" y={y + 4} textAnchor="end" fontSize="11" fill="#687178">{Math.round(value)}</text></g>;
        })}
        {bars.map((item, index) => {
          const width = 112, x = 110 + index * 190, height = (item.value / max) * chartHeight, y = chartBottom - height;
          return <g key={item.label}><rect x={x} y={y} width={width} height={height} rx="8" fill="#f28b55"><title>{`${item.label} : ${item.value}`}</title></rect><text x={x + width / 2} y="252" textAnchor="middle" fontSize="11" fill="#687178">{item.label}</text></g>;
        })}
      </svg>
    </section>
    <section aria-labelledby="shipment-report-data">
      <h3 id="shipment-report-data" className="mb-2 text-[14px] font-semibold text-[#25292e]">Données du rapport</h3>
      {loading ? <LoadingState label="Chargement des expéditions…" /> : rows.length ? <div className="space-y-2">{rows.slice(0, 8).map((row, index) => {
        const reference = String(row.expedition_reference || `Expédition ${index + 1}`),
          origin = String(row.origin_city || "Départ à préciser"), destination = String(row.destination_city || "Destination à préciser"),
          route = String(row.route_label || `${origin} → ${destination}`), status = shipmentStatusLabel(String(row.status || "")),
          href = row.id ? `/app/shipments/${encodeURIComponent(String(row.id))}` : null,
          content = <><span><span className="block text-[12px] font-medium text-[#25292e]">{reference}</span><span className="mt-1 block text-[11px] text-[#697178]">{route}</span></span><span className="flex items-center gap-2 text-[11px] text-[#59636b]"><span className="bg-[#f1f2f1] px-2 py-1">{status}</span><ChevronRight size={14} /></span></>;
        return href ? <Link key={String(row.id)} href={href} className="flex items-center justify-between gap-3 border border-[#dfe3e4] bg-white px-3 py-3 hover:bg-[#fafbfb]">{content}</Link> : <div key={`${reference}-${index}`} className="flex items-center justify-between gap-3 border border-[#dfe3e4] bg-white px-3 py-3">{content}</div>;
      })}</div> : <p className="border border-[#dfe3e4] bg-white px-3 py-4 text-[12px] text-[#697178]">Aucune expédition enregistrée sur cette période.</p>}
    </section>
  </div>;
}
function shipmentStatusLabel(status: string) {
  const labels: Record<string, string> = { DRAFT: "Brouillon", PREPARING: "Prévue", LOADING: "En chargement", READY: "Prête", READY_FOR_DEPARTURE: "Prête au départ", DISPATCHED: "Partie", IN_TRANSIT: "En transit", CUSTOMS_CLEARANCE: "En douane", ARRIVED: "Arrivée", ARRIVED_DESTINATION: "Arrivée", AVAILABLE_FOR_PICKUP: "Disponible au retrait", OUT_FOR_DELIVERY: "En livraison", DELIVERED: "Livrée", CANCELLED: "Annulée", ARCHIVED: "Archivée" };
  return labels[status.toUpperCase()] || status.replaceAll("_", " ").toLowerCase();
}
function FinanceReport({ data, rows, loading, onExport }: { data: Analytics; rows: Array<Record<string, unknown>>; loading: boolean; onExport: () => void }) {
  const currencies = [...new Set([...data.finance.map((item) => item.currency), ...data.monthly_finance.map((item) => item.currency)].filter(Boolean))];
  const [selectedCurrency, setSelectedCurrency] = useState(currencies[0] || "");
  const activeCurrency = currencies.includes(selectedCurrency) ? selectedCurrency : currencies[0] || "";
  const monthly = data.monthly_finance.filter((item) => item.currency === activeCurrency);
  const invoiceRows = data.finance.filter((item) => item.invoices > 0 || Number(item.invoiced) > 0 || Number(item.outstanding) > 0);
  const totalFor = (key: "invoiced" | "collected" | "outstanding") => invoiceRows.length
    ? invoiceRows.map((item) => financeMoney(item[key], item.currency)).join(" · ")
    : financeMoney(0, activeCurrency || "USD");
  const pendingCount = invoiceRows.reduce((sum, item) => sum + Number(item.pending_invoices || 0), 0);
  return <div className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-[16px] font-semibold text-[#25292e]">Rapport financier</h2><p className="mt-1 text-[12px] text-[#697178]">Facturation, encaissements et soldes</p></div>
      <PermissionGuard permission="reports.export"><OperationButton onClick={onExport}><Download size={14} />Exporter</OperationButton></PermissionGuard>
    </div>
    <div className="grid grid-cols-2 gap-2">
      <FinanceMetric label="Facturé" value={totalFor("invoiced")} />
      <FinanceMetric label="Encaissé" value={totalFor("collected")} />
      <FinanceMetric label="Restant à encaisser" value={totalFor("outstanding")} />
      <FinanceMetric label="Factures en attente" value={pendingCount.toLocaleString("fr-FR")} />
    </div>
    <section className="border border-[#dfe3e4] bg-white p-4" aria-label="Évolution mensuelle des factures et encaissements">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h3 className="text-[14px] font-semibold text-[#25292e]">Facturé et encaissé par mois</h3>{currencies.length > 1 && <label className="text-[11px] text-[#697178]">Devise <select aria-label="Devise du graphique" className={`${input} ml-2`} value={activeCurrency} onChange={(event) => setSelectedCurrency(event.target.value)}>{currencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}</select></label>}</div>
      <FinanceTrend data={monthly} currency={activeCurrency || "USD"} />
    </section>
    <section aria-labelledby="finance-report-data">
      <h3 id="finance-report-data" className="mb-2 text-[14px] font-semibold text-[#25292e]">Données du rapport</h3>
      {loading ? <LoadingState label="Chargement des factures…" /> : rows.length ? <div className="space-y-2">{rows.slice(0, 8).map((row, index) => {
        const reference = String(row.document_number || `FAC-${String(index + 1).padStart(4, "0")}`),
          client = String(row.client_name || "Client"),
          status = invoiceStatusLabel(String(row.status || ""));
        return <div key={String(row.id || `${reference}-${index}`)} className="flex items-center justify-between gap-3 border border-[#dfe3e4] bg-white px-3 py-3"><span><span className="block text-[12px] font-medium text-[#25292e]">{reference}</span><span className="mt-1 block text-[11px] text-[#697178]">{client}</span></span><span className="flex items-center gap-2 text-[11px] text-[#59636b]"><span className="bg-[#f1f2f1] px-2 py-1">{status}</span><ChevronRight size={14} /></span></div>;
      })}</div> : <p className="border border-[#dfe3e4] bg-white px-3 py-4 text-[12px] text-[#697178]">Aucune facture sur cette période.</p>}
    </section>
  </div>;
}
function FinanceMetric({ label, value }: { label: string; value: string }) {
  return <section className="border border-[#dfe3e4] bg-white px-4 py-3"><p className="text-[11px] text-[#697178]">{label}</p><p className="mt-2 text-[15px] font-semibold text-[#25292e]">{value}</p></section>;
}
function financeMoney(value: string | number, currency: string) {
  try { return new Intl.NumberFormat("fr-FR", { style: "currency", currency, currencyDisplay: "narrowSymbol", maximumFractionDigits: 2 }).format(Number(value || 0)); }
  catch { return `${Number(value || 0).toLocaleString("fr-FR")} ${currency}`; }
}
function invoiceStatusLabel(status: string) {
  const labels: Record<string, string> = { ISSUED: "À payer", PARTIALLY_PAID: "Partiellement payée", PAID: "Payée", OVERDUE: "En retard", DRAFT: "Brouillon", VOID: "Annulée" };
  return labels[status.toUpperCase()] || status.replaceAll("_", " ").toLowerCase();
}
function FinanceTrend({ data, currency }: { data: Analytics["monthly_finance"]; currency: string }) {
  const maxValue = Math.max(0, ...data.flatMap((item) => [Number(item.invoiced), Number(item.collected)]));
  const magnitude = Math.pow(10, Math.floor(Math.log10(maxValue || 1))), normalized = (maxValue || magnitude) / magnitude;
  const step = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude;
  const max = Math.max(step, Math.ceil(maxValue / step) * step);
  const left = 66, right = 680, top = 22, bottom = 230, height = bottom - top;
  const groupWidth = data.length ? (right - left) / data.length : 0, barWidth = Math.min(48, groupWidth * 0.32);
  return <><svg className="h-[340px] w-full" viewBox="0 0 700 280" role="img" aria-label={`Montants facturés et encaissés chaque mois en ${currency}`}>
    {Array.from({ length: 5 }, (_, index) => { const amount = (max / 4) * (4 - index), y = top + index * (height / 4); return <g key={index}><line x1={left} y1={y} x2={right} y2={y} stroke="#edf0ef" strokeDasharray="2 4"/><text x={left - 9} y={y + 4} textAnchor="end" fontSize="10" fill="#687178">{new Intl.NumberFormat("fr-FR", { notation: amount >= 1000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(amount)} {currency}</text></g>; })}
    {data.map((item, index) => { const center = left + groupWidth * (index + 0.5), invoice = Number(item.invoiced), paid = Number(item.collected), invoiceHeight = (invoice / max) * height, paidHeight = (paid / max) * height; return <g key={`${item.month}-${item.currency}`}><rect x={center - barWidth - 2} y={bottom - invoiceHeight} width={barWidth} height={invoiceHeight} rx="7" fill="#f28b55"><title>{`Facturé : ${financeMoney(invoice, currency)}`}</title></rect><rect x={center + 2} y={bottom - paidHeight} width={barWidth} height={paidHeight} rx="7" fill="#f5cf4b"><title>{`Encaissé : ${financeMoney(paid, currency)}`}</title></rect><text x={center} y="252" textAnchor="middle" fontSize="10" fill="#687178">{new Date(`${item.month}T12:00:00`).toLocaleDateString("fr-FR", { month: "short" })}</text></g>; })}
  </svg>{!data.length && <p className="text-center text-[12px] text-[#697178]">Aucune activité financière sur les six derniers mois.</p>}<div className="mt-1 flex justify-center gap-5 text-[11px]"><span className="text-[#f28b55]">● Facturé</span><span className="text-[#d2a900]">● Encaissé</span></div></>;
}
function Routes({ data }: { data: Analytics }) {
  return (
    <Card
      title="Performance des routes"
      subtitle="Volumes et durée moyenne observée entre création et dernière mise à jour."
    >
      <Table rows={data.routes} />
    </Card>
  );
}
function OfficesReport({ data, onExport }: { data: Analytics; onExport: () => void }) {
  return <div className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-[16px] font-semibold text-[#25292e]">Performances bureaux</h2><p className="mt-1 text-[12px] text-[#697178]">Activité et résultats par bureau</p></div>
      <PermissionGuard permission="reports.export"><OperationButton onClick={onExport}><Download size={14} />Exporter</OperationButton></PermissionGuard>
    </div>
    {data.offices.length ? <div className="space-y-2">{data.offices.map((office) => <section key={office.id} className="border border-[#dfe3e4] bg-white px-3 py-3">
      <div className="mb-3 flex items-center justify-between gap-3"><h3 className="text-[13px] font-semibold text-[#25292e]">{office.name || office.city}</h3><span className="bg-[#f1f2f1] px-2 py-1 text-[10px] text-[#59636b]">{Number(office.packages).toLocaleString("fr-FR")} colis</span></div>
      <div className="space-y-2 text-[11px]"><div className="flex items-center justify-between gap-3 text-[#697178]"><span>Expéditions</span><span className="font-medium text-[#25292e]">{Number(office.expeditions).toLocaleString("fr-FR")}</span></div><div className="flex items-start justify-between gap-3 text-[#697178]"><span>Paiements reçus</span><span className="text-right font-medium text-[#25292e]">{office.payments.length ? office.payments.map((payment) => financeMoney(payment.amount, payment.currency)).join(" · ") : "0"}</span></div></div>
    </section>)}</div> : <p className="border border-[#dfe3e4] bg-white px-3 py-4 text-[12px] text-[#697178]">Aucun bureau accessible pour cette sélection.</p>}
    <section aria-labelledby="office-report-data"><h3 id="office-report-data" className="mb-2 text-[14px] font-semibold text-[#25292e]">Données du rapport</h3>{data.offices.length ? <div className="space-y-2">{data.offices.map((office) => <div key={office.id} className="flex items-center justify-between gap-3 border border-[#dfe3e4] bg-white px-3 py-3"><span><span className="block text-[12px] font-medium text-[#25292e]">{office.name || office.city}</span><span className="mt-1 block text-[11px] text-[#697178]">{office.city}</span></span><span className="flex items-center gap-2 text-[11px] text-[#59636b]"><span className="bg-[#f1f2f1] px-2 py-1">{office.status === "ACTIVE" ? "Actif" : "Inactif"}</span><ChevronRight size={14} /></span></div>)}</div> : <p className="border border-[#dfe3e4] bg-white px-3 py-4 text-[12px] text-[#697178]">Aucun bureau accessible pour cette sélection.</p>}</section>
  </div>;
}
function exportOffices(offices: Analytics["offices"], start: string, end: string) {
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`,
    lines = [["Bureau", "Ville", "Statut", "Colis", "Expéditions", "Paiements reçus"], ...offices.map((office) => [office.name, office.city, office.status, String(office.packages), String(office.expeditions), office.payments.map((payment) => `${payment.amount} ${payment.currency}`).join(" | ")])],
    csv = `\uFEFF${lines.map((line) => line.map((value) => quote(String(value || ""))).join(",")).join("\r\n")}`,
    url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })),
    link = document.createElement("a");
  link.href = url; link.download = `slaivio-bureaux-${start}-${end}.csv`; link.click(); URL.revokeObjectURL(url);
}
function Reports({
  report,
  rows,
  open,
  download,
  start,
  end,
}: {
  report: string;
  rows: Array<Record<string, unknown>>;
  open: (k: string) => void;
  download: (k: string) => void;
  start: string;
  end: string;
}) {
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await saveReportView({
      name: String(f.get("name")),
      report_key: report,
      filters: { start, end },
      is_shared: f.get("shared") === "on",
    });
    e.currentTarget.reset();
  }
  return (
    <div className="grid gap-4">
      <Card
        title="Bibliothèque de rapports"
        subtitle="Prévisualisez 200 lignes ou exportez jusqu’à 10 000 lignes filtrées."
      >
        <div className="flex flex-wrap gap-2">
          {reports.map(([k, l]) => (
            <button
              key={k}
              className={report === k ? primary : button}
              onClick={() => open(k)}
            >
              {l}
            </button>
          ))}
          <PermissionGuard permission="reports.export">
            <button
              className={`${button} ml-auto`}
              onClick={() => download(report)}
            >
              <Download size={14} />
              Exporter CSV
            </button>
          </PermissionGuard>
        </div>
      </Card>
      <PermissionGuard permission="reports.manage">
        <Card
          title="Enregistrer cette vue"
          subtitle="Retrouvez facilement la période et le rapport sélectionnés."
        >
          <form className="flex flex-wrap gap-2" onSubmit={save}>
            <input
              required
              name="name"
              className={`${input} min-w-[240px]`}
              placeholder="Ex. Rapport mensuel direction"
            />
            <label className="flex items-center gap-2 text-[12px]">
              <input name="shared" type="checkbox" />
              Partager à l’agence
            </label>
            <button className={button}>
              <Save size={14} />
              Enregistrer
            </button>
          </form>
        </Card>
      </PermissionGuard>
      <Card
        title={`Aperçu · ${report}`}
        subtitle={`${rows.length} ligne(s) chargée(s)`}
      >
        <Table rows={rows} />
      </Card>
    </div>
  );
}
function Bars({ items }: { items: Array<{ label: string; value: number }> }) {
  const max = Math.max(1, ...items.map((x) => x.value));
  return (
    <div className="space-y-3">
      {items.map((x) => (
        <div key={x.label}>
          <div className="mb-1 flex justify-between text-[12px]">
            <span>{x.label || "Non renseigné"}</span>
            <b>{x.value}</b>
          </div>
          <div className="h-2 bg-[#e9edeb]">
            <div
              className="h-2 bg-[#167d57]"
              style={{ width: `${(x.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
function Table({ rows }: { rows: Array<Record<string, unknown>> }) {
  const columns = useMemo(() => (rows[0] ? Object.keys(rows[0]) : []), [rows]);
  if (!rows.length)
    return (
      <p className="py-12 text-center text-[13px] text-[#69707d]">
        Aucune donnée sur cette période.
      </p>
    );
  return (
    <div className="max-h-[520px] overflow-auto">
      <table className="w-full whitespace-nowrap text-left text-[12px]">
        <thead className="sticky top-0 bg-[#f1f1ef]">
          <tr>
            {columns.map((c) => (
              <th className="px-3 py-2 font-semibold" key={c}>
                {c.replaceAll("_", " ")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr className="border-t" key={i}>
              {columns.map((c) => (
                <td className="max-w-[300px] truncate px-3 py-2" key={c}>
                  {format(r[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function format(v: unknown) {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return v.toLocaleString("fr-FR");
  if (typeof v === "boolean") return v ? "Oui" : "Non";
  return String(v);
}
function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden border border-[#dfe3e4] bg-white">
      <header className="border-b border-[#e5e8e9] bg-[#fafbfb] px-4 py-3">
        <h2 className="text-[14px] font-semibold text-[#293034]">{title}</h2>
        {subtitle && <p className="text-[11px] text-[#697178]">{subtitle}</p>}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}
