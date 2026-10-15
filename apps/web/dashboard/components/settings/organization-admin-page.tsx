"use client";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Bell,
  Boxes,
  Building2,
  ClipboardList,
  CreditCard,
  Database,
  FileText,
  KeyRound,
  Languages,
  MapPin,
  Plug,
  Plus,
  Route as RouteIcon,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  archiveWorkspace,
  getAdmin,
  inviteMember,
  requestDataOperation,
  revokeInvitation,
  saveIntegration,
  saveLocation,
  saveNumbering,
  saveRole,
  saveWorkspace,
  updateMember,
  updateMemberOfficeAccess,
  updateLocationStatus,
  updateOrganization,
  updateSettings,
  type AdminData,
  type Member,
} from "@/services/organization-admin";
import { PermissionGuard } from "@/components/permissions/permission-guard";
import { OperationPageHeader } from "@/components/ui/operation-page-header";
import { FormSection, OperationButton, OperationField } from "@/components/ui/operation-controls";
import { OperationDrawer } from "@/components/ui/operation-drawer";
import { ErrorState, LoadingState } from "@/components/ui/page-state";
import { FormGeographyFields } from "@/components/ui/geography-fields";
import {
  getNotificationPreferences,
  saveNotificationPreference,
  type NotificationPreference,
} from "@/services/notification-center";
import { OrganizationTransportSettings } from "@/components/settings/organization-transport-settings";
import { getTimeZoneOptions } from "@/components/settings/time-zone-options";
import { useDashboardLocale } from "@/components/i18n/dashboard-language";
import { AuditSettings } from "@/components/settings/audit-settings";
const input =
  "h-9 w-full rounded-[5px] border border-[#d8d9dc] bg-white px-3 text-[13px] outline-none focus:border-[#16855f]";
const button =
  "h-9 rounded-[6px] border border-[#d8d9dc] bg-white px-3 text-[13px] font-medium hover:bg-[#f6f7f7]";
const primary =
  "h-9 rounded-[6px] bg-[#12c76f] px-4 text-[13px] font-semibold text-white hover:bg-[#0fb766]";
const tabs = [
  ["general", "Général", Languages],
  ["agency", "Agence", Building2],
  ["workspaces", "Workspaces", Building2],
  ["locations", "Implantations", MapPin],
  ["services", "Services", Boxes],
  ["routes", "Routes", RouteIcon],
  ["team", "Utilisateurs & équipe", Users],
  ["roles", "Rôles & permissions", KeyRound],
  ["notifications", "Notifications", Bell],
  ["integrations", "Canaux & intégrations", Plug],
  ["documents", "Documents & numérotation", FileText],
  ["billing", "Abonnement Slaivio", CreditCard],
  ["security", "Sécurité", ShieldCheck],
  ["data", "Données & confidentialité", Database],
  ["audit", "Historique des actions", ClipboardList],
] as const;
type Section = (typeof tabs)[number][0];
const sectionTitles: Record<Section, [string, string]> = {
  general: ["Général", "Préférences régionales et unités du workspace actif."],
  agency: ["Agence", "Identité légale, coordonnées et image de marque de l’agence."],
  workspaces: ["Workspaces", "Espaces opérationnels, responsables et périmètres de travail."],
  locations: ["Implantations de votre agence", "Bureaux physiques organisés au sein de la même organisation."],
  services: ["Services de transport", "Prestations proposées par l’agence et utilisées par les colis et la tarification."],
  routes: ["Routes commerciales", "Liaisons de transport et services disponibles pour chacune."],
  team: ["Utilisateurs & équipe", "Invitations, affectations et accès des collaborateurs."],
  roles: ["Rôles & permissions", "Responsabilités et droits accordés à chaque rôle."],
  notifications: ["Notifications", "Événements importants et canaux utilisés pour prévenir l’équipe."],
  integrations: ["Canaux & intégrations", "Comptes externes connectés aux opérations de l’agence."],
  documents: ["Documents & numérotation", "Formats de références utilisés sur les documents métier."],
  billing: ["Abonnement Slaivio", "Plan, usage et facturation de votre abonnement à la plateforme."],
  security: ["Sécurité", "Protection des comptes, sessions et règles d’authentification."],
  data: ["Données & confidentialité", "Export, conservation et demandes sensibles sur les données."],
  audit: ["Historique des actions", "Actions sensibles enregistrées dans les modules de l’organisation."],
};
function val(f: FormData, k: string) {
  return String(f.get(k) || "").trim() || null;
}
export function OrganizationAdminPage() {
  const router = useRouter(),
    params = useSearchParams();
  const [data, setData] = useState<AdminData | null>(null),
    [tab, setTab] = useState<Section>("general"),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  useEffect(() => {
    const requested = params.get("section");
    const aliases: Record<string, Section> = {
      profile: "general",
      preferences: "general",
      organization: "agency",
      spaces: "workspaces",
    };
    const resolved = requested ? aliases[requested] || requested : "general";
    if (tabs.some(([id]) => id === resolved)) setTab(resolved as Section);
  }, [params]);
  const load = useCallback(async () => {
    try {
      setError("");
      setData(await getAdmin());
    } catch {
      setError("Le centre d’administration est indisponible.");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function run(action: () => Promise<unknown>, message: string) {
    try {
      setError("");
      await action();
      setNotice(message);
      await load();
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail;
      setError(
        detail === "organization_requires_an_active_owner"
          ? "Une organisation doit toujours conserver au moins un propriétaire actif."
          : detail || "L’opération n’a pas abouti.",
      );
    }
  }
  function select(section: Section) {
    setTab(section);
    router.replace(`/app/settings?section=${section}`, { scroll: false });
  }
  if (!data) return error
    ? <ErrorState title="Paramètres indisponibles" description={error} retry={load} />
    : <LoadingState label="Chargement des paramètres…" />;
  return (
    <div className="min-h-full bg-[#f6f7f8]">
      <OperationPageHeader
        title="Paramètres"
        description="Configurez l’entreprise, les accès et les préférences de votre espace de travail."
      />
      <div className="grid min-h-[calc(100vh-132px)] lg:grid-cols-[272px_minmax(0,1fr)]">
        <aside className="hidden border-r border-[#e0e2e4] bg-[#fafafa] p-3 lg:block">
          <SettingsGroup label="Administration">
            {tabs.map(([id, label, Icon]) => (
              <SettingsItem
                key={id}
                active={tab === id}
                icon={<Icon size={15} />}
                label={label}
                onClick={() => select(id)}
              />
            ))}
          </SettingsGroup>
          <PermissionGuard permission="platform.admin.read">
            <SettingsGroup label="Plateforme">
              <SettingsLink href="/app/platform" icon={<ShieldCheck size={15} />} label="Console Super Admin" />
            </SettingsGroup>
          </PermissionGuard>
        </aside>
        <main className="min-w-0 p-5 lg:p-7">
          <div className="mx-auto max-w-[1120px]">
            <label className="mb-5 grid gap-1.5 text-[12px] font-medium text-[#59636e] lg:hidden">
              Section des paramètres
              <select className={input} value={tab} onChange={(event) => select(event.target.value as Section)}>
                {tabs.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </label>
            <div className="mb-5 flex items-start gap-3 border-b border-[#e5e6e7] pb-4">
              <div className="min-w-0 flex-1"><h2 className="text-[20px] font-semibold">
                {sectionTitles[tab][0]}
              </h2>
              <p className="mt-1 text-[13px] text-[#69707d]">
                {sectionTitles[tab][1]}
              </p></div>
            </div>
            {notice && (
              <div className="mb-3 rounded-[5px] bg-emerald-50 px-4 py-3 text-[13px] text-emerald-800">
                {notice}
              </div>
            )}
            {error && (
              <div className="mb-3 rounded-[5px] bg-red-50 px-4 py-3 text-[13px] text-red-700">
                {error}
              </div>
            )}
            {tab === "general" && <Preferences data={data} run={run} />}{" "}
            {tab === "agency" && <Organization data={data} run={run} />}{" "}
            {tab === "workspaces" && <Workspaces data={data} run={run} />}{" "}
            {tab === "locations" && <Locations data={data} run={run} />}{" "}
            {tab === "services" && <OrganizationTransportSettings section="services"/>}{" "}
            {tab === "routes" && <OrganizationTransportSettings section="routes"/>}{" "}
            {tab === "team" && <Team data={data} run={run} />}{" "}
            {tab === "roles" && <Roles data={data} run={run} />}{" "}
            {tab === "notifications" && (
              <NotificationsSettings />
            )}{" "}
            {tab === "integrations" && <Integrations data={data} run={run} />}{" "}
            {tab === "documents" && <DocumentsSettings data={data} run={run} />}{" "}
            {tab === "billing" && <BillingSettings data={data} />}{" "}
            {tab === "security" && <Security data={data} run={run} />}{" "}
            {tab === "data" && <DataSettings data={data} run={run} />}{" "}
            {tab === "audit" && <AuditSettings />}{" "}
          </div>
        </main>
      </div>
    </div>
  );
}

function SettingsGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-5">
      <div className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#8a9097]">
        {label}
      </div>
      <div className="space-y-0.5">{children}</div>
    </section>
  );
}
const settingsItemClass =
  "flex min-h-9 w-full items-center gap-2.5 rounded-[5px] px-2.5 text-left text-[13px]";
function SettingsItem({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${settingsItemClass} ${active ? "bg-[#e4f4ee] font-medium text-[#145f49]" : "text-[#444b52] hover:bg-[#eeeeed]"}`}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}
function SettingsLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={`${settingsItemClass} text-[#444b52] hover:bg-[#eeeeed]`}
    >
      {icon}
      <span className="truncate">{label}</span>
    </Link>
  );
}
function Card({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[8px] border border-[#e3e7ea] bg-white">
      <div className="border-b border-[#edf0f3] px-5 py-4">
        <h2 className="text-[15px] font-semibold text-[#293034]">{title}</h2>
        <p className="text-[12px] text-[#697178]">{description}</p>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

const notificationCategories = [
  ["OPERATIONS", "Activité de l’agence", "Dossiers, tâches et opérations importantes"],
  ["SHIPMENT", "Expéditions", "Départs, arrivées, retards et incidents"],
  ["PACKAGE", "Colis", "Réception, blocage, anomalie et disponibilité"],
  ["PAYMENT", "Paiements", "Paiement reçu, échéance et facture impayée"],
  ["COMPLIANCE", "Contrôles", "Documents, restrictions et validations requises"],
  ["SYSTEM", "Compte et sécurité", "Invitations, accès et alertes de sécurité"],
] as const;

function NotificationsSettings() {
  const [items, setItems] = useState<NotificationPreference[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    getNotificationPreferences()
      .then(setItems)
      .catch(() => setMessage("Les préférences ne peuvent pas être chargées."));
  }, []);
  const current = (category: string): NotificationPreference =>
    items.find((item) => item.category === category) || {
      category,
      in_app: true,
      email: false,
      whatsapp: false,
      digest_frequency: "IMMEDIATE",
    };
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setMessage("");
    try {
      const saved = await Promise.all(
        notificationCategories.map(([category]) =>
          saveNotificationPreference({
            category,
            in_app: form.get(`${category}.app`) === "on",
            email: form.get(`${category}.email`) === "on",
            whatsapp: form.get(`${category}.whatsapp`) === "on",
            digest_frequency: String(form.get(`${category}.frequency`) || "IMMEDIATE"),
          }),
        ),
      );
      setItems(saved.map((result) => result.preference || result));
      setMessage("Préférences enregistrées.");
    } catch {
      setMessage("L’enregistrement n’a pas abouti.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Card
      title="Notifications de l’agence"
      description="Choisissez où et à quel rythme votre équipe reçoit chaque type d’alerte."
    >
      <form onSubmit={submit}>
        <div className="overflow-x-auto">
          <div className="min-w-[680px]">
            <div className="grid grid-cols-[minmax(240px,1fr)_74px_74px_92px_150px] border-b border-[#e6e9ee] bg-[#f7f8fa] px-3 py-2 text-[12px] font-medium text-[#5f6b76]">
              <span>Événement</span><span>Dans Slaivio</span><span>Email</span><span>WhatsApp</span><span>Fréquence</span>
            </div>
            {notificationCategories.map(([category, label, description]) => {
              const preference = current(category);
              return (
                <div key={category} className="grid grid-cols-[minmax(240px,1fr)_74px_74px_92px_150px] items-center border-b border-[#edf0f3] px-3 py-3 last:border-0">
                  <div><b className="text-[13px]">{label}</b><p className="text-[11px] text-[#74808c]">{description}</p></div>
                  <input aria-label={`${label} dans Slaivio`} name={`${category}.app`} type="checkbox" defaultChecked={preference.in_app} className="h-4 w-4 accent-[#12c76f]" />
                  <input aria-label={`${label} par email`} name={`${category}.email`} type="checkbox" defaultChecked={preference.email} className="h-4 w-4 accent-[#12c76f]" />
                  <input aria-label={`${label} par WhatsApp`} name={`${category}.whatsapp`} type="checkbox" defaultChecked={preference.whatsapp} className="h-4 w-4 accent-[#12c76f]" />
                  <select name={`${category}.frequency`} defaultValue={preference.digest_frequency} className={input}>
                    <option value="IMMEDIATE">Immédiatement</option><option value="DAILY">Résumé quotidien</option><option value="WEEKLY">Résumé hebdomadaire</option><option value="OFF">Désactivé</option>
                  </select>
                </div>
              );
            })}
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between"><p className="text-[12px] text-[#537064]">{message}</p><button disabled={saving} className={primary}>{saving ? "Enregistrement…" : "Enregistrer"}</button></div>
      </form>
    </Card>
  );
}
function Organization({
  data,
  run,
}: {
  data: AdminData;
  run: (a: () => Promise<unknown>, m: string) => void;
}) {
  const o = data.organization;
  const [logoUrl, setLogoUrl] = useState(String(o.logo_url || ""));
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    run(
      () =>
        updateOrganization({
          expected_version: o.row_version,
          organization_name: val(f, "name"),
          legal_name: val(f, "legal"),
          country: val(f, "country"),
          city: val(f, "city"),
          address: val(f, "address"),
          phone: val(f, "phone"),
          email: val(f, "email"),
          website: val(f, "website"),
          logo_url: val(f, "logo_url"),
          registration_number: val(f, "registration"),
          tax_number: val(f, "tax"),
        }),
      "Profil de l’agence mis à jour.",
    );
  }
  return (
    <Card
      title="Profil de l’agence"
      description="Informations officielles réutilisées dans les factures, documents et communications."
    >
      <PermissionGuard permission="organization.manage" fallback={<ReadOnly />}>
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
          <FormGeographyFields
            key={`organization-geo-${String(o.row_version)}`}
            initialCountry={String(o.country || "")}
            initialCity={String(o.city || "")}
            className={`${input} mt-1`}
            fieldClassName="text-[12px] text-[#555d68]"
          />
          {[
            ["name", "Nom commercial", "organization_name"],
            ["legal", "Raison sociale", "legal_name"],
            ["registration", "Numéro d’enregistrement", "registration_number"],
            ["tax", "Identifiant fiscal", "tax_number"],
            ["phone", "Téléphone", "phone"],
            ["email", "Email", "email"],
            ["website", "Site web", "website"],
            ["address", "Adresse", "address"],
          ].map(([n, l, k]) => (
            <label key={n} className="text-[12px] text-[#555d68]">
              {l}
              <input
                className={`${input} mt-1`}
                name={n}
                defaultValue={String(o[k] || "")}
              />
            </label>
          ))}
          <label className="text-[12px] text-[#555d68]">
            Logo de l’agence
            <input
              className={`${input} mt-1`}
              name="logo_url"
              type="url"
              pattern="https://.*"
              value={logoUrl}
              onChange={(event) => setLogoUrl(event.target.value)}
              placeholder="https://exemple.com/logo.png"
            />
          </label>
          {logoUrl && (
            <div className="flex min-h-24 items-center gap-4 rounded-xl bg-[#f7f9f8] p-4">
              <Image src={logoUrl} alt="Aperçu du logo de l’agence" width={160} height={64} className="max-h-16 w-auto object-contain" unoptimized />
              <span className="text-[12px] text-[#69747d]">Aperçu avant enregistrement</span>
            </div>
          )}
          <div className="md:col-span-2">
            <button className={primary}>Enregistrer le profil</button>
          </div>
        </form>
      </PermissionGuard>
    </Card>
  );
}
function Team({
  data,
  run,
}: {
  data: AdminData;
  run: (a: () => Promise<unknown>, m: string) => void;
}) {
  async function invite(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    run(
      () => inviteMember(String(f.get("email")), String(f.get("role"))),
      "Invitation envoyée.",
    );
  }
  return (
    <div className="grid gap-4">
      <Card
        title="Inviter un collaborateur"
        description="L’invitation est envoyée par Clerk et expire automatiquement."
      >
        <PermissionGuard permission="team.write">
          <form onSubmit={invite} className="flex flex-wrap gap-2">
            <input
              required
              type="email"
              name="email"
              className={`${input} max-w-sm`}
              placeholder="collaborateur@agence.com"
            />
            <select name="role" className={`${input} max-w-[220px]`}>
              {data.roles.map((r) => (
                <option key={r.id} value={r.role_code}>
                  {r.role_name}
                </option>
              ))}
            </select>
            <button className={primary}>
              <UserPlus className="mr-2 inline" size={14} />
              Inviter
            </button>
          </form>
        </PermissionGuard>
      </Card>
      <Card
        title={`Membres (${data.members.length})`}
        description="Suspendre un accès prend effet côté API sans supprimer l’historique."
      >
        <div className="divide-y">
          {data.members.map((m) => (
            <MemberRow key={m.id} member={m} roles={data.roles} locations={data.locations} run={run} />
          ))}
        </div>
      </Card>
      {data.invitations.length > 0 && (
        <Card
          title="Invitations"
          description="Invitations en attente, acceptées ou révoquées."
        >
          <div className="divide-y">
            {data.invitations.map((x) => (
              <div
                className="flex items-center justify-between py-3 text-[13px]"
                key={String(x.id)}
              >
                <div>
                  <b>{String(x.email)}</b>
                  <p className="text-[12px] text-[#69707d]">
                    {String(x.role_code)} · {String(x.status)}
                  </p>
                </div>
                {x.status === "PENDING" && (
                  <PermissionGuard permission="team.manage">
                    <button
                      className={button}
                      onClick={() =>
                        run(
                          () => revokeInvitation(String(x.id)),
                          "Invitation révoquée.",
                        )
                      }
                    >
                      Révoquer
                    </button>
                  </PermissionGuard>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
function MemberRow({
  member,
  roles,
  locations,
  run,
}: {
  member: Member;
  roles: AdminData["roles"];
  locations: AdminData["locations"];
  run: (a: () => Promise<unknown>, m: string) => void;
}) {
  const [role, setRole] = useState(member.role_code),
    [status, setStatus] = useState(member.status),
    [officeScope, setOfficeScope] = useState(member.office_access_scope || "ALL_OFFICES"),
    [officeIds, setOfficeIds] = useState(member.office_ids || []);
  const offices = locations.filter((location) =>
    location.location_type === "OFFICE" && location.status === "ACTIVE",
  );
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3 text-[13px]">
      <div>
        <b>{member.member_display_name || member.member_email || "Membre"}</b>
        <p className="text-[12px] text-[#69707d]">
          {member.member_email || member.id}
        </p>
      </div>
      <PermissionGuard
        permission="team.manage"
        fallback={
          <span>
            {member.role_name} · {member.status}
          </span>
        }
      >
        <div className="flex gap-2">
          <select
            className={input}
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            {roles.map((r) => (
              <option key={r.id} value={r.role_code}>
                {r.role_name}
              </option>
            ))}
          </select>
          <select
            className={input}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="ACTIVE">Actif</option>
            <option value="SUSPENDED">Suspendu</option>
          </select>
          <button
            className={button}
            onClick={() =>
              run(
                () =>
                  updateMember(member.id, {
                    role_code: role,
                    status,
                    expected_version: member.row_version,
                  }),
                "Accès du membre mis à jour.",
              )
            }
          >
            Appliquer
          </button>
        </div>
      </PermissionGuard>
      {member.role_code !== "OWNER" && (
        <PermissionGuard permission="locations.access.manage">
          <div className="basis-full rounded-[6px] border border-[#e2e5e7] bg-[#fafbfb] p-3">
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-[12px] font-medium">Bureaux autorisés</label>
              <select
                className={`${input} max-w-[240px]`}
                value={officeScope}
                onChange={(event) => setOfficeScope(event.target.value as "ALL_OFFICES" | "SELECTED_OFFICES")}
              >
                <option value="ALL_OFFICES">Tous les bureaux</option>
                <option value="SELECTED_OFFICES">Bureaux sélectionnés</option>
              </select>
              <button
                className={button}
                onClick={() => run(
                  () => updateMemberOfficeAccess(member.id, {
                    office_access_scope: officeScope,
                    office_ids: officeScope === "SELECTED_OFFICES" ? officeIds : [],
                    expected_version: member.row_version,
                  }),
                  "Bureaux autorisés mis à jour.",
                )}
              >
                Enregistrer les accès
              </button>
            </div>
            {officeScope === "SELECTED_OFFICES" && (
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                {offices.map((office) => {
                  const id = String(office.id);
                  return (
                    <label key={id} className="flex items-center gap-2 text-[12px]">
                      <input
                        type="checkbox"
                        checked={officeIds.includes(id)}
                        onChange={(event) => setOfficeIds((current) =>
                          event.target.checked
                            ? [...new Set([...current, id])]
                            : current.filter((item) => item !== id),
                        )}
                      />
                      {String(office.name)} · {String(office.city)}
                    </label>
                  );
                })}
                {!offices.length && <span className="text-[12px] text-[#69707d]">Aucun bureau actif n’est configuré.</span>}
              </div>
            )}
          </div>
        </PermissionGuard>
      )}
    </div>
  );
}
const permissionGroups: Record<string, string> = {
  clients: "Clients",
  dossiers: "Dossiers",
  packages: "Colis",
  shipments: "Expéditions",
  batches: "Batchs et groupages",
  departures: "Calendrier des départs",
  routes: "Routes",
  services: "Services",
  pricing: "Tarification",
  finance: "Finance",
  followups: "Relances",
  broadcasts: "Campagnes",
  knowledge: "Base de connaissances",
  warehouses: "Entrepôts",
  team: "Équipe",
  settings: "Paramètres",
  organization: "Agence",
};
function permissionGroupLabel(group: string) {
  return permissionGroups[group] || "Autres fonctions";
}
function permissionActionLabel(code: string) {
  const action = code.split(".").slice(1).join(".");
  const labels: Record<string, string> = {
    read: "Consulter",
    create: "Créer",
    update: "Modifier",
    manage: "Gérer",
    archive: "Archiver",
    export: "Exporter",
    analytics: "Voir les analyses",
    publish: "Publier",
    approve: "Valider",
    review: "Vérifier",
    scan: "Scanner",
    assign: "Affecter",
  };
  return labels[action] || "Action avancée";
}
function Roles({
  data,
  run,
}: {
  data: AdminData;
  run: (a: () => Promise<unknown>, m: string) => void;
}) {
  const groups = useMemo(
    () =>
      data.permissions.reduce<Record<string, AdminData["permissions"]>>(
        (all, p) => {
          const key = p.permission_code.split(".")[0] || "other";
          (all[key] ??= []).push(p);
          return all;
        },
        {},
      ),
    [data.permissions],
  );
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const roleName = String(f.get("name") || "").trim();
    const generatedCode = roleName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 40);
    run(
      () =>
        saveRole({
          code: generatedCode,
          name: roleName,
          description: f.get("description"),
          permissions: f.getAll("permissions"),
        }),
      "Rôle enregistré.",
    );
  }
  return (
    <div className="grid gap-4 lg:grid-cols-[.8fr_1.2fr]">
      <Card
        title="Rôles existants"
        description="Les rôles système forment le socle; les rôles personnalisés répondent à votre organisation."
      >
        {data.roles.map((r) => (
          <div className="border-b py-3 text-[13px]" key={r.id}>
            <b>{r.role_name}</b>
            <p className="text-[12px] text-[#69707d]">
              {r.permission_count} droits · {r.member_count} membres{" "}
              {r.system_role ? "· Système" : ""}
            </p>
          </div>
        ))}
      </Card>
      <Card
        title="Nouveau rôle personnalisé"
        description="Accordez uniquement les capacités nécessaires."
      >
        <PermissionGuard permission="roles.manage" fallback={<ReadOnly />}>
          <form onSubmit={submit} className="grid gap-5">
            <FormSection title="Responsabilité" description="Utilisez un nom compris par les responsables et les employés.">
              <OperationField label="Nom du rôle" required><input required name="name" className={input} placeholder="Ex. Responsable entrepôt Chine" /></OperationField>
              <OperationField label="À quoi sert ce rôle ?"><input name="description" className={input} placeholder="Décrivez simplement les responsabilités de cette équipe" /></OperationField>
            </FormSection>
            <FormSection title="Actions autorisées" description="Cochez uniquement les actions nécessaires au travail de ce rôle.">
            <div className="max-h-[400px] overflow-y-auto rounded-[6px] border border-[#e3e7ea] p-3">
              {Object.entries(groups).map(([group, permissions]) => (
                <div key={group} className="mb-4">
                  <b className="text-[12px] font-semibold text-[#334155]">
                    {permissionGroupLabel(group)}
                  </b>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {permissions.map((p) => (
                      <label className="flex gap-2 text-[12px]" key={p.id}>
                        <input
                          type="checkbox"
                          name="permissions"
                          value={p.permission_code}
                        />
                        <span>
                          <b>{p.description || permissionActionLabel(p.permission_code)}</b>
                          <small className="block text-[#69707d]">{permissionActionLabel(p.permission_code)}</small>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            </FormSection>
            <div className="flex justify-end"><OperationButton type="submit" variant="primary">Créer le rôle</OperationButton></div>
          </form>
        </PermissionGuard>
      </Card>
    </div>
  );
}
function Preferences({
  data,
  run,
}: {
  data: AdminData;
  run: (a: () => Promise<unknown>, m: string) => void;
}) {
  const locale=useDashboardLocale();
  const s = data.settings || { row_version: 1 };
  const timeZones=useMemo(()=>getTimeZoneOptions(locale).map(({value,label})=>[value,label]),[locale]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    run(
      () =>
        updateSettings({
          expected_version: s.row_version,
          timezone: val(f, "timezone"),
          currency_code: val(f, "currency"),
          country_code: val(f, "country"),
          language_code: String(s.language_code || "fr"),
          date_format: val(f, "date"),
          weight_unit: val(f, "weight"),
          volume_unit: val(f, "volume"),
          time_format: val(f, "time"),
          dimension_unit: val(f, "dimensions"),
          distance_unit: val(f, "distance"),
          notification_email: val(f, "email"),
          settings: s.settings || {},
          security: s.security || {},
        }),
      "Préférences enregistrées.",
    );
  }
  return (
    <Card
      title="Préférences de l’espace"
      description="Fuseau horaire de référence, formats et unités partagés par l’organisation."
    >
      <PermissionGuard permission="settings.write" fallback={<ReadOnly />}>
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
          <SettingSelect label="Fuseau horaire de référence" name="timezone" value={String(s.timezone || "Africa/Kinshasa")} options={timeZones} />
          <SettingSelect label="Devise comptable principale" name="currency" value={String(s.currency_code || "USD")} options={["USD","CDF","EUR","CNY","AED","XAF","GHS","KES"].map(x=>[x,x])} />
          <FormGeographyFields initialCountry={String(s.country_code || data.organization.country || "")} countryValueMode="isoCode" showCity={false} className={`${input} mt-1`} fieldClassName="grid gap-1 text-[13px]" countryLabel="Pays principal" />
          <SettingSelect label="Format de date" name="date" value={String(s.date_format || "DD/MM/YYYY")} options={[["DD/MM/YYYY","31/12/2026"],["MM/DD/YYYY","12/31/2026"],["YYYY-MM-DD","2026-12-31"]]} />
          <SettingSelect label="Format de l’heure" name="time" value={String(s.time_format || "24H")} options={[["24H","24 heures"],["12H","12 heures (AM/PM)"]]} />
          <SettingSelect label="Poids" name="weight" value={String(s.weight_unit || "kg")} options={[["kg","Kilogrammes (kg)"],["lb","Livres (lb)"]]} />
          <SettingSelect label="Volume" name="volume" value={String(s.volume_unit || "cbm")} options={[["cbm","Mètre cube (m³)"],["ft3","Pied cube (ft³)"]]} />
          <SettingSelect label="Dimensions" name="dimensions" value={String(s.dimension_unit || "cm")} options={[["cm","Centimètres"],["in","Pouces"]]} />
          <SettingSelect label="Distance" name="distance" value={String(s.distance_unit || "km")} options={[["km","Kilomètres"],["mi","Miles"]]} />
          <label>Email pour les alertes importantes<input name="email" type="email" className={`${input} mt-1`} defaultValue={String(s.notification_email || "")} placeholder="operations@agence.com" /></label>
          <div className="flex items-end"><button className={primary}>Enregistrer les préférences</button></div>
        </form>
      </PermissionGuard>
    </Card>
  );
}
function SettingSelect({label,name,value,options}:{label:string;name:string;value:string;options:string[][]}) {
  return <label>{label}<select name={name} defaultValue={value} className={`${input} mt-1`}>{options.map(([option,labelText])=><option key={option} value={option}>{labelText}</option>)}</select></label>;
}
function Security({
  data,
  run,
}: {
  data: AdminData;
  run: (a: () => Promise<unknown>, m: string) => void;
}) {
  const s = data.settings || { row_version: 1 },
    sec = (s.security || {}) as Record<string, unknown>;
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    run(
      () =>
        updateSettings({
          ...s,
          expected_version: s.row_version,
          security: {
            require_mfa: f.get("mfa") === "on",
            session_timeout_minutes: Number(f.get("timeout")),
            inactivity_timeout_minutes: Number(f.get("inactivity")),
            max_failed_attempts: Number(f.get("attempts")),
          },
        }),
      "Politique de sécurité mise à jour.",
    );
  }
  return (
    <Card
      title="Protection des comptes"
      description="Définissez les règles de connexion appliquées aux membres de votre agence."
    >
      <PermissionGuard permission="security.manage" fallback={<ReadOnly />}>
        <form onSubmit={submit} className="grid max-w-2xl gap-5">
          <label className="flex items-start gap-3 rounded-md bg-[#f8faf9] p-4 ring-1 ring-[#e6eae8]">
            <input
              name="mfa"
              type="checkbox"
              defaultChecked={Boolean(sec.require_mfa)}
            />
            <span><b className="block text-[13px]">Exiger la double authentification</b><small className="text-[11px] font-normal text-[#74808c]">Chaque membre devra confirmer sa connexion avec un second facteur.</small></span>
          </label>
          <div className="grid gap-4 sm:grid-cols-3">
            <label>Durée maximale d’une session<input name="timeout" type="number" min="15" max="10080" className={`${input} mt-1`} defaultValue={Number(sec.session_timeout_minutes || 480)} /><small className="text-[11px] font-normal text-[#74808c]">En minutes</small></label>
            <label>Déconnexion après inactivité<input name="inactivity" type="number" min="5" max="1440" className={`${input} mt-1`} defaultValue={Number(sec.inactivity_timeout_minutes || 30)} /><small className="text-[11px] font-normal text-[#74808c]">En minutes</small></label>
            <label>Tentatives avant verrouillage<input name="attempts" type="number" min="3" max="20" className={`${input} mt-1`} defaultValue={Number(sec.max_failed_attempts || 5)} /><small className="text-[11px] font-normal text-[#74808c]">Échecs de connexion</small></label>
          </div>
          <div className="rounded-md bg-[#f7f8fa] p-4 text-[12px] text-[#53606d]"><b className="block text-[#25292e]">Sessions et appareils</b>Chaque membre peut consulter ses appareils connectés et fermer ses autres sessions depuis son menu de compte.</div>
          <button className={primary}>Enregistrer la politique</button>
        </form>
      </PermissionGuard>
    </Card>
  );
}
function Workspaces({
  data,
  run,
}: {
  data: AdminData;
  run: (a: () => Promise<unknown>, m: string) => void;
}) {
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    run(
      () =>
        saveWorkspace({
          name: val(f, "name"),
          code: val(f, "code"),
          country_code: val(f, "country"),
          currency_code: val(f, "currency") || "USD",
          timezone: val(f, "timezone") || "UTC",
          language_code: val(f, "language") || "fr",
        }),
      "Workspace enregistré.",
    );
  }
  return (
    <div className="grid gap-4">
      <Card
        title="Nouveau workspace"
        description="Un périmètre opérationnel isolé par pays ou activité."
      >
        <form onSubmit={submit} className="grid gap-2 md:grid-cols-3">
          <input
            required
            name="name"
            className={input}
            placeholder="Workspace RDC"
          />
          <input required name="code" className={input} placeholder="RDC" />
          <FormGeographyFields countryValueMode="isoCode" showCity={false} className={input} fieldClassName="grid gap-1 text-[12px] text-[#555d68]" countryLabel="Pays du workspace" />
          <select name="currency" className={input} defaultValue="USD"><option>USD</option><option>EUR</option><option>CDF</option><option>GBP</option><option>CNY</option><option>AED</option><option>XAF</option><option>GHS</option><option>KES</option></select>
          <select name="timezone" className={input} defaultValue="UTC"><option value="Africa/Kinshasa">Kinshasa</option><option value="Africa/Douala">Douala</option><option value="Africa/Abidjan">Abidjan</option><option value="Europe/Brussels">Bruxelles</option><option value="Europe/Paris">Paris</option><option value="Asia/Shanghai">Shanghai</option><option value="Asia/Dubai">Dubaï</option><option value="UTC">Temps universel (UTC)</option></select>
          <select name="language" className={input}>
            <option value="fr">Français</option>
            <option value="en">English</option>
          </select>
          <button className={primary}>Enregistrer</button>
        </form>
      </Card>
      <Card
        title="Workspaces"
        description="Les archives restent auditables et ne suppriment aucune donnée."
      >
        {data.workspaces.map((x) => (
          <div
            key={String(x.id)}
            className="flex items-center justify-between border-b py-3 text-[13px]"
          >
            <div>
              <b>{String(x.name)}</b>
              <p className="text-[#69707d]">
                {String(x.code)} · {String(x.country_code || "—")} ·{" "}
                {String(x.currency_code)} · {String(x.status)}
              </p>
            </div>
            {x.status === "ACTIVE" && (
              <button
                className={button}
                onClick={() =>
                  run(
                    () => archiveWorkspace(String(x.id), Number(x.row_version)),
                    "Workspace archivé.",
                  )
                }
              >
                Archiver
              </button>
            )}
          </div>
        ))}
        {!data.workspaces.length && (
          <p className="text-[13px] text-[#69707d]">
            Aucun workspace configuré.
          </p>
        )}
      </Card>
    </div>
  );
}
function Locations({
  data,
  run,
}: {
  data: AdminData;
  run: (a: () => Promise<unknown>, m: string) => void;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const offices = data.locations.filter((location) => location.location_type === "OFFICE");
  const officesByCountry = offices.reduce<Record<string, typeof offices>>((groups, office) => {
    const country = String(office.country);
    groups[country] = [...(groups[country] || []), office];
    return groups;
  }, {});
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    run(
      async () => {
        await saveLocation({
          name: val(f, "name"),
          location_type: "OFFICE",
          country: val(f, "country"),
          city: val(f, "city"),
          address: val(f, "address"),
          phone: val(f, "phone"),
          opening_hours: { text: val(f, "hours") },
          timezone: "UTC",
          services: [],
        });
        setCreateOpen(false);
      },
      "Bureau enregistré.",
    );
  }
  return (
    <div className="grid gap-4">
      <section className="flex flex-col items-start justify-between gap-4 rounded-xl border border-[#e3e7ea] bg-white p-5 sm:flex-row sm:items-center sm:px-6">
        <div>
          <h2 className="text-[15px] font-semibold text-[#293034]">Bureaux de l’agence</h2>
          <p className="mt-1 text-[13px] text-[#697178]">Ajoutez et gérez les implantations physiques de votre organisation.</p>
        </div>
        <OperationButton variant="primary" onClick={() => setCreateOpen(true)} className="h-10 shrink-0 px-4">
          <Plus size={16} aria-hidden="true" />
          Ajouter un bureau
        </OperationButton>
      </section>
      <OperationDrawer
        open={createOpen}
        close={() => setCreateOpen(false)}
        title="Ajouter un bureau"
        description="Renseignez les informations de cette implantation. Vous pourrez les modifier plus tard."
        width="max-w-3xl"
        placement="center"
        bodyClassName="!bg-[#f5f7f8] p-4 sm:p-7"
        headerLeading={<div className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Building2 size={21} aria-hidden="true" /></div>}
        footer={<><OperationButton type="button" onClick={() => setCreateOpen(false)}>Annuler</OperationButton><OperationButton type="submit" form="create-office-form" variant="primary">Enregistrer le bureau</OperationButton></>}
      >
        <form id="create-office-form" onSubmit={submit} className="mx-auto grid w-full max-w-2xl gap-5">
          <section className="rounded-2xl border border-[#e4e9e8] bg-white p-5 shadow-[0_2px_10px_rgba(20,35,32,.03)] sm:p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-emerald-700">01 · Identification</p>
            <h3 className="mt-1 text-[16px] font-semibold text-[#222a30]">Nom et localisation</h3>
            <p className="mb-5 mt-1 text-[13px] text-[#69747c]">Les champs marqués d’un astérisque sont obligatoires.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-[13px] font-semibold text-[#414950] sm:col-span-2">
                Nom du bureau *
                <input required minLength={2} maxLength={120} name="name" autoFocus className={`${input} h-11 rounded-lg px-3.5 text-[14px]`} placeholder="Ex. Bureau de Bobo-Dioulasso" />
              </label>
              <FormGeographyFields required className={`${input} h-11 rounded-lg px-3.5 text-[14px]`} fieldClassName="grid gap-2 text-[13px] font-semibold text-[#414950]" />
            </div>
          </section>
          <section className="rounded-2xl border border-[#e4e9e8] bg-white p-5 shadow-[0_2px_10px_rgba(20,35,32,.03)] sm:p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-emerald-700">02 · Informations complémentaires</p>
            <h3 className="mt-1 text-[16px] font-semibold text-[#222a30]">Coordonnées locales <span className="text-[13px] font-normal text-[#849097]">· facultatif</span></h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-[13px] font-semibold text-[#414950] sm:col-span-2">Adresse du bureau<input name="address" maxLength={300} className={`${input} h-11 rounded-lg px-3.5 text-[14px]`} placeholder="Rue, numéro et repère utile" /></label>
              <label className="grid gap-2 text-[13px] font-semibold text-[#414950]">Téléphone du bureau<input name="phone" type="tel" maxLength={30} className={`${input} h-11 rounded-lg px-3.5 text-[14px]`} placeholder="+226 ..." /></label>
              <label className="grid gap-2 text-[13px] font-semibold text-[#414950]">Horaires d’ouverture<input name="hours" maxLength={300} className={`${input} h-11 rounded-lg px-3.5 text-[14px]`} placeholder="Lun–Sam, 08:00–17:00" /></label>
            </div>
          </section>
        </form>
      </OperationDrawer>
      <Card
        title={`Bureaux de l’agence · ${offices.length}`}
        description="Les bureaux inactifs restent conservés pour préserver l’historique."
      >
        {Object.entries(officesByCountry).sort(([left], [right]) => left.localeCompare(right)).map(([country, items]) => (
          <section key={country} className="border-b py-2 last:border-b-0">
            <h3 className="flex items-center justify-between py-2 text-[13px] font-semibold text-[#303a43]">
              {country}<span className="text-[11px] font-normal text-[#74808c]">{items.length} bureau{items.length > 1 ? "x" : ""}</span>
            </h3>
            {items.map((x) => (
              <div key={String(x.id)} className="flex items-center justify-between gap-4 border-t py-3 text-[13px]">
                <div className="min-w-0">
                  <b>{String(x.name)}</b>
                  <p className="text-[#69707d]">
                    {String(x.city)}
                    {x.address ? ` · ${String(x.address)}` : ""}
                    {x.phone ? ` · ${String(x.phone)}` : ""}
                  </p>
                  <span className={x.status === "ACTIVE" ? "text-emerald-700" : "text-slate-500"}>
                    {x.status === "ACTIVE" ? "Actif" : "Inactif"}
                  </span>
                </div>
                <button
                  type="button"
                  className={button}
                  onClick={() => run(
                    () => updateLocationStatus(
                      String(x.id),
                      x.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                      Number(x.row_version),
                    ),
                    x.status === "ACTIVE" ? "Bureau désactivé." : "Bureau réactivé.",
                  )}
                >
                  {x.status === "ACTIVE" ? "Désactiver" : "Réactiver"}
                </button>
              </div>
            ))}
          </section>
        ))}
        {!offices.length && <p className="py-3 text-[13px] text-[#69707d]">Aucun bureau configuré.</p>}
      </Card>
    </div>
  );
}
function Integrations({
  data,
  run,
}: {
  data: AdminData;
  run: (a: () => Promise<unknown>, m: string) => void;
}) {
  async function connect(provider: "WHATSAPP" | "GMAIL") {
    run(
      () =>
        saveIntegration({
          provider,
          account_label: provider === "WHATSAPP" ? "WhatsApp Business de l’agence" : "Gmail de l’agence",
          status: "CONNECTING",
          granted_permissions: [],
          configuration: {},
        }),
      "Connexion initialisée. Finalisez le consentement OAuth du fournisseur.",
    );
  }
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {(["WHATSAPP", "GMAIL", "TIKTOK"] as const).map((provider) => {
        const current = data.integrations.find((x) => x.provider === provider);
        const available = provider === "WHATSAPP";
        return (
          <Card
            key={provider}
            title={provider === "WHATSAPP" ? "WhatsApp Business" : provider === "GMAIL" ? "Gmail" : "TikTok Business"}
            description={provider === "WHATSAPP" ? "Messages clients, Inbox, campagnes et réponses de l’agence." : "Ce canal pourra être ajouté à votre espace de communication."}
          >
            <p className="mb-4 text-[13px]">État : <b>{integrationStatusLabel(String(current?.status || "DISCONNECTED"), available)}</b>
              {current?.last_sync_at
                ? ` · Sync ${new Date(String(current.last_sync_at)).toLocaleString("fr-FR")}`
                : ""}
            </p>
            {available ? <button className={primary} onClick={() => connect("WHATSAPP")}>{current ? "Reconnecter WhatsApp" : "Connecter WhatsApp"}</button> : <span className="inline-flex h-9 items-center rounded-md bg-[#f1f3f4] px-3 text-[12px] font-medium text-[#707780]">Disponible prochainement</span>}
          </Card>
        );
      })}
    </div>
  );
}
function integrationStatusLabel(status: string, available: boolean) {
  if (!available) return "Bientôt disponible";
  return ({ CONNECTED: "Connecté", CONNECTING: "Connexion à finaliser", ERROR: "Attention requise", DISCONNECTED: "Non connecté" } as Record<string,string>)[status] || status;
}
function DocumentsSettings({
  data,
  run,
}: {
  data: AdminData;
  run: (a: () => Promise<unknown>, m: string) => void;
}) {
  return (
    <Card
      title="Documents & numérotation"
      description="Formats versionnés, jamais codés en dur."
    >
      <div className="grid gap-3 md:grid-cols-2">
        {data.numbering.map((x) => (
          <form
            key={String(x.id)}
            className="rounded-[7px] border border-[#e3e7ea] bg-[#fafbfb] p-4"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              run(
                () =>
                  saveNumbering(
                    String(x.document_type),
                    String(f.get("format")),
                    Number(x.row_version),
                  ),
                "Format enregistré.",
              );
            }}
          >
            <div className="mb-3"><b className="text-[13px]">{documentTypeLabel(String(x.document_type))}</b><p className="mt-0.5 text-[11px] text-[#74808c]">Exemple généré automatiquement : {numberingExample(String(x.prefix_format))}</p></div>
            <label>Format du numéro
              <input name="format" className={`${input} mt-1 font-mono`} defaultValue={String(x.prefix_format)} />
            </label>
            <OperationButton type="submit" className="mt-3">Enregistrer ce format</OperationButton>
          </form>
        ))}
      </div>
    </Card>
  );
}
function documentTypeLabel(type: string) {
  const labels: Record<string, string> = {
    INVOICE: "Factures clients",
    QUOTE: "Devis",
    RECEIPT: "Reçus de paiement",
    CLIENT: "Clients des dossiers",
    DOSSIER: "Dossiers",
    PACKAGE: "Colis",
    SHIPMENT: "Expéditions",
    PAYMENT: "Paiements",
    MANIFEST: "Manifestes",
    DELIVERY_NOTE: "Bons de livraison",
    SHIPPING_LABEL: "Étiquettes colis",
  };
  return labels[type] || type.toLowerCase().replaceAll("_", " ");
}
function numberingExample(format: string) {
  return format
    .replaceAll("{YYYY}", "2026")
    .replaceAll("{YEAR}", "2026")
    .replaceAll("{SEQUENCE}", "184")
    .replace(/\{0+\}/g, "000184");
}
function BillingSettings({ data }: { data: AdminData }) {
  const b = data.billing || {};
  const usage = (b.usage || {}) as Record<string, number>,
    limits = (b.limits || {}) as Record<string, number>;
  return (
    <div className="grid gap-4">
      <Card
        title="Plan actuel"
        description="Abonnement Slaivio, distinct des factures clients."
      >
        <h3 className="text-xl font-semibold">
          {String(b.plan_code || "TRIAL")}
        </h3>
        <p className="text-[13px]">
          {String(b.status || "TRIAL")} · {String(b.monthly_amount || 0)}{" "}
          {String(b.billing_currency || "USD")} / mois
        </p>
        <p className="mt-2 text-[12px] text-[#69707d]">
          Prochaine facturation :{" "}
          {b.next_billing_at
            ? new Date(String(b.next_billing_at)).toLocaleDateString("fr-FR")
            : "Non planifiée"}
        </p>
      </Card>
      <Card
        title="Usage"
        description="Mesures utilisées par le futur moteur d’abonnement."
      >
        {Object.keys({ ...limits, ...usage }).map((k) => (
          <div className="mb-3" key={k}>
            <div className="flex justify-between text-[12px]">
              <span>{k}</span>
              <b>
                {usage[k] || 0} / {limits[k] || "∞"}
              </b>
            </div>
            <div className="mt-1 h-1.5 bg-[#e6e8e8]">
              <div
                className="h-full bg-[#16855f]"
                style={{
                  width: `${Math.min(100, ((usage[k] || 0) / (limits[k] || Infinity)) * 100)}%`,
                }}
              />
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
function DataSettings({
  data,
  run,
}: {
  data: AdminData;
  run: (a: () => Promise<unknown>, m: string) => void;
}) {
  async function exportData() {
    run(
      () =>
        requestDataOperation({
          request_type: "EXPORT",
          scope: {
            modules: [
              "clients",
              "dossiers",
              "packages",
              "shipments",
              "finance",
            ],
            format: "JSON",
          },
        }),
      "Export demandé.",
    );
  }
  async function deleteOrg() {
    const name = String(
      data.organization.organization_name || data.organization.name || "",
    );
    const confirmation = prompt(
      `Tapez exactement « ${name} » pour confirmer la demande`,
    );
    if (confirmation !== name) return;
    run(
      () =>
        requestDataOperation({
          request_type: "DELETE_ORGANIZATION",
          scope: {},
          confirmation,
        }),
      "Demande sensible enregistrée pour validation.",
    );
  }
  return (
    <div className="grid gap-4">
      <Card
        title="Export et conservation"
        description="Les exports sont préparés en arrière-plan et restent auditables."
      >
        <button className={primary} onClick={exportData}>
          Demander un export complet
        </button>
        <p className="mt-3 text-[12px] text-[#69707d]">
          Demandes récentes : {data.data_requests.length}
        </p>
      </Card>
      <section className="border border-red-200 bg-red-50 p-5">
        <h3 className="font-semibold text-red-800">Zone sensible</h3>
        <p className="my-3 text-[12px] text-red-700">
          La suppression n’est jamais immédiate : confirmation forte, audit et
          validation sont requis.
        </p>
        <button
          className="h-9 bg-red-700 px-4 text-[13px] font-semibold text-white"
          onClick={deleteOrg}
        >
          Demander la suppression
        </button>
      </section>
    </div>
  );
}
function ReadOnly() {
  return (
    <p className="rounded-[5px] bg-[#f2f2f1] p-3 text-[12px] text-[#69707d]">
      Consultation seule : votre rôle ne permet pas cette modification.
    </p>
  );
}
