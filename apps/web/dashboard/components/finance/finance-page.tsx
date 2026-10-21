"use client";
import { useResourceLink } from "@/components/ui/use-resource-link";
import { RecordPaymentForm } from "./record-payment-form";
import { FinanceOfficeAssignment } from "./finance-office-assignment";
import { FinanceSettingsOverview } from "./finance-settings-overview";
import { PaymentReverseButton } from "./finance-completion-actions";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, CalendarDays, Download, HandCoins, Plus, ReceiptText, RefreshCcw, Search, Share2, Users, Wallet } from "lucide-react";
import { PermissionGuard } from "@/components/permissions/permission-guard";
import { OperationDrawer } from "@/components/ui/operation-drawer";
import { OperationPageHeader } from "@/components/ui/operation-page-header";
import { OperationContent, OperationSearch, OperationToolbar } from "@/components/ui/operation-primitives";
import { OperationButton, OperationField, OperationFilterPopover } from "@/components/ui/operation-controls";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/page-state";
import { listClients, type ClientRecord } from "@/services/clients";
import { listPackages, pricePackage, type PackageRecord } from "@/services/packages";
import {
  createPackageInvoice,
  createFinance,
  exportFinance,
  financeStats,
  financePrint,
  getFinance,
  getPackageInvoice,
  issueFinance,
  listFinance,
  listFinancePayments,
  paymentReceipt,
  voidFinance,
  type FinanceDocument,
  type FinanceStats,
  type FinancePaymentRow,
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
  const detail = (e as { response?: { data?: { detail?: string | { code?: string; field?: string } } } })?.response?.data?.detail;
  const code = typeof detail === "string" ? detail : detail?.code;
  const messages: Record<string, string> = {
    pricing_input_required: "Une mesure requise par la grille tarifaire manque sur le colis (poids, volume ou valeur déclarée).",
    package_route_required_for_pricing: "Aucun trajet n’est associé au colis. Rattachez-le d’abord à un trajet configuré.",
    no_active_pricing_grid: "Aucune grille tarifaire active ne couvre ce service et ce trajet. Vérifiez Gestion > Tarification.",
    package_weight_required: "Le poids ou le volume nécessaire au calcul du tarif manque dans la fiche du colis.",
    route_service_mismatch: "Le service sélectionné n’est pas proposé sur le trajet de ce colis.",
    no_matching_pricing_rule: "Aucune règle tarifaire ne correspond au type de marchandise ou de colis. Vérifiez la configuration du service.",
    pricing_grid_has_no_price_rules: "La grille tarifaire de ce service ne contient pas encore de règle de prix.",
    manual_quote_required: "Ce colis nécessite un devis manuel avant facturation.",
    package_not_found: "Ce colis n’est plus disponible dans votre agence. Actualisez la liste et réessayez.",
    package_pricing_required: "Calculez d’abord le tarif du colis dans sa fiche avant de le facturer.",
    package_pricing_inconsistent: "Le tarif enregistré du colis est incohérent. Faites-le vérifier avant facturation.",
    package_pricing_currency_mismatch: "La devise du tarif ne correspond plus à celle du colis. Vérifiez sa tarification.",
    package_legacy_payments_require_reconciliation: "Ce colis contient des paiements historiques à rapprocher avant la création de la facture.",
    package_client_required: "Associez d’abord un client à ce colis.",
    package_version_conflict: "Le colis a changé depuis son chargement. Recherchez-le à nouveau puis réessayez.",
    finance_office_scope_not_supported: "Votre contexte de bureau n’autorise pas encore cette opération financière."
  };
  return (code && messages[code]) || err(e);
}
export function FinancePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<FinanceDocument[]>([]),
    [stats, setStats] = useState(empty),
    [q, setQ] = useState(""),
    [status, setStatus] = useState(""),
    [kind, setKind] = useState(""),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [create, setCreate] = useState(false),
    [section, setSection] = useState<"overview" | "invoices" | "payments" | "balances" | "settings">("overview"),
    [paymentRows, setPaymentRows] = useState<FinancePaymentRow[]>([]),
    [periodPreset, setPeriodPreset] = useState("month"),
    [startDate, setStartDate] = useState(() => dateInputValue(new Date(new Date().getFullYear(), new Date().getMonth(), 1))),
    [endDate, setEndDate] = useState(() => dateInputValue(new Date())),
    [openPaymentOnDetail, setOpenPaymentOnDetail] = useState(false),
    [paymentChooserOpen, setPaymentChooserOpen] = useState(false),
    [paymentCandidates, setPaymentCandidates] = useState<FinanceDocument[]>([]),
    [paymentCandidatesLoading, setPaymentCandidatesLoading] = useState(false),
    [paymentSelectionId, setPaymentSelectionId] = useState(""),
    [selectedPayment, setSelectedPayment] = useState<FinancePaymentRow | null>(null),
    [selected, setSelected] = useState<FinanceDocument | null>(null);
  const closeResourceLink = useResourceLink(getFinance, setSelected, setError);
  useEffect(() => {
    const requested = searchParams.get("section");
    if (requested === "overview" || requested === "invoices" || requested === "payments" || requested === "balances" || requested === "settings") {
      setSection(requested);
    } else if (requested === null) {
      setSection("overview");
    }
  }, [searchParams]);
  function selectSection(next: "overview" | "invoices" | "payments" | "balances" | "settings") {
    setSection(next);
    setStatus(""); setKind("");
    router.replace(`/app/finance?section=${next}`, { scroll: false });
  }
  function changePeriod(preset: string) {
    const now = new Date();
    let start = new Date(now.getFullYear(), now.getMonth(), 1);
    let end = now;
    if (preset === "previous-month") {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (preset === "year") {
      start = new Date(now.getFullYear(), 0, 1);
    }
    setPeriodPreset(preset);
    setStartDate(dateInputValue(start));
    setEndDate(dateInputValue(end));
  }
  async function download() {
    const blob = await exportFinance();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "slaivio-facturation.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }
  const load = useCallback(async () => {
    if (section === "settings") { setLoading(false); return; }
    setLoading(true);
    setError("");
    try {
      const [a, b, payments] = await Promise.all([
        section === "overview" || section === "invoices" || section === "balances" ? listFinance({
          q: q || undefined,
          status: status || undefined,
          document_type: section === "overview" ? kind || undefined : "INVOICE",
          page_size: 100,
        }) : Promise.resolve({items:[] as FinanceDocument[],pagination:{total:0}}),
        financeStats({start_date:startDate||undefined,end_date:endDate||undefined}),
        section === "payments" || section === "overview" ? listFinancePayments({q:section === "payments" ? q||undefined : undefined,status:section === "payments" ? status||undefined : undefined,start_date:startDate||undefined,end_date:endDate||undefined,page_size:100}).catch(() => ({items:[] as FinancePaymentRow[]})) : Promise.resolve({items:[] as FinancePaymentRow[]}),
      ]);
      setItems(a.items);
      setStats(b);
      setPaymentRows(payments.items);
    } catch (e) {
      setError(err(e));
    } finally {
      setLoading(false);
    }
  }, [q, status, kind, section, startDate, endDate]);
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
  async function openPaymentChooser() {
    setPaymentChooserOpen(true);
    setPaymentCandidatesLoading(true);
    try {
      const result = await listFinance({ document_type: "INVOICE", page_size: 100 });
      const payable = result.items.filter(item => ["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(item.status) && item.balance_due > 0);
      setPaymentCandidates(payable);
      setPaymentSelectionId(current => payable.some(item => item.id === current) ? current : payable[0]?.id || "");
    } catch (cause) {
      setError(err(cause));
      setPaymentCandidates([]);
    } finally {
      setPaymentCandidatesLoading(false);
    }
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
  return (
    <div className="min-h-full bg-white">
      <OperationPageHeader
        title="Finance"
        description="Factures, paiements reçus et soldes clients."
        actions={section !== "settings" ? <div className="flex flex-wrap items-center gap-2">{(section === "payments" || section === "balances") && <PermissionGuard permission="finance.export"><button className={button} onClick={download}><Download size={14}/>Exporter</button></PermissionGuard>}<PermissionGuard permission="finance.payments"><button className={primary} onClick={() => void openPaymentChooser()}><Plus size={15}/>Enregistrer un paiement</button></PermissionGuard></div> : undefined}
      />
      <main>
        <nav aria-label="Sections Finance" className="mx-auto flex w-full max-w-[1200px] gap-2 overflow-x-auto px-6 py-2 sm:px-8">
          {([["overview","Vue d’ensemble"],["invoices","Factures"],["payments","Paiements"],["balances","Soldes clients"],["settings","Paramètres"]] as const).map(([key,label])=><button key={key} type="button" aria-current={section===key?"page":undefined} onClick={()=>selectSection(key)} className={`shrink-0 rounded-full px-3 py-2 text-[12px] transition-colors ${section===key?"bg-[#111111] font-semibold text-white":"text-[#68717d] hover:bg-[#f2f3f3] hover:text-[#17212b]"}`}>{label}</button>)}
        </nav>
        {section === "overview" ? <FinanceOverview loading={loading} stats={stats} payments={paymentRows.slice(0,4)} onViewAll={() => selectSection("payments")} onNewInvoice={() => setCreate(true)} onBalances={() => selectSection("balances")} onOpenPayment={id => void open(id,true)} periodPreset={periodPreset} onPeriodChange={changePeriod} error={error}/> : section === "invoices" ? <FinanceInvoices loading={loading} error={error} items={items} query={q} setQuery={setQ} onCreate={() => setCreate(true)} onOpen={id => void open(id)}/> : section === "balances" ? <FinanceBalances loading={loading} error={error} items={items} query={q} setQuery={setQ} onOpen={id => void open(id)}/> : section === "settings" ? <PermissionGuard permission="finance.settings"><FinanceSettingsOverview/></PermissionGuard> : <>
        <OperationToolbar search={<OperationSearch value={q} onChange={setQ} placeholder={section === "payments" ? "Rechercher un paiement…" : "Numéro, client, téléphone…"} />} filters={<><OperationFilterPopover activeCount={section === "payments" ? (status ? 1 : 0) : (status ? 1 : 0) + (kind ? 1 : 0)} onReset={() => { setKind(""); setStatus(""); }} title={section === "payments" ? "Filtrer les paiements" : "Filtrer la finance"}>{section === "payments" ? <OperationField label="État du paiement"><select className={`${input} w-full`} value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Tous</option><option value="CONFIRMED">Confirmés</option><option value="REVERSED">Annulés</option></select></OperationField> : <><OperationField label="Type de document"><select className={`${input} w-full`} value={kind} onChange={(event) => setKind(event.target.value)}><option value="">Tous les documents</option><option value="QUOTE">Devis</option><option value="INVOICE">Factures</option><option value="CREDIT_NOTE">Avoirs</option></select></OperationField><OperationField label="État du document"><select className={`${input} w-full`} value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Tous les états</option>{["DRAFT","ISSUED","PARTIALLY_PAID","PAID","OVERDUE","VOID"].map((x) => <option key={x} value={x}>{labels[x]}</option>)}</select></OperationField></>}</OperationFilterPopover><OperationButton onClick={load} aria-label="Actualiser" title="Actualiser" className="w-9 px-0">
              <RefreshCcw size={14} />
            </OperationButton></>} />
        <OperationContent className="pt-4">
          {error && <ErrorState title="Facturation indisponible" description={error} retry={load} />}
          {loading ? <TableSkeleton rows={4} columns={1} label="Chargement des paiements…" /> : paymentRows.length ? <div className="grid gap-2">{paymentRows.map(payment=><div key={payment.id} className="flex w-full items-center justify-between gap-4 rounded-[7px] border border-[#dfe2e4] bg-white px-3 py-3 transition hover:bg-[#fafbfb] sm:px-4"><button type="button" onClick={()=>setSelectedPayment(payment)} className="min-w-0 flex-1 text-left"><strong className="block truncate text-[13px] font-semibold text-[#273039]">{payment.client_name}</strong><span className="mt-0.5 block truncate text-[11px] text-[#78828a]">{payment.receipt_number} · {payment.method === "MANUAL" ? "Paiement manuel" : payment.method} · {new Date(payment.paid_at).toLocaleDateString("fr-FR",{day:"numeric",month:"short"})}</span></button><span className="shrink-0 text-right"><strong className="block text-[13px] font-medium text-[#273039]">{cash(payment.amount,payment.currency)}</strong><span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${payment.status === "CONFIRMED" ? "bg-[#e0f5e9] text-[#16834d]" : "bg-[#fce8e6] text-[#b42318]"}`}>{payment.status === "CONFIRMED" ? "Confirmé" : "Annulé"}</span></span><div className="hidden items-center gap-2 md:flex">{payment.status === "CONFIRMED" && <>{payment.receipt_available ? <button type="button" className="text-xs text-slate-600 hover:underline" onClick={()=>void downloadPaymentReceipt(payment)}>Reçu</button> : <span className="text-xs text-slate-400">Reçu indisponible</span>}<PaymentReverseButton documentId={payment.document_id} paymentId={payment.id} onRun={(fn)=>{void runPaymentAction(fn);}} /></>}</div></div>)}</div> : <EmptyState title="Aucun paiement" description="Les paiements correspondant à cette recherche apparaîtront ici." />}
        </OperationContent>
        </>}
      </main>
      {selectedPayment && <PaymentDetail payment={selectedPayment} close={() => setSelectedPayment(null)} onOpenInvoice={() => { const id=selectedPayment.document_id; setSelectedPayment(null); void open(id,true); }} onReceipt={downloadPaymentReceipt} onReverse={fn => runPaymentAction(fn)} onChanged={load}/>}
      <OperationDrawer open={paymentChooserOpen} close={() => setPaymentChooserOpen(false)} title="Enregistrer un paiement" description="Saisissez le montant reçu et confirmez les détails de l’encaissement manuel." width="max-w-[560px]">
        {paymentCandidatesLoading ? <TableSkeleton rows={3} columns={2} label="Chargement des factures…"/> : paymentCandidates.length ? <div className="space-y-4 p-4">
          <label className="grid gap-1.5 text-[12px] font-medium text-[#303941]">Facture concernée *<select className={input} value={paymentSelectionId} onChange={event => setPaymentSelectionId(event.target.value)}>{paymentCandidates.map(item=><option key={item.id} value={item.id}>{item.document_number} — {item.client_name}</option>)}</select></label>
          {paymentCandidates.find(item=>item.id===paymentSelectionId) ? <RecordPaymentForm key={paymentSelectionId} document={paymentCandidates.find(item=>item.id===paymentSelectionId)!} onCancel={() => setPaymentChooserOpen(false)} onRecorded={async () => { await load(); setPaymentChooserOpen(false); }}/> : null}
        </div> : <div className="p-4"><EmptyState title="Aucune facture à encaisser" description="Les factures émises avec un solde restant apparaîtront ici."/></div>}
      </OperationDrawer>
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
      {selected && (
        <Detail
          key={selected.id}
          item={selected}
          startPayment={openPaymentOnDetail}
          close={() => { setSelected(null); setOpenPaymentOnDetail(false); closeResourceLink(); }}
          reload={async () => {
            setSelected(await getFinance(selected.id));
            load();
          }}
        />
      )}
    </div>
  );
}

function FinanceInvoices({loading,error,items,query,setQuery,onCreate,onOpen}:{loading:boolean;error:string;items:FinanceDocument[];query:string;setQuery:(value:string)=>void;onCreate:()=>void;onOpen:(id:string)=>void}) {
  const statusStyle:Record<string,string>={PAID:"bg-[#dcf5e6] text-[#148344]",PARTIALLY_PAID:"bg-[#fff0dc] text-[#d87320]",OVERDUE:"bg-[#fde7e7] text-[#b43e3e]",ISSUED:"bg-[#f0f1f2] text-[#505a62]",DRAFT:"bg-[#f0f1f2] text-[#68727a]",VOID:"bg-[#f0f1f2] text-[#68727a]"};
  return <OperationContent className="pt-3">
    <div className="flex justify-end"><PermissionGuard permission="finance.create"><button type="button" onClick={onCreate} className={primary}><Plus size={14}/>Nouvelle facture</button></PermissionGuard></div>
    <label className="mt-3 flex h-10 w-full items-center gap-2 rounded-full border border-[#d8dde0] bg-white px-4 focus-within:border-[#aeb8be]"><Search size={15} className="shrink-0 text-[#7b858c]"/><input aria-label="Rechercher un client ou une facture" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Rechercher un client ou une facture…" className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-[#8b949a]"/></label>
    {error&&<div role="alert" className="mt-3 rounded-[8px] bg-[#fff5f4] p-3 text-[12px] text-[#9d352d]">{error}</div>}
    {loading?<div className="mt-3"><TableSkeleton rows={4} columns={2} label="Chargement des factures…"/></div>:items.length?<div className="mt-2 grid gap-1.5">{items.map(item=><button key={item.id} type="button" onClick={()=>onOpen(item.id)} className="flex min-h-[62px] w-full items-center justify-between gap-4 rounded-[8px] border border-[#dfe3e6] bg-white px-3 py-2.5 text-left transition hover:bg-[#fafbfb]"><span className="min-w-0"><strong className="block truncate text-[12px] font-medium text-[#303941]">{item.client_name}</strong><span className="mt-1 block truncate text-[10px] text-[#7a848b]">{item.document_number} · Total {cash(item.total,item.currency)}</span></span><span className="shrink-0 text-right"><strong className="block text-[11px] font-medium text-[#303941]">{cash(item.balance_due,item.currency)} restant</strong><span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[9px] font-medium ${statusStyle[item.status]||statusStyle.ISSUED}`}>{labels[item.status]||item.status}</span></span></button>)}</div>:<div className="mt-3 rounded-[8px] border border-[#e2e5e7] p-5"><EmptyState title="Aucune facture" description="Les factures correspondant à votre recherche apparaîtront ici."/></div>}
  </OperationContent>;
}

function FinanceBalances({loading,error,items,query,setQuery,onOpen}:{loading:boolean;error:string;items:FinanceDocument[];query:string;setQuery:(value:string)=>void;onOpen:(id:string)=>void}) {
  const statusStyle:Record<string,string>={PAID:"bg-[#dcf5e6] text-[#148344]",PARTIALLY_PAID:"bg-[#fff0dc] text-[#d87320]",OVERDUE:"bg-[#fde7e7] text-[#b43e3e]",ISSUED:"bg-[#f0f1f2] text-[#505a62]",DRAFT:"bg-[#f0f1f2] text-[#68727a]",VOID:"bg-[#f0f1f2] text-[#68727a]"};
  return <OperationContent className="pt-3">
    <label className="mt-3 flex h-10 w-full items-center gap-2 rounded-full border border-[#d8dde0] bg-white px-4 focus-within:border-[#aeb8be]"><Search size={15} className="shrink-0 text-[#7b858c]"/><input aria-label="Rechercher un client ou une facture" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Rechercher un client ou une facture…" className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-[#8b949a]"/></label>
    {error&&<div role="alert" className="mt-3 rounded-[8px] bg-[#fff5f4] p-3 text-[12px] text-[#9d352d]">{error}</div>}
    {loading?<div className="mt-3"><TableSkeleton rows={4} columns={2} label="Chargement des soldes…"/></div>:items.length?<div className="mt-2 grid gap-1.5">{items.map(item=><button key={item.id} type="button" onClick={()=>onOpen(item.id)} className="flex min-h-[62px] w-full items-center justify-between gap-4 rounded-[8px] border border-[#dfe3e6] bg-white px-3 py-2.5 text-left transition hover:bg-[#fafbfb]"><span className="min-w-0"><strong className="block truncate text-[12px] font-medium text-[#303941]">{item.client_name}</strong><span className="mt-1 block truncate text-[10px] text-[#7a848b]">{item.document_number} · Total {cash(item.total,item.currency)}</span></span><span className="shrink-0 text-right"><strong className="block text-[11px] font-medium text-[#303941]">{cash(item.balance_due,item.currency)} restant</strong><span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[9px] font-medium ${statusStyle[item.status]||statusStyle.ISSUED}`}>{item.status === "PAID" ? "Payée" : item.status === "PARTIALLY_PAID" ? "Partielle" : labels[item.status]||item.status}</span></span></button>)}</div>:<div className="mt-3 rounded-[8px] border border-[#e2e5e7] p-5"><EmptyState title="Aucun solde client" description="Les factures correspondant à votre recherche apparaîtront ici."/></div>}
  </OperationContent>;
}

function FinanceOverview({loading,stats,payments,onViewAll,onNewInvoice,onBalances,onOpenPayment,periodPreset,onPeriodChange,error}:{loading:boolean;stats:FinanceStats;payments:FinancePaymentRow[];onViewAll:()=>void;onNewInvoice:()=>void;onBalances:()=>void;onOpenPayment:(id:string)=>void;periodPreset:string;onPeriodChange:(value:string)=>void;error:string}) {
  const billed = stats.period.by_currency.map(row=>cash(row.invoiced,row.currency)).join(" · ") || cash(0,"USD");
  const collected = stats.period.by_currency.map(row=>cash(row.collected,row.currency)).join(" · ") || cash(0,"USD");
  const outstanding = stats.by_currency.map(row=>cash(row.outstanding,row.currency)).join(" · ") || cash(0,"USD");
  const unpaid = stats.unpaid_invoice_count + stats.partially_paid_invoice_count;
  const methodName:Record<string,string>={MOBILE_MONEY:"Mobile Money",CASH:"Espèces",BANK_TRANSFER:"Virement",CARD:"Carte",MANUAL:"Manuel"};
  const cards=[
    {label:"Montant facturé",value:billed,icon:ReceiptText},
    {label:"Paiements reçus",value:collected,icon:HandCoins},
    {label:"Restant à encaisser",value:outstanding,icon:Wallet},
    {label:"Factures impayées ou partielles",value:String(unpaid),icon:CalendarDays},
  ];
  return <OperationContent className="pt-3">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <label className="flex min-w-[190px] items-center gap-2 text-[11px] text-[#68717d]"><span className="sr-only">Période</span><select aria-label="Période" value={periodPreset} onChange={event=>onPeriodChange(event.target.value)} className={`${input} min-w-[190px]`}><option value="month">Ce mois</option><option value="previous-month">Le mois dernier</option><option value="year">Cette année</option></select></label>
    </div>
    {error&&<div role="alert" className="mb-3 rounded-[8px] bg-[#fff5f4] p-3 text-[12px] text-[#9d352d]">La synthèse n’a pas pu être actualisée. {error}</div>}
    <div className="grid gap-2 sm:grid-cols-2">
      {cards.map(({label,value,icon:Icon})=><article key={label} className="min-w-0 rounded-[8px] border border-[#dfe3e6] bg-white p-4"><div className="flex items-center justify-between gap-3"><p className="text-[11px] text-[#717b83]">{label}</p><Icon size={13} className="shrink-0 text-[#727d84]"/></div><p className="mt-2 truncate text-[18px] font-semibold tabular-nums text-[#20272e]">{loading?"…":value}</p></article>)}
    </div>
    <section className="mt-2 rounded-[8px] border border-[#dfe3e6] bg-white p-4">
      <div className="mb-2 flex items-center justify-between gap-3"><h2 className="text-[13px] font-semibold text-[#303941]">Derniers paiements</h2><button type="button" onClick={onViewAll} className="inline-flex items-center gap-1 text-[11px] font-medium text-[#59646c] hover:text-[#111827]">Voir tout <ArrowRight size={13}/></button></div>
      {loading?<TableSkeleton rows={3} columns={2} label="Chargement des paiements…"/>:payments.length? <div className="grid gap-1">{payments.map(payment=><button key={payment.id} type="button" onClick={()=>onOpenPayment(payment.document_id)} className="flex w-full items-center justify-between gap-4 rounded-[7px] px-2 py-2 text-left transition hover:bg-[#f7f8f8]"><span className="flex min-w-0 items-center gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#e9f7ef] text-[#15945b]">✓</span><span className="min-w-0"><strong className="block truncate text-[12px] font-medium text-[#303941]">{payment.client_name}</strong><span className="mt-0.5 block truncate text-[10px] text-[#78828a]">{methodName[payment.method]||payment.method} · {new Date(payment.paid_at).toLocaleDateString("fr-FR",{day:"numeric",month:"short"})}</span></span></span><span className="shrink-0 text-right"><strong className="block text-[12px] font-medium text-[#303941]">+ {cash(payment.amount,payment.currency)}</strong><span className="mt-0.5 block text-[10px] text-[#78828a]">{payment.document_number}</span></span></button>)}</div>:<p className="py-5 text-center text-[12px] text-[#78828a]">Aucun paiement récent pour cette période.</p>}
    </section>
    <div className="mt-2 flex flex-wrap gap-2"><PermissionGuard permission="finance.create"><button type="button" onClick={onNewInvoice} className={button}><Plus size={13}/>Nouvelle facture</button></PermissionGuard><button type="button" onClick={onBalances} className={button}><Users size={13}/>Soldes clients</button></div>
  </OperationContent>;
}

function CreateModal({ close, done }: { close: () => void; done: (document?: FinanceDocument) => void | Promise<void> }) {
  const [clients, setClients] = useState<ClientRecord[]>([]),
    [step, setStep] = useState<1 | 2>(1),
    [clientId, setClientId] = useState(""),
    [association, setAssociation] = useState<"PACKAGE" | "SHIPMENT" | "NONE">("NONE"),
    [packages, setPackages] = useState<PackageRecord[]>([]),
    [associatedPackageId, setAssociatedPackageId] = useState(""),
    [packagesLoading, setPackagesLoading] = useState(false),
    [pricingBusy, setPricingBusy] = useState(false),
    [existingPackageInvoice, setExistingPackageInvoice] = useState<FinanceDocument|null>(null),
    [existingInvoiceLoading, setExistingInvoiceLoading] = useState(false),
    [currency, setCurrency] = useState("USD"),
    [dueDate, setDueDate] = useState(""),
    [paymentTerms, setPaymentTerms] = useState("Paiement avant livraison"),
    [notes, setNotes] = useState(""),
    [lines, setLines] = useState<Array<{description:string;quantity:number;unit_price:number;discount_rate:number;tax_rate:number}>>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const pricingRequestRef = useRef(0);
  const selectedAssociatedPackage = packages.find((item) => item.id === associatedPackageId);
  const selectedClient = clients.find((client) => client.id === clientId);
  const today = new Date().toISOString().slice(0, 10);
  const packageIsPriced = Boolean(selectedAssociatedPackage?.fees_total != null && selectedAssociatedPackage.pricing_snapshot && Object.keys(selectedAssociatedPackage.pricing_snapshot).length);
  const packageTotal = association === "NONE" ? 0 : Number(selectedAssociatedPackage?.fees_total || 0);
  const total = packageTotal + lines.reduce((sum, line) => sum + line.quantity * line.unit_price * (1 - line.discount_rate / 100) * (1 + line.tax_rate / 100), 0);
  useEffect(() => {
    listClients({ page_size: 100 }).then((r) => setClients(r.items)).catch(()=>setError("Chargement des clients impossible. Rouvrez le formulaire pour réessayer."));
  }, []);
  useEffect(() => {
    if (association === "NONE" || !clientId) { setPackages([]); setPackagesLoading(false); return; }
    let active = true;
    const timer = setTimeout(() => {
      setPackagesLoading(true);
      listPackages({ client_id: clientId, page: 1, page_size: 50 })
        .then((result) => { if (active) setPackages(result.items); })
        .catch((cause) => { if (active) setError(err(cause)); })
        .finally(() => { if (active) setPackagesLoading(false); });
    }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [association, clientId]);
  useEffect(() => {
    const requestId = ++pricingRequestRef.current;
    if (association === "NONE" || !selectedAssociatedPackage) { setExistingPackageInvoice(null); setExistingInvoiceLoading(false); setPricingBusy(false); return; }
    let active = true;
    if (selectedAssociatedPackage.currency) setCurrency(selectedAssociatedPackage.currency);
    setExistingInvoiceLoading(true);
    setExistingPackageInvoice(null);
    getPackageInvoice(selectedAssociatedPackage.id).then(invoice => { if (active) setExistingPackageInvoice(invoice); }).catch(() => { if (active) setError("La facture existante du colis n’a pas pu être vérifiée."); }).finally(() => { if (active) setExistingInvoiceLoading(false); });
    if (!packageIsPriced && selectedAssociatedPackage.shipping_service_id) {
      setPricingBusy(true); setError("");
      pricePackage(selectedAssociatedPackage.id, selectedAssociatedPackage.shipping_service_id)
        .then(updated => { if (active) { setPackages(current => current.map(item => item.id === updated.id ? updated : item)); setCurrency(updated.currency || "USD"); } })
        .catch(cause => { if (active) setError(packageInvoiceError(cause)); })
        .finally(() => { if (pricingRequestRef.current === requestId) setPricingBusy(false); });
    } else setPricingBusy(false);
    return () => { active = false; };
  }, [association, selectedAssociatedPackage?.id, packageIsPriced, selectedAssociatedPackage?.shipping_service_id]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (step === 1) {
      const invalid = !clientId || !dueDate || (association === "NONE" && !lines.length) || lines.some((line) => !line.description.trim() || line.quantity <= 0 || line.unit_price < 0);
      if (invalid) { setError("Sélectionnez un client, indiquez l’échéance et ajoutez une prestation ou un colis tarifé."); return; }
      if (association !== "NONE" && !selectedAssociatedPackage) { setError("Sélectionnez le colis ou l’expédition à associer."); return; }
      if (association !== "NONE" && !packageIsPriced) { setError("Le tarif du colis doit être calculé et validé avant la vérification."); return; }
      if (existingPackageInvoice) { setError(`Une facture existe déjà pour ce colis (${existingPackageInvoice.document_number}).`); return; }
      setError(""); setStep(2); return;
    }
    setBusy(true);
    try {
      if (association !== "NONE") {
        const selectedPackage = selectedAssociatedPackage;
        if (!selectedPackage || !selectedPackage.row_version || !packageIsPriced) throw new Error("Sélectionnez un colis dont le tarif est actualisé avant de préparer la facture.");
        let invoice: FinanceDocument;
        try {
          invoice = await createPackageInvoice(selectedPackage.id, selectedPackage.row_version, { due_date: dueDate || null, notes: notes || null, terms: paymentTerms, additional_lines: lines });
        } catch (cause) {
          setError(packageInvoiceError(cause));
          setBusy(false);
          return;
        }
        await done(invoice);
        return;
      }
      await createFinance({
        document_type: "INVOICE",
        client_id: clientId,
        currency,
        due_date: dueDate || null,
        notes: notes || null,
        terms: paymentTerms,
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
      description="Préparez la facture, vérifiez son contenu, puis enregistrez-la en brouillon."
      close={close}
      width="max-w-[720px]"
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="flex items-center gap-3 px-1" aria-label={`Étape ${step} sur 2`}>
          {[{n:1,label:"Informations"},{n:2,label:"Vérification"}].map((item)=><div key={item.n} className={`flex flex-1 items-center gap-2 py-2 text-[12px] ${step===item.n?"font-semibold text-[#16855f]":"text-[#7b858d]"}`}><span className={`grid h-6 w-6 place-items-center rounded-full ${step>=item.n?"bg-[#16855f] text-white":"bg-[#f0f1f2]"}`}>{step>item.n?"✓":item.n}</span>{item.label}<span className={`h-[2px] flex-1 ${item.n===1?step===2?"bg-[#16855f]":"bg-[#e6e8e9]":"hidden"}`}/></div>)}
        </div>
        {step === 1 ? <div className="space-y-5">
          <section className="space-y-3">
            <h3 className="text-[13px] font-semibold">1. Informations générales</h3>
            <label className="grid gap-1 text-[12px]">Client *<select required value={clientId} onChange={(event)=>{setClientId(event.target.value);setAssociatedPackageId("");}} className={input}>
              <option value="">Sélectionner un client</option>{clients.map((client)=><option key={client.id} value={client.id}>{client.display_name||client.name||client.company_name||client.phone}</option>)}
            </select></label>
            <fieldset className="space-y-1"><legend className="text-[12px]">Associer à</legend><div className="grid grid-cols-3 rounded-full bg-[#f2f3f3] p-1">{([ ["PACKAGE","Colis"],["SHIPMENT","Expédition"],["NONE","Aucun"] ] as const).map(([value,label])=><button key={value} type="button" aria-pressed={association===value} onClick={()=>{setAssociation(value);setAssociatedPackageId("");}} className={`rounded-full px-3 py-1.5 text-[12px] ${association===value?"bg-white font-semibold text-[#20272d] shadow-sm":"text-[#78828a]"}`}>{label}</button>)}</div></fieldset>
            {association!=="NONE"&&<><label className="grid gap-1 text-[12px]">{association==="PACKAGE"?"Colis concerné":"Expédition concernée"}<select value={associatedPackageId} onChange={(event)=>{setAssociatedPackageId(event.target.value);setExistingPackageInvoice(null);}} disabled={!clientId||packagesLoading} className={input}><option value="">{!clientId?"Sélectionnez d’abord un client":packagesLoading?"Chargement…":`Sélectionner ${association==="PACKAGE"?"un colis":"une expédition"}`}</option>{packages.filter(item=>association==="PACKAGE"?true:Boolean(item.shipment_id)).map(item=><option key={item.id} value={item.id}>{association==="PACKAGE"?(item.package_reference||item.tracking_id||item.id):(item.shipment_reference||item.shipment_id)} · {item.description||item.package_type}</option>)}</select></label>{selectedAssociatedPackage&&<div className="rounded-[7px] bg-[#f8f9f9] p-3 text-[12px]">{pricingBusy?<span className="text-[#78828a]">Calcul du tarif selon les règles de tarification…</span>:packageIsPriced?<div className="flex items-center justify-between gap-3"><span><strong className="block">Tarif calculé du colis</strong><span className="text-[10px] text-[#78828a]">Tarif validé · ajouté automatiquement aux prestations</span></span><strong>{cash(packageTotal,selectedAssociatedPackage.currency||currency)}</strong></div>:<span className="text-amber-700">{selectedAssociatedPackage.shipping_service_id?error||"Calcul du tarif en cours…":"Ce colis n’a pas de service tarifable associé."}</span>}{existingPackageInvoice&&<p className="mt-2 text-[11px] text-amber-700">Une facture existe déjà pour ce colis : {existingPackageInvoice.document_number}.</p>}</div>}</>}
            <p className="text-[10px] text-[#78828a]">Le tarif du colis est calculé automatiquement. Sans colis, ajoutez librement les prestations et leurs montants.</p>
            <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-[12px]">Date de facture<input type="date" value={today} readOnly className={`${input} bg-[#f7f8f8]`} /><span className="text-[10px] text-[#78828a]">La date officielle est fixée à l’émission.</span></label><label className="grid gap-1 text-[12px]">Date d’échéance *<input required type="date" value={dueDate} onChange={(event)=>setDueDate(event.target.value)} className={input}/></label></div>
            <label className="grid gap-1 text-[12px]">Devise<select disabled={association!=="NONE"} value={currency} onChange={(event)=>setCurrency(event.target.value)} className={`${input} disabled:bg-[#f7f8f8]`}>{["USD","EUR","CDF","AOA","CNY","XOF","XAF"].map(code=><option key={code} value={code}>{code} — {code==="USD"?"Dollar américain":code==="CDF"?"Franc congolais":code==="EUR"?"Euro":code}</option>)}</select><span className="text-[10px] text-[#78828a]">{association==="NONE"?"Changer la devise ne convertit pas automatiquement les montants saisis.":"La devise suit automatiquement celle du tarif validé du colis."}</span></label>
          </section>
          <section className="space-y-3">
            <div className="flex items-center justify-between"><h3 className="text-[13px] font-semibold">2. Prestations facturées</h3><span className="rounded-full bg-[#f1f2f2] px-2 py-1 text-[10px]">{lines.length} ligne(s)</span></div>
            {!lines.length?<div className="py-3 text-center text-[12px] text-[#78828a]"><ReceiptText size={16} className="mx-auto mb-1"/><strong className="block font-medium text-[#303941]">Aucune prestation ajoutée</strong><span>Ajoutez les prestations facturées ci-dessous.</span></div>:<div className="space-y-2">{lines.map((line,index)=><div key={index} className="grid gap-2 rounded-[7px] bg-[#f8f9f9] p-3 sm:grid-cols-[minmax(0,2fr)_90px_minmax(120px,1fr)_auto]"><label className="grid gap-1 text-[11px]">Description de la prestation *<input required value={line.description} onChange={(event)=>setLines(lines.map((item,i)=>i===index?{...item,description:event.target.value}:item))} placeholder="Ex. Transport aérien, manutention…" className={input}/></label><label className="grid gap-1 text-[11px]">Quantité *<input required type="number" min="0.001" step="0.001" value={line.quantity} onChange={(event)=>setLines(lines.map((item,i)=>i===index?{...item,quantity:Number(event.target.value)}:item))} className={input}/></label><label className="grid gap-1 text-[11px]">Prix unitaire ({currency}) *<input required type="number" min="0" step="0.01" value={line.unit_price} onChange={(event)=>setLines(lines.map((item,i)=>i===index?{...item,unit_price:Number(event.target.value)}:item))} placeholder="Tarif à définir" className={input}/></label><button type="button" aria-label="Retirer la prestation" className="self-end px-2 py-2 text-[11px] text-red-600" onClick={()=>setLines(lines.filter((_,i)=>i!==index))}>Retirer</button></div>)}</div>}
            <button type="button" className={`${button} w-full rounded-full`} onClick={()=>setLines([...lines,{description:"",quantity:1,unit_price:0,discount_rate:0,tax_rate:0}])}><Plus size={13}/>Ajouter une ligne</button>
            <div className="flex items-center justify-between rounded-[7px] bg-[#f8f9f9] px-3 py-3 text-[12px]"><strong>Total de la facture</strong><strong>{cash(total,selectedAssociatedPackage?.currency||currency)}</strong></div>
          </section>
          <section className="space-y-3"><h3 className="text-[13px] font-semibold">3. Règlement</h3><label className="grid gap-1 text-[12px]">Conditions applicables<select value={paymentTerms} onChange={(event)=>setPaymentTerms(event.target.value)} className={input}>{["Paiement avant livraison","Paiement à l’arrivée","Paiement à crédit","Paiement à réception","Autre condition"].map(term=><option key={term}>{term}</option>)}</select><span className="text-[10px] text-[#78828a]">La politique de paiement dépend aussi des paramètres financiers du service concerné.</span></label><label className="grid gap-1 text-[12px]">Note sur la facture (facultatif)<textarea value={notes} onChange={(event)=>setNotes(event.target.value)} className="min-h-16 rounded-[5px] border border-[#d8dce0] p-3 text-[12px] outline-none focus:border-[#16855f]" placeholder="Informations ou instructions de règlement…"/></label></section>
        </div> : <div className="space-y-4">
          <h3 className="text-[13px] font-semibold">Vérification de la facture</h3>
          <section className="space-y-2 rounded-[7px] bg-[#f8f9f9] p-3 text-[12px]"><div className="flex justify-between"><span className="text-[#78828a]">Client</span><strong>{selectedClient?.display_name||selectedClient?.name||selectedClient?.company_name||selectedClient?.phone}</strong></div><div className="flex justify-between"><span className="text-[#78828a]">Association</span><strong>{association==="NONE"?"Aucune":`${association==="PACKAGE"?"Colis":"Expédition"} · ${selectedAssociatedPackage?.package_reference||selectedAssociatedPackage?.tracking_id||selectedAssociatedPackage?.shipment_reference||""}`}</strong></div><div className="flex justify-between"><span className="text-[#78828a]">Échéance</span><strong>{dueDate?new Date(`${dueDate}T00:00:00`).toLocaleDateString("fr-FR"):"—"}</strong></div><div className="flex justify-between"><span className="text-[#78828a]">Devise</span><strong>{currency}</strong></div></section>
          <section className="space-y-2"><h4 className="text-[12px] font-semibold">Prestations</h4>{selectedAssociatedPackage&&packageIsPriced&&<div className="flex justify-between gap-3 rounded-[7px] px-2 py-2 text-[12px]"><span>Transport du colis {selectedAssociatedPackage.package_reference}<span className="block text-[10px] text-[#78828a]">Tarif validé</span></span><strong>{cash(packageTotal,selectedAssociatedPackage.currency||currency)}</strong></div>}{lines.map((line,index)=><div key={index} className="flex justify-between gap-3 rounded-[7px] px-2 py-2 text-[12px]"><span>{line.description}<span className="block text-[10px] text-[#78828a]">{line.quantity} × {cash(line.unit_price,currency)}</span></span><strong>{cash(line.quantity*line.unit_price*(1-line.discount_rate/100)*(1+line.tax_rate/100),currency)}</strong></div>)}<div className="flex justify-between bg-[#f8f9f9] p-3 text-[13px]"><strong>Total</strong><strong>{cash(total,selectedAssociatedPackage?.currency||currency)}</strong></div></section>
          <section className="space-y-1 text-[12px]"><h4 className="font-semibold">Règlement</h4><p>{paymentTerms}</p>{notes&&<p className="text-[#78828a]">{notes}</p>}</section>
        </div>}
        {error && <p className="text-[13px] text-red-600">{error}</p>}
        <div className="flex items-center justify-between gap-3 pt-2"><button type="button" className={button} onClick={()=>step===2?setStep(1):close()}>{step===2?"Retour aux informations":"Annuler"}</button><div className="flex gap-2">{step===1&&<button type="button" disabled={busy||existingInvoiceLoading||pricingBusy} className={button} onClick={()=>void (async()=>{if(!clientId||!dueDate||(association==="NONE"&&!lines.length)||association!=="NONE"&&!packageIsPriced||existingPackageInvoice){setError("Complétez le client, l’échéance et ajoutez une prestation ou choisissez un colis tarifé.");return;}setBusy(true);try{if(association!=="NONE"&&selectedAssociatedPackage?.row_version){await createPackageInvoice(selectedAssociatedPackage.id,selectedAssociatedPackage.row_version,{due_date:dueDate,notes:notes||null,terms:paymentTerms,additional_lines:lines});}else{await createFinance({document_type:"INVOICE",client_id:clientId,currency,due_date:dueDate,notes:notes||null,terms:paymentTerms,lines});}await done();}catch(cause){setError(err(cause));setBusy(false);}})()}>{busy?"Enregistrement…":"Enregistrer en brouillon"}</button>}<button disabled={busy||pricingBusy||packagesLoading||existingInvoiceLoading||(association!=="NONE"&&(!packageIsPriced||Boolean(existingPackageInvoice)))} className={primary}>{step===1?"Vérifier la facture →":busy?"Enregistrement…":"Confirmer et enregistrer"}</button></div></div>
      </form>
    </OperationDrawer>
  );
}
function PaymentDetail({payment,close,onOpenInvoice,onReceipt,onReverse,onChanged}:{payment:FinancePaymentRow;close:()=>void;onOpenInvoice:()=>void;onReceipt:(payment:FinancePaymentRow)=>Promise<void>;onReverse:(fn:()=>Promise<unknown>)=>void;onChanged:()=>void|Promise<void>}) {
  const [tab,setTab]=useState<"details"|"invoice"|"history">("details");
  const [document,setDocument]=useState<FinanceDocument|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const methodNames:Record<string,string>={CASH:"Espèces",MOBILE_MONEY:"Mobile Money",BANK_TRANSFER:"Virement bancaire",CARD:"Carte",MANUAL:"Manuel"};
  useEffect(()=>{let active=true;setLoading(true);getFinance(payment.document_id).then(value=>{if(active)setDocument(value)}).catch(()=>{if(active)setError("La facture liée ou l’historique n’a pas pu être chargé.")}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[payment.document_id]);
  const relatedEvents=(document?.events||[]).filter(event=>event.payment_id===payment.id);
  const statusLabel=payment.status==="CONFIRMED"?"Enregistré":"Annulé";
  const paymentText=`Paiement ${payment.receipt_number} · ${payment.client_name} · ${cash(payment.amount,payment.currency)} · ${methodNames[payment.method]||payment.method}`;
  async function share(){try{if(navigator.share)await navigator.share({title:`Paiement ${payment.receipt_number}`,text:paymentText});else{await navigator.clipboard.writeText(paymentText);setError("Résumé du paiement copié.")}}catch(cause){if((cause as {name?:string})?.name!=="AbortError")setError("Le partage n’a pas pu être ouvert.")}}
  async function viewReceipt(){try{const blob=await paymentReceipt(payment.document_id,payment.id);const url=URL.createObjectURL(blob);window.open(url,"_blank","noopener,noreferrer");setTimeout(()=>URL.revokeObjectURL(url),60000)}catch{setError("Le reçu n’est pas disponible pour ce paiement.")}}
  const tabs=<div className="flex flex-wrap gap-1.5 py-2">{([ ["details","Détails"], ["invoice","Facture liée"], ["history","Historique"] ] as const).map(([key,label])=><button key={key} type="button" onClick={()=>setTab(key)} aria-current={tab===key?"page":undefined} className={`rounded-full px-3 py-1.5 text-[12px] font-medium ${tab===key?"bg-[#111] text-white":"text-[#606a72] hover:bg-[#f2f3f3]"}`}>{label}</button>)}</div>;
  return <OperationDrawer open close={close} title={`Paiement ${payment.receipt_number}`} description={new Date(payment.paid_at).toLocaleString("fr-FR",{dateStyle:"long",timeStyle:"short"})} width="max-w-[650px]" tabs={tabs} headerMeta={<><span className={`rounded-full px-2 py-1 text-[10px] font-medium ${payment.status==="CONFIRMED"?"bg-[#e0f5e9] text-[#16834d]":"bg-[#fce8e6] text-[#b42318]"}`}>{statusLabel}</span><span className="rounded-full bg-[#f0f1f2] px-2 py-1 text-[10px] font-medium text-[#505a62]">{methodNames[payment.method]||payment.method}</span><span className="rounded-full bg-[#f0f1f2] px-2 py-1 text-[10px] font-medium text-[#505a62]">{payment.currency}</span></>}>
    <div className="space-y-4">
      <section className="py-2 text-center"><span className="text-[11px] text-[#78828a]">Montant encaissé</span><strong className="mt-1 block text-[24px] font-semibold text-[#20272d]">{cash(payment.amount,payment.currency)}</strong><span className="mt-2 inline-flex items-center gap-1.5 text-[10px] text-[#78828a]"><span className="h-2 w-2 rounded-full bg-[#16a05d]"/>{payment.status==="CONFIRMED"?"Paiement enregistré":"Paiement annulé"}</span></section>
      <div className="flex flex-wrap gap-2"><button type="button" disabled={!payment.receipt_available} className={`${button} rounded-full disabled:opacity-50`} onClick={()=>void viewReceipt()}><ReceiptText size={14}/>Voir le reçu</button><button type="button" disabled={!payment.receipt_available} className={`${button} rounded-full disabled:opacity-50`} onClick={()=>void onReceipt(payment)}><Download size={14}/>Télécharger</button><button type="button" className={`${button} rounded-full`} onClick={()=>void share()}><Share2 size={14}/>Partager</button></div>
      {tab==="details"&&<div className="space-y-4"><section className="space-y-2"><h3 className="text-[13px] font-semibold">Informations du paiement</h3>{[["Référence",payment.receipt_number],["Client",payment.client_name],["Méthode",methodNames[payment.method]||payment.method],["Référence transaction",payment.reference||"Non renseignée"],["Date d’encaissement",new Date(payment.paid_at).toLocaleDateString("fr-FR")],["Enregistré par",payment.recorded_by_name||"Agent de l’agence"],["Bureau",payment.office_name||"Non renseigné"]].map(([label,value])=><div key={label} className="flex justify-between gap-4 text-[12px]"><span className="text-[#78828a]">{label}</span><span className="text-right text-[#303941]">{value}</span></div>)}</section><section className="space-y-2"><h3 className="text-[13px] font-semibold">Justificatif</h3>{payment.receipt_available?<div className="flex items-center justify-between rounded-[7px] border border-[#e1e4e6] p-3 text-[12px]"><span><strong className="block">Reçu {payment.receipt_number}</strong><span className="text-[10px] text-[#78828a]">Justificatif généré par SLAIVIO</span></span><button type="button" aria-label="Voir le reçu" onClick={()=>void viewReceipt()} className="rounded p-1 text-[#68717d] hover:bg-[#f2f3f3]"><ReceiptText size={15}/></button></div>:<p className="rounded-[7px] bg-[#f8f9f9] p-3 text-[11px] text-[#78828a]">Aucun reçu archivé pour ce paiement.</p>}</section>{payment.status==="CONFIRMED"&&<div className="flex items-center justify-between gap-3 border-t border-[#e8eaec] pt-3"><span className="text-[10px] text-[#78828a]">Toute correction doit être tracée.</span><PermissionGuard permission="finance.reverse_payment"><PaymentReverseButton documentId={payment.document_id} paymentId={payment.id} onRun={fn=>onReverse(async()=>{await fn();await onChanged();})}/></PermissionGuard></div>}</div>}
      {tab==="invoice"&&(loading?<TableSkeleton rows={3} columns={1} label="Chargement de la facture…"/>:document?<section className="space-y-3"><h3 className="text-[13px] font-semibold">Facture associée</h3><div className="rounded-[7px] border border-[#e1e4e6] p-3"><div className="flex items-center justify-between gap-3"><strong>{document.document_number}</strong><span className="rounded-full bg-[#f0f1f2] px-2 py-1 text-[10px]">{labels[document.status]||document.status}</span></div><p className="mt-1 text-[11px] text-[#78828a]">{document.client_name}</p><div className="mt-3 grid grid-cols-3 gap-2 text-[11px]"><span>Total<br/><b>{cash(document.total,document.currency)}</b></span><span>Payé<br/><b>{cash(document.amount_paid,document.currency)}</b></span><span>Solde<br/><b>{cash(document.balance_due,document.currency)}</b></span></div></div><button type="button" className={`${button} rounded-full`} onClick={onOpenInvoice}>Ouvrir la facture</button></section>:<EmptyState title="Facture indisponible" description={error||"Le document associé est introuvable."}/>)}
      {tab==="history"&&(loading?<TableSkeleton rows={3} columns={1} label="Chargement de l’historique…"/>:<section className="space-y-2"><h3 className="text-[13px] font-semibold">Historique des opérations</h3>{relatedEvents.length?relatedEvents.map(event=><div key={event.id} className="flex justify-between gap-4 rounded-[7px] bg-[#f8f9f9] px-3 py-2.5 text-[12px]"><div><strong>{event.event_type.replaceAll("_"," ")}</strong>{event.actor_name&&<span className="ml-2 text-[10px] text-[#78828a]">par {event.actor_name}</span>}</div><time className="shrink-0 text-[10px] text-[#78828a]">{new Date(event.created_at).toLocaleString("fr-FR")}</time></div>):<EmptyState title="Aucun événement disponible" description="Aucun événement n’est associé à ce paiement."/>}</section>)}
      {error&&<p role="status" className="rounded-[6px] bg-[#f8f9f9] p-2 text-[11px] text-[#606a72]">{error}</p>}
    </div>
  </OperationDrawer>;
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
  const [activeTab, setActiveTab] = useState<"details" | "payments" | "history">("details");
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
  async function downloadPdf() {
    const popup = window.open("", "_blank");
    if (!popup) { setError("Autorisez les fenêtres contextuelles pour ouvrir le document PDF."); return; }
    try {
      const markup = await financePrint(item.id);
      popup.document.open(); popup.document.write(markup); popup.document.close();
      window.setTimeout(() => popup.print(), 300);
    } catch { popup.close(); setError("La facture n’a pas pu être préparée pour l’impression."); }
  }
  async function shareInvoice() {
    const shareText = `Facture ${item.document_number} · ${item.client_name} · ${cash(item.total,item.currency)} · Solde : ${cash(item.balance_due,item.currency)}`;
    try {
      if (navigator.share) await navigator.share({ title: `Facture ${item.document_number}`, text: shareText });
      else { await navigator.clipboard.writeText(shareText); setError("Résumé de la facture copié."); }
    } catch (cause) {
      if ((cause as {name?:string})?.name !== "AbortError") setError("Le partage n’a pas pu être ouvert.");
    }
  }
  const paymentRatio = item.total > 0 ? Math.min(100, Math.max(0, item.amount_paid / item.total * 100)) : 0;
  const invoiceStatus = labels[item.status] || item.status;
  const methodNames: Record<string,string> = { CASH:"Espèces", MOBILE_MONEY:"Mobile Money", BANK_TRANSFER:"Virement bancaire", CARD:"Carte", MANUAL:"Manuel" };
  const tabs = <div className="flex flex-wrap gap-1.5 py-2">{([ ["details","Détails"], ["payments","Paiements"], ["history","Historique"] ] as const).map(([key,label])=><button key={key} type="button" onClick={()=>setActiveTab(key)} aria-current={activeTab===key?"page":undefined} className={`rounded-full px-3 py-1.5 text-[12px] font-medium ${activeTab===key?"bg-[#111] text-white":"text-[#606a72] hover:bg-[#f2f3f3]"}`}>{label}</button>)}</div>;
  return (
    <OperationDrawer
      open
      title={`${item.document_type === "INVOICE" ? "Facture" : labels[item.document_type]} ${item.document_number}`}
      description={`Créée le ${new Date(item.created_at).toLocaleDateString("fr-FR")} · ${(item as FinanceDocument & {office_name?:string|null}).office_name || "Bureau"}`}
      close={close}
      width="max-w-[680px]"
      tabs={tabs}
      headerMeta={<><span className="rounded-full bg-[#fff0dc] px-2 py-1 text-[10px] font-medium text-[#c76d20]">{invoiceStatus}</span><span className="rounded-full bg-[#f0f1f2] px-2 py-1 text-[10px] font-medium text-[#505a62]">{item.currency}</span></>}
    >
      <div className="space-y-4">
        {!(item as FinanceDocument & {office_id?:string|null}).office_id && <PermissionGuard permission="finance.settings"><FinanceOfficeAssignment documentId={item.id} version={item.row_version} onSaved={reload} /></PermissionGuard>}
        <section className="space-y-2">
          <div className="grid grid-cols-3 gap-3"><div><span className="block text-[10px] text-[#78828a]">Total facture</span><strong className="text-[14px] font-semibold">{cash(item.total,item.currency)}</strong></div><div><span className="block text-[10px] text-[#78828a]">Déjà payé</span><strong className="text-[14px] font-semibold">{cash(item.amount_paid,item.currency)}</strong></div><div><span className="block text-[10px] text-[#78828a]">Solde restant</span><strong className="text-[14px] font-semibold">{cash(item.balance_due,item.currency)}</strong></div></div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[#eef0f1]"><div className="h-full rounded-full bg-[#16855f]" style={{width:`${paymentRatio}%`}}/></div><p className="text-[10px] text-[#78828a]">{Math.round(paymentRatio)} % réglé</p>
        </section>
        <div className="flex flex-wrap gap-2">
          {item.document_type === "INVOICE" && ["ISSUED","PARTIALLY_PAID","OVERDUE"].includes(item.status) && item.balance_due > 0 && <PermissionGuard permission="finance.payments"><button type="button" className={`${primary} rounded-full`} onClick={()=>setPaymentOpen(value=>!value)}><Plus size={14}/>Enregistrer un paiement</button></PermissionGuard>}
          {item.status === "DRAFT" && <PermissionGuard permission="finance.issue"><button type="button" disabled={busy} className={`${primary} rounded-full`} onClick={()=>run(()=>issueFinance(item.id,item.row_version))}>Émettre</button></PermissionGuard>}
          <button type="button" className={`${button} rounded-full`} onClick={()=>void downloadPdf()}><Download size={14}/>PDF</button>
          <button type="button" className={`${button} rounded-full`} onClick={()=>void shareInvoice()}><Share2 size={14}/>Partager</button>
          {["DRAFT","ISSUED"].includes(item.status) && item.amount_paid===0 && <PermissionGuard permission="finance.void"><button type="button" disabled={busy} className={`${button} rounded-full`} onClick={()=>{const reason=window.prompt("Motif obligatoire de l’annulation");if(reason)run(()=>voidFinance(item.id,item.row_version,reason));}}>Annuler</button></PermissionGuard>}
        </div>
        {paymentOpen && <PermissionGuard permission="finance.payments"><RecordPaymentForm document={item} onCancel={()=>setPaymentOpen(false)} onRecorded={async()=>{await reload();setPaymentOpen(false);}}/></PermissionGuard>}
        {activeTab === "details" && <div className="space-y-5">
          <section className="space-y-2"><h3 className="text-[13px] font-semibold">Informations client</h3>{[["Client",item.client_name],["Téléphone",item.client_phone || "Non renseigné"],["Colis lié",item.dossier_reference || "Aucun colis lié"]].map(([label,value])=><div key={label} className="flex justify-between gap-4 text-[12px]"><span className="text-[#78828a]">{label}</span><span className="text-right text-[#303941]">{value}</span></div>)}</section>
          <section className="space-y-2"><h3 className="text-[13px] font-semibold">Détail de la facturation</h3><div className="flex justify-between text-[10px] text-[#78828a]"><span>Description</span><span>Montant</span></div>{item.lines?.map((line,index)=><div key={`${line.description}-${index}`} className="flex justify-between gap-4 border-t border-[#edf0f1] py-2 text-[12px]"><span className="min-w-0">{line.description}{line.quantity!==1&&<small className="block text-[#78828a]">{line.quantity} × {cash(line.unit_price,item.currency)}</small>}</span><span className="shrink-0">{cash(line.line_total ?? line.quantity*line.unit_price,item.currency)}</span></div>)}<div className="flex justify-between border-t border-[#e1e4e6] pt-2 text-[12px] font-semibold"><span>Total</span><span>{cash(item.total,item.currency)}</span></div></section>
          <section className="space-y-2"><h3 className="text-[13px] font-semibold">Conditions de règlement</h3><div className="flex justify-between gap-4 text-[12px]"><span className="text-[#78828a]">Politique</span><span>{item.terms || "Selon les conditions de la facture"}</span></div><div className="flex justify-between gap-4 text-[12px]"><span className="text-[#78828a]">Échéance</span><span>{item.due_date ? new Date(`${item.due_date}T12:00:00`).toLocaleDateString("fr-FR") : "Non définie"}</span></div></section>
        </div>}
        {activeTab === "payments" && <section className="space-y-2"><h3 className="text-[13px] font-semibold">Paiements et reçus</h3>{item.payments?.length ? item.payments.map(payment=><div key={payment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[7px] border border-[#e1e4e6] p-3 text-[12px]"><div><strong className="block">{payment.receipt_number}</strong><span className="text-[10px] text-[#78828a]">{methodNames[payment.method]||payment.method} · {new Date(payment.paid_at).toLocaleDateString("fr-FR")}{payment.reference?` · ${payment.reference}`:""}</span>{payment.provider === "SASPAY" && <small className="block text-slate-500">Frais {payment.provider_fee==null?"—":cash(payment.provider_fee,payment.currency)} · net agence {payment.provider_net_amount==null?"—":cash(payment.provider_net_amount,payment.currency)}</small>}</div><div className="flex items-center gap-2"><strong>{cash(payment.amount,payment.currency)}</strong><span className={`rounded-full px-2 py-0.5 text-[10px] ${payment.status==="CONFIRMED"?"bg-[#e0f5e9] text-[#16834d]":"bg-[#fce8e6] text-[#b42318]"}`}>{payment.status==="CONFIRMED"?"Confirmé":"Annulé"}</span>{payment.status==="CONFIRMED"&&payment.receipt_snapshot&&<button type="button" disabled={busy} className="text-[11px] text-[#59636b] hover:underline" onClick={()=>run(async()=>{const blob=await paymentReceipt(item.id,payment.id);const url=URL.createObjectURL(blob);const anchor=document.createElement("a");anchor.href=url;anchor.download=`${payment.receipt_number}.html`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);})}>Reçu</button>}{payment.status==="CONFIRMED"&&<PaymentReverseButton documentId={item.id} paymentId={payment.id} onRun={fn=>{void run(fn);}}/>}</div></div>):<EmptyState title="Aucun paiement enregistré" description="Les paiements reçus sur cette facture apparaîtront ici."/>}</section>}
        {activeTab === "history" && <section className="space-y-2"><h3 className="text-[13px] font-semibold">Historique</h3>{item.events?.length ? item.events.map(event=><div key={event.id} className="flex justify-between gap-4 rounded-[7px] bg-[#f8f9f9] px-3 py-2.5 text-[12px]"><div><strong>{event.event_type.replaceAll("_"," ")}</strong>{event.actor_name&&<span className="ml-2 text-[10px] text-[#78828a]">par {event.actor_name}</span>}</div><time className="shrink-0 text-[10px] text-[#78828a]">{new Date(event.created_at).toLocaleString("fr-FR")}</time></div>):<EmptyState title="Aucun historique disponible" description="Les événements associés à cette facture apparaîtront ici."/>}</section>}
        {error && <p className="rounded bg-red-50 p-3 text-red-700">{error}</p>}
      </div>
    </OperationDrawer>
  );
}
