"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import Link from "next/link";
import { ChevronRight, Download } from "lucide-react";
import { API_BASE_URL } from "@/services/api";
import { exportReport, getAnalytics, previewReport, type Analytics } from "@/services/reports";
import { PermissionGuard } from "@/components/permissions/permission-guard";
import { OperationPageHeader } from "@/components/ui/operation-page-header";
import { OperationButton, OperationTab } from "@/components/ui/operation-controls";
import { ErrorState, LoadingState } from "@/components/ui/page-state";
import { getOfficeContext, type OfficeContext } from "@/services/organization-admin";

type ReportTab = "overview" | "packages" | "shipments" | "clients" | "finance" | "offices";
type ReportRow = Record<string, unknown>;

const tabs: Array<{ id: ReportTab; label: string }> = [
  { id: "overview", label: "Vue d’ensemble" },
  { id: "packages", label: "Colis" },
  { id: "shipments", label: "Expéditions" },
  { id: "clients", label: "Clients" },
  { id: "finance", label: "Finances" },
  { id: "offices", label: "Bureaux" },
];

const today = new Date().toISOString().slice(0, 10);
const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
const thirtyDaysAgo = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
const threeMonthsStart = new Date(new Date().getFullYear(), new Date().getMonth() - 2, 1).toISOString().slice(0, 10);

const selectClass = "mt-1 h-10 w-full rounded-full border border-[#cfd4d6] bg-white px-4 text-[13px] text-[#30363a] outline-none focus:border-[#aeb8be]";

export function ReportsAnalyticsPage() {
  const [start, setStart] = useState(currentMonthStart);
  const [end, setEnd] = useState(today);
  const [data, setData] = useState<Analytics | null>(null);
  const [tab, setTab] = useState<ReportTab>("overview");
  const [officeContext, setOfficeContext] = useState<OfficeContext | null>(null);
  const [officeId, setOfficeId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reportRows, setReportRows] = useState<Record<string, ReportRow[]>>({});
  const contentRef = useRef<HTMLDivElement>(null);
  const reportKey = JSON.stringify([tab, start, end, officeId]);
  const cachedRows = reportRows[reportKey];
  const rows = cachedRows ?? [];
  const rowsLoading = cachedRows === undefined;

  function selectTab(nextTab: ReportTab) {
    if (nextTab === tab) return;
    // Only the report pane scrolls; changing tabs never resizes the workspace.
    if (contentRef.current) contentRef.current.scrollTop = 0;
    setTab(nextTab);
  }

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

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    let active = true;
    getOfficeContext().then((context) => {
      if (!active) return;
      setOfficeContext(context);
      setOfficeId(context.selected_office_id || "");
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (tab === "overview" || tab === "offices" || cachedRows !== undefined) return;
    let active = true;
    previewReport(tab, start, end, officeId || undefined)
      .then((result) => { if (active) setReportRows((previous) => ({ ...previous, [reportKey]: result })); })
      .catch(() => { if (active) setReportRows((previous) => ({ ...previous, [reportKey]: [] })); });
    return () => { active = false; };
  }, [tab, start, end, officeId, reportKey, cachedRows]);

  async function download(key: string) {
    const blob = await exportReport(key, start, end, officeId || undefined);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `slaivio-${key}-${start}-${end}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const exportCurrentView = () => {
    if (tab === "offices" && data) {
      exportOffices(data.offices, start, end);
      return;
    }
    void download(tab === "overview" ? "packages" : tab);
  };

  const hasPeriodActivity = Boolean(data && (
    ["clients", "packages", "shipments", "pickups", "weight_kg"].some((key) => Number(data.kpis[key] || 0) > 0) ||
    data.finance.some((item) => item.invoices > 0 || Number(item.collected) > 0)
  ));

  return (
    <div data-ui="reports-workspace" className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-white [&>header]:shrink-0">
      <OperationPageHeader
        title="Rapports & analyses"
        description="Suivez les performances de votre activité Cargo."
        actions={<PermissionGuard permission="reports.export"><OperationButton variant="primary" className="!rounded-full !border-[#111111] !bg-[#111111] !text-white hover:!bg-[#303030]" onClick={exportCurrentView}><Download size={14} />Exporter un rapport</OperationButton></PermissionGuard>}
      />

      <main className="mx-auto flex min-h-0 w-full max-w-[1200px] min-w-0 flex-1 flex-col overflow-hidden px-6 sm:px-8">
        <nav aria-label="Sections des rapports" className="operation-tabs mb-4 flex shrink-0 flex-nowrap items-center gap-0 overflow-x-auto pb-2">
          {tabs.map(({ id, label }) => (
            <OperationTab key={id} active={tab === id} className="!text-[14px]" onClick={() => selectTab(id)}>{label}</OperationTab>
          ))}
        </nav>

        <div className="mb-5 grid min-w-0 shrink-0 gap-3 sm:grid-cols-2">
          <label className="min-w-0 text-[12px] text-[#697178]">Période
            <select aria-label="Période" className={selectClass} value={`${start}|${end}`} onChange={(event) => {
              const [nextStart, nextEnd] = event.target.value.split("|");
              setStart(nextStart);
              setEnd(nextEnd);
            }}>
              <option value={`${currentMonthStart}|${today}`}>Ce mois</option>
              <option value={`${thirtyDaysAgo}|${today}`}>30 derniers jours</option>
              <option value={`${threeMonthsStart}|${today}`}>3 derniers mois</option>
              <option value={`${yearStart}|${today}`}>Cette année</option>
            </select>
          </label>
          <label className="min-w-0 text-[12px] text-[#697178]">Bureau
            <select aria-label="Bureau" className={selectClass} value={officeId} onChange={(event) => setOfficeId(event.target.value)}>
              <option value="">Tous les bureaux autorisés</option>
              {(officeContext?.offices || []).map((office) => <option key={office.location_id} value={office.location_id}>{office.city || office.name}</option>)}
            </select>
          </label>
        </div>

        <div ref={contentRef} data-ui="report-content" role="region" aria-label={`Contenu du rapport — ${tabs.find(({ id }) => id === tab)?.label}`} tabIndex={0} className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain pb-10 outline-none [overflow-anchor:none] [scrollbar-gutter:stable] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#aeb8be]">
        {error && data && <div className="mb-4 border border-[#e7c98d] bg-[#fffaf0] px-4 py-3 text-[13px] text-[#75530b]" role="alert">{error} Les derniers indicateurs disponibles restent affichés.</div>}
        {loading && !data ? <LoadingState label="Calcul des indicateurs…" /> : data ? (
          <div className="min-w-0 space-y-5">
            {!hasPeriodActivity && <div role="status" className="border border-[#dfe3e4] bg-white px-4 py-3 text-[13px] text-[#697178]">Aucune opération n’a été enregistrée sur la période sélectionnée. Les vues d’état courant peuvent toutefois afficher le stock existant.</div>}
            {tab === "overview" && <Overview data={data} />}
            {tab === "packages" && <PackagesView data={data} rows={rows} loading={rowsLoading} onExport={() => void download("packages")} />}
            {tab === "shipments" && <ShipmentsView data={data} rows={rows} loading={rowsLoading} onExport={() => void download("shipments")} />}
            {tab === "clients" && <ClientsView data={data} rows={rows} loading={rowsLoading} onExport={() => void download("clients")} />}
            {tab === "finance" && <FinanceView data={data} rows={rows} loading={rowsLoading} onExport={() => void download("finance")} />}
            {tab === "offices" && <OfficesView offices={data.offices} onExport={() => exportOffices(data.offices, start, end)} />}
          </div>
        ) : (
          <ErrorState title="Analytics indisponibles" description={error || "Aucune donnée analytique n’a pu être chargée."} retry={load} />
        )}
        </div>
      </main>
    </div>
  );
}

function analyticsErrorMessage(error: unknown) {
  if (!axios.isAxiosError(error)) return "Le calcul des indicateurs n’a pas pu être terminé.";
  if (!error.response) {
    if (error.code === "ECONNABORTED") return "La requête Analytics a dépassé le délai d’attente. Vérifiez la disponibilité de l’API et réessayez.";
    const target = API_BASE_URL ? `${API_BASE_URL}/reports/analytics` : "URL de l’API non configurée";
    return `Aucune réponse HTTP de l’API (${target}). Vérifiez l’URL publique du backend, sa disponibilité, le réseau, TLS et CORS.`;
  }
  if (error.response.status === 401) return "Votre session a expiré. Reconnectez-vous pour consulter les indicateurs.";
  if (error.response.status === 403) return "Votre rôle ne possède pas l’autorisation de consulter les Analytics de cette agence.";
  if (error.response.status === 422) return "La période choisie n’est pas valide. Vérifiez les dates de début et de fin.";
  return "Le serveur n’a pas pu calculer les indicateurs. Réessayez après le redéploiement de l’API.";
}

function Overview({ data }: { data: Analytics }) {
  const financeValue = data.finance.length
    ? data.finance.map((row) => `${money(row.collected, row.currency)}`).join(" · ")
    : "0";
  return <>
    <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi title="Colis enregistrés" value={number(data.kpis.packages)} change={change(data.kpis.packages, data.kpis.previous_packages)} />
      <Kpi title="Expéditions" value={number(data.kpis.shipments)} change={change(data.kpis.shipments, data.kpis.previous_shipments)} />
      <Kpi title="Clients actifs" value={number(data.kpis.active_clients)} change={change(data.kpis.active_clients, data.kpis.previous_active_clients)} />
      <Kpi title="Paiements reçus" value={financeValue} change={data.finance.length > 1 ? null : change(Number(data.finance[0]?.collected || 0), Number(data.finance[0]?.previous_collected || 0))} />
    </div>
    <section className="min-w-0" aria-labelledby="activity-chart-title">
      <div className="mb-3">
        <h2 id="activity-chart-title" className="text-[16px] font-semibold text-[#25292e]">Évolution de l’activité</h2>
        <p className="mt-1 text-[13px] text-[#697178]">Colis et expéditions — 6 derniers mois</p>
      </div>
      <ActivityChart data={data.monthly_trend || []} />
    </section>
  </>;
}

function Kpi({ title, value, change: delta }: { title: string; value: React.ReactNode; change: number | "new" | null }) {
  const detail = delta === "new" ? "Nouveau sur la période" : delta === null ? "Plusieurs devises" : `${delta > 0 ? "+" : ""}${delta}% vs période précédente`;
  return <section className="min-w-0 border border-[#dfe3e4] bg-white px-4 py-4">
    <p className="text-[13px] text-[#697178]">{title}</p>
    <p className="mt-3 break-words text-[22px] font-semibold leading-tight text-[#25292e]">{value}</p>
    <p className={`mt-2 text-[12px] ${delta === null ? "text-[#697178]" : delta === "new" || delta >= 0 ? "text-[#16855f]" : "text-[#bd5b3a]"}`}>{detail}</p>
  </section>;
}

function change(current: number | undefined, previous: number | undefined): number | "new" | null {
  const now = Number(current || 0), before = Number(previous || 0);
  if (!before && !now) return 0;
  if (!before) return "new";
  return Math.round(((now - before) / before) * 100);
}

function ActivityChart({ data }: { data: Analytics["monthly_trend"] }) {
  const chart = useMemo(() => {
    const maxValue = Math.max(0, ...data.flatMap((item) => [item.packages, item.shipments]));
    const max = Math.max(4, Math.ceil(maxValue / 40) * 40);
    const left = 48, right = 720, top = 18, bottom = 250;
    const x = (index: number) => data.length <= 1 ? (left + right) / 2 : left + index * (right - left) / (data.length - 1);
    const y = (value: number) => bottom - (value / max) * (bottom - top);
    return { max, left, right, top, bottom, x, y };
  }, [data]);
  const packagePoints = data.map((item, index) => `${chart.x(index)},${chart.y(item.packages)}`).join(" ");
  const shipmentPoints = data.map((item, index) => `${chart.x(index)},${chart.y(item.shipments)}`).join(" ");
  return <div className="min-w-0">
    <svg className="block h-auto w-full" viewBox="0 0 760 320" role="img" aria-label="Évolution mensuelle des colis et des expéditions sur les six derniers mois" preserveAspectRatio="xMidYMid meet">
      {Array.from({ length: 5 }, (_, index) => {
        const value = (chart.max / 4) * (4 - index), y = chart.top + index * ((chart.bottom - chart.top) / 4);
        return <g key={index}><line x1={chart.left} y1={y} x2={chart.right} y2={y} stroke="#e8ebec" strokeDasharray="2 5" /><text x={chart.left - 10} y={y + 4} textAnchor="end" fontSize="11" fill="#687178">{Math.round(value)}</text></g>;
      })}
      {data.length > 0 && <>
        <polyline fill="none" stroke="#f27d4b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={packagePoints} />
        <polyline fill="none" stroke="#f3c746" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={shipmentPoints} />
        {data.map((item, index) => <g key={item.month}>
          <circle cx={chart.x(index)} cy={chart.y(item.packages)} r="3.5" fill="#f27d4b" />
          <circle cx={chart.x(index)} cy={chart.y(item.shipments)} r="3.5" fill="#f3c746" />
          <text x={chart.x(index)} y="278" textAnchor="middle" fontSize="11" fill="#687178">{new Date(`${item.month}T12:00:00`).toLocaleDateString("fr-FR", { month: "short" })}</text>
        </g>)}
      </>}
    </svg>
    {data.length ? <div className="mt-2 flex flex-wrap justify-center gap-x-6 gap-y-2 text-[12px] text-[#59636b]"><span><i className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-[#f27d4b]" />Colis</span><span><i className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-[#f3c746]" />Expéditions</span></div> : <p className="py-10 text-center text-[13px] text-[#697178]">Aucune activité à afficher sur les six derniers mois.</p>}
  </div>;
}

function PackagesView({ data, rows, loading, onExport }: { data: Analytics; rows: ReportRow[]; loading: boolean; onExport: () => void }) {
  const statuses = statusValues(data, "packages", ["Reçus", "Expédiés", "Arrivés", "Livrés"], Number(data.kpis.packages || 0));
  return <ReportView title="Rapport des colis" description="Réception, expédition, arrivée et livraison" onExport={onExport}>
    <SummaryStats items={statuses} columns={2} />
    <StatusChart items={statuses} />
    <ReportRows rows={rows} loading={loading} empty="Aucun colis enregistré sur cette période." kind="packages" />
  </ReportView>;
}

function ShipmentsView({ data, rows, loading, onExport }: { data: Analytics; rows: ReportRow[]; loading: boolean; onExport: () => void }) {
  const statuses = statusValues(data, "shipments", ["Prévues", "En transit", "Arrivées"]);
  return <ReportView title="Rapport des expéditions" description="Départs, arrivées et expéditions en transit" onExport={onExport}>
    <SummaryStats items={statuses} columns={3} />
    <StatusChart items={statuses} />
    <ReportRows rows={rows} loading={loading} empty="Aucune expédition enregistrée sur cette période." kind="shipments" />
  </ReportView>;
}

function ClientsView({ data, rows, loading, onExport }: { data: Analytics; rows: ReportRow[]; loading: boolean; onExport: () => void }) {
  const stats = [{ label: "Clients actifs", value: Number(data.kpis.active_clients || 0) }, { label: "Nouveaux clients", value: Number(data.kpis.clients || 0) }];
  return <ReportView title="Rapport des clients" description="Nouveaux clients et activité" onExport={onExport}>
    <SummaryStats items={stats} columns={2} />
    <section className="min-w-0" aria-label="Évolution des nouveaux clients"><ClientChart data={data.monthly_trend || []} /></section>
    <ReportRows rows={rows} loading={loading} empty="Aucun nouveau client sur cette période." kind="clients" />
  </ReportView>;
}

function FinanceView({ data, rows, loading, onExport }: { data: Analytics; rows: ReportRow[]; loading: boolean; onExport: () => void }) {
  const invoices = data.finance.filter((item) => item.invoices > 0 || Number(item.invoiced) > 0 || Number(item.outstanding) > 0);
  const metrics = [
    { label: "Facturé", value: invoices.length ? invoices.map((row) => money(row.invoiced, row.currency)).join(" · ") : money(0, "USD") },
    { label: "Encaissé", value: invoices.length ? invoices.map((row) => money(row.collected, row.currency)).join(" · ") : money(0, "USD") },
    { label: "Restant à encaisser", value: invoices.length ? invoices.map((row) => money(row.outstanding, row.currency)).join(" · ") : money(0, "USD") },
    { label: "Factures en attente", value: number(invoices.reduce((sum, row) => sum + Number(row.pending_invoices || 0), 0)) },
  ];
  const currency = data.monthly_finance[0]?.currency || data.finance[0]?.currency || "USD";
  const monthly = data.monthly_finance.filter((row) => row.currency === currency);
  return <ReportView title="Rapport financier" description="Facturation, encaissements et soldes" onExport={onExport}>
    <SummaryStats items={metrics} columns={2} />
    <section className="min-w-0" aria-label="Facturation et encaissements par mois"><FinanceChart data={monthly} currency={currency} /></section>
    <ReportRows rows={rows} loading={loading} empty="Aucune facture sur cette période." kind="finance" />
  </ReportView>;
}

function OfficesView({ offices, onExport }: { offices: Analytics["offices"]; onExport: () => void }) {
  return <div className="min-w-0 space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-[16px] font-semibold text-[#25292e]">Performances bureaux</h2><p className="mt-1 text-[13px] text-[#697178]">Activité et résultats par bureau</p></div><PermissionGuard permission="reports.export"><OperationButton onClick={onExport}><Download size={14} />Exporter</OperationButton></PermissionGuard></div>
    {offices.length ? <div className="grid min-w-0 gap-3 lg:grid-cols-2">{offices.map((office) => <section key={office.id} className="min-w-0 border border-[#dfe3e4] bg-white px-4 py-4">
      <div className="mb-4 flex items-center justify-between gap-3"><h3 className="truncate text-[15px] font-semibold text-[#25292e]">{office.name || office.city}</h3><span className="shrink-0 bg-[#f1f2f1] px-2 py-1 text-[11px] text-[#59636b]">{number(office.packages)} colis</span></div>
      <div className="grid gap-3 text-[13px] sm:grid-cols-2"><Metric label="Expéditions" value={number(office.expeditions)} /><Metric label="Paiements reçus" value={office.payments.length ? office.payments.map((payment) => money(payment.amount, payment.currency)).join(" · ") : "0"} /></div>
      <p className="mt-4 border-t border-[#e8ebec] pt-3 text-[12px] text-[#697178]">{office.city} · {office.status === "ACTIVE" ? "Actif" : "Inactif"}</p>
    </section>)}</div> : <EmptyState>Aucun bureau accessible pour cette sélection.</EmptyState>}
  </div>;
}

function ReportView({ title, description, onExport, children }: { title: string; description: string; onExport: () => void; children: React.ReactNode }) {
  return <div className="min-w-0 space-y-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-[16px] font-semibold text-[#25292e]">{title}</h2><p className="mt-1 text-[13px] text-[#697178]">{description}</p></div><PermissionGuard permission="reports.export"><OperationButton onClick={onExport}><Download size={14} />Exporter</OperationButton></PermissionGuard></div>{children}</div>;
}

function SummaryStats({ items, columns }: { items: Array<{ label: string; value: string | number }>; columns: 2 | 3 }) {
  return <div className={`grid min-w-0 grid-cols-2 gap-x-6 gap-y-4 ${columns === 3 ? "md:grid-cols-3" : ""}`}>
    {items.map((item) => <section key={item.label} className="min-w-0 px-2 py-2"><p className="text-[12px] text-[#697178]">{item.label}</p><p className="mt-2 break-words text-[20px] font-semibold text-[#25292e]">{item.value}</p></section>)}
  </div>;
}

function StatusChart({ items }: { items: Array<{ label: string; value: number }> }) {
  const max = Math.max(1, ...items.map((item) => item.value));
  const left = 60, right = 740, top = 18, bottom = 292;
  const slot = (right - left) / items.length, barWidth = Math.min(112, slot * 0.62);
  return <svg className="block h-auto w-full" viewBox="0 0 760 350" role="img" aria-label={items.map(({ label, value }) => `${label}: ${value}`).join(", ")} preserveAspectRatio="xMidYMid meet">
    {Array.from({ length: 5 }, (_, index) => { const value = Math.round(max * (4 - index) / 4), y = top + index * ((bottom - top) / 4); return <g key={index}><line x1={left} x2={right} y1={y} y2={y} stroke="#e8ebec" strokeDasharray="2 5" /><text x={left - 12} y={y + 4} textAnchor="end" fontSize="11" fill="#687178">{value}</text></g>; })}
    {items.map((item, index) => { const height = item.value / max * (bottom - top), x = left + slot * index + (slot - barWidth) / 2; return <g key={item.label}><rect x={x} y={bottom - height} width={barWidth} height={height} rx="7" fill="#f28b55"><title>{`${item.label} : ${item.value}`}</title></rect><text x={x + barWidth / 2} y="320" textAnchor="middle" fontSize="11" fill="#687178">{item.label}</text></g>; })}
  </svg>;
}

function ClientChart({ data }: { data: Analytics["monthly_trend"] }) {
  const maxValue = Math.max(6, Math.ceil(Math.max(0, ...data.map((row) => row.clients)) / 6) * 6);
  const left = 58, right = 740, top = 22, bottom = 272;
  const x = (index: number) => data.length <= 1 ? (left + right) / 2 : left + index * (right - left) / (data.length - 1);
  const y = (value: number) => bottom - value / maxValue * (bottom - top);
  const points = data.map((row, index) => `${x(index)},${y(row.clients)}`).join(" ");
  return <div className="min-w-0">
    <h3 className="mb-3 text-[14px] font-semibold text-[#25292e]">Nouveaux clients par mois</h3>
    <svg className="block h-auto w-full" viewBox="0 0 760 320" role="img" aria-label="Évolution mensuelle des nouveaux clients" preserveAspectRatio="xMidYMid meet">
      {Array.from({ length: 5 }, (_, index) => { const value = Math.round(maxValue * (4 - index) / 4), lineY = top + index * ((bottom - top) / 4); return <g key={index}><line x1={left} x2={right} y1={lineY} y2={lineY} stroke="#e8ebec" strokeDasharray="2 5"/><text x={left - 12} y={lineY + 4} textAnchor="end" fontSize="11" fill="#687178">{value}</text></g>; })}
      {points && <polyline points={points} fill="none" stroke="#f27d4b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
      {data.map((row, index) => <g key={row.month}><circle cx={x(index)} cy={y(row.clients)} r="3.5" fill="#f27d4b" /><text x={x(index)} y="302" textAnchor="middle" fontSize="11" fill="#687178">{new Date(`${row.month}T12:00:00`).toLocaleDateString("fr-FR", { month: "short" })}</text></g>)}
    </svg>
    {!data.length && <p className="text-center text-[13px] text-[#697178]">Aucune activité à afficher sur cette période.</p>}
  </div>;
}

function FinanceChart({ data, currency }: { data: Analytics["monthly_finance"]; currency: string }) {
  const max = Math.max(1, ...data.flatMap((row) => [Number(row.invoiced), Number(row.collected)]));
  return <div className="min-w-0">
    <h3 className="mb-3 text-[14px] font-semibold text-[#25292e]">Facturé et encaissé par mois</h3>
    <svg className="block h-auto w-full" viewBox="0 0 760 350" role="img" aria-label={`Montants facturés et encaissés en ${currency}`} preserveAspectRatio="xMidYMid meet">
      {Array.from({ length: 5 }, (_, index) => { const amount = max * (4 - index) / 4, y = 18 + index * 68; return <g key={index}><line x1="72" x2="740" y1={y} y2={y} stroke="#e8ebec" strokeDasharray="2 5"/><text x="62" y={y + 4} textAnchor="end" fontSize="10" fill="#687178">{new Intl.NumberFormat("fr-FR", { notation: amount >= 1000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(amount)}</text></g>; })}
      {data.map((row, index) => { const slot = data.length ? 668 / data.length : 0, center = 72 + slot * (index + 0.5), width = Math.min(52, slot * 0.3), billed = Number(row.invoiced), collected = Number(row.collected), chartHeight = 272; return <g key={`${row.month}-${row.currency}`}>
        <rect x={center - width - 2} y={290 - billed / max * chartHeight} width={width} height={billed / max * chartHeight} rx="6" fill="#f28b55"><title>{`Facturé : ${money(billed, currency)}`}</title></rect>
        <rect x={center + 2} y={290 - collected / max * chartHeight} width={width} height={collected / max * chartHeight} rx="6" fill="#f5cf4b"><title>{`Encaissé : ${money(collected, currency)}`}</title></rect>
        <text x={center} y="320" textAnchor="middle" fontSize="11" fill="#687178">{new Date(`${row.month}T12:00:00`).toLocaleDateString("fr-FR", { month: "short" })}</text>
      </g>; })}
    </svg>
    <div className="mt-3 flex flex-wrap justify-center gap-x-6 gap-y-2 text-[12px] text-[#59636b]"><span><i className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-[#f28b55]" />Facturé</span><span><i className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-[#f5cf4b]" />Encaissé</span></div>
    {!data.length && <p className="mt-4 text-center text-[13px] text-[#697178]">Aucune activité financière sur les six derniers mois.</p>}
  </div>;
}

function ReportRows({ rows, loading, empty, kind }: { rows: ReportRow[]; loading: boolean; empty: string; kind: ReportTab }) {
  return <section className="min-h-[280px] min-w-0" aria-labelledby="report-data-title" aria-busy={loading}>
    <h3 id="report-data-title" className="mb-3 text-[14px] font-semibold text-[#25292e]">Données du rapport</h3>
    {loading ? <div role="status" aria-label="Chargement du rapport…" className="grid min-w-0 gap-2 md:grid-cols-2">
      <span className="sr-only">Chargement du rapport…</span>
      {Array.from({ length: 6 }, (_, index) => <div key={index} aria-hidden="true" className="flex h-[76px] items-center justify-between gap-3 border border-[#dfe3e4] bg-white px-3 py-3"><div className="w-2/3 animate-pulse space-y-2"><div className="h-3 w-1/2 rounded bg-[#e7ebed]"/><div className="h-3 w-full rounded bg-[#edf0f1]"/></div><div className="h-5 w-16 animate-pulse rounded bg-[#edf0f1]"/></div>)}
    </div> : rows.length ? <div className="grid min-w-0 gap-2 md:grid-cols-2">
      {rows.slice(0, 12).map((row, index) => <ReportRowCard key={String(row.id || row.reference || index)} row={row} index={index} kind={kind} />)}
    </div> : <EmptyState>{empty}</EmptyState>}
  </section>;
}

function ReportRowCard({ row, index, kind }: { row: ReportRow; index: number; kind: ReportTab }) {
  let reference = "", subtitle = "", status = "";
  if (kind === "packages") {
    reference = String(row.package_reference || row.tracking_id || row.reference || `COL-${String(index + 1).padStart(4, "0")}`);
    subtitle = String(row.destination_country || row.warehouse_name || row.description || row.package_type || "Colis");
    status = packageStatusLabel(String(row.status || ""));
  } else if (kind === "shipments") {
    reference = String(row.expedition_reference || row.reference || `EXP-${String(index + 1).padStart(4, "0")}`);
    subtitle = String(row.route_label || [row.origin_city, row.destination_city].filter(Boolean).join(" → ") || "Trajet à préciser");
    status = shipmentStatusLabel(String(row.status || ""));
  } else if (kind === "clients") {
    reference = String(row.client_reference || `CLI-${String(index + 1).padStart(3, "0")}`);
    subtitle = String(row.name || "Client");
    status = String(row.lifecycle_status === "active" ? "Actif" : row.lifecycle_status || "Nouveau").replaceAll("_", " ");
  } else {
    reference = String(row.document_number || row.invoice_number || `FAC-${String(index + 1).padStart(4, "0")}`);
    subtitle = String(row.client_name || "Client");
    status = invoiceStatusLabel(String(row.status || ""));
  }
  const id = row.id ? String(row.id) : "";
  const href = kind === "packages" && id ? `/app/packages?open=${encodeURIComponent(id)}` : kind === "shipments" && id ? `/app/shipments/${encodeURIComponent(id)}` : null;
  const content = <><span className="min-w-0"><span className="block truncate text-[13px] font-medium text-[#25292e]">{reference}</span><span className="mt-1 block truncate text-[12px] text-[#697178]">{subtitle}</span></span><span className="flex shrink-0 items-center gap-2 text-[11px] text-[#59636b]"><span className="max-w-[160px] truncate bg-[#f1f2f1] px-2 py-1">{status}</span><ChevronRight size={14} /></span></>;
  const className = "flex min-w-0 items-center justify-between gap-3 border border-[#dfe3e4] bg-white px-3 py-3 hover:bg-[#fafbfb]";
  return href ? <Link href={href} className={className}>{content}</Link> : <div className={className}>{content}</div>;
}

function statusValues(data: Analytics, key: string, labels: string[], receivedPackages?: number) {
  const raw = data.statuses[key] || [];
  if (!raw.length) return labels.map((label) => ({ label, value: label === "Reçus" && receivedPackages !== undefined ? receivedPackages : 0 }));
  const aliases: Record<string, string[]> = {
    "Reçus": ["RECEIVED", "RECEIVED_AT_ORIGIN", "RECEIVEDAT_ORIGIN"],
    "Expédiés": ["SHIPPED", "DEPARTED", "IN_TRANSIT", "CUSTOMS", "ARRIVED", "ARRIVED_DESTINATION", "CLEARED", "READY_FOR_PICKUP", "AVAILABLE_FOR_PICKUP", "OUT_FOR_DELIVERY", "DELIVERED"],
    "Arrivés": ["ARRIVED", "ARRIVED_DESTINATION", "CLEARED", "READY_FOR_PICKUP", "AVAILABLE_FOR_PICKUP", "OUT_FOR_DELIVERY", "DELIVERED"],
    "Livrés": ["DELIVERED"],
    "Prévues": ["DRAFT", "PREPARING", "LOADING", "READY", "READY_FOR_DEPARTURE"],
    "En transit": ["DISPATCHED", "IN_TRANSIT", "CUSTOMS_CLEARANCE"],
    "Arrivées": ["ARRIVED", "ARRIVED_DESTINATION", "AVAILABLE_FOR_PICKUP", "OUT_FOR_DELIVERY", "DELIVERED"],
  };
  return labels.map((label) => {
    if (label === "Reçus" && receivedPackages !== undefined) return { label, value: receivedPackages };
    const explicit = raw.find((entry) => normalize(entry.label) === normalize(label));
    const matches = raw.filter((entry) => (aliases[label] || []).includes(normalize(entry.label)));
    return { label, value: explicit ? Number(explicit.value) : matches.reduce((sum, entry) => sum + Number(entry.value || 0), 0) };
  });
}

function normalize(value: string) { return value.toUpperCase().replaceAll(/[^A-Z]/g, ""); }
function number(value: number | string | undefined) { return Number(value || 0).toLocaleString("fr-FR"); }
function money(value: string | number, currency: string) {
  try { return new Intl.NumberFormat("fr-FR", { style: "currency", currency, currencyDisplay: "narrowSymbol", maximumFractionDigits: 2 }).format(Number(value || 0)); }
  catch { return `${number(Number(value || 0))} ${currency}`; }
}
function packageStatusLabel(status: string) {
  const labels: Record<string, string> = { RECEIVED: "Reçu", IN_TRANSIT: "En transit", ARRIVED: "Arrivé", ARRIVED_DESTINATION: "Arrivé", AVAILABLE_FOR_PICKUP: "À retirer", DELIVERED: "Livré", PICKED_UP: "Retiré", CANCELLED: "Annulé" };
  return labels[status.toUpperCase()] || status.replaceAll("_", " ").toLowerCase() || "Enregistré";
}
function shipmentStatusLabel(status: string) {
  const labels: Record<string, string> = { DRAFT: "Brouillon", PREPARING: "Prévue", LOADING: "En chargement", READY: "Prête", READY_FOR_DEPARTURE: "Prête au départ", DISPATCHED: "Partie", IN_TRANSIT: "En transit", CUSTOMS_CLEARANCE: "En douane", ARRIVED: "Arrivée", ARRIVED_DESTINATION: "Arrivée", AVAILABLE_FOR_PICKUP: "Disponible au retrait", OUT_FOR_DELIVERY: "En livraison", DELIVERED: "Livrée", CANCELLED: "Annulée", ARCHIVED: "Archivée" };
  return labels[status.toUpperCase()] || status.replaceAll("_", " ").toLowerCase() || "Enregistrée";
}
function invoiceStatusLabel(status: string) {
  const labels: Record<string, string> = { ISSUED: "À payer", PARTIALLY_PAID: "Partiellement payée", PAID: "Payée", OVERDUE: "En retard", DRAFT: "Brouillon", VOID: "Annulée" };
  return labels[status.toUpperCase()] || status.replaceAll("_", " ").toLowerCase() || "Facture";
}
function Metric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><p className="text-[12px] text-[#697178]">{label}</p><p className="mt-1 break-words text-[14px] font-medium text-[#25292e]">{value}</p></div>;
}
function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="border border-[#dfe3e4] bg-white px-4 py-5 text-[13px] text-[#697178]">{children}</p>;
}
function exportOffices(offices: Analytics["offices"], start: string, end: string) {
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const lines = [["Bureau", "Ville", "Statut", "Colis", "Expéditions", "Paiements reçus"], ...offices.map((office) => [office.name, office.city, office.status, String(office.packages), String(office.expeditions), office.payments.map((payment) => `${payment.amount} ${payment.currency}`).join(" | ")])];
  const csv = `\uFEFF${lines.map((line) => line.map((value) => quote(String(value || ""))).join(",")).join("\r\n")}`;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `slaivio-bureaux-${start}-${end}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
