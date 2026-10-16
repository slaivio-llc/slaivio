"use client";
import { useResourceLink } from "@/components/ui/use-resource-link";
import { RecordPaymentForm } from "./record-payment-form";
import { FinanceOfficeAssignment } from "./finance-office-assignment";
import { FinanceDuePolicySettings } from "./finance-due-policy-settings";
import { PaymentReverseButton } from "./finance-completion-actions";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { ChevronRight, Download, Plus, RefreshCcw } from "lucide-react";
import { PermissionGuard } from "@/components/permissions/permission-guard";
import { OperationDrawer } from "@/components/ui/operation-drawer";
import { OperationPageHeader } from "@/components/ui/operation-page-header";
import { OperationContent, OperationMetrics, OperationSearch, OperationTable, OperationToolbar } from "@/components/ui/operation-primitives";
import { OperationButton, OperationField, OperationFilterPopover, OperationMetric, OperationMetricGrid } from "@/components/ui/operation-controls";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/page-state";
import { listClients, type ClientRecord } from "@/services/clients";
import { listPackages, type PackageRecord } from "@/services/packages";
import {
  createPackageInvoice,
  createFinance,
  exportFinance,
  financeStats,
  getFinance,
  issueFinance,
  listFinance,
  listFinancePayments,
  listFinanceBalances,
  paymentReceipt,
  voidFinance,
  type FinanceDocument,
  type FinanceStats,
  type FinancePaymentRow,
  type FinanceBalanceRow,
} from "@/services/finance";
const button =
    "inline-flex h-9 items-center justify-center gap-2 rounded-[5px] border border-[#d9dcdf] bg-white px-3 text-[13px] font-medium hover:bg-[#f5f6f6] disabled:opacity-50",
  primary =
    "inline-flex h-9 items-center justify-center gap-2 rounded-[5px] bg-[#16855f] px-3 text-[13px] font-semibold text-white hover:bg-[#126f50] disabled:opacity-50",
  input =
    "h-9 rounded-[5px] border border-[#d8dce0] bg-white px-3 text-[13px] outline-none focus:border-[#16855f]";
const empty: FinanceStats = {
  invoices: 0,
  drafts: 0,
  overdue: 0,
  unpaid_invoice_count: 0,
  partially_paid_invoice_count: 0,
  by_currency: [],
  period: { start_date: "", end_date: "", by_currency: [] },
};
function dateInputValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}
const labels: Record<string, string> = {
  QUOTE: "Devis",
  INVOICE: "Facture",
  CREDIT_NOTE: "Avoir",
  DRAFT: "Brouillon",
  ISSUED: "Émise",
  ACCEPTED: "Accepté",
  PARTIALLY_PAID: "Partiellement payée",
  PAID: "Payée",
  OVERDUE: "En retard",
  VOID: "Annulée",
};
function cash(v: number, c = "USD") {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: c,
  }).format(Number(v || 0));
}
function err(e: unknown) {
  return (
    (e as { response?: { data?: { detail?: string } } })?.response?.data
      ?.detail || "Une erreur est survenue."
  );
}
function packageInvoiceError(e: unknown) {
  const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
  const messages: Record<string, string> = {
    package_not_found: "Ce colis n’est plus disponible dans votre agence. Actualisez la liste et réessayez.",
    package_pricing_required: "Calculez d’abord le tarif du colis dans sa fiche avant de le facturer.",
    package_pricing_inconsistent: "Le tarif enregistré du colis est incohérent. Faites-le vérifier avant facturation.",
    package_pricing_currency_mismatch: "La devise du tarif ne correspond plus à celle du colis. Vérifiez sa tarification.",
    package_legacy_payments_require_reconciliation: "Ce colis contient des paiements historiques à rapprocher avant la création de la facture.",
    package_client_required: "Associez d’abord un client à ce colis.",
    package_version_conflict: "Le colis a changé depuis son chargement. Recherchez-le à nouveau puis réessayez.",
    finance_office_scope_not_supported: "Votre contexte de bureau n’autorise pas encore cette opération financière."
  };
  return (detail && messages[detail]) || err(e);
}
export function FinancePage() {
  const [items, setItems] = useState<FinanceDocument[]>([]),
    [stats, setStats] = useState(empty),
    [q, setQ] = useState(""),
    [status, setStatus] = useState(""),
    [kind, setKind] = useState(""),
    [activeMetric, setActiveMetric] = useState(""),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [create, setCreate] = useState(false),
    [policySettings, setPolicySettings] = useState(false),
    [section, setSection] = useState<"overview" | "invoices" | "payments" | "balances">("overview"),
    [paymentRows, setPaymentRows] = useState<FinancePaymentRow[]>([]),
    [balanceRows, setBalanceRows] = useState<FinanceBalanceRow[]>([]),
    [currency, setCurrency] = useState(""),
    [startDate, setStartDate] = useState(() => dateInputValue(new Date(new Date().getFullYear(), new Date().getMonth(), 1))),
    [endDate, setEndDate] = useState(() => dateInputValue(new Date())),
    [openPaymentOnDetail, setOpenPaymentOnDetail] = useState(false),
    [selected, setSelected] = useState<FinanceDocument | null>(null);
  const closeResourceLink = useResourceLink(getFinance, setSelected, setError);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [a, b, payments, balances] = await Promise.all([
        section === "overview" || section === "invoices" ? listFinance({
          q: q || undefined,
          status: status || undefined,
          document_type: section === "invoices" ? "INVOICE" : kind || undefined,
          page_size: 100,
        }) : Promise.resolve({items:[] as FinanceDocument[],pagination:{total:0}}),
        financeStats({start_date:startDate||undefined,end_date:endDate||undefined}),
        section === "payments" ? listFinancePayments({q:q||undefined,currency:currency||undefined,status:status||undefined,start_date:startDate||undefined,end_date:endDate||undefined,page_size:100}) : Promise.resolve({items:[] as FinancePaymentRow[]}),
        section === "balances" ? listFinanceBalances({q:q||undefined,currency:currency||undefined,page_size:100}) : Promise.resolve({items:[] as FinanceBalanceRow[]}),
      ]);
      setItems(a.items);
      setStats(b);
      setPaymentRows(payments.items);
      setBalanceRows(balances.items);
    } catch (e) {
      setError(err(e));
    } finally {
      setLoading(false);
    }
  }, [q, status, kind, section, currency, startDate, endDate]);
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);
  async function open(id: string, showPayment = false) {
    try {
      const document = await getFinance(id);
      setOpenPaymentOnDetail(showPayment && document.document_type === "INVOICE" && ["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(document.status) && document.balance_due > 0);
      setSelected(document);
    } catch (e) {
      setError(err(e));
    }
  }
  async function runPaymentAction(fn: () => Promise<unknown>) {
    setError("");
    try { await fn(); await load(); }
    catch (cause) { setError(err(cause)); }
  }
  async function downloadPaymentReceipt(payment: FinancePaymentRow) {
    await runPaymentAction(async () => {
      const blob = await paymentReceipt(payment.document_id, payment.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${payment.receipt_number}.html`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }
  async function download() {
    const b = await exportFinance(),
      u = URL.createObjectURL(b),
      a = document.createElement("a");
    a.href = u;
    a.download = "slaivio-facturation.csv";
    a.click();
    URL.revokeObjectURL(u);
  }
  return (
    <div className="min-h-full bg-white">
      <OperationPageHeader
        title="Finance"
        description="Suivez les montants à payer, les paiements reçus, les soldes clients, les factures et les reçus."
        actions={
          <>
            <PermissionGuard permission="finance.settings">
              <button className={button} onClick={() => setPolicySettings(true)}>Conditions de paiement</button>
            </PermissionGuard>
            <PermissionGuard permission="finance.export">
              <button className={button} onClick={download}>
                <Download size={15} />
                Exporter
              </button>
            </PermissionGuard>
            <PermissionGuard permission="finance.create">
              <button className={primary} onClick={() => setCreate(true)}>
                <Plus size={15} />
                Créer une facture
              </button>
            </PermissionGuard>
          </>
        }
      />
      <main>
        <nav aria-label="Sections Finance" className="flex gap-1 overflow-x-auto border-b border-[#e6e8e9] px-6">
          {([["overview","Vue d’ensemble"],["invoices","Factures"],["payments","Paiements"],["balances","Soldes clients"]] as const).map(([key,label])=><button key={key} type="button" aria-current={section===key?"page":undefined} onClick={()=>{setSection(key);setStatus("");setKind("");setActiveMetric("");}} className={`shrink-0 border-b-2 px-3 py-3 text-[13px] ${section===key?"border-[#16855f] font-semibold text-[#126f50]":"border-transparent text-[#68717d] hover:text-[#17212b]"}`}>{label}</button>)}
          <PermissionGuard permission="finance.settings"><button type="button" onClick={()=>setPolicySettings(true)} className="shrink-0 border-b-2 border-transparent px-3 py-3 text-[13px] text-[#68717d] hover:text-[#17212b]">Paramètres</button></PermissionGuard>
        </nav>
        {section === "overview" && <OperationMetrics>
        <OperationMetricGrid>
          {[
            ["Facturé sur la période", stats.period.by_currency.map(row => cash(row.invoiced, row.currency)).join(" · ") || "—"],
            ["Encaissé sur la période", stats.period.by_currency.map(row => cash(row.collected, row.currency)).join(" · ") || "—"],
            ["Solde restant dû", stats.by_currency.map(row => cash(row.outstanding, row.currency)).join(" · ") || "—"],
            ["Exigible aujourd’hui", stats.by_currency.map(row => cash(row.due_now, row.currency)).join(" · ") || "—"],
            ["Factures impayées", stats.unpaid_invoice_count],
            ["Factures partiellement payées", stats.partially_paid_invoice_count],
          ].map(([l, v]) => (
            <OperationMetric key={String(l)} label={String(l)} value={v} active={activeMetric === l} onClick={() => { setActiveMetric(String(l)); setSection("invoices"); setKind("INVOICE"); setStatus(String(l).includes("partiellement") ? "PARTIALLY_PAID" : ""); }} />
          ))}
        </OperationMetricGrid>
        </OperationMetrics>}
        {section === "overview" && <div className="flex flex-wrap items-end gap-3 px-6 pt-4">
          <label className="grid gap-1 text-[11px] text-[#68717d]">Période — du<input aria-label="Début de la période" className={input} type="date" value={startDate} max={endDate || undefined} onChange={event=>setStartDate(event.target.value)} /></label>
          <label className="grid gap-1 text-[11px] text-[#68717d]">Au<input aria-label="Fin de la période" className={input} type="date" value={endDate} min={startDate || undefined} onChange={event=>setEndDate(event.target.value)} /></label>
        </div>}
        {(section === "payments" || section === "balances") && <div className="flex flex-wrap items-end gap-3 px-6 pt-4">
          <label className="grid gap-1 text-[11px] text-[#68717d]">Devise<select className={input} value={currency} onChange={event=>setCurrency(event.target.value)}><option value="">Toutes les devises</option>{stats.by_currency.map(row=><option key={row.currency} value={row.currency}>{row.currency}</option>)}</select></label>
          {section === "payments" && <><label className="grid gap-1 text-[11px] text-[#68717d]">Du<input className={input} type="date" value={startDate} onChange={event=>setStartDate(event.target.value)}/></label><label className="grid gap-1 text-[11px] text-[#68717d]">Au<input className={input} type="date" value={endDate} onChange={event=>setEndDate(event.target.value)}/></label><label className="grid gap-1 text-[11px] text-[#68717d]">État<select className={input} value={status} onChange={event=>setStatus(event.target.value)}><option value="">Tous</option><option value="CONFIRMED">Confirmés</option><option value="REVERSED">Annulés</option></select></label></>}
        </div>}
        <OperationToolbar search={<OperationSearch value={q} onChange={setQ} placeholder="Numéro, client, téléphone…" />} filters={<><OperationFilterPopover activeCount={(status ? 1 : 0) + (kind ? 1 : 0)} onReset={() => { setKind(""); setStatus(""); setActiveMetric(""); }} title="Filtrer la finance"><OperationField label="Type de document"><select className={`${input} w-full`} value={kind} onChange={(event) => { setKind(event.target.value); setActiveMetric(""); }}><option value="">Tous les documents</option><option value="QUOTE">Devis</option><option value="INVOICE">Factures</option><option value="CREDIT_NOTE">Avoirs</option></select></OperationField><OperationField label="État du document"><select className={`${input} w-full`} value={status} onChange={(e) => { setStatus(e.target.value); setActiveMetric(""); }}><option value="">Tous les états</option>{["DRAFT","ISSUED","PARTIALLY_PAID","PAID","OVERDUE","VOID"].map((x) => <option key={x} value={x}>{labels[x]}</option>)}</select></OperationField></OperationFilterPopover><OperationButton onClick={load} aria-label="Actualiser" title="Actualiser" className="w-9 px-0">
              <RefreshCcw size={14} />
            </OperationButton></>} />
        <OperationContent className="pt-4">
          {error && <ErrorState title="Facturation indisponible" description={error} retry={load} />}
        <OperationTable>
          {section === "payments" ? (paymentRows.length ? <table className="w-full min-w-[1120px] text-left text-[13px]"><thead className="bg-[#f6f7f7] text-[#5f6976]"><tr>{["Reçu","Date","Client","Facture","Moyen","Référence","Montant","État","Actions"].map(label=><th key={label} className="px-4 py-3 font-medium">{label}</th>)}</tr></thead><tbody>{paymentRows.map(payment=><tr key={payment.id} className="border-t"><td className="px-4 py-3 font-semibold">{payment.receipt_number}</td><td>{new Date(payment.paid_at).toLocaleDateString("fr-FR")}</td><td>{payment.client_name}</td><td>{payment.document_number}</td><td>{payment.method}</td><td>{payment.reference||"—"}</td><td className="font-semibold">{cash(payment.amount,payment.currency)}</td><td>{payment.status === "CONFIRMED" ? "Confirmé" : "Annulé"}</td><td><div className="flex items-center gap-2 px-2"><button type="button" className="text-xs font-medium text-emerald-700 hover:underline" onClick={()=>open(payment.document_id,true)}>Facture / paiement</button>{payment.status === "CONFIRMED" && <>{payment.receipt_available ? <button type="button" className="text-xs text-slate-600 hover:underline" onClick={()=>downloadPaymentReceipt(payment)}>Reçu</button> : <span className="text-xs text-slate-400">Reçu indisponible</span>}<PaymentReverseButton documentId={payment.document_id} paymentId={payment.id} onRun={(fn)=>{void runPaymentAction(fn);}} /></>}</div></td></tr>)}</tbody></table> : <EmptyState title="Aucun paiement" description="Les paiements confirmés ou annulés selon les filtres apparaîtront ici." />) : section === "balances" ? (balanceRows.length ? <table className="w-full min-w-[800px] text-left text-[13px]"><thead className="bg-[#f6f7f7] text-[#5f6976]"><tr>{["Client","Devise","Factures","Facturé","Payé","Solde","Exigible","Prochaine échéance"].map(label=><th key={label} className="px-4 py-3 font-medium">{label}</th>)}</tr></thead><tbody>{balanceRows.map((balance,index)=><tr key={`${balance.client_id}-${balance.currency}-${index}`} className="border-t"><td className="px-4 py-3 font-semibold">{balance.client_name}</td><td>{balance.currency}</td><td>{balance.invoice_count}</td><td>{cash(balance.invoiced,balance.currency)}</td><td>{cash(balance.paid,balance.currency)}</td><td className="font-semibold">{cash(balance.balance,balance.currency)}</td><td>{cash(balance.due_now,balance.currency)}</td><td>{balance.next_due||"—"}</td></tr>)}</tbody></table> : <EmptyState title="Aucun solde client" description="Aucune facture émise ne correspond aux filtres." />) : loading ? (
            <TableSkeleton rows={7} columns={9} label="Chargement de la facturation…" />
          ) : items.length ? (
            <table className="w-full min-w-[900px] text-left text-[13px]">
              <thead className="bg-[#f6f7f7] text-[#5f6976]">
                <tr>
                  {[
                    "Numéro",
                    "Type",
                    "Client",
                    "Statut",
                    "Total",
                    "Payé",
                    "Solde",
                    "Échéance",
                    "",
                  ].map((x) => (
                    <th key={x} className="px-4 py-3 font-medium">
                      {x}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((x) => (
                  <tr
                    key={x.id}
                    onClick={() => open(x.id)}
                    className="cursor-pointer border-t hover:bg-[#fafafa]"
                  >
                    <td className="px-4 py-3 font-semibold">
                      {x.document_number}
                    </td>
                    <td>{labels[x.document_type]}</td>
                    <td>{x.client_name}</td>
                    <td>
                      <span className="rounded-full bg-[#eef0f2] px-2 py-1 text-[11px]">
                        {labels[x.status] || x.status}
                      </span>
                    </td>
                    <td>{cash(x.total, x.currency)}</td>
                    <td>{cash(x.amount_paid, x.currency)}</td>
                    <td className="font-semibold">
                      {cash(x.balance_due, x.currency)}
                    </td>
                    <td>{x.due_date || "—"}</td>
                    <td className="w-10 pr-4 text-right text-[#8a929a]">
                      <ChevronRight className="ml-auto" size={16} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState title="Aucun document financier" description="Créez le premier devis ou la première facture de l’agence." />
          )}
        </OperationTable>
        </OperationContent>
      </main>
      {create && (
        <CreateModal
          close={() => setCreate(false)}
          done={async (document) => {
            setCreate(false);
            await load();
            if (document?.id) await open(document.id);
          }}
        />
      )}
      <FinanceDuePolicySettings open={policySettings} close={() => setPolicySettings(false)} />
      {selected && (
        <Detail
          key={selected.id}
          item={selected}
          startPayment={openPaymentOnDetail}
          close={() => { setSelected(null); closeResourceLink(); }}
          reload={async () => {
            setSelected(await getFinance(selected.id));
            load();
          }}
        />
      )}
    </div>
  );
}
function CreateModal({ close, done }: { close: () => void; done: (document?: FinanceDocument) => void | Promise<void> }) {
  const [clients, setClients] = useState<ClientRecord[]>([]),
    [mode, setMode] = useState<"manual" | "package">("manual"),
    [packages, setPackages] = useState<PackageRecord[]>([]),
    [packageQuery, setPackageQuery] = useState(""),
    [packageId, setPackageId] = useState(""),
    [packagesLoading, setPackagesLoading] = useState(false),
    [currency, setCurrency] = useState("USD"),
    [lines, setLines] = useState([
      {
        description: "Prestation de transport",
        quantity: 1,
        unit_price: 0,
        discount_rate: 0,
        tax_rate: 0,
      },
    ]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    listClients({ page_size: 100 }).then((r) => setClients(r.items)).catch(()=>setError("Chargement des clients impossible. Rouvrez le formulaire pour réessayer."));
  }, []);
  useEffect(() => {
    if (mode !== "package") return;
    let active = true;
    const timer = setTimeout(() => {
      setPackagesLoading(true);
      listPackages({ q: packageQuery.trim() || undefined, page: 1, page_size: 50 })
        .then((result) => { if (active) setPackages(result.items); })
        .catch((cause) => { if (active) setError(err(cause)); })
        .finally(() => { if (active) setPackagesLoading(false); });
    }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [mode, packageQuery]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "package") {
        const selectedPackage = packages.find((item) => item.id === packageId);
        if (!selectedPackage || !selectedPackage.row_version) throw new Error("Sélectionnez un colis actualisé avant de préparer sa facture.");
        let invoice: FinanceDocument;
        try {
          invoice = await createPackageInvoice(selectedPackage.id, selectedPackage.row_version);
        } catch (cause) {
          setError(packageInvoiceError(cause));
          setBusy(false);
          return;
        }
        await done(invoice);
        return;
      }
      const f = new FormData(e.currentTarget);
      await createFinance({
        document_type: String(f.get("document_type")),
        client_id: String(f.get("client_id")),
        currency: String(f.get("currency")).toUpperCase(),
        due_date: String(f.get("due_date")) || null,
        notes: String(f.get("notes")) || null,
        terms: String(f.get("terms")) || null,
        lines,
      });
      await done();
    } catch (e) {
      setError(err(e));
      setBusy(false);
    }
  }
  return (
    <OperationDrawer
      open
      title="Créer une facture"
      description="Facturez les prestations de transport d’un client, puis enregistrez ses paiements et remettez son reçu."
      close={close}
      width="max-w-3xl"
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="flex gap-2 border-b pb-3" role="group" aria-label="Origine de la facture">
          <button type="button" aria-pressed={mode === "manual"} onClick={() => { setMode("manual"); setError(""); }} className={mode === "manual" ? primary : button}>Facture libre</button>
          <button type="button" aria-pressed={mode === "package"} onClick={() => { setMode("package"); setError(""); }} className={mode === "package" ? primary : button}>Depuis un colis</button>
        </div>
        {mode === "package" ? <section className="space-y-3 rounded-lg border border-slate-200 p-4">
          <div><b className="text-[13px]">Facturer un colis enregistré</b><p className="mt-1 text-xs text-slate-600">La facture reprend le client, la devise et le tarif validé du colis. Aucun montant n’est saisi manuellement.</p></div>
          <label className="grid gap-1 text-[13px]">Rechercher un colis<input className={input} type="search" value={packageQuery} onChange={(event) => { setPackageQuery(event.target.value); setPackageId(""); }} placeholder="Référence, suivi ou nom du client" /></label>
          <label className="grid gap-1 text-[13px]">Colis<select required value={packageId} onChange={(event) => setPackageId(event.target.value)} className={input}>
            <option value="">{packagesLoading ? "Recherche des colis…" : "Sélectionner un colis"}</option>
            {packages.map((item) => <option key={item.id} value={item.id}>{item.package_reference || item.tracking_id || item.id} · {item.client_name || "Client non renseigné"}{item.fees_total == null ? " · Tarif à calculer" : ` · ${cash(item.fees_total, item.currency || "USD")}`}</option>)}
          </select></label>
          {!packagesLoading && !packages.length && <p className="text-xs text-slate-500">Aucun colis trouvé dans votre périmètre. Vérifiez la référence ou vos droits d’accès aux colis.</p>}
          {(() => { const item = packages.find((candidate) => candidate.id === packageId); if (!item) return null; const priced = item.fees_total != null && Boolean(item.pricing_snapshot); return <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-700"><p><strong>Client :</strong> {item.client_name || "Non renseigné"}</p><p><strong>Tarif :</strong> {priced ? cash(item.fees_total!, item.currency || "USD") : "À calculer dans le module Colis avant facturation"}</p>{!item.client_id && <p className="mt-2 text-amber-700">Ce colis n’a pas de client associé ; sa facture ne peut pas être préparée.</p>}{priced && <p className="mt-2">Le brouillon sera ouvert après sa création. Émettez-le depuis sa fiche pour qu’il soit pris en compte au départ.</p>}</div>; })()}
        </section> : <>
        <div className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="document_type" value="INVOICE"/>
          <label className="grid gap-1 text-[13px]">Client<select required name="client_id" className={input}>
            <option value="">Sélectionner un client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.display_name || c.name || c.company_name || c.phone}
              </option>
            ))}
          </select></label>
          <label className="grid gap-1 text-[13px]">Devise<select required name="currency" value={currency} onChange={event=>setCurrency(event.target.value)} className={input}>{["USD","EUR","CDF","AOA","CNY","XOF","XAF"].map(code=><option key={code}>{code}</option>)}</select></label>
          <label className="grid gap-1 text-[13px]">Échéance (optionnelle)<input name="due_date" type="date" className={input} /></label>
        </div>
        <section className="space-y-3 rounded-lg bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <b className="text-[13px]">Prestations facturées</b>
              <p className="mt-1 text-xs text-slate-600">Pour chaque prestation, indiquez la quantité et le prix par unité. Le montant est calculé automatiquement.</p>
            </div>
            <button
              type="button"
              className={button}
              onClick={() =>
                setLines([
                  ...lines,
                  {
                    description: "",
                    quantity: 1,
                    unit_price: 0,
                    discount_rate: 0,
                    tax_rate: 0,
                  },
                ])
              }
            >
              Ajouter une ligne
            </button>
          </div>
          {lines.map((l, i) => (
            <div key={i} className="grid gap-3 rounded-lg bg-white p-3 sm:grid-cols-2 lg:grid-cols-[minmax(180px,2fr)_minmax(90px,.7fr)_minmax(120px,1fr)_minmax(100px,.8fr)_auto]">
              <label className="grid gap-1 text-xs font-medium text-slate-700">Prestation<input required aria-label={`Prestation ${i+1}`} className={input} value={l.description} onChange={(e)=>setLines(lines.map((x,j)=>j===i?{...x,description:e.target.value}:x))} placeholder="Ex. Transport du colis"/></label>
              <label className="grid gap-1 text-xs font-medium text-slate-700">Quantité<input required aria-label={`Quantité ${i+1}`} type="number" step="0.001" min="0.001" className={input} value={l.quantity} onChange={(e)=>setLines(lines.map((x,j)=>j===i?{...x,quantity:Number(e.target.value)}:x))}/></label>
              <label className="grid gap-1 text-xs font-medium text-slate-700">Prix unitaire<input required aria-label={`Prix unitaire ${i+1}`} type="number" step="0.01" min="0" className={input} value={l.unit_price} onChange={(e)=>setLines(lines.map((x,j)=>j===i?{...x,unit_price:Number(e.target.value)}:x))}/></label>
              <label className="grid gap-1 text-xs font-medium text-slate-700">Taxe (%)<input aria-label={`Taxe ${i+1}`} type="number" min="0" max="100" step="0.01" className={input} value={l.tax_rate} onChange={(e)=>setLines(lines.map((x,j)=>j===i?{...x,tax_rate:Number(e.target.value)}:x))}/></label>
              <div className="flex items-end justify-between gap-3 lg:flex-col lg:items-end lg:justify-center">
                <span className="text-xs text-slate-500">Montant</span>
                <strong className="text-sm">{cash(l.quantity*l.unit_price*(1+l.tax_rate/100),currency)}</strong>
                {lines.length>1&&<button type="button" className="text-xs text-red-600 hover:underline" onClick={()=>setLines(lines.filter((_,j)=>j!==i))}>Retirer</button>}
              </div>
            </div>
          ))}
        </section>
        <textarea
          name="notes"
          className="min-h-16 w-full rounded bg-slate-50 p-3 text-[13px] outline-none focus:ring-2 focus:ring-emerald-700"
          placeholder="Notes internes ou visibles sur le document"
        />
        <textarea
          name="terms"
          className="min-h-16 w-full rounded bg-slate-50 p-3 text-[13px] outline-none focus:ring-2 focus:ring-emerald-700"
          placeholder="Conditions de règlement"
        />
        </>}
        {error && <p className="text-[13px] text-red-600">{error}</p>}
        <button disabled={busy || (mode === "package" && (packagesLoading || !packageId))} className={`${primary} w-full`}>
          {busy ? "Création…" : mode === "package" ? "Préparer la facture du colis" : "Créer le brouillon"}
        </button>
      </form>
    </OperationDrawer>
  );
}
function Detail({
  item,
  close,
  reload,
  startPayment = false,
}: {
  item: FinanceDocument;
  close: () => void;
  reload: () => void | Promise<void>;
  startPayment?: boolean;
}) {
  const [paymentOpen, setPaymentOpen] = useState(startPayment);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      await reload();
    } catch (e) {
      setError(err(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <OperationDrawer
      open
      title={item.document_number}
      description={`${labels[item.document_type]} · ${item.client_name} · ${labels[item.status]}`}
      close={close}
    >
      <div className="space-y-4 p-5">
        {!(item as FinanceDocument & {office_id?:string|null}).office_id && <PermissionGuard permission="finance.settings"><FinanceOfficeAssignment documentId={item.id} version={item.row_version} onSaved={reload} /></PermissionGuard>}
        <section className="grid grid-cols-3 gap-3">
          {[
            ["Total", cash(item.total, item.currency)],
            ["Payé", cash(item.amount_paid, item.currency)],
            ["Solde", cash(item.balance_due, item.currency)],
          ].map(([l, v]) => (
            <div key={l} className="rounded bg-white p-4">
              <small>{l}</small>
              <b className="block text-lg">{v}</b>
            </div>
          ))}
        </section>
        <section className="rounded bg-white p-4">
          <h3 className="mb-3 font-semibold">Détail</h3>
          {item.lines?.map((l, i) => (
            <div
              key={i}
              className="flex justify-between border-t py-3 text-[13px]"
            >
              <span>
                {l.description} · {l.quantity} ×{" "}
                {cash(l.unit_price, item.currency)}
              </span>
              <b>{cash(l.line_total || 0, item.currency)}</b>
            </div>
          ))}
        </section>
        <div className="flex flex-wrap gap-2">
          {item.status === "DRAFT" && (
            <PermissionGuard permission="finance.issue">
              <button
                disabled={busy}
                className={primary}
                onClick={() =>
                  run(() => issueFinance(item.id, item.row_version))
                }
              >
                Émettre
              </button>
            </PermissionGuard>
          )}
          {item.document_type === "INVOICE" &&
            ["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(item.status) && (
              <PermissionGuard permission="finance.payments">
                <button
                  disabled={busy}
                  className={primary}
                  onClick={() => setPaymentOpen(true)}
                >
                  Enregistrer un paiement
                </button>
              </PermissionGuard>
            )}
          {["DRAFT", "ISSUED"].includes(item.status) &&
            item.amount_paid === 0 && (
              <PermissionGuard permission="finance.void">
                <button
                  disabled={busy}
                  className={button}
                  onClick={() => {
                    const reason = window.prompt(
                      "Motif obligatoire de l’annulation",
                    );
                    if (reason)
                      run(() => voidFinance(item.id, item.row_version, reason));
                  }}
                >
                  Annuler
                </button>
              </PermissionGuard>
            )}
        </div>
        {paymentOpen && <PermissionGuard permission="finance.payments"><RecordPaymentForm document={item} onCancel={() => setPaymentOpen(false)} onRecorded={async () => { await reload(); setPaymentOpen(false); }} /></PermissionGuard>}
        {item.payments?.length ? (
          <section className="rounded bg-white p-4">
            <h3 className="mb-2 font-semibold">Paiements et reçus</h3>
            {item.payments.map((p) => (
              <div
                key={p.id}
                className="flex justify-between border-t py-3 text-[13px]"
              >
                <span>
                  {p.receipt_number} · {p.method === "MANUAL" ? "Enregistré par l’agence" : p.method}
                  {p.status === "REVERSED" && <span className="ml-2 text-red-700">Annulé</span>}
                  {p.provider === "SASPAY" && <small className="block text-slate-500">
                    Débité client {p.provider_charged == null ? "—" : cash(p.provider_charged, p.currency)} · frais {p.provider_fee == null ? "—" : cash(p.provider_fee, p.currency)} · net agence {p.provider_net_amount == null ? "—" : cash(p.provider_net_amount, p.currency)} ({p.fee_charge_mode || "—"})
                  </small>}
                </span>
                <b>{cash(p.amount, p.currency)}</b>
                {p.status === "CONFIRMED" && p.receipt_snapshot ? <button type="button" disabled={busy} className={button} onClick={() => run(async () => {
                  const blob = await paymentReceipt(item.id, p.id);
                  const url = URL.createObjectURL(blob);
                  const anchor = document.createElement("a");
                  anchor.href = url; anchor.download = `${p.receipt_number}.html`; anchor.click();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                })}>Télécharger le reçu</button> : p.status === "CONFIRMED" ? <span className="text-xs text-slate-500">Reçu historique non disponible</span> : null}
              </div>
            ))}
          </section>
        ) : null}
        {error && <p className="rounded bg-red-50 p-3 text-red-700">{error}</p>}
      </div>
    </OperationDrawer>
  );
}
