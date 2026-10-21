"use client";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "@/services/api";
import { Download, RefreshCcw, Save } from "lucide-react";
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
import { OperationButton, OperationField, OperationFilterPopover, OperationMetric, OperationMetricGrid } from "@/components/ui/operation-controls";
import { ErrorState, LoadingState } from "@/components/ui/page-state";
import { getOfficeContext, type OfficeContext } from "@/services/organization-admin";
const button =
    "inline-flex h-9 items-center gap-2 rounded-[5px] border border-[#d8dddf] bg-white px-3 text-[13px] font-medium text-[#30363a] hover:bg-[#f5f7f6]",
  primary =
    "inline-flex h-9 items-center gap-2 rounded-[5px] bg-[#167d57] px-3 text-[13px] font-semibold text-white hover:bg-[#116b49]",
  input =
    "h-9 rounded-[5px] border border-[#cfd4d6] bg-white px-3 text-[13px] outline-none focus:border-[#167d57]";
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
    [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
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
  const metricCards = data
    ? [
        ["Nouveaux clients", data.kpis.clients],
        ["Colis reçus", data.kpis.packages],
        ["Expéditions", data.kpis.shipments],
        ["Retraits", data.kpis.pickups],
        [
          "Poids traité",
          `${Number(data.kpis.weight_kg).toLocaleString("fr-FR")} kg`,
        ],
      ]
    : [];
  const hasPeriodActivity = Boolean(data && (
    ["clients", "packages", "shipments", "pickups", "weight_kg"].some((key) => data.kpis[key] > 0) ||
    data.finance.some((row) => row.invoices > 0 || !/^0+(?:\.0+)?$/.test(row.collected))
  ));
  return (
    <div className="min-h-full bg-[#f6f7f7] [&_[data-ui=operation-metrics]]:hidden [&_[data-ui=operation-toolbar]]:hidden [&_.operation-actions>label]:hidden [&_.operation-actions>button:first-of-type]:hidden">
      <OperationPageHeader
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
            <PermissionGuard permission="reports.export"><OperationButton onClick={() => download(tab === "finance" ? "finance" : tab === "shipments" ? "shipments" : tab === "clients" ? "clients" : "packages")}><Download size={14} />Exporter un rapport</OperationButton></PermissionGuard>
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
        <nav aria-label="Sections des rapports" className="operation-tabs flex flex-nowrap items-center gap-0 overflow-x-auto py-2">
          {[["overview", "Vue d’ensemble"], ["operations", "Colis"], ["shipments", "Expéditions"], ["clients", "Clients"], ["finance", "Finances"], ["warehouses", "Bureaux"]].map(([key, label]) => <button key={key} type="button" onClick={() => setTab(key)} className={`rounded-full px-3 py-1.5 text-[12px] font-medium ${tab === key ? "bg-[#111] text-white" : "text-[#59636b] hover:bg-[#f0f2f1]"}`}>{label}</button>)}
        </nav>
      </div>
      <main className="mx-auto w-full max-w-[1200px] px-6 py-5 sm:px-8">
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <label className="text-[11px] text-[#697178]">Période<select aria-label="Période" className={`${input} mt-1 w-full`} value={`${start}|${end}`} onChange={(event) => { const [s, e] = event.target.value.split("|"); setStart(s); setEnd(e); }}>
            <option value={`${new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)}|${today}`}>Ce mois</option><option value={`${monthAgo}|${today}`}>30 derniers jours</option><option value={`${new Date(new Date().getFullYear(), new Date().getMonth() - 2, 1).toISOString().slice(0, 10)}|${today}`}>3 derniers mois</option><option value={`${new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10)}|${today}`}>Cette année</option>
          </select></label>
          <label className="text-[11px] text-[#697178]">Bureau<select aria-label="Bureau" className={`${input} mt-1 w-full`} value={officeId} onChange={(event) => setOfficeId(event.target.value)}><option value="">Tous les bureaux autorisés</option>{(officeContext?.offices || []).map((office) => <option key={office.location_id} value={office.location_id}>{office.city || office.name}</option>)}</select></label>
        </div>
        {data && tab === "overview" && <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Kpi title="Colis enregistrés" value={data.kpis.packages} change={change(data.kpis.packages, data.kpis.previous_packages)} /><Kpi title="Expéditions" value={data.kpis.shipments} change={change(data.kpis.shipments, data.kpis.previous_shipments)} /><Kpi title="Clients actifs" value={data.kpis.active_clients} change={change(data.kpis.active_clients, data.kpis.previous_active_clients)} /><Kpi title="Paiements reçus" value={data.finance.length ? data.finance.map((row) => `${Number(row.collected).toLocaleString("fr-FR")} ${row.currency}`).join(" · ") : "0"} change={data.finance.length === 1 ? change(Number(data.finance[0].collected), Number(data.finance[0].previous_collected)) : null} /></div>}
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
            {tab === "operations" && <Operations data={data} />}{" "}
            {tab === "finance" && <Finance data={data} />}{" "}
            {tab === "routes" && <Routes data={data} />}{" "}
            {tab === "warehouses" && <Warehouses data={data} />}{" "}
            {tab === "clients" && <Clients data={data} />}
            {tab === "shipments" && <Routes data={data} />}
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
function change(current: number, previous: number): number | null {
  if (!previous && !current) return 0;
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}
function Kpi({ title, value, change: delta }: { title: string; value: React.ReactNode; change: number | null }) {
  return <section className="rounded-[8px] border border-[#dfe3e4] bg-white px-4 py-3"><p className="text-[11px] text-[#697178]">{title}</p><p className="mt-2 text-[20px] font-semibold text-[#25292e]">{value}</p><p className={`mt-1 text-[11px] ${delta !== null && delta >= 0 ? "text-[#16855f]" : "text-[#bd5b3a]"}`}>{delta === null ? "Comparaison indisponible" : `${delta > 0 ? "+" : ""}${delta}% vs période précédente`}</p></section>;
}
function Clients({ data }: { data: Analytics }) {
  const active = Number(data.kpis.active_clients || 0);
  return <Card title="Clients actifs" subtitle="Clients ayant eu au moins un colis créé pendant la période sélectionnée"><p className="text-[24px] font-semibold">{active.toLocaleString("fr-FR")}</p></Card>;
}
function Overview({ data }: { data: Analytics }) {
  return (
    <div className="grid gap-4">
      <Card
        title="Activité quotidienne"
        subtitle="Nouveaux clients, colis et expéditions sur la période"
      >
        <MonthlyTrend data={data.monthly_trend || []} />
      </Card>
      <div className="grid gap-4 lg:grid-cols-3">
        {Object.entries(data.statuses).filter(([key])=>key!="dossiers").map(([key, items]) => (
          <Card
            key={key}
            title={`Statuts · ${key}`}
            subtitle="Opérations créées sur la période sélectionnée"
          >
            <Bars items={items} />
          </Card>
        ))}
      </div>
    </div>
  );
}
function MonthlyTrend({ data }: { data: Analytics["monthly_trend"] }) {
  const max = Math.max(1, ...data.flatMap((item) => [item.packages, item.shipments]));
  const points = (key: "packages" | "shipments") => data.map((item, index) => `${35 + index * 126},${210 - (item[key] / max) * 185}`).join(" ");
  return <div className="rounded-[8px] border border-[#dfe3e4] bg-white p-4"><div className="mb-2 flex items-center justify-between"><h2 className="text-[14px] font-semibold">Évolution de l’activité</h2><span className="rounded-full bg-[#f1f2f1] px-2 py-1 text-[10px] text-[#59636b]">6 mois</span></div><svg className="h-[260px] w-full" viewBox="0 0 700 250" role="img" aria-label="Évolution mensuelle des colis et expéditions"><path d="M30 210H680M30 150H680M30 90H680M30 30H680" stroke="#edf0ef" strokeDasharray="2 4"/><polyline fill="none" stroke="#ff784c" strokeWidth="2" points={points("packages")}/><polyline fill="none" stroke="#f0c742" strokeWidth="2" points={points("shipments")}/>{data.map((item,index)=><g key={item.month}><circle cx={35+index*126} cy={210-(item.packages/max)*185} r="3" fill="#ff784c"/><circle cx={35+index*126} cy={210-(item.shipments/max)*185} r="3" fill="#f0c742"/><text x={35+index*126} y="232" textAnchor="middle" fontSize="10" fill="#687178">{new Date(`${item.month}T12:00:00`).toLocaleDateString("fr-FR",{month:"short"})}</text></g>)}</svg><div className="mt-1 flex justify-center gap-5 text-[11px]"><span className="text-[#ff784c]">● Colis</span><span className="text-[#d2a900]">● Expéditions</span></div></div>;
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
function Operations({ data }: { data: Analytics }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {Object.entries(data.statuses).filter(([key])=>key!="dossiers").map(([key, items]) => (
        <Card key={key} title={key} subtitle="Opérations créées sur la période sélectionnée">
          <Bars items={items} />
        </Card>
      ))}
    </div>
  );
}
function Finance({ data }: { data: Analytics }) {
  return (
    <Card
      title="Performance financière"
      subtitle="Factures créées sur la période, encaissements selon la date du paiement et soldes actuels. Les devises restent séparées."
    >
      <Table rows={data.finance} />
    </Card>
  );
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
function Warehouses({ data }: { data: Analytics }) {
  return (
    <Card
      title="Inventaire par entrepôt"
      subtitle="Stock physique actuellement enregistré."
    >
      <Table rows={data.warehouses} />
    </Card>
  );
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
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden border border-[#dfe3e4] bg-white">
      <header className="border-b border-[#e5e8e9] bg-[#fafbfb] px-4 py-3">
        <h2 className="text-[14px] font-semibold text-[#293034]">{title}</h2>
        <p className="text-[11px] text-[#697178]">{subtitle}</p>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}
