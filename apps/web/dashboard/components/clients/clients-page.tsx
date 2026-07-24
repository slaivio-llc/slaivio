"use client";

import axios from "axios";
import {
  AlertCircle,
  Building2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Mail,
  MapPin,
  MoreHorizontal,
  Phone,
  Plus,
  Search,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  createClient,
  getClient,
  getClientStats,
  listClients,
  type ClientCustomerType,
  type ClientLifecycleStatus,
  type ClientPayload,
  type ClientRecord,
  type ClientStats,
} from "@/services/clients";

const statusLabels: Record<ClientLifecycleStatus, string> = {
  lead: "Lead",
  active: "Actif",
  pending: "En attente",
  inactive: "Inactif",
  blocked: "Bloqué",
};

const statusStyles: Record<ClientLifecycleStatus, string> = {
  lead: "bg-blue-50 text-blue-700 ring-blue-100",
  active: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  pending: "bg-amber-50 text-amber-700 ring-amber-100",
  inactive: "bg-slate-100 text-slate-600 ring-slate-200",
  blocked: "bg-red-50 text-red-700 ring-red-100",
};

const typeLabels: Record<ClientCustomerType, string> = {
  individual: "Particulier",
  business: "Entreprise",
  agent: "Agent",
  partner: "Partenaire",
};

const emptyStats: ClientStats = {
  total: 0,
  leads: 0,
  active: 0,
  pending: 0,
  inactive: 0,
  blocked: 0,
  new_this_month: 0,
};

type Pagination = { page: number; page_size: number; total: number; total_pages: number };

export function ClientsPage() {
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [stats, setStats] = useState<ClientStats>(emptyStats);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, page_size: 20, total: 0, total_pages: 0 });
  const [selected, setSelected] = useState<ClientRecord | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ClientLifecycleStatus | "">("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);

  const page = pagination.page || 1;

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      loadClients(1);
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [query, status]);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      setStats(await getClientStats());
    } catch {
      setStats(emptyStats);
    }
  }

  async function loadClients(nextPage = page) {
    setLoading(true);
    setError("");
    try {
      const response = await listClients({
        q: query || undefined,
        status,
        page: nextPage,
        page_size: 20,
        sort: "created_desc",
      });
      setClients(response.items);
      setPagination(response.pagination);
      if (response.items.length === 0 || (selected && !response.items.some((item) => item.id === selected.id))) {
        setSelected(null);
      }
    } catch (err) {
      setError(apiErrorMessage(err));
      setClients([]);
      setSelected(null);
    } finally {
      setLoading(false);
    }
  }

  async function selectClient(client: ClientRecord) {
    setSelected(client);
    setDetailLoading(true);
    try {
      setSelected(await getClient(client.id));
    } catch {
      setSelected(client);
    } finally {
      setDetailLoading(false);
    }
  }

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError("");
    setCreating(true);
    const form = new FormData(event.currentTarget);
    const payload: ClientPayload = {
      name: String(form.get("name") || "").trim() || undefined,
      company_name: String(form.get("company_name") || "").trim() || undefined,
      phone: String(form.get("phone") || "").trim() || undefined,
      whatsapp_phone: String(form.get("whatsapp_phone") || "").trim() || undefined,
      email: String(form.get("email") || "").trim() || undefined,
      country: String(form.get("country") || "").trim() || undefined,
      city: String(form.get("city") || "").trim() || undefined,
      customer_type: String(form.get("customer_type") || "individual") as ClientCustomerType,
      lifecycle_status: String(form.get("lifecycle_status") || "lead") as ClientLifecycleStatus,
      source: "manual",
      notes: String(form.get("notes") || "").trim() || undefined,
    };

    try {
      const created = await createClient(payload);
      setModalOpen(false);
      setSelected(created);
      await Promise.all([loadStats(), loadClients(1)]);
    } catch (err) {
      setCreateError(apiErrorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  const statCards = useMemo(() => [
    { label: "Clients total", value: stats.total, tone: "blue" },
    { label: "Clients actifs", value: stats.active, tone: "blue" },
    { label: "Leads", value: stats.leads, tone: "blue" },
    { label: "En attente", value: stats.pending, tone: "amber" },
    { label: "Inactifs", value: stats.inactive, tone: "neutral" },
  ], [stats]);

  return (
    <div className="min-h-full bg-[#f7f8fa] px-5 py-5 text-[#1f2328] md:px-8 lg:px-10">
      <div className="mx-auto max-w-[1480px] rounded-xl border border-[#d7dbe0] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.10)]">
        <header className="flex flex-col gap-5 border-b border-[#dfe3e8] px-6 py-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-[#6b7280]">
              <span>Operations</span>
              <span>›</span>
              <span className="font-medium text-[#1f2328]">Clients</span>
            </div>
            <h1 className="mt-5 text-[34px] font-semibold tracking-[-0.035em]">Clients</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6b7280]">Répertoire réel des leads, clients et partenaires de votre agence active. Les données viennent uniquement du module Clients et de l’organisation connectée.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-[#d7dbe0] bg-white px-3 text-sm font-medium shadow-sm transition hover:bg-[#f7f8fa]">
              <Filter size={17} />
              Filtres
            </button>
            <button
              onClick={() => setModalOpen(true)}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[#12c76f] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0fb966]"
            >
              <Plus size={18} />
              Nouveau client
            </button>
          </div>
        </header>

        <section className="grid gap-3 px-6 py-5 sm:grid-cols-2 xl:grid-cols-5">
          {statCards.map((card) => (
            <div key={card.label} className={`min-h-[112px] rounded-md border p-5 ${metricCardClass(card.tone)}`}>
              <div className="flex items-start justify-between gap-4">
                <p className="max-w-[160px] text-[15px] font-medium leading-5">{card.label}</p>
                <span className="flex h-8 w-8 items-center justify-center rounded-md border border-black/10 bg-white/80 text-lg leading-none text-[#4b5563] shadow-sm">↗</span>
              </div>
              <p className="mt-3 text-[38px] font-normal leading-none tracking-[-0.04em]">{card.value.toLocaleString("fr-FR")}</p>
            </div>
          ))}
        </section>

        <section className="border-t border-[#dfe3e8]">
          <div className="min-w-0 overflow-hidden bg-white">
            <div className="flex flex-col gap-2 border-b border-[#dfe3e8] px-6 py-3 lg:flex-row lg:items-center">
              <button className="h-8 rounded-md border border-[#d7dbe0] bg-white px-3 text-sm font-medium shadow-sm hover:bg-[#f7f8fa]">Type</button>
              <button className="h-8 rounded-md border border-[#d7dbe0] bg-white px-3 text-sm font-medium shadow-sm hover:bg-[#f7f8fa]">Pays</button>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as ClientLifecycleStatus | "")}
                className="h-8 rounded-md border border-[#d7dbe0] bg-white px-3 text-sm font-medium outline-none"
              >
                <option value="">Statut</option>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <label className="ml-auto flex h-8 min-w-0 items-center rounded-md border border-[#d7dbe0] bg-[#f7f8fa] px-2 focus-within:border-[#2563eb] lg:w-[300px]">
                <Search size={18} className="text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Rechercher..."
                  className="ml-2 min-w-0 flex-1 bg-transparent text-sm outline-none"
                />
              </label>
            </div>

            {error && (
              <div className="m-4 flex items-start gap-3 rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-700">
                <AlertCircle size={18} className="mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            <ClientsTable clients={clients} loading={loading} selectedId={selected?.id} onSelect={selectClient} />

            <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
              <span>{pagination.total === 0 ? "0 client" : `${((page - 1) * pagination.page_size) + 1} - ${Math.min(page * pagination.page_size, pagination.total)} sur ${pagination.total} client(s)`}</span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1 || loading}
                  onClick={() => loadClients(page - 1)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white disabled:opacity-40"
                >
                  <ChevronLeft size={17} />
                </button>
                <span className="rounded-lg bg-[#12c76f] px-3 py-2 text-sm font-semibold text-white">{page}</span>
                <button
                  disabled={page >= pagination.total_pages || loading}
                  onClick={() => loadClients(page + 1)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white disabled:opacity-40"
                >
                  <ChevronRight size={17} />
                </button>
              </div>
            </div>
          </div>

        </section>
      </div>

      {selected && (
        <ClientDetails client={selected} loading={detailLoading} onClose={() => setSelected(null)} />
      )}

      {modalOpen && (
        <CreateClientModal
          creating={creating}
          error={createError}
          onClose={() => setModalOpen(false)}
          onSubmit={submitCreate}
        />
      )}
    </div>
  );
}

function ClientsTable({ clients, loading, selectedId, onSelect }: {
  clients: ClientRecord[];
  loading: boolean;
  selectedId?: string;
  onSelect: (client: ClientRecord) => void;
}) {
  if (loading) {
    return (
      <div className="space-y-2 p-4">
        {[0, 1, 2, 3, 4].map((item) => <div key={item} className="h-16 animate-pulse rounded-lg bg-slate-100" />)}
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="flex min-h-[360px] flex-col items-center justify-center px-6 text-center">
        <h2 className="text-lg font-semibold">Aucun client trouvé</h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
          Créez votre premier client ou ajustez la recherche. Cette liste affichera uniquement les clients réels de l’organisation active.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[920px] w-full border-collapse text-left text-sm">
        <thead className="border-b border-[#dfe3e8] bg-[#fafbfc] text-xs font-medium text-[#6b7280]">
          <tr>
            <th className="px-5 py-4">Client</th>
            <th className="px-5 py-4">Téléphone</th>
            <th className="px-5 py-4">Pays</th>
            <th className="px-5 py-4">Type</th>
            <th className="px-5 py-4">Statut</th>
            <th className="px-5 py-4">Dossiers</th>
            <th className="px-5 py-4">Colis</th>
            <th className="px-5 py-4">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#edf0f2]">
          {clients.map((client) => (
            <tr
              key={client.id}
              onClick={() => onSelect(client)}
              className={`cursor-pointer transition hover:bg-[#f7f8fa] ${selectedId === client.id ? "bg-[#eef2f7]" : ""}`}
            >
              <td className="px-5 py-4">
                <div className="min-w-0">
                  <p className="truncate font-medium text-[#1f2328]">{client.display_name || client.name || "Sans nom"}</p>
                  <p className="truncate text-xs text-[#6b7280]">{client.email || client.company_name || "Email non renseigné"}</p>
                </div>
              </td>
              <td className="px-5 py-4 text-slate-700">{client.phone || client.whatsapp_phone || "Non renseigné"}</td>
              <td className="px-5 py-4 text-slate-700">{[client.city, client.country].filter(Boolean).join(", ") || "Non renseigné"}</td>
              <td className="px-5 py-4 text-slate-700">{typeLabels[client.customer_type]}</td>
              <td className="px-5 py-4"><StatusBadge status={client.lifecycle_status} /></td>
              <td className="px-5 py-4 font-medium text-slate-800">{client.dossiers_count}</td>
              <td className="px-5 py-4 font-medium text-slate-800">{client.shipments_count}</td>
              <td className="px-5 py-4"><MoreHorizontal size={18} className="text-slate-400" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ClientDetails({ client, loading, onClose }: { client: ClientRecord; loading: boolean; onClose: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setVisible(true));
    return () => window.cancelAnimationFrame(frame);
  }, [client.id]);

  function close() {
    setVisible(false);
    window.setTimeout(onClose, 180);
  }

  return (
    <div className="fixed inset-0 z-50">
      <button
        aria-label="Fermer la fiche client"
        onClick={close}
        className={`absolute inset-0 bg-slate-950/20 transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`}
      />
      <aside className={`absolute right-0 top-0 h-full w-full max-w-[430px] border-l border-[#d7dbe0] bg-white shadow-[-20px_0_50px_rgba(15,23,42,0.16)] transition-transform duration-200 ease-out ${visible ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-[#dfe3e8] px-5 py-4">
            <div>
              <p className="text-xs font-medium text-[#6b7280]">Fiche client</p>
              <h2 className="mt-1 max-w-[300px] truncate text-lg font-semibold">{client.display_name || client.name || "Sans nom"}</h2>
            </div>
            <button onClick={close} className="rounded-md p-2 text-slate-500 hover:bg-[#f1f3f5]">
              <X size={18} />
            </button>
          </div>

          <div className="border-b border-[#dfe3e8] p-5">
            <div className="flex items-start gap-4">
              <Initials name={client.display_name || client.name || "Client"} large />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-base font-semibold">{client.display_name || client.name || "Sans nom"}</p>
                  <StatusBadge status={client.lifecycle_status} />
                </div>
                <p className="mt-1 text-sm text-slate-500">{typeLabels[client.customer_type]} · Source {client.source}</p>
              </div>
            </div>
          </div>

          <div className={`flex-1 overflow-y-auto p-5 ${loading ? "opacity-60" : ""}`}>
            <div className="space-y-5">
              <DetailRow icon={Phone} label="Téléphone" value={client.phone || "Non renseigné"} />
              <DetailRow icon={Mail} label="Email" value={client.email || "Non renseigné"} />
              <DetailRow icon={MapPin} label="Localisation" value={[client.city, client.country].filter(Boolean).join(", ") || "Non renseigné"} />
              <DetailRow icon={Building2} label="Entreprise" value={client.company_name || "Non renseigné"} />
              <div className="rounded-lg border border-slate-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Résumé opérationnel</p>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <Metric label="Dossiers" value={client.dossiers_count} />
                  <Metric label="Colis" value={client.shipments_count} />
                  <Metric label="Solde" value={formatMoney(client.current_balance, client.preferred_currency)} />
                  <Metric label="Total dépensé" value={formatMoney(client.total_spent, client.preferred_currency)} />
                </div>
              </div>
              {client.notes && (
                <div className="rounded-lg bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                  {client.notes}
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function CreateClientModal({ creating, error, onClose, onSubmit }: {
  creating: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold">Nouveau client</h2>
            <p className="mt-1 text-sm text-slate-500">Créez un lead ou client réel pour l’organisation active.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <form onSubmit={onSubmit} className="space-y-5 p-6">
          {error && <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Nom complet" name="name" placeholder="Jean Mukendi" />
            <Input label="Entreprise" name="company_name" placeholder="OTI Cargo Express" />
            <Input label="Téléphone" name="phone" placeholder="+243 81 234 5678" />
            <Input label="WhatsApp" name="whatsapp_phone" placeholder="+243 81 234 5678" />
            <Input label="Email" name="email" placeholder="client@email.com" />
            <Input label="Pays" name="country" placeholder="RDC" />
            <Input label="Ville" name="city" placeholder="Kinshasa" />
            <label className="text-sm font-medium text-slate-700">
              Type
              <select name="customer_type" className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 outline-none">
                <option value="individual">Particulier</option>
                <option value="business">Entreprise</option>
                <option value="agent">Agent</option>
                <option value="partner">Partenaire</option>
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Statut
              <select name="lifecycle_status" className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 outline-none">
                <option value="lead">Lead</option>
                <option value="active">Actif</option>
                <option value="pending">En attente</option>
                <option value="inactive">Inactif</option>
                <option value="blocked">Bloqué</option>
              </select>
            </label>
          </div>
          <label className="block text-sm font-medium text-slate-700">
            Notes internes
            <textarea name="notes" rows={4} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-3 outline-none" placeholder="Informations utiles pour l’équipe..." />
          </label>
          <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
            <button type="button" onClick={onClose} className="h-11 rounded-lg border border-slate-200 px-5 text-sm font-semibold">Annuler</button>
            <button disabled={creating} className="h-11 rounded-lg bg-[#12c76f] px-5 text-sm font-semibold text-white disabled:opacity-60">
              {creating ? "Création..." : "Créer le client"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Input({ label, name, placeholder }: { label: string; name: string; placeholder: string }) {
  return (
    <label className="text-sm font-medium text-slate-700">
      {label}
      <input name={name} placeholder={placeholder} className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 outline-none focus:border-slate-400" />
    </label>
  );
}

function Initials({ name, large = false }: { name: string; large?: boolean }) {
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "CL";
  return (
    <div className={`flex shrink-0 items-center justify-center rounded-full bg-[#121826] font-semibold text-white ${large ? "h-14 w-14 text-base" : "h-10 w-10 text-sm"}`}>
      {initials}
    </div>
  );
}

function StatusBadge({ status }: { status: ClientLifecycleStatus }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusStyles[status]}`}>{statusLabels[status]}</span>;
}

function DetailRow({ icon: Icon, label, value }: { icon: typeof Phone; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <Icon size={17} className="mt-0.5 text-slate-500" />
      <div className="min-w-0">
        <p className="text-slate-500">{label}</p>
        <p className="mt-1 break-words font-medium text-slate-950">{value}</p>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function metricCardClass(tone: string) {
  if (tone === "amber") return "border-[#e8d29a] bg-[#fff4d7] text-[#b76100]";
  if (tone === "neutral") return "border-[#d7dbe0] bg-[#f7f8fa] text-[#1f2328]";
  return "border-[#c8d2e5] bg-[#f1f5fb] text-[#0752b8]";
}

function apiErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (detail === "duplicate_client") return "Un client avec ce téléphone ou cet email existe déjà dans cette agence.";
    if (detail === "name_company_phone_or_email_required") return "Ajoutez au moins un nom, une entreprise, un téléphone ou un email.";
    if (error.response?.status === 401) return "Session expirée. Reconnectez-vous.";
    if (error.response?.status === 403) return "Vous n’avez pas accès à cette organisation.";
    if (!error.response) return "API injoignable. Vérifiez que NEXT_PUBLIC_API_URL/NEXT_PUBLIC_API_BASE_URL pointe vers le backend déployé et que le service API est en ligne.";
    return detail || `Erreur API (${error.response?.status || "réseau"}).`;
  }
  return "Une erreur inattendue est survenue.";
}

function formatMoney(value: number | null | undefined, currency?: string | null) {
  const amount = Number(value || 0);
  return `${amount.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} ${currency || "$"}`;
}
