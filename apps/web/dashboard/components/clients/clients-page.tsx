"use client";

import axios from "axios";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleSlash,
  Clock3,
  Filter,
  Mail,
  MapPin,
  MoreHorizontal,
  Phone,
  Plus,
  Search,
  User,
  Users,
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
      if (response.items.length === 0) {
        setSelected(null);
      } else if (!selected || !response.items.some((item) => item.id === selected.id)) {
        setSelected(response.items[0]);
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
    { label: "Clients total", value: stats.total, icon: Users, tone: "emerald" },
    { label: "Actifs", value: stats.active, icon: CheckCircle2, tone: "emerald" },
    { label: "Leads", value: stats.leads, icon: User, tone: "blue" },
    { label: "En attente", value: stats.pending, icon: Clock3, tone: "amber" },
    { label: "Inactifs", value: stats.inactive, icon: CircleSlash, tone: "slate" },
  ], [stats]);

  return (
    <div className="min-h-screen bg-[#f8faf9] px-5 py-6 text-[#07111f] md:px-8 lg:px-10">
      <div className="mx-auto max-w-[1480px]">
        <header className="flex flex-col gap-5 border-b border-slate-200 pb-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-[32px] font-semibold tracking-[-0.04em]">Clients</h1>
            <p className="mt-2 text-sm text-slate-500">Répertoire réel des leads, clients et partenaires de votre agence active.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold shadow-sm transition hover:bg-slate-50">
              <Filter size={17} />
              Filtres
            </button>
            <button
              onClick={() => setModalOpen(true)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#12c76f] px-5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(18,199,111,0.22)] transition hover:bg-[#0fb966]"
            >
              <Plus size={18} />
              Nouveau client
            </button>
          </div>
        </header>

        <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {statCards.map((card) => (
            <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <div className="flex items-center gap-3">
                <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${toneClass(card.tone)}`}>
                  <card.icon size={20} />
                </div>
                <div>
                  <p className="text-2xl font-semibold tracking-[-0.03em]">{card.value}</p>
                  <p className="text-sm text-slate-500">{card.label}</p>
                </div>
              </div>
            </div>
          ))}
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center">
              <label className="flex h-11 min-w-0 flex-1 items-center rounded-lg border border-slate-200 bg-white px-3 focus-within:border-slate-400">
                <Search size={18} className="text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Rechercher un client, téléphone ou email..."
                  className="ml-3 min-w-0 flex-1 bg-transparent text-sm outline-none"
                />
              </label>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as ClientLifecycleStatus | "")}
                className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none"
              >
                <option value="">Tous les statuts</option>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
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

          <ClientDetails client={selected} loading={detailLoading} />
        </section>
      </div>

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
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
          <Users size={22} />
        </div>
        <h2 className="mt-4 text-lg font-semibold">Aucun client trouvé</h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
          Créez votre premier client ou ajustez la recherche. Cette liste affichera uniquement les clients réels de l’organisation active.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[920px] w-full text-left text-sm">
        <thead className="border-b border-slate-200 text-xs font-semibold uppercase tracking-[0.04em] text-slate-400">
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
        <tbody className="divide-y divide-slate-100">
          {clients.map((client) => (
            <tr
              key={client.id}
              onClick={() => onSelect(client)}
              className={`cursor-pointer transition hover:bg-slate-50 ${selectedId === client.id ? "bg-emerald-50/55" : ""}`}
            >
              <td className="px-5 py-4">
                <div className="flex items-center gap-3">
                  <Initials name={client.display_name || client.name || client.phone || client.email || "Client"} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-950">{client.display_name || client.name || "Sans nom"}</p>
                    <p className="truncate text-xs text-slate-500">{client.email || client.company_name || "Email non renseigné"}</p>
                  </div>
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

function ClientDetails({ client, loading }: { client: ClientRecord | null; loading: boolean }) {
  if (!client) {
    return (
      <aside className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
          <User size={22} />
        </div>
        <h2 className="mt-4 text-base font-semibold">Aucun client sélectionné</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">Sélectionnez un client réel dans la liste pour afficher sa fiche.</p>
      </aside>
    );
  }

  return (
    <aside className="rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="border-b border-slate-200 p-6">
        <div className="flex items-start gap-4">
          <Initials name={client.display_name || client.name || "Client"} large />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-lg font-semibold">{client.display_name || client.name || "Sans nom"}</h2>
              <StatusBadge status={client.lifecycle_status} />
            </div>
            <p className="mt-1 text-sm text-slate-500">{typeLabels[client.customer_type]} · Source {client.source}</p>
          </div>
        </div>
      </div>
      <div className={`space-y-5 p-6 ${loading ? "opacity-60" : ""}`}>
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
    </aside>
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

function toneClass(tone: string) {
  if (tone === "blue") return "bg-blue-50 text-blue-600";
  if (tone === "amber") return "bg-amber-50 text-amber-600";
  if (tone === "slate") return "bg-slate-100 text-slate-600";
  return "bg-emerald-50 text-emerald-600";
}

function apiErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (detail === "duplicate_client") return "Un client avec ce téléphone ou cet email existe déjà dans cette agence.";
    if (detail === "name_company_phone_or_email_required") return "Ajoutez au moins un nom, une entreprise, un téléphone ou un email.";
    if (error.response?.status === 401) return "Session expirée. Reconnectez-vous.";
    if (error.response?.status === 403) return "Vous n’avez pas accès à cette organisation.";
    return detail || `Erreur API (${error.response?.status || "réseau"}).`;
  }
  return "Une erreur inattendue est survenue.";
}

function formatMoney(value: number | null | undefined, currency?: string | null) {
  const amount = Number(value || 0);
  return `${amount.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} ${currency || "$"}`;
}
