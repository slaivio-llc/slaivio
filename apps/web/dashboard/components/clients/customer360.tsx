"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { api } from "@/services/api";
import type { ClientRecord } from "@/services/clients";
import { usePermissions } from "@/components/permissions/permission-provider";
import { OperationActionMenu } from "@/components/ui/operation-controls";
import { OperationDrawerTabs } from "@/components/ui/operation-drawer";
import { CompanyContacts } from "./company-contacts";

const sections = [
  { key: "packages", label: "Colis", permission: "packages.read" },
  { key: "finance", label: "Paiements", permission: "finance.read" },
  { key: "communications", label: "Conversations", permission: "inbox.read" },
  { key: "activity", label: "Historique", permission: "clients.read" },
] as const;
type Section = (typeof sections)[number]["key"];
type Item = { id: string; reference?: string; status?: string; occurred_at?: string; text_body?: string; document_id?: string; document_type?: string; title?: string; direction?: string; action?: string; currency?: string; total?: number; balance_due?: number; destination_city?: string; destination_country?: string; tracking_id?: string; weight_kg?: number };
type Result = { items?: Item[]; total?: number; balances?: { currency: string; paid: number; outstanding: number }[] };
const eventLabels: Record<string, string> = { "client.created": "Client créé", "client.updated": "Fiche modifiée", "client.archived": "Client archivé", "client.restored": "Client restauré", "client.merged": "Doublon fusionné", "client.merged_into": "Client fusionné", "message.inbound": "Message reçu", "message.outbound": "Message envoyé", PAYMENT_RECEIVED: "Paiement reçu", PAYMENT_REVERSED: "Paiement annulé", ISSUED: "Facture émise", CREATED: "Document créé" };
const formatDate = (value?: string | null) => value ? new Date(value).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "Non renseignée";
const formatMoney = (value: number | string | undefined, currency: string) => new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(Number(value || 0));
const humanStatus = (value?: string) => value?.toLocaleLowerCase("fr-FR").replaceAll("_", " ") || "—";

export function Customer360({ client, close, edit, archive, busy }: { client: ClientRecord; close: () => void; edit: () => void; archive: () => void; busy: boolean }) {
  const { permissions } = usePermissions();
  const tabs = sections.filter(section => permissions.includes(section.permission));
  const [section, setSection] = useState<Section>("packages");
  const activeSection = tabs.some(tab => tab.key === section) ? section : tabs[0]?.key || "packages";
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(false); setResult(null);
    api.get<Result>(`/clients/${client.id}/crm/${activeSection}`, { params: { page }, signal: controller.signal })
      .then(response => { if (!controller.signal.aborted) setResult(response.data); })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [client.id, client.row_version, activeSection, page, retry]);

  const total = result?.total || 0;
  const pages = Math.max(1, Math.ceil(total / 25));
  const name = client.display_name || client.name || client.company_name || "Client";
  const currency = client.preferred_currency || "USD";

  return <div data-client-detail className="mx-auto w-full max-w-[1200px] px-6 py-6 sm:px-8">
    <style>{`body:has([data-client-detail]) [aria-label="Répertoire clients"]{display:none}`}</style>
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-7">
        <div className="flex min-w-0 items-start gap-3">
          <button type="button" onClick={close} aria-label="Retour aux clients" className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"><ArrowLeft size={15}/></button>
          <div className="min-w-0"><p className="text-[11px] text-slate-500">Clients / Fiche client</p><h1 className="mt-1 truncate text-lg font-semibold text-slate-900">{name}</h1><p className="mt-0.5 text-xs text-slate-500">{client.client_reference || "Client"} · {client.customer_type === "business" ? "Entreprise" : "Particulier"}</p></div>
        </div>
        <div className="flex items-center gap-2">
          {activeSection === "packages" && <Link href="/app/packages" className="inline-flex h-9 items-center rounded-md border border-slate-200 px-3 text-[13px] font-medium text-slate-700 hover:bg-slate-50">+ Nouveau colis</Link>}
          {permissions.includes("clients.update") && <button type="button" onClick={edit} className="inline-flex h-9 items-center rounded-md border border-slate-200 px-3 text-[13px] font-medium text-slate-700 hover:bg-slate-50">Modifier</button>}
          {permissions.includes("clients.archive") && <OperationActionMenu label="Plus d’actions"><button type="button" onClick={archive} disabled={busy}>Archiver le client</button></OperationActionMenu>}
        </div>
      </header>

      <div className="grid gap-4 p-5 sm:p-7">
        <section className="rounded-lg border border-slate-200 p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Informations du client</h2>
          <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
            <Fact label="Téléphone / WhatsApp">{client.phone || client.whatsapp_phone || "Non renseigné"}</Fact>
            <Fact label="Pays">{client.country || "Non renseigné"}</Fact>
            <Fact label="Email">{client.email || "Non renseigné"}</Fact>
            <Fact label="Date d’inscription">{formatDate(client.created_at)}</Fact>
          </dl>
          {client.customer_type === "business" && <div className="mt-4 border-t border-slate-100 pt-3"><CompanyContacts clientId={client.id} editable={permissions.includes("clients.update")}/></div>}
        </section>

        <div className={`grid gap-3 ${permissions.includes("finance.read") ? "sm:grid-cols-3" : "sm:grid-cols-1"}`}>
          <Metric label="Colis" value={client.packages_count ?? "—"}/>
          {permissions.includes("finance.read") && <Metric label="Total facturé" value={formatMoney(client.total_spent, currency)}/>}
          {permissions.includes("finance.read") && <Metric label="Solde dû" value={formatMoney(client.current_balance, currency)} danger={client.current_balance > 0}/>}
        </div>

        {tabs.length > 0 && <nav aria-label="Sections de la fiche client" className="flex items-center gap-4 overflow-x-auto border-b border-slate-200"><OperationDrawerTabs items={tabs.map(tab => ({ ...tab }))} value={activeSection} primaryCount={6} onChange={value => { setSection(value as Section); setPage(1); }}/></nav>}
        {activeSection === "packages" && <h2 className="text-sm font-semibold text-slate-800">Colis du client</h2>}
        {loading ? <p role="status" className="p-5 text-sm text-slate-500">Chargement de la fiche…</p> : error ? <div role="alert" className="p-5 text-sm"><p>Impossible de charger cette section. Vos droits ont peut-être changé.</p><button type="button" className="mt-3 underline" onClick={() => setRetry(value => value + 1)}>Réessayer</button></div> : <SectionContent section={activeSection} result={result} total={total} page={page} pages={pages} setPage={setPage}/>}
      </div>
    </section>
  </div>;
}

function SectionContent({ section, result, total, page, pages, setPage }: { section: Section; result: Result | null; total: number; page: number; pages: number; setPage: (page: number) => void }) {
  if (!result?.items?.length && !(section === "finance" && result?.balances?.length)) return <p className="py-8 text-center text-sm text-slate-500">{section === "packages" ? "Aucun colis pour ce client." : section === "finance" ? "Aucun paiement ou document financier." : section === "communications" ? "Aucune conversation enregistrée." : "Aucun historique disponible."}</p>;
  return <div className="overflow-hidden rounded-lg border border-slate-200">
    {section === "finance" && Boolean(result?.balances?.length) && <div className="grid gap-2 border-b bg-slate-50 p-3 sm:grid-cols-2">{result?.balances?.map(balance => <article key={balance.currency} className="rounded-md border border-slate-200 bg-white p-3 text-xs"><h3 className="font-semibold">{balance.currency}</h3><p className="mt-1">Payé : {formatMoney(balance.paid, balance.currency)} · Solde dû : {formatMoney(balance.outstanding, balance.currency)}</p></article>)}</div>}
    {section === "packages" && <div className="grid grid-cols-[1.2fr_1fr_auto] border-b bg-slate-50 px-3 py-2 text-[11px] font-medium text-slate-500"><span>Référence</span><span>Route</span><span>Statut</span></div>}
    <ul className="divide-y divide-slate-100">{(result?.items || []).map(item => {
      const href = section === "packages" ? `/app/packages?open=${encodeURIComponent(item.id)}` : section === "finance" ? `/app/finance?open=${encodeURIComponent(item.document_id || item.id)}` : null;
      const title = section === "activity" ? item.title || eventLabels[item.action || ""] || item.action?.replaceAll("_", " ") || "Activité enregistrée" : section === "communications" ? (item.direction === "outbound" ? "Message envoyé" : "Message reçu") : item.reference || "Sans référence";
      const route = [item.destination_city, item.destination_country].filter(Boolean).join(" · ") || "—";
      return <li key={item.id} className="grid grid-cols-[1.2fr_1fr_auto] items-center gap-3 px-3 py-3 text-sm"><span className="min-w-0">{href ? <Link href={href} className="font-medium text-emerald-800 hover:underline">{title}</Link> : <strong className="font-medium text-slate-800">{title}</strong>}{(section === "activity" && item.reference || item.tracking_id) && <small className="block truncate text-xs text-slate-500">{item.reference || `Suivi : ${item.tracking_id}`}</small>}{item.text_body && <small className="mt-1 block whitespace-pre-wrap text-xs text-slate-600">{item.text_body}</small>}</span><span className="text-xs text-slate-600">{section === "packages" ? `${route}${item.weight_kg != null ? ` · ${item.weight_kg} kg` : ""}` : formatDate(item.occurred_at)}</span><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-700">{humanStatus(item.status || item.action)}</span></li>;
    })}</ul>
    {total > 25 && <nav aria-label="Pagination de la fiche" className="flex items-center justify-between border-t px-3 py-2 text-xs text-slate-500"><button type="button" disabled={page === 1} onClick={() => setPage(page - 1)} className="rounded border px-3 py-1.5 disabled:opacity-40">Précédent</button><span>{page} / {pages} · {total} éléments</span><button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)} className="rounded border px-3 py-1.5 disabled:opacity-40">Suivant</button></nav>}
  </div>;
}

function Fact({ label, children }: { label: string; children: string }) { return <div><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm text-slate-800">{children}</dd></div>; }
function Metric({ label, value, danger = false }: { label: string; value: number | string; danger?: boolean }) { return <div className="rounded-lg border border-slate-200 px-4 py-3"><p className="text-xs text-slate-500">{label}</p><p className={`mt-1 text-base font-semibold ${danger ? "text-red-600" : "text-slate-900"}`}>{typeof value === "number" ? value.toLocaleString("fr-FR") : value}</p></div>; }
