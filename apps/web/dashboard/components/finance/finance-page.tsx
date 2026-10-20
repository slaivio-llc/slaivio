"use client";
import { useResourceLink } from "@/components/ui/use-resource-link";
import { RecordPaymentForm } from "./record-payment-form";
import { FinanceOfficeAssignment } from "./finance-office-assignment";
import { FinanceDuePolicySettings } from "./finance-due-policy-settings";
import { PaymentReverseButton } from "./finance-completion-actions";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, CalendarDays, ChevronRight, Download, HandCoins, Plus, ReceiptText, RefreshCcw, Search, Users, Wallet } from "lucide-react";
import { PermissionGuard } from "@/components/permissions/permission-guard";
import { OperationDrawer } from "@/components/ui/operation-drawer";
import { OperationPageHeader } from "@/components/ui/operation-page-header";
import { OperationContent, OperationSearch, OperationTable, OperationToolbar } from "@/components/ui/operation-primitives";
import { OperationButton, OperationField, OperationFilterPopover } from "@/components/ui/operation-controls";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/page-state";
import { listClients, type ClientRecord } from "@/services/clients";
import { listPackages, pricePackage, type PackageRecord } from "@/services/packages";
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
    [balanceRows, setBalanceRows] = useState<FinanceBalanceRow[]>([]),
    [currency, setCurrency] = useState(""),
    [periodPreset, setPeriodPreset] = useState("month"),
    [startDate, setStartDate] = useState(() => dateInputValue(new Date(new Date().getFullYear(), new Date().getMonth(), 1))),
    [endDate, setEndDate] = useState(() => dateInputValue(new Date())),
    [openPaymentOnDetail, setOpenPaymentOnDetail] = useState(false),
    [paymentChooserOpen, setPaymentChooserOpen] = useState(false),
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
      const [a, b, payments, balances] = await Promise.all([
        section === "overview" || section === "invoices" ? listFinance({
          q: q || undefined,
          status: status || undefined,
          document_type: section === "invoices" ? "INVOICE" : kind || undefined,
          page_size: 100,
        }) : Promise.resolve({items:[] as FinanceDocument[],pagination:{total:0}}),
        financeStats({start_date:startDate||undefined,end_date:endDate||undefined}),
        section === "payments" || section === "overview" ? listFinancePayments({q:section === "payments" ? q||undefined : undefined,currency:section === "payments" ? currency||undefined : undefined,status:section === "payments" ? status||undefined : undefined,start_date:startDate||undefined,end_date:endDate||undefined,page_size:100}).catch(() => ({items:[] as FinancePaymentRow[]})) : Promise.resolve({items:[] as FinancePaymentRow[]}),
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
  return (
    <div className="min-h-full bg-white">
      <OperationPageHeader
        title="Finance"
        description="Factures, paiements reçus et soldes clients."
        actions={section !== "settings" ? <div className="flex flex-wrap items-center gap-2">{(section === "payments" || section === "balances") && <PermissionGuard permission="finance.export"><button className={button} onClick={download}><Download size={14}/>Exporter</button></PermissionGuard>}<PermissionGuard permission="finance.payments"><button className={primary} onClick={() => setPaymentChooserOpen(true)}><Plus size={15}/>Enregistrer un paiement</button></PermissionGuard></div> : undefined}
      />
      <main>
        <nav aria-label="Sections Finance" className="mx-auto flex w-full max-w-[1200px] gap-2 overflow-x-auto px-6 py-2 sm:px-8">
          {([["overview","Vue d’ensemble"],["invoices","Factures"],["payments","Paiements"],["balances","Soldes clients"],["settings","Paramètres"]] as const).map(([key,label])=><button key={key} type="button" aria-current={section===key?"page":undefined} onClick={()=>selectSection(key)} className={`shrink-0 rounded-full px-3 py-2 text-[12px] transition-colors ${section===key?"bg-[#111111] font-semibold text-white":"text-[#68717d] hover:bg-[#f2f3f3] hover:text-[#17212b]"}`}>{label}</button>)}
        </nav>
        {section === "overview" ? <FinanceOverview loading={loading} stats={stats} payments={paymentRows.slice(0,4)} onViewAll={() => selectSection("payments")} onNewInvoice={() => setCreate(true)} onBalances={() => selectSection("balances")} onOpenPayment={id => void open(id,true)} periodPreset={periodPreset} onPeriodChange={changePeriod} error={error}/> : section === "invoices" ? <FinanceInvoices loading={loading} error={error} items={items} query={q} setQuery={setQ} onCreate={() => setCreate(true)} onOpen={id => void open(id)}/> : section === "settings" ? <PermissionGuard permission="finance.settings"><FinanceDuePolicySettings/></PermissionGuard> : <>
        {section === "payments" && <div className="px-6 pt-4 sm:px-8"><h2 className="mb-3 text-[15px] font-semibold text-[#20272d]">Historique des paiements</h2></div>}
        {section === "balances" && <div className="flex flex-wrap items-end gap-3 px-6 pt-4"><label className="grid gap-1 text-[11px] text-[#68717d]">Devise<select className={input} value={currency} onChange={event=>setCurrency(event.target.value)}><option value="">Toutes les devises</option>{stats.by_currency.map(row=><option key={row.currency} value={row.currency}>{row.currency}</option>)}</select></label></div>}
        <OperationToolbar search={<OperationSearch value={q} onChange={setQ} placeholder={section === "payments" ? "Rechercher un paiement…" : "Numéro, client, téléphone…"} />} filters={<><OperationFilterPopover activeCount={section === "payments" ? (status ? 1 : 0) : (status ? 1 : 0) + (kind ? 1 : 0)} onReset={() => { setKind(""); setStatus(""); }} title={section === "payments" ? "Filtrer les paiements" : "Filtrer la finance"}>{section === "payments" ? <OperationField label="État du paiement"><select className={`${input} w-full`} value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Tous</option><option value="CONFIRMED">Confirmés</option><option value="REVERSED">Annulés</option></select></OperationField> : <><OperationField label="Type de document"><select className={`${input} w-full`} value={kind} onChange={(event) => setKind(event.target.value)}><option value="">Tous les documents</option><option value="QUOTE">Devis</option><option value="INVOICE">Factures</option><option value="CREDIT_NOTE">Avoirs</option></select></OperationField><OperationField label="État du document"><select className={`${input} w-full`} value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Tous les états</option>{["DRAFT","ISSUED","PARTIALLY_PAID","PAID","OVERDUE","VOID"].map((x) => <option key={x} value={x}>{labels[x]}</option>)}</select></OperationField></>}</OperationFilterPopover><OperationButton onClick={load} aria-label="Actualiser" title="Actualiser" className="w-9 px-0">
              <RefreshCcw size={14} />
            </OperationButton></>} />
        <OperationContent className="pt-4">
          {error && <ErrorState title="Facturation indisponible" description={error} retry={load} />}
        <OperationTable>
          {section === "payments" ? (loading ? <TableSkeleton rows={4} columns={1} label="Chargement des paiements…" /> : paymentRows.length ? <div className="grid gap-2">{paymentRows.map(payment=><div key={payment.id} className="flex w-full items-center justify-between gap-4 rounded-[7px] border border-[#dfe2e4] bg-white px-3 py-3 sm:px-4"><button type="button" onClick={()=>open(payment.document_id,true)} className="min-w-0 flex-1 text-left"><strong className="block truncate text-[13px] font-semibold text-[#273039]">{payment.client_name}</strong><span className="mt-0.5 block truncate text-[11px] text-[#78828a]">{payment.receipt_number} · {payment.method === "MANUAL" ? "Paiement manuel" : payment.method} · {new Date(payment.paid_at).toLocaleDateString("fr-FR",{day:"numeric",month:"short"})}</span></button><span className="shrink-0 text-right"><strong className="block text-[13px] font-medium text-[#273039]">{cash(payment.amount,payment.currency)}</strong><span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${payment.status === "CONFIRMED" ? "bg-[#e0f5e9] text-[#16834d]" : "bg-[#fce8e6] text-[#b42318]"}`}>{payment.status === "CONFIRMED" ? "Confirmé" : "Annulé"}</span></span><div className="hidden items-center gap-2 md:flex">{payment.status === "CONFIRMED" && <>{payment.receipt_available ? <button type="button" className="text-xs text-slate-600 hover:underline" onClick={()=>void downloadPaymentReceipt(payment)}>Reçu</button> : <span className="text-xs text-slate-400">Reçu indisponible</span>}<PaymentReverseButton documentId={payment.document_id} paymentId={payment.id} onRun={(fn)=>{void runPaymentAction(fn);}} /></>}</div></div>)}</div> : <EmptyState title="Aucun paiement" description="Les paiements correspondant à cette recherche apparaîtront ici." />) : section === "balances" ? (balanceRows.length ? <table className="w-full min-w-[800px] text-left text-[13px]"><thead className="bg-[#f6f7f7] text-[#5f6976]"><tr>{["Client","Devise","Factures","Facturé","Payé","Solde","Exigible","Prochaine échéance"].map(label=><th key={label} className="px-4 py-3 font-medium">{label}</th>)}</tr></thead><tbody>{balanceRows.map((balance,index)=><tr key={`${balance.client_id}-${balance.currency}-${index}`} className="border-t"><td className="px-4 py-3 font-semibold">{balance.client_name}</td><td>{balance.currency}</td><td>{balance.invoice_count}</td><td>{cash(balance.invoiced,balance.currency)}</td><td>{cash(balance.paid,balance.currency)}</td><td className="font-semibold">{cash(balance.balance,balance.currency)}</td><td>{cash(balance.due_now,balance.currency)}</td><td>{balance.next_due||"—"}</td></tr>)}</tbody></table> : <EmptyState title="Aucun solde client" description="Aucune facture émise ne correspond aux filtres." />) : loading ? (
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
        </>}
      </main>
      <OperationDrawer open={paymentChooserOpen} close={() => setPaymentChooserOpen(false)} title="Enregistrer un paiement" description="Choisissez une facture avec un solde restant à encaisser." width="max-w-[620px]">
        {loading ? <TableSkeleton rows={3} columns={2} label="Chargement des factures…"/> : items.filter(item=>item.document_type==="INVOICE"&&["ISSUED","PARTIALLY_PAID","OVERDUE"].includes(item.status)&&item.balance_due>0).length ? <div className="grid gap-2">{items.filter(item=>item.document_type==="INVOICE"&&["ISSUED","PARTIALLY_PAID","OVERDUE"].includes(item.status)&&item.balance_due>0).map(item=><button key={item.id} type="button" onClick={()=>{setPaymentChooserOpen(false);void open(item.id,true);}} className="flex w-full items-center justify-between gap-4 rounded-[8px] bg-[#f7f8f8] p-4 text-left transition hover:bg-[#eef3f0]"><span className="min-w-0"><strong className="block truncate text-[13px] text-[#303941]">{item.client_name}</strong><span className="mt-1 block text-[11px] text-[#77818a]">{item.document_number}</span></span><span className="shrink-0 text-right"><strong className="block text-[13px] text-[#303941]">{cash(item.balance_due,item.currency)}</strong><span className="mt-1 block text-[10px] text-[#77818a]">Solde restant</span></span></button>)}</div> : <EmptyState title="Aucune facture à encaisser" description="Les factures émises avec un solde restant apparaîtront ici."/>}
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
    <div className="flex items-center justify-between gap-3"><h2 className="text-[13px] font-semibold text-[#303941]">Factures</h2><PermissionGuard permission="finance.create"><button type="button" onClick={onCreate} className={primary}><Plus size={14}/>Nouvelle facture</button></PermissionGuard></div>
    <label className="mt-3 flex h-10 w-full items-center gap-2 rounded-full border border-[#d8dde0] bg-white px-4 focus-within:border-[#aeb8be]"><Search size={15} className="shrink-0 text-[#7b858c]"/><input aria-label="Rechercher un client ou une facture" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Rechercher un client ou une facture…" className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-[#8b949a]"/></label>
    {error&&<div role="alert" className="mt-3 rounded-[8px] bg-[#fff5f4] p-3 text-[12px] text-[#9d352d]">{error}</div>}
    {loading?<div className="mt-3"><TableSkeleton rows={4} columns={2} label="Chargement des factures…"/></div>:items.length?<div className="mt-2 grid gap-1.5">{items.map(item=><button key={item.id} type="button" onClick={()=>onOpen(item.id)} className="flex min-h-[62px] w-full items-center justify-between gap-4 rounded-[8px] border border-[#dfe3e6] bg-white px-3 py-2.5 text-left transition hover:bg-[#fafbfb]"><span className="min-w-0"><strong className="block truncate text-[12px] font-medium text-[#303941]">{item.client_name}</strong><span className="mt-1 block truncate text-[10px] text-[#7a848b]">{item.document_number} · Total {cash(item.total,item.currency)}</span></span><span className="shrink-0 text-right"><strong className="block text-[11px] font-medium text-[#303941]">{cash(item.balance_due,item.currency)} restant</strong><span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[9px] font-medium ${statusStyle[item.status]||statusStyle.ISSUED}`}>{labels[item.status]||item.status}</span></span></button>)}</div>:<div className="mt-3 rounded-[8px] border border-[#e2e5e7] p-5"><EmptyState title="Aucune facture" description="Les factures correspondant à votre recherche apparaîtront ici."/></div>}
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
      <h2 className="text-[13px] font-semibold text-[#303941]">Aperçu financier</h2>
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
    [mode, setMode] = useState<"manual" | "package">("manual"),
    [packages, setPackages] = useState<PackageRecord[]>([]),
    [packageQuery, setPackageQuery] = useState(""),
    [packageId, setPackageId] = useState(""),
    [packagesLoading, setPackagesLoading] = useState(false),
    [pricingBusy, setPricingBusy] = useState(false),
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
  const selectedPackageForInvoice = packages.find((item) => item.id === packageId);
  const selectedPackageIsPriced = Boolean(selectedPackageForInvoice?.fees_total != null && selectedPackageForInvoice.pricing_snapshot && Object.keys(selectedPackageForInvoice.pricing_snapshot).length);
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
  async function calculateSelectedPackagePrice() {
    const selectedPackage = packages.find((item) => item.id === packageId);
    if (!selectedPackage?.shipping_service_id || pricingBusy) return;
    setPricingBusy(true);
    setError("");
    try {
      const updated = await pricePackage(selectedPackage.id, selectedPackage.shipping_service_id);
      setPackages(current => current.map(item => item.id === updated.id ? updated : item));
    } catch (cause) {
      setError(packageInvoiceError(cause));
    } finally {
      setPricingBusy(false);
    }
  }
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
          {(() => { const item = packages.find((candidate) => candidate.id === packageId); const priced = Boolean(item?.fees_total != null && item.pricing_snapshot && Object.keys(item.pricing_snapshot).length); return item && !priced && item.shipping_service_id ? <PermissionGuard permission="packages.pricing"><button type="button" disabled={pricingBusy || item.row_version == null} onClick={calculateSelectedPackagePrice} className={button}>{pricingBusy ? "Calcul du tarif…" : "Calculer le tarif du colis"}</button></PermissionGuard> : null; })()}
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
        {mode === "package" && !selectedPackageIsPriced ? <p className="text-xs text-slate-500">Calculez d’abord le tarif enregistré du colis. Le bouton de facturation sera activé ensuite.</p> : null}
        <button disabled={busy || (mode === "package" && (packagesLoading || !packageId || !selectedPackageIsPriced))} className={`${primary} w-full`}>
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
            ["Montant facturé", cash(item.total, item.currency)],
            ["Payé", cash(item.amount_paid, item.currency)],
            ["Solde restant", cash(item.balance_due, item.currency)],
          ].map(([l, v]) => (
            <div key={l} className="rounded bg-white p-4">
              <small>{l}</small>
              <b className="block text-lg">{v}</b>
            </div>
          ))}
        </section>
        <section className="rounded bg-white p-4">
          <h3 className="mb-3 font-semibold">Détail</h3>
          {item.document_type === "INVOICE" && item.status === "DRAFT" && <p className="mb-3 rounded-[5px] bg-slate-50 p-3 text-[12px] text-slate-600">Le tarif facturé est déjà fixé dans ce brouillon. L’émission rend la facture officielle; elle n’enregistre pas un paiement. Enregistrez séparément l’argent réellement reçu.</p>}
          {item.lines?.map((l, i) => (
            <div
              key={i}
              className="flex justify-between border-t py-3 text-[13px]"
            >
              <span>
                {l.description}{l.quantity !== 1 ? ` · ${l.quantity} × ${cash(l.unit_price, item.currency)}` : ""}
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
