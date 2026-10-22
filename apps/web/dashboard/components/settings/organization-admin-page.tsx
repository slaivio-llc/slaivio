"use client";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Bell,
  Boxes,
  Building2,
  Clock3,
  CreditCard,
  Database,
  FileText,
  KeyRound,
  Languages,
  MapPin,
  ImagePlus,
  Plug,
  Plus,
  Route as RouteIcon,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";
import Link from "next/link";
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
import { FormSection, OperationButton, OperationField } from "@/components/ui/operation-controls";
import { OperationDrawer } from "@/components/ui/operation-drawer";
import { ErrorState, LoadingState } from "@/components/ui/page-state";
import { FormGeographyFields } from "@/components/ui/geography-fields";
import { OrganizationTransportSettings } from "@/components/settings/organization-transport-settings";
const input =
  "h-9 w-full rounded-[5px] border border-[#d8d9dc] bg-white px-3 text-[13px] outline-none focus:border-[#16855f]";
const button =
  "h-9 rounded-[6px] border border-[#d8d9dc] bg-white px-3 text-[13px] font-medium hover:bg-[#f6f7f7]";
const primary =
  "h-9 rounded-[6px] bg-[#12c76f] px-4 text-[13px] font-semibold text-white hover:bg-[#0fb766]";
const tabs = [
  ["subscription", "Abonnement Slaivio", CreditCard],
  ["agency", "Profil de l’agence", Building2],
  ["visual", "Identit\u00e9 visuelle", Building2],
  ["tracking", "Page publique de tracking", Building2],
  ["hours", "Horaires & disponibilit\u00e9", Clock3],
  ["packages", "Colis & r\u00e9ception", Boxes],
  ["delivery", "Exp\u00e9ditions & livraison", RouteIcon],
  ["numbering", "R\u00e9f\u00e9rences & num\u00e9rotation", FileText],
  ["goods", "Marchandises & restrictions", ShieldCheck],
  ["general", "Langues & devises", Languages],
  ["clients", "Clients & conditions", Users],
  ["locations", "Bureaux & contacts", MapPin],
  ["workspaces", "Espaces de travail", Building2],
  ["services", "Services Cargo", Boxes],
  ["routes", "Routes", RouteIcon],
  ["documents", "Documents & étiquettes", FileText],
  ["notifications", "Notifications & messages", Bell],
  ["assistant", "Assistant IA", Building2],
  ["integrations", "Intégrations", Plug],
  ["team", "Équipe & accès", Users],
  ["roles", "Rôles & permissions", KeyRound],
  ["billing", "Paiements & facturation", CreditCard],
  ["security", "Accès & sécurité", ShieldCheck],
  ["data", "Données & confidentialité", Database],
] as const;
type Section = (typeof tabs)[number][0];
const settingGroups: Array<[string, Section[]]> = [
  ["Identité & présence", ["agency", "locations"]],
  ["Opérations Cargo", ["services", "routes", "documents"]],
  ["Clients & finance", ["notifications", "billing"]],
  ["Administration", ["team", "roles", "security", "integrations", "general", "workspaces", "data"]],
];
settingGroups.push(
  ["IDENTIT\u00c9 & PR\u00c9SENCE", ["agency", "visual", "tracking", "locations", "hours"]],
  ["OP\u00c9RATIONS CARGO", ["packages", "delivery", "numbering", "goods", "documents"]],
  ["CLIENTS & FINANCE", ["clients", "billing", "notifications", "assistant"]],
  ["ADMINISTRATION", ["security", "integrations", "general", "subscription"]],
);
const visibleSettings = settingGroups.slice(4).flatMap(([, sections]) => sections);
const sectionTitles: Partial<Record<Section, [string, string]>> = {
  visual: ["Identité visuelle", "Configurez les règles applicables à votre agence."],
  tracking: ["Page publique de tracking", "Personnalisez l’expérience de suivi de vos clients."],
  hours: ["Horaires & disponibilité", "Configurez les horaires d’ouverture et le fuseau horaire de votre agence."],
  packages: ["Colis & réception", "Configurez les règles d’enregistrement et de réception des colis."],
  delivery: ["Expéditions & livraison", "Configurez les confirmations de livraison et les délais de retrait."],
  numbering: ["Références & numérotation", "Configurez le format des références générées pour vos colis."],
  goods: ["Marchandises & restrictions", "Définissez les contrôles et consignes applicables aux marchandises."],
  clients: ["Clients & conditions", "Définissez les conditions de crédit et les règles applicables aux clients."],
  assistant: ["Assistant IA", "Cette section sera complétée avec sa maquette dédiée."],
  subscription: ["Abonnement Slaivio", "Plan et usage de votre abonnement à la plateforme."],
  general: ["Général", "Préférences régionales et unités du workspace actif."],
  agency: ["Profil de l’agence", "Informations officielles utilisées sur les espaces publics et documents."],
  workspaces: ["Workspaces", "Espaces opérationnels, responsables et périmètres de travail."],
  locations: ["Implantations de votre agence", "Bureaux physiques organisés au sein de la même organisation."],
  services: ["Services de transport", "Prestations proposées par l’agence et utilisées par les colis et la tarification."],
  routes: ["Routes commerciales", "Liaisons de transport et services disponibles pour chacune."],
  team: ["Utilisateurs & équipe", "Invitations, affectations et accès des collaborateurs."],
  roles: ["Rôles & permissions", "Responsabilités et droits accordés à chaque rôle."],
  notifications: ["Notifications & messages", "Configurez les notifications automatiques envoyées à vos clients."],
  integrations: ["Canaux & intégrations", "Comptes externes connectés aux opérations de l’agence."],
  documents: ["Documents & étiquettes", "Configurez l’apparence et le format des documents de l’agence."],
  billing: ["Abonnement Slaivio", "Plan, usage et facturation de votre abonnement à la plateforme."],
  security: ["Accès & sécurité", "Configurez les règles applicables à votre agence."],
  data: ["Données & confidentialité", "Export, conservation et demandes sensibles sur les données."],
};
function val(f: FormData, k: string) {
  return String(f.get(k) || "").trim() || null;
}
export function OrganizationAdminPage() {
  const router = useRouter(),
    params = useSearchParams();
  const [data, setData] = useState<AdminData | null>(null),
    [tab, setTab] = useState<Section>("agency"),
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
    const resolved = requested ? aliases[requested] || requested : "agency";
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
          : detail === "clerk_organizations_not_enabled"
            ? "Impossible d’envoyer l’invitation : activez Organizations dans le Clerk Dashboard de l’instance utilisée par l’API, puis réessayez."
            : detail === "invitation_provider_unavailable"
              ? "Le service d’invitation est temporairement injoignable. Réessayez plus tard."
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
    <div className="min-h-full bg-[#fff] px-4 py-5 sm:px-6 lg:py-8">
      <div className="mx-auto max-w-[1080px] bg-white">
        <header className="flex items-center justify-between gap-4 border-b border-[#e7eaec] px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center text-[#30363a]"><Building2 size={19}/></span><div><h1 className="text-[19px] font-semibold text-[#25292e]">Paramètres de l’agence</h1><p className="mt-1 text-[13px] text-[#697178]">Personnalisez votre environnement Slaivio</p></div></div>
          <span className="shrink-0 rounded-full bg-[#f1f2f1] px-2.5 py-1 text-[10px] font-medium text-[#59636b]">Administration</span>
        </header>
        <div className="flex items-center gap-2 border-b border-[#e7eaec] px-4 py-3 text-[13px] text-[#697178] sm:px-6"><Building2 size={14}/><span>{String(data.organization.organization_name || "Agence")}</span><span>›</span><span className="font-medium text-[#25292e]">{sectionTitles[tab]?.[0] || tab}</span></div>
        <div className="grid min-h-[620px] lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="hidden border-b border-[#e0e2e4] p-2.5 lg:block lg:border-b-0 lg:border-r lg:p-3">
          {settingGroups.slice(4).map(([group, sections]) => <SettingsGroup key={group} label={group}>
            {sections.map(id => { const item = tabs.find(([key]) => key === id)!; const [key, label, Icon] = item; return <SettingsItem key={key} active={tab === key} icon={<Icon size={13} />} label={label} onClick={() => select(key)}/>; })}
          </SettingsGroup>)}
          <PermissionGuard permission="platform.admin.read"><SettingsGroup label="Plateforme"><SettingsLink href="/app/platform" icon={<ShieldCheck size={13}/>} label="Console Super Admin"/></SettingsGroup></PermissionGuard>
        </aside>
        <main className="min-w-0 p-4 sm:p-6 [&_form_label]:text-[13px] [&_form_input]:text-[14px] [&_form_textarea]:text-[14px]">
          <div className="mx-auto max-w-[640px]">
            <label className="mb-5 grid gap-1.5 text-[13px] font-medium text-[#59636e] lg:hidden">Section des paramètres<select className={input} value={tab} onChange={(event) => select(event.target.value as Section)}>{visibleSettings.map(id => { const [key, label] = tabs.find(([key]) => key === id)!; return <option key={key} value={key}>{label}</option>; })}</select></label>
            <div className="mb-5 border-b border-[#e7eaec] pb-4"><h2 className="text-[20px] font-semibold text-[#25292e]">{sectionTitles[tab]?.[0] || tab}</h2><p className="mt-1.5 text-[14px] leading-5 text-[#697178]">{sectionTitles[tab]?.[1] || ""}</p></div>
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
            {tab === "notifications" && <CustomerMilestoneNotifications data={data} run={run} />}{" "}
            {tab === "integrations" && <Integrations data={data} run={run} />}{" "}
            {tab === "documents" && <DocumentsSettings data={data} run={run} />}{" "}
            {tab === "billing" && <BillingSettings data={data} />}{" "}
            {tab === "security" && <Security data={data} run={run} />}{" "}
            {tab === "data" && <DataSettings data={data} run={run} />}{" "}
            {!["general", "agency", "visual", "tracking", "packages", "delivery", "numbering", "goods", "clients", "workspaces", "locations", "services", "routes", "team", "roles", "notifications", "integrations", "documents", "billing", "security", "data"].includes(tab) && <div className="rounded-lg border border-[#e7eaec] bg-[#fafbfb] p-5 text-[14px] leading-6 text-[#59636e]">Cette section sera détaillée à partir de sa maquette dédiée. Sa navigation est en place.</div>}
            <VisualIdentitySettings data={data} run={run} active={tab === "visual"} />
            <PublicTrackingSettings data={data} run={run} active={tab === "tracking"} />
            <AgencyHoursSettings data={data} run={run} active={tab === "hours"} />
            <ParcelReceiptRulesSettings data={data} run={run} active={tab === "packages"} />
            <ShipmentDeliverySettings data={data} run={run} active={tab === "delivery"} />
            <PackageNumberingSettings data={data} run={run} active={tab === "numbering"} />
            <GoodsRestrictionsSettings data={data} run={run} active={tab === "goods"} />
            <ClientConditionsSettings data={data} run={run} active={tab === "clients"} />
          </div>
        </main>
        </div>
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
  "flex min-h-8 w-full items-center gap-2 rounded-[5px] px-2 text-left text-[12px]";
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
      className={`${settingsItemClass} ${active ? "bg-[#f0f1f1] font-semibold text-[#25292e]" : "text-[#444b52] hover:bg-[#f5f6f6]"}`}
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

const customerMilestones = [
  ["package_received", "Colis reçu à l'entrepôt"],
  ["departure_confirmed", "Départ effectivement confirmé"],
  ["package_arrived", "Arrivée du colis"],
  ["ready_for_pickup", "Colis prêt à retirer"],
] as const;

function CustomerMilestoneNotifications({ data, run }: { data: AdminData; run: (action: () => Promise<unknown>, message: string) => void }) {
  const rawSettings = data.settings?.settings;
  const storedSettings = rawSettings && typeof rawSettings === "object" && !Array.isArray(rawSettings) ? rawSettings as Record<string, unknown> : {};
  const rawMilestones = storedSettings.customer_milestone_notifications;
  const savedMilestones = rawMilestones && typeof rawMilestones === "object" && !Array.isArray(rawMilestones) ? rawMilestones as Record<string, unknown> : {};
  const [milestones, setMilestones] = useState<Record<string, boolean>>(() => Object.fromEntries(customerMilestones.map(([key]) => [key, savedMilestones[key] !== false])));
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    run(() => updateSettings({ ...data.settings, expected_version: Number(data.settings?.row_version || 1), settings: { ...storedSettings, customer_milestone_notifications: milestones } }), "Paramètres de notifications enregistrés.");
  }
  return <PermissionGuard permission="settings.write" fallback={<ReadOnly />}><form onSubmit={submit} className="max-w-[640px]">
    <section className="border-b border-[#e7eaec] pb-4">
      <h3 className="text-[15px] font-semibold text-[#25292e]">Notifications automatiques</h3>
      <div className="mt-3 divide-y divide-[#edf0f2]">{customerMilestones.map(([key, label]) => <label key={key} className="flex min-h-11 cursor-pointer items-center justify-between gap-4 py-2 text-[14px] text-[#30363a]"><span>{label}</span><input aria-label={label} type="checkbox" checked={milestones[key] !== false} onChange={event => setMilestones(current => ({ ...current, [key]: event.target.checked }))} className="h-5 w-5 shrink-0 accent-[#202326]" /></label>)}</div>
      <p className="mt-3 text-[12px] leading-5 text-[#697178]">Envoi soumis aux connexions actives, aux modèles approuvés, au consentement et à la prévention des doublons.</p>
    </section>
    <div className="flex justify-end pt-4"><button className={primary}>Enregistrer</button></div>
  </form></PermissionGuard>;
}
function PublicTrackingSettings({
  data,
  run,
  active,
}: {
  data: AdminData;
  run: (action: () => Promise<unknown>, message: string) => void;
  active: boolean;
}) {
  const rawSettings = data.settings?.settings;
  const storedSettings = rawSettings && typeof rawSettings === "object" && !Array.isArray(rawSettings)
    ? rawSettings as Record<string, unknown>
    : {};
  const storedPage = storedSettings.public_tracking_page && typeof storedSettings.public_tracking_page === "object"
    ? storedSettings.public_tracking_page as Record<string, unknown>
    : {};
  const fallbackSlug = String(data.organization.organization_name || "agence")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "agence";
  const [enabled, setEnabled] = useState(storedPage.enabled !== false);
  const [slug, setSlug] = useState(String(storedPage.slug || fallbackSlug));
  const [welcome, setWelcome] = useState(String(storedPage.welcome_message || "Suivez votre colis en temps réel grâce à sa référence."));
  const [showBrand, setShowBrand] = useState(storedPage.show_brand !== false);
  const [showSupport, setShowSupport] = useState(storedPage.show_support !== false);
  const [showHistory, setShowHistory] = useState(storedPage.show_history !== false);
  const [showPricing, setShowPricing] = useState(storedPage.show_pricing === true);
  if (!active) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nextPage = {
      enabled,
      slug: String(form.get("slug") || "").trim().toLowerCase(),
      welcome_message: String(form.get("welcome") || "").trim(),
      show_brand: showBrand,
      show_support: showSupport,
      show_history: showHistory,
      show_pricing: showPricing,
    };
    run(() => updateSettings({
      ...data.settings,
      expected_version: Number(data.settings?.row_version || 1),
      settings: { ...storedSettings, public_tracking_page: nextPage },
    }), "Paramètres de tracking public enregistrés.");
  }

  const publicUrl = `tracking.slaivio.com/${slug || "identifiant-agence"}`;
  const agencyName = String(data.organization.organization_name || "Votre agence");
  const supportPhone = String(data.organization.phone || "");
  return <section className="grid gap-5">
    <form onSubmit={submit} className="grid max-w-[640px] gap-5">
      <section className="grid gap-3 border-b border-[#e7eaec] pb-5">
        <h3 className="text-[15px] font-semibold text-[#25292e]">Suivi public</h3>
        <label className="flex items-center justify-between gap-4 py-1 text-[14px] font-medium text-[#30363a]">
          <span><span className="block">Activer le suivi public</span><span className="mt-1 block text-[12px] font-normal text-[#697178]">Les clients peuvent consulter leurs colis sans compte.</span></span>
          <input aria-label="Activer le suivi public" type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} className="h-5 w-5 accent-[#137c56]" />
        </label>
        <label className="grid gap-1.5 text-[13px] font-medium text-[#59636e]">Identifiant public de l’agence<input name="slug" required minLength={3} maxLength={40} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={slug} onChange={event => setSlug(event.target.value.toLowerCase())} className="h-10 w-full rounded-full border border-[#d8dddf] px-3 text-[14px] font-normal text-[#25292e] outline-none focus:border-[#16855f]" /></label>
        <div className="pt-1"><p className="text-[12px] text-[#697178]">Adresse illustrative</p><p className="mt-1 text-[13px] font-medium text-[#30363a]">{publicUrl}</p><p className="mt-1 text-[11px] text-[#858d93]">La disponibilité et l’unicité de l’identifiant doivent être vérifiées côté serveur.</p></div>
        <label className="grid gap-1.5 text-[13px] font-medium text-[#59636e]">Message d’accueil<textarea name="welcome" rows={3} maxLength={300} value={welcome} onChange={event => setWelcome(event.target.value)} className="w-full rounded-lg border border-[#d8dddf] px-3 py-2.5 text-[14px] font-normal text-[#25292e] outline-none focus:border-[#16855f]" /></label>
      </section>
      <section className="grid gap-3 border-b border-[#e7eaec] pb-5">
        <h3 className="text-[15px] font-semibold text-[#25292e]">Éléments visibles sur la page</h3>
        <VisibilityToggle label="Afficher le logo et le nom de l’agence" checked={showBrand} onChange={setShowBrand}/>
        <VisibilityToggle label="Afficher les coordonnées du support" checked={showSupport} onChange={setShowSupport}/>
        <VisibilityToggle label="Afficher l’historique de suivi" checked={showHistory} onChange={setShowHistory}/>
        <VisibilityToggle label="Afficher les informations tarifaires" checked={showPricing} onChange={setShowPricing}/>
      </section>
      <section>
        <h3 className="text-[15px] font-semibold text-[#25292e]">Aperçu de la page client</h3>
        <div className="mt-3 rounded-lg border border-[#d8dddf] p-4">
          {showBrand && <div className="flex items-center gap-2 text-[13px] font-medium text-[#30363a]"><span className="grid h-8 w-8 place-items-center rounded-md bg-[#f4f6f5]"><Building2 size={16}/></span>{agencyName}</div>}
          <h4 className="mt-4 text-[15px] font-semibold text-[#25292e]">Suivez votre colis</h4>
          <p className="mt-1 text-[13px] leading-5 text-[#697178]">{welcome}</p>
          <div className="mt-4 flex gap-2"><span className="h-10 flex-1 rounded-lg border border-[#d8dddf] px-3 py-2 text-[13px] text-[#9aa1a6]">Référence du colis</span><span className="rounded-lg bg-[#172b4d] px-4 py-2 text-[13px] font-medium text-white">Suivre</span></div>
          {showSupport && supportPhone && <p className="mt-3 text-[12px] text-[#697178]">Support : {supportPhone}</p>}
          {!enabled && <p className="mt-3 text-[12px] font-medium text-amber-700">Le suivi public est désactivé.</p>}
          {!showHistory && <p className="mt-2 text-[11px] text-[#899197]">L’historique de suivi est masqué.</p>}
          {showPricing && <p className="mt-2 text-[11px] text-[#899197]">Les informations tarifaires ne seront visibles que si elles existent et sont autorisées.</p>}
        </div>
      </section>
      <p className="text-[12px] leading-5 text-[#697178]">La consultation réelle doit protéger les données personnelles et limiter les informations accessibles avec une simple référence.</p>
      <PermissionGuard permission="organization.manage"><div className="flex justify-end border-t border-[#e7eaec] pt-4"><button className={primary}>Enregistrer</button></div></PermissionGuard>
    </form>
  </section>;
}

function VisibilityToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex items-center justify-between gap-4 text-[13px] text-[#30363a]">{label}<input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} className="h-5 w-5 accent-[#137c56]" /></label>;
}

function AgencyHoursSettings({
  data,
  run,
  active,
}: {
  data: AdminData;
  run: (action: () => Promise<unknown>, message: string) => void;
  active: boolean;
}) {
  const settings = data.settings?.settings && typeof data.settings.settings === "object" && !Array.isArray(data.settings.settings)
    ? data.settings.settings as Record<string, unknown>
    : {};
  const storedHours = settings.agency_hours && typeof settings.agency_hours === "object"
    ? settings.agency_hours as Record<string, unknown>
    : {};
  const [hours, setHours] = useState(String(storedHours.text || "Lundi – samedi, 08h00 – 17h00"));
  const [timezone, setTimezone] = useState(String(data.settings?.timezone || "Africa/Kinshasa"));
  if (!active) return null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nextSettings = data.settings || { row_version: 1 };
    run(() => updateSettings({
      ...nextSettings,
      expected_version: Number(nextSettings.row_version || 1),
      timezone: String(form.get("agency_timezone") || "Africa/Kinshasa"),
      settings: {
        ...settings,
        agency_hours: { text: String(form.get("agency_hours") || "").trim() },
      },
    }), "Horaires et fuseau horaire enregistrés.");
  }

  return <section className="grid gap-5">
    <PermissionGuard permission="settings.write" fallback={<ReadOnly />}>
      <form onSubmit={submit} className="grid max-w-[640px] gap-5">
        <label className="grid gap-1.5 text-[13px] font-medium text-[#59636e]">Horaires de l’agence<textarea name="agency_hours" rows={3} maxLength={300} required value={hours} onChange={event => setHours(event.target.value)} className="w-full rounded-lg border border-[#d8dddf] px-3 py-2.5 text-[14px] font-normal text-[#25292e] outline-none focus:border-[#16855f]" /></label>
        <label className="grid gap-1.5 text-[13px] font-medium text-[#59636e]">Fuseau horaire<select name="agency_timezone" value={timezone} onChange={event => setTimezone(event.target.value)} className="h-10 w-full rounded-full border border-[#d8dddf] bg-white px-3 text-[14px] font-normal text-[#25292e] outline-none focus:border-[#16855f]">{[["Africa/Kinshasa", "Kinshasa"], ["Africa/Lubumbashi", "Lubumbashi"], ["Africa/Douala", "Douala"], ["Africa/Abidjan", "Abidjan"], ["Africa/Lagos", "Lagos"], ["Europe/Brussels", "Bruxelles"], ["Europe/Paris", "Paris"], ["Asia/Shanghai", "Shanghai"], ["Asia/Dubai", "Dubaï"], ["UTC", "Temps universel (UTC)"]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <p className="border-b border-[#e7eaec] pb-4 text-[12px] leading-5 text-[#697178]">En production : horaires par jour, pauses, jours fériés, fermetures exceptionnelles et horaires distincts par bureau.</p>
        <div className="flex items-center justify-between border-t border-[#e7eaec] pt-4"><span className="text-[11px] text-[#858d93]">Configuration de démonstration</span><button className={primary}>Enregistrer</button></div>
      </form>
    </PermissionGuard>
  </section>;
}

function ParcelReceiptRulesSettings({
  data,
  run,
  active,
}: {
  data: AdminData;
  run: (action: () => Promise<unknown>, message: string) => void;
  active: boolean;
}) {
  const rawSettings = data.settings?.settings;
  const storedSettings = rawSettings && typeof rawSettings === "object" && !Array.isArray(rawSettings)
    ? rawSettings as Record<string, unknown>
    : {};
  const storedRules = storedSettings.parcel_receipt_rules && typeof storedSettings.parcel_receipt_rules === "object"
    ? storedSettings.parcel_receipt_rules as Record<string, unknown>
    : {};
  const [categoryRequired, setCategoryRequired] = useState(storedRules.category_required !== false);
  const [packagingRequired, setPackagingRequired] = useState(storedRules.packaging_required !== false);
  const [allowUnmeasured, setAllowUnmeasured] = useState(storedRules.allow_unmeasured !== false);
  const [allowPhotos, setAllowPhotos] = useState(storedRules.allow_photos !== false);
  const [autoRateLookup, setAutoRateLookup] = useState(storedRules.auto_rate_lookup !== false);
  if (!active) return null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    run(() => updateSettings({
      ...data.settings,
      expected_version: Number(data.settings?.row_version || 1),
      settings: {
        ...storedSettings,
        parcel_receipt_rules: {
          category_required: categoryRequired,
          packaging_required: packagingRequired,
          allow_unmeasured: allowUnmeasured,
          allow_photos: allowPhotos,
          auto_rate_lookup: autoRateLookup,
        },
      },
    }), "Règles de réception des colis enregistrées.");
  }

  return <section className="grid gap-5">
    <PermissionGuard permission="settings.write" fallback={<ReadOnly />}>
      <form onSubmit={submit} className="grid max-w-[640px] gap-5">
        <section className="grid gap-3 border-b border-[#e7eaec] pb-5">
          <h3 className="text-[15px] font-semibold text-[#25292e]">Règles d’enregistrement</h3>
          <VisibilityToggle label="Catégorie de marchandise obligatoire" checked={categoryRequired} onChange={setCategoryRequired}/>
          <VisibilityToggle label="Type de conditionnement obligatoire" checked={packagingRequired} onChange={setPackagingRequired}/>
          <VisibilityToggle label="Autoriser la réception sans mesure" checked={allowUnmeasured} onChange={setAllowUnmeasured}/>
          <VisibilityToggle label="Autoriser les photos du colis" checked={allowPhotos} onChange={setAllowPhotos}/>
          <VisibilityToggle label="Recherche automatique du tarif" checked={autoRateLookup} onChange={setAutoRateLookup}/>
        </section>
        <section className="grid gap-3 border-b border-[#e7eaec] pb-5">
          <h3 className="text-[15px] font-semibold text-[#25292e]">Mesures selon le service</h3>
          {[ ["Transport aérien", "KG"], ["Transport maritime", "CBM"], ["Transport express", "KG"] ].map(([service, unit]) => <div key={service} className="flex items-center justify-between px-2 py-1 text-[13px] text-[#30363a]"><span>{service}</span><span className="rounded-full bg-[#f0f1f2] px-2.5 py-1 text-[11px] font-semibold text-[#424a50]">{unit}</span></div>)}
          <p className="text-[12px] leading-5 text-[#697178]">L’unité de facturation est déterminée automatiquement par la configuration du service, jamais choisie par l’agent.</p>
        </section>
        <div className="flex items-center justify-between border-t border-[#e7eaec] pt-4"><span className="text-[11px] text-[#858d93]">Configuration de démonstration</span><button className={primary}>Enregistrer</button></div>
      </form>
    </PermissionGuard>
  </section>;
}

function ShipmentDeliverySettings({
  data,
  run,
  active,
}: {
  data: AdminData;
  run: (action: () => Promise<unknown>, message: string) => void;
  active: boolean;
}) {
  const rawSettings = data.settings?.settings;
  const storedSettings = rawSettings && typeof rawSettings === "object" && !Array.isArray(rawSettings)
    ? rawSettings as Record<string, unknown>
    : {};
  const storedRules = storedSettings.shipment_delivery_rules && typeof storedSettings.shipment_delivery_rules === "object"
    ? storedSettings.shipment_delivery_rules as Record<string, unknown>
    : {};
  const [deliveryProof, setDeliveryProof] = useState(storedRules.delivery_proof !== false);
  const [arrivalNotice, setArrivalNotice] = useState(storedRules.arrival_notice !== false);
  const [pickupDays, setPickupDays] = useState(String(storedRules.pickup_delay_days ?? 14));
  if (!active) return null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    run(() => updateSettings({
      ...data.settings,
      expected_version: Number(data.settings?.row_version || 1),
      settings: {
        ...storedSettings,
        shipment_delivery_rules: {
          delivery_proof: deliveryProof,
          arrival_notice: arrivalNotice,
          pickup_delay_days: Number(pickupDays),
        },
      },
    }), "Règles d’expédition et de livraison enregistrées.");
  }

  return <section className="grid gap-5">
    <PermissionGuard permission="settings.write" fallback={<ReadOnly />}>
      <form onSubmit={submit} className="grid max-w-[640px] gap-5">
        <div className="grid gap-3 border-b border-[#e7eaec] pb-5">
          <label className="flex items-center justify-between gap-4 text-[13px] text-[#30363a]"><span><span className="block font-medium">Preuve de livraison</span><span className="mt-1 block text-[12px] text-[#697178]">Conserver une confirmation lors de la remise.</span></span><input aria-label="Preuve de livraison" type="checkbox" checked={deliveryProof} onChange={event => setDeliveryProof(event.target.checked)} className="h-5 w-5 accent-[#137c56]" /></label>
          <label className="flex items-center justify-between gap-4 text-[13px] text-[#30363a]"><span><span className="block font-medium">Avis d’arrivée</span><span className="mt-1 block text-[12px] text-[#697178]">Déclencher après confirmation réelle de l’arrivée.</span></span><input aria-label="Avis d’arrivée" type="checkbox" checked={arrivalNotice} onChange={event => setArrivalNotice(event.target.checked)} className="h-5 w-5 accent-[#137c56]" /></label>
          <label className="grid gap-1.5 text-[13px] font-medium text-[#59636e]">Délai indicatif de retrait (jours)<input type="number" min={0} max={365} step={1} required value={pickupDays} onChange={event => setPickupDays(event.target.value)} className="h-10 w-full rounded-full border border-[#d8dddf] px-3 text-[14px] font-normal text-[#25292e] outline-none focus:border-[#16855f]" /></label>
          <p className="text-[12px] leading-5 text-[#697178]">Les calendriers de départ, routes et expéditions se gèrent dans les modules opérationnels.</p>
        </div>
        <div className="flex items-center justify-between border-t border-[#e7eaec] pt-4"><span className="text-[11px] text-[#858d93]">Configuration de démonstration</span><button className={primary}>Enregistrer</button></div>
      </form>
    </PermissionGuard>
  </section>;
}

function PackageNumberingSettings({
  data,
  run,
  active,
}: {
  data: AdminData;
  run: (action: () => Promise<unknown>, message: string) => void;
  active: boolean;
}) {
  const numbering = data.numbering.find(item => String(item.document_type).toUpperCase() === "PACKAGE");
  if (!active) return null;
  if (!numbering) return <p role="alert" className="max-w-[640px] rounded-lg border border-amber-200 bg-amber-50 p-4 text-[13px] text-amber-900">Le compteur de références colis n’est pas configuré pour cette agence.</p>;
  const packageNumbering = numbering;

  const currentFormat = String(packageNumbering.prefix_format || "COL-{YYYY}-{000001}");
  const initialPrefix = currentFormat.split("{")[0].replace(/[-_]+$/, "") || "COL";
  const preview = currentFormat
    .replaceAll("{YYYY}", String(new Date().getFullYear()))
    .replaceAll("{YEAR}", String(new Date().getFullYear()))
    .replace(/\{(0+)\}/g, (_, zeros: string) => String(packageNumbering.next_number || 1).padStart(zeros.length, "0"))
    .replaceAll("{SEQUENCE}", String(packageNumbering.next_number || 1));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const prefix = String(form.get("agency_prefix") || "").trim().toUpperCase();
    run(() => saveNumbering("PACKAGE", `${prefix}-{YYYY}-{000001}`, Number(packageNumbering.row_version)), "Format de référence des colis enregistré.");
  }

  return <section className="grid gap-5">
    <PermissionGuard permission="documents.settings" fallback={<ReadOnly />}>
      <form onSubmit={submit} className="grid max-w-[640px] gap-5">
        <label className="grid gap-1.5 text-[13px] font-medium text-[#59636e]">Modèle de référence colis<select disabled value="prefix-year-sequence" className="h-10 w-full rounded-full border border-[#d8dddf] bg-white px-3 text-[14px] font-normal text-[#25292e]"><option value="prefix-year-sequence">Préfixe + année + séquence</option></select></label>
        <label className="grid gap-1.5 text-[13px] font-medium text-[#59636e]">Préfixe agence<input name="agency_prefix" required minLength={2} maxLength={12} pattern="[A-Za-z0-9-]+" defaultValue={initialPrefix} className="h-10 w-full rounded-full border border-[#d8dddf] px-3 text-[14px] font-normal uppercase text-[#25292e] outline-none focus:border-[#16855f]" /></label>
        <label className="grid gap-1.5 text-[13px] font-medium text-[#59636e]">Longueur de la séquence<select disabled value="6" className="h-10 w-full rounded-full border border-[#d8dddf] bg-white px-3 text-[14px] font-normal text-[#25292e]"><option value="6">6 chiffres</option></select></label>
        <label className="grid gap-1.5 text-[13px] font-medium text-[#59636e]">Compteur<select disabled value="global" className="h-10 w-full rounded-full border border-[#d8dddf] bg-white px-3 text-[14px] font-normal text-[#25292e]"><option value="global">Global à l’agence</option></select></label>
        <label className="grid gap-1.5 text-[13px] font-medium text-[#59636e]">Réinitialisation<select disabled value="never" className="h-10 w-full rounded-full border border-[#d8dddf] bg-white px-3 text-[14px] font-normal text-[#25292e]"><option value="never">Jamais</option></select></label>
        <div className="grid gap-1"><span className="text-[12px] text-[#697178]">Exemple fictif</span><strong className="text-[14px] font-semibold text-[#25292e]">{preview}</strong></div>
        <p className="border-b border-[#e7eaec] pb-4 text-[12px] leading-5 text-[#697178]">Les paramètres doivent être validés contre les collisions de références avant activation. Les références existantes sont immuables.</p>
        <div className="flex items-center justify-between border-t border-[#e7eaec] pt-4"><span className="text-[11px] text-[#858d93]">Configuration de démonstration</span><button className={primary}>Enregistrer</button></div>
      </form>
    </PermissionGuard>
  </section>;
}

function GoodsRestrictionsSettings({
  data,
  run,
  active,
}: {
  data: AdminData;
  run: (action: () => Promise<unknown>, message: string) => void;
  active: boolean;
}) {
  const rawSettings = data.settings?.settings;
  const storedSettings = rawSettings && typeof rawSettings === "object" && !Array.isArray(rawSettings)
    ? rawSettings as Record<string, unknown>
    : {};
  const storedRules = storedSettings.goods_restrictions && typeof storedSettings.goods_restrictions === "object"
    ? storedSettings.goods_restrictions as Record<string, unknown>
    : {};
  const [regulatedGoodsCheck, setRegulatedGoodsCheck] = useState(storedRules.regulated_goods_check !== false);
  const [instructions, setInstructions] = useState(String(storedRules.agent_instructions || "Batteries et produits dangereux : acceptation soumise à vérification préalable."));
  if (!active) return null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    run(() => updateSettings({
      ...data.settings,
      expected_version: Number(data.settings?.row_version || 1),
      settings: {
        ...storedSettings,
        goods_restrictions: {
          regulated_goods_check: regulatedGoodsCheck,
          agent_instructions: instructions.trim(),
        },
      },
    }), "Règles marchandises et restrictions enregistrées.");
  }

  return <section className="grid gap-5">
    <PermissionGuard permission="settings.write" fallback={<ReadOnly />}>
      <form onSubmit={submit} className="grid max-w-[640px] gap-5">
        <VisibilityToggle label="Vérification des marchandises réglementées" checked={regulatedGoodsCheck} onChange={setRegulatedGoodsCheck}/>
        <label className="grid gap-1.5 text-[13px] font-medium text-[#59636e]">Conditions et restrictions communiquées aux agents<textarea rows={4} maxLength={2000} required value={instructions} onChange={event => setInstructions(event.target.value)} className="w-full rounded-lg border border-[#d8dddf] px-3 py-2.5 text-[14px] font-normal text-[#25292e] outline-none focus:border-[#16855f]" /></label>
        <p className="border-b border-[#e7eaec] pb-4 text-[12px] leading-5 text-[#697178]">Les règles doivent pouvoir varier selon le pays, le corridor et le service, avec validation humaine pour les marchandises sensibles.</p>
        <div className="flex items-center justify-between border-t border-[#e7eaec] pt-4"><span className="text-[11px] text-[#858d93]">Configuration de démonstration</span><button className={primary}>Enregistrer</button></div>
      </form>
    </PermissionGuard>
  </section>;
}

function ClientConditionsSettings({
  data,
  run,
  active,
}: {
  data: AdminData;
  run: (action: () => Promise<unknown>, message: string) => void;
  active: boolean;
}) {
  const rawSettings = data.settings?.settings;
  const storedSettings = rawSettings && typeof rawSettings === "object" && !Array.isArray(rawSettings)
    ? rawSettings as Record<string, unknown>
    : {};
  const storedConditions = storedSettings.client_conditions && typeof storedSettings.client_conditions === "object"
    ? storedSettings.client_conditions as Record<string, unknown>
    : {};
  const [allowCredit, setAllowCredit] = useState(storedConditions.allow_customer_credit === true);
  if (!active) return null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    run(() => updateSettings({
      ...data.settings,
      expected_version: Number(data.settings?.row_version || 1),
      settings: {
        ...storedSettings,
        client_conditions: { ...storedConditions, allow_customer_credit: allowCredit },
      },
    }), "Conditions clients enregistrées.");
  }

  return <section className="grid gap-5">
    <PermissionGuard permission="settings.write" fallback={<ReadOnly />}>
      <form onSubmit={submit} className="grid max-w-[640px] gap-5">
        <VisibilityToggle label="Autoriser le crédit client" checked={allowCredit} onChange={setAllowCredit}/>
        <p className="-mt-3 text-[12px] leading-5 text-[#697178]">Uniquement pour les clients explicitement approuvés.</p>
        <p className="border-b border-[#e7eaec] pb-4 text-[12px] leading-5 text-[#697178]">Autres règles à prévoir : conditions générales, consentements, réclamations, données obligatoires, gestion des comptes entreprises.</p>
        <div className="flex items-center justify-between border-t border-[#e7eaec] pt-4"><span className="text-[11px] text-[#858d93]">Configuration de démonstration</span><button className={primary}>Enregistrer</button></div>
      </form>
    </PermissionGuard>
  </section>;
}

function VisualIdentitySettings({
  data,
  run,
  active,
}: {
  data: AdminData;
  run: (action: () => Promise<unknown>, message: string) => void;
  active: boolean;
}) {
  const organization = data.organization;
  const initialPrimaryColor = String(organization.primary_color || "#137C56");
  const initialSecondaryColor = String(organization.secondary_color || "#172B4D");
  const [primaryPreview, setPrimaryPreview] = useState(initialPrimaryColor);
  const [secondaryPreview, setSecondaryPreview] = useState(initialSecondaryColor);
  if (!active) return null;
  const currentSettings = data.settings?.settings;
  const visualSettings = currentSettings && typeof currentSettings === "object" && !Array.isArray(currentSettings)
    ? currentSettings as Record<string, unknown>
    : {};

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const logo = val(form, "logo");
    const darkLogo = val(form, "dark_logo");
    const favicon = val(form, "favicon");
    const primaryColor = val(form, "primary_color") || "#137C56";
    const secondaryColor = val(form, "secondary_color") || "#172B4D";
    const nextSettings = { ...visualSettings, brand_favicon_url: favicon };
    run(async () => {
      await updateOrganization({
        expected_version: Number(organization.row_version),
        logo_url: logo,
        logo_dark_url: darkLogo,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
      });
      await updateSettings({
        expected_version: Number(data.settings?.row_version || 1),
        settings: nextSettings,
      });
    }, "Identité visuelle enregistrée.");
  }

  return <section className="grid gap-5">
    <header className="border-b border-[#e7eaec] pb-3">
      <h3 className="text-[16px] font-semibold text-[#25292e]">Identité visuelle de l’agence</h3>
      <p className="mt-1 text-[13px] leading-5 text-[#697178]">Logos et couleurs utilisés sur le suivi, les factures et les documents.</p>
    </header>
    <form onSubmit={submit} className="grid max-w-[640px] gap-4">
      <label className="grid gap-2 text-[13px] font-medium text-[#59636e]">
        Logo principal
        <span className="grid min-h-[148px] place-items-center rounded-lg border border-[#d8dddf] bg-white px-4 py-5 text-center">
          <span><ImagePlus size={22} className="mx-auto text-[#747d84]"/><span className="mt-2 block text-[14px] font-semibold text-[#25292e]">Logo principal</span><span className="mt-1 block text-[12px] font-normal text-[#697178]">Utilisé sur le tracking, les factures et les documents.</span></span>
          <input aria-label="URL du logo principal" name="logo" type="url" pattern="https://.*" defaultValue={String(organization.logo_url || "")} placeholder="URL du logo (démo)" className="h-10 w-full rounded-full border border-[#d8dddf] bg-white px-3 text-[14px] font-normal text-[#25292e] outline-none focus:border-[#16855f]" />
        </span>
      </label>
      <label className="grid gap-1.5 text-[13px] font-medium text-[#59636e]">Logo pour fond sombre<input name="dark_logo" type="url" pattern="https://.*" defaultValue={String(organization.logo_dark_url || "")} placeholder="URL du logo alternatif" className="h-10 w-full rounded-full border border-[#d8dddf] bg-white px-3 text-[14px] font-normal text-[#25292e] outline-none focus:border-[#16855f]" /></label>
      <label className="grid gap-1.5 text-[13px] font-medium text-[#59636e]">Favicon<input name="favicon" type="url" pattern="https://.*" defaultValue={String(visualSettings.brand_favicon_url || "")} placeholder="URL de l’icône" className="h-10 w-full rounded-full border border-[#d8dddf] bg-white px-3 text-[14px] font-normal text-[#25292e] outline-none focus:border-[#16855f]" /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-[13px] font-medium text-[#59636e]">Couleur principale<input name="primary_color" type="text" pattern="#[0-9A-Fa-f]{6}" defaultValue={initialPrimaryColor} onChange={event => setPrimaryPreview(event.target.value)} className="h-10 w-full rounded-full border border-[#d8dddf] bg-white px-3 text-[14px] font-normal uppercase text-[#25292e] outline-none focus:border-[#16855f]" /></label>
        <label className="grid gap-1.5 text-[13px] font-medium text-[#59636e]">Couleur secondaire<input name="secondary_color" type="text" pattern="#[0-9A-Fa-f]{6}" defaultValue={initialSecondaryColor} onChange={event => setSecondaryPreview(event.target.value)} className="h-10 w-full rounded-full border border-[#d8dddf] bg-white px-3 text-[14px] font-normal uppercase text-[#25292e] outline-none focus:border-[#16855f]" /></label>
      </div>
      <div className="rounded-lg border border-[#d8dddf] p-4">
        <p className="text-[12px] text-[#697178]">Aperçu de l’identité</p>
        <div className="mt-3 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-md bg-[#f4f6f5] text-[#4d5860]"><Building2 size={18}/></span><span className="min-w-0"><strong className="block truncate text-[14px] text-[#25292e]">{String(organization.organization_name || "Votre agence")}</strong><span className="mt-0.5 block truncate text-[12px] text-[#697178]">{String(organization.brand_slogan || "Nom et slogan de l’agence")}</span></span></div>
        <div className="mt-3 flex gap-2"><span className="h-5 w-8 rounded" style={{ backgroundColor: /^#[0-9A-Fa-f]{6}$/.test(primaryPreview) ? primaryPreview : "#137C56" }}/><span className="h-5 w-8 rounded" style={{ backgroundColor: /^#[0-9A-Fa-f]{6}$/.test(secondaryPreview) ? secondaryPreview : "#172B4D" }}/></div>
      </div>
      <p className="text-[12px] leading-5 text-[#697178]">En production, prévoyez le téléversement sécurisé, le recadrage et la validation des images plutôt qu’une URL manuelle.</p>
      <PermissionGuard permission="organization.manage"><div className="flex justify-end border-t border-[#e7eaec] pt-4"><button className={primary}>Enregistrer</button></div></PermissionGuard>
    </form>
  </section>;
}

function Organization({
  data,
  run,
}: {
  data: AdminData;
  run: (a: () => Promise<unknown>, m: string) => void;
}) {
  const o = data.organization;
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    run(
      () =>
        updateOrganization({
          expected_version: o.row_version,
          organization_name: val(f, "name"),
          legal_name: val(f, "legal"),
          brand_slogan: val(f, "slogan"),
          brand_description: val(f, "description"),
          country: val(f, "country"),
          city: val(f, "city"),
          address: val(f, "address"),
          phone: val(f, "phone"),
          email: val(f, "email"),
          website: val(f, "website"),
          registration_number: val(f, "registration"),
          tax_number: val(f, "tax"),
        }),
      "Profil de l’agence mis à jour.",
    );
  }
  return (
    <section className="grid gap-4 [&>header]:hidden">
      <header className="border-b border-[#e7eaec] pb-3"><h3 className="text-[14px] font-semibold text-[#25292e]">Profil de l’agence</h3><p className="mt-1 text-[10px] leading-4 text-[#697178]">Informations officielles utilisées sur les espaces publics et documents.</p></header>
      <PermissionGuard permission="organization.manage" fallback={<ReadOnly />}>
        <form onSubmit={submit} className="grid max-w-[560px] gap-3">
          {[["name", "Nom commercial *", "organization_name"], ["legal", "Raison sociale", "legal_name"], ["slogan", "Slogan", "brand_slogan"]].map(([n, l, k]) => <label key={n} className="grid gap-1 text-[10px] text-[#697178]">{l}<input className="h-8 w-full rounded-full border border-[#d8dddf] bg-white px-3 text-[11px] text-[#25292e] outline-none focus:border-[#16855f]" name={n} defaultValue={String(o[k] || "")} required={n === "name"}/></label>)}
          <label className="grid gap-1 text-[10px] text-[#697178]">Description de l’agence<textarea name="description" rows={3} className="w-full rounded-[6px] border border-[#d8dddf] px-3 py-2 text-[11px] text-[#25292e] outline-none focus:border-[#16855f]" defaultValue={String(o.brand_description || "")}/></label>
          <div className="border-t border-[#e7eaec] pt-3"><h4 className="text-[11px] font-semibold text-[#25292e]">Coordonnées officielles</h4></div>
          {[["phone", "Téléphone", "phone", "tel"], ["email", "Email de contact", "email", "email"], ["website", "Site web", "website", "url"]].map(([n, l, k, type]) => <label key={n} className="grid gap-1 text-[10px] text-[#697178]">{l}<input type={type} className="h-8 w-full rounded-full border border-[#d8dddf] bg-white px-3 text-[11px] text-[#25292e] outline-none focus:border-[#16855f]" name={n} defaultValue={String(o[k] || "")} placeholder={n === "website" ? "https://" : ""}/></label>)}
          <FormGeographyFields key={`organization-geo-${String(o.row_version)}`} initialCountry={String(o.country || "")} initialCity={String(o.city || "")} className="h-8 w-full rounded-full border border-[#d8dddf] bg-white px-3 text-[11px] text-[#25292e]" fieldClassName="grid gap-1 text-[10px] text-[#697178]" countryLabel="Pays" cityLabel="Ville"/>
          <label className="grid gap-1 text-[10px] text-[#697178]">Adresse du siège<textarea name="address" rows={2} className="w-full rounded-[6px] border border-[#d8dddf] px-3 py-2 text-[11px] text-[#25292e] outline-none focus:border-[#16855f]" defaultValue={String(o.address || "")} placeholder="Adresse complète"/></label>
          {[["registration", "Numéro d’enregistrement", "registration_number"], ["tax", "Identifiant fiscal", "tax_number"]].map(([n, l, k]) => <label key={n} className="grid gap-1 text-[10px] text-[#697178]">{l}<input className="h-8 w-full rounded-full border border-[#d8dddf] bg-white px-3 text-[11px] text-[#25292e] outline-none focus:border-[#16855f]" name={n} defaultValue={String(o[k] || "")}/></label>)}
          <p className="text-[10px] leading-4 text-[#697178]">Les informations publiques sont sélectionnées dans les paramètres de la page publique de suivi. Les données légales peuvent rester privées.</p>
          <div className="flex items-center justify-between border-t border-[#e7eaec] pt-3"><span className="text-[9px] text-[#8a9297]">Profil de l’agence</span><button className={primary}>Enregistrer</button></div>
        </form>
      </PermissionGuard>
    </section>
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
  const s = data.settings || { row_version: 1 };
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
          language_code: val(f, "language"),
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
      description="Formats appliqués à tous les collaborateurs de l’agence."
    >
      <PermissionGuard permission="settings.write" fallback={<ReadOnly />}>
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
          <SettingSelect label="Langue de l’interface" name="language" value={String(s.language_code || "fr")} options={[["fr","Français"],["en","English"]]} />
          <SettingSelect label="Fuseau horaire" name="timezone" value={String(s.timezone || "UTC")} options={[["Africa/Kinshasa","Kinshasa"],["Africa/Douala","Douala"],["Africa/Abidjan","Abidjan"],["Asia/Shanghai","Chine"],["Asia/Dubai","Dubaï"],["UTC","Temps universel (UTC)"]]} />
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
  const s = data.settings || { row_version: 1 };
  const sec = (s.security || {}) as Record<string, unknown>;
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    run(
      () =>
        updateSettings({
          ...s,
          expected_version: s.row_version,
          security: {
            ...sec,
            require_mfa: form.get("mfa") === "on",
          },
        }),
      "Politique d’authentification mise à jour.",
    );
  }
  return (
    <PermissionGuard permission="security.manage" fallback={<ReadOnly />}>
      <form onSubmit={submit} className="grid max-w-[640px] gap-4">
        <section className="grid gap-3 border-b border-[#e7eaec] pb-4">
          <label className="flex items-center justify-between gap-4 text-[14px] text-[#30363a]">
            <span>
              <span className="block font-medium">Authentification multifacteur</span>
              <span className="mt-1 block text-[12px] text-[#697178]">Protection supplémentaire des comptes.</span>
            </span>
            <input aria-label="Authentification multifacteur" name="mfa" type="checkbox" defaultChecked={sec.require_mfa === undefined ? true : Boolean(sec.require_mfa)} className="h-5 w-5 accent-[#202326]" />
          </label>
          <p className="text-[12px] leading-5 text-[#697178]">Rôles personnalisés, accès par bureau, historique des connexions et audit des changements sensibles.</p>
          <Link href="/app/settings?section=team" className="flex h-10 w-full items-center justify-center rounded-full border border-[#d8dddf] text-[13px] font-medium text-[#424a50] hover:bg-[#f7f8f8]">Configurer les accès</Link>
        </section>
        <div className="flex items-center justify-between border-t border-[#e7eaec] pt-4">
          <span className="text-[11px] text-[#858d93]">Paramètres de sécurité de l’agence</span>
          <button className={primary}>Enregistrer</button>
        </div>
      </form>
    </PermissionGuard>
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
  const rawSettings = data.settings?.settings;
  const storedSettings = rawSettings && typeof rawSettings === "object" && !Array.isArray(rawSettings)
    ? rawSettings as Record<string, unknown>
    : {};
  const storedPreferences = storedSettings.document_preferences && typeof storedSettings.document_preferences === "object"
    ? storedSettings.document_preferences as Record<string, unknown>
    : {};
  const [labelFormat, setLabelFormat] = useState(String(storedPreferences.label_format || "THERMAL_100_150"));
  const [showLogo, setShowLogo] = useState(storedPreferences.show_agency_logo !== false);
  const [showOfficeDetails, setShowOfficeDetails] = useState(storedPreferences.show_office_details !== false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    run(() => updateSettings({
      ...data.settings,
      expected_version: Number(data.settings?.row_version || 1),
      settings: {
        ...storedSettings,
        document_preferences: {
          label_format: labelFormat,
          show_agency_logo: showLogo,
          show_office_details: showOfficeDetails,
        },
      },
    }), "Préférences des documents et étiquettes enregistrées.");
  }

  return <section className="grid gap-5">
    <PermissionGuard permission="documents.settings" fallback={<ReadOnly />}>
      <form onSubmit={submit} className="grid max-w-[640px] gap-5">
        <label className="grid gap-1.5 text-[13px] font-medium text-[#59636e]">Format d’étiquette par défaut<select value={labelFormat} onChange={event => setLabelFormat(event.target.value)} className="h-10 w-full rounded-full border border-[#d8dddf] bg-white px-3 text-[14px] font-normal text-[#25292e] outline-none focus:border-[#16855f]"><option value="THERMAL_100_150">Thermique 100 × 150 mm</option><option value="A4">A4</option><option value="THERMAL_100_100">Thermique 100 × 100 mm</option></select></label>
        <VisibilityToggle label="Afficher le logo de l’agence" checked={showLogo} onChange={setShowLogo}/>
        <VisibilityToggle label="Afficher les coordonnées du bureau" checked={showOfficeDetails} onChange={setShowOfficeDetails}/>
        <p className="border-b border-[#e7eaec] pb-4 text-[12px] leading-5 text-[#697178]">Modèles à personnaliser : étiquette colis, reçu de dépôt, facture, manifeste, bon de livraison.</p>
        <div className="flex items-center justify-between border-t border-[#e7eaec] pt-4"><span className="text-[11px] text-[#858d93]">Configuration de démonstration</span><button className={primary}>Enregistrer</button></div>
      </form>
    </PermissionGuard>
  </section>;
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
