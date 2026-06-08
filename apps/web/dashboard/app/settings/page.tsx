"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bot,
  Brain,
  Building2,
  CheckCircle2,
  CreditCard,
  Database,
  Globe2,
  KeyRound,
  LockKeyhole,
  MessageCircle,
  PackageCheck,
  Plus,
  Scale,
  ShieldCheck,
  Truck,
  Users,
  Wifi,
} from "lucide-react";

import {
  CargoCard,
  CargoPageShell,
  EmptyState,
  RefreshButton,
  StatusPill,
} from "@/components/cargo/cargo-page-shell";
import {
  createGoodsRule,
  createKnowledgeItem,
  createPricingRule,
  getAISettings,
  getGoodsRules,
  getKnowledgeItems,
  getPricingRules,
  updateAISettings,
  type AISettings,
  type WhatsAppSenderStatus,
} from "@/services/settings";
import { getTenantContext } from "@/services/tenant";

const sections = [
  {
    id: "general",
    label: "General",
    group: "Configuration",
    icon: Building2,
  },
  {
    id: "access",
    label: "Access",
    group: "Configuration",
    icon: Users,
  },
  {
    id: "whatsapp",
    label: "WhatsApp Business",
    group: "Integrations",
    icon: MessageCircle,
  },
  {
    id: "ai",
    label: "AI Automation",
    group: "Operations",
    icon: Bot,
  },
  {
    id: "cargo",
    label: "Cargo Rules",
    group: "Operations",
    icon: Truck,
  },
  {
    id: "billing",
    label: "Billing",
    group: "Business",
    icon: CreditCard,
  },
  {
    id: "danger",
    label: "Danger Zone",
    group: "Business",
    icon: AlertTriangle,
  },
];

export default function SettingsPage() {
  const [knowledge, setKnowledge] = useState<any[]>([]);
  const [goods, setGoods] = useState<any[]>([]);
  const [pricing, setPricing] = useState<any[]>([]);
  const [aiSettings, setAiSettings] = useState<AISettings | null>(null);
  const [whatsappSender, setWhatsappSender] =
    useState<WhatsAppSenderStatus | null>(null);
  const [tenantContext, setTenantContext] = useState<any>(null);
  const [activeSection, setActiveSection] = useState("general");
  const [savingAI, setSavingAI] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      const [tenant, k, g, p, ai] = await Promise.all([
        getTenantContext(),
        getKnowledgeItems(),
        getGoodsRules(),
        getPricingRules(),
        getAISettings(),
      ]);

      setTenantContext(tenant);
      setKnowledge(k);
      setGoods(g);
      setPricing(p);
      setAiSettings(ai.settings);
      setWhatsappSender(ai.whatsapp_sender);
    } catch {
      setError("Impossible de charger les reglages.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const activeTenant = tenantContext?.active_tenant;
  const tenantCount = tenantContext?.tenants?.length || 0;

  const metrics = useMemo(
    () => ({
      knowledge: knowledge.length,
      goods: goods.length,
      pricing: pricing.length,
      autoReply: aiSettings?.auto_reply_enabled ? "ON" : "OFF",
      readiness:
        knowledge.length > 0 &&
        goods.length > 0 &&
        pricing.length > 0 &&
        whatsappSender?.can_send
          ? "Ready"
          : "Setup",
    }),
    [
      aiSettings?.auto_reply_enabled,
      goods.length,
      knowledge.length,
      pricing.length,
      whatsappSender?.can_send,
    ]
  );

  async function addKnowledge() {
    await createKnowledgeItem({
      title: "Adresse Kinshasa",
      content: "Notre bureau est situe a Kinshasa, Lingwala.",
      category: "ADDRESS",
    });
    load();
  }

  async function addGoodsRule() {
    await createGoodsRule({
      goods_name: "Telephone",
      category: "ELECTRONICS",
      is_accepted: true,
      pricing_mode: "PER_PIECE",
      note: "Telephone accepte avec controle.",
    });
    load();
  }

  async function addPricingRule() {
    await createPricingRule({
      origin_country: "Chine",
      destination_country: "RDC",
      rule_type: "PER_KG",
      price: 20,
      currency: "USD",
      goods_type: "general",
    });
    load();
  }

  async function toggleAutoReply(enabled: boolean) {
    setSavingAI(true);

    try {
      const updated = await updateAISettings({
        auto_reply_enabled: enabled,
      });
      setAiSettings(updated.settings);
      setWhatsappSender(updated.whatsapp_sender);
    } finally {
      setSavingAI(false);
    }
  }

  async function updateConfidence(value: number) {
    setSavingAI(true);

    try {
      const updated = await updateAISettings({
        auto_reply_min_confidence: value,
      });
      setAiSettings(updated.settings);
      setWhatsappSender(updated.whatsapp_sender);
    } finally {
      setSavingAI(false);
    }
  }

  function jumpTo(sectionId: string) {
    setActiveSection(sectionId);
  }

  return (
    <CargoPageShell
      eyebrow="Agency Console"
      title="Settings"
      description="Pilotez l'identite agence, les acces, Meta WhatsApp, l'automatisation IA et les regles cargo depuis une console claire."
      action={<RefreshButton onClick={load} />}
    >
      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {loading && <EmptyState label="Chargement des reglages..." />}

      {!loading && (
        <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
          <SettingsSidebar
            activeSection={activeSection}
            onSelect={jumpTo}
          />

          <div className="min-w-0 space-y-6">
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SettingsMetric
                label="Readiness"
                value={metrics.readiness}
                hint="Etat global de configuration"
                tone={metrics.readiness === "Ready" ? "success" : "warning"}
              />
              <SettingsMetric
                label="Meta WhatsApp"
                value={whatsappSender?.can_send ? "Connected" : "Pending"}
                hint={whatsappSender?.display_phone_number || "Numero non connecte"}
                tone={whatsappSender?.can_send ? "success" : "warning"}
              />
              <SettingsMetric
                label="Auto Reply"
                value={metrics.autoReply}
                hint="Reponses IA automatiques"
                tone={aiSettings?.auto_reply_enabled ? "success" : "neutral"}
              />
              <SettingsMetric
                label="Rules"
                value={String(metrics.knowledge + metrics.goods + metrics.pricing)}
                hint="Knowledge, goods, pricing"
                tone="info"
              />
            </section>

            <SettingsSection
              id="general"
              hidden={activeSection !== "general"}
              icon={<Building2 size={18} />}
              title="General settings"
              description="Informations de base de l'agence active et contexte operationnel."
            >
              <div className="divide-y divide-slate-100 rounded-3xl border border-slate-200 bg-white">
                <SettingsRow
                  label="Agency name"
                  description="Nom affiche dans l'inbox, les messages et les operations."
                  value={activeTenant?.organization_name || "Organisation active"}
                />
                <SettingsRow
                  label="Organization ID"
                  description="Reference interne utilisee par les APIs SLAIVIO."
                  value={activeTenant?.org_id || "Non disponible"}
                  copyable
                />
                <SettingsRow
                  label="Market mode"
                  description="Langues de depart pour les agences internationales."
                  value="Francais / English ready"
                />
                <SettingsRow
                  label="Cargo operating profile"
                  description="Configuration recommandee pour import/export multi-pays."
                  value="International Cargo Agency"
                />
              </div>
            </SettingsSection>

            <SettingsSection
              id="access"
              hidden={activeSection !== "access"}
              icon={<ShieldCheck size={18} />}
              title="Project access"
              description="Controle des organisations, managers et permissions."
            >
              <div className="grid gap-4 lg:grid-cols-2">
                <ConsoleCard
                  icon={<Users size={20} />}
                  title="Organization-wide access"
                  description={`${tenantCount} organisation(s) disponible(s) pour cet utilisateur.`}
                  actionLabel="Gerer avec Clerk"
                  muted
                />
                <ConsoleCard
                  icon={<LockKeyhole size={20} />}
                  title="Authentication"
                  description="Clerk protege les sessions dashboard et l'acces API."
                  status="Clerk only"
                  statusTone="success"
                />
                <ConsoleCard
                  icon={<KeyRound size={20} />}
                  title="Permissions"
                  description="Roles, permissions et entitlements sont verifies cote API."
                  status="Protected"
                  statusTone="success"
                />
                <ConsoleCard
                  icon={<Database size={20} />}
                  title="Tenant isolation"
                  description="Les operations utilisent l'organisation active, pas un compte demo."
                  status="Active"
                  statusTone="success"
                />
              </div>
            </SettingsSection>

            <SettingsSection
              id="whatsapp"
              hidden={activeSection !== "whatsapp"}
              icon={<MessageCircle size={18} />}
              title="WhatsApp Business"
              description="Connexion officielle du numéro WhatsApp Business de l'agence."
            >
              <div className="grid gap-4 lg:grid-cols-3">
                <ConfigCard
                  label="Numéro connecté"
                  value={
                    whatsappSender?.can_send
                      ? "Prêt pour l'envoi"
                      : "Aucun numero d'envoi disponible"
                  }
                  hint={whatsappSender?.display_phone_number || "Connectez un numero WhatsApp Business"}
                  tone={whatsappSender?.can_send ? "success" : "warning"}
                />
                <ConfigCard
                  label="Onboarding"
                  value="Connexion via portefeuille Business"
                  hint="L'agence suit le flow officiel sans manipuler les réglages techniques."
                  tone="info"
                />
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm">
                  <div className="font-bold text-slate-950">Action rapide</div>
                  <p className="mt-2 text-slate-600">
                    Connecter ou remplacer le numéro WhatsApp Business actif.
                  </p>
                  <a
                    href="/whatsapp/connect"
                    className="mt-4 inline-flex rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white"
                  >
                    Connecter WhatsApp
                  </a>
                </div>
              </div>

              {!whatsappSender?.can_send && (
                <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm font-medium text-amber-800">
                  Les reponses automatiques peuvent etre configurees, mais l'envoi reel attend un numero WhatsApp Business connecte.
                </div>
              )}
            </SettingsSection>

            <SettingsSection
              id="ai"
              hidden={activeSection !== "ai"}
              icon={<Bot size={18} />}
              title="AI automation"
              description="Controlez le niveau d'autonomie de l'assistant SLAIVIO."
            >
              <div className="rounded-3xl border border-slate-200 bg-white p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h3 className="text-lg font-black text-slate-950">
                      AI Auto Reply
                    </h3>
                    <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
                      L'IA peut repondre seule aux demandes sures. Les plaintes,
                      demandes humaines et cas incertains restent pour l'equipe.
                    </p>
                  </div>

                  <button
                    onClick={() => toggleAutoReply(!aiSettings?.auto_reply_enabled)}
                    disabled={savingAI || !aiSettings}
                    className={`rounded-2xl px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 disabled:opacity-50 ${
                      aiSettings?.auto_reply_enabled
                        ? "bg-red-600 shadow-red-600/20"
                        : "bg-slate-950 shadow-slate-950/20"
                    }`}
                  >
                    {aiSettings?.auto_reply_enabled ? "Desactiver" : "Activer"}
                  </button>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  <ConfigCard
                    label="Status"
                    value={
                      aiSettings?.auto_reply_enabled
                        ? "Auto-reponse activee"
                        : "Auto-reponse desactivee"
                    }
                    tone={aiSettings?.auto_reply_enabled ? "success" : "warning"}
                  />
                  <ConfigCard
                    label="Escalation"
                    value="Human fallback"
                    hint="Les cas sensibles restent pour les agents."
                    tone="info"
                  />
                  <label className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm">
                    <div className="font-bold text-slate-950">
                      Confiance minimale
                    </div>
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step="0.05"
                      value={aiSettings?.auto_reply_min_confidence ?? 0.75}
                      onChange={(event) => updateConfidence(Number(event.target.value))}
                      className="slaivo-focus mt-3 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2"
                    />
                  </label>
                </div>
              </div>
            </SettingsSection>

            <SettingsSection
              id="cargo"
              hidden={activeSection !== "cargo"}
              icon={<Truck size={18} />}
              title="Cargo rules"
              description="Base de connaissances, marchandises et tarification utilisees par l'IA et les operations."
            >
              <div className="grid gap-6 xl:grid-cols-3">
                <RulePanel
                  icon={<Brain size={22} />}
                  title="Knowledge"
                  description="Informations agence utilisees par l'IA et les agents."
                  actionLabel="Add"
                  onAdd={addKnowledge}
                >
                  {knowledge.length === 0 && <EmptyState label="Aucune connaissance." />}
                  {knowledge.slice(0, 4).map((item) => (
                    <RuleItem
                      key={item.id}
                      title={item.title}
                      pill={item.category}
                      body={item.content}
                    />
                  ))}
                </RulePanel>

                <RulePanel
                  icon={<PackageCheck size={22} />}
                  title="Goods Rules"
                  description="Controle marchandises et restrictions."
                  actionLabel="Add"
                  onAdd={addGoodsRule}
                >
                  {goods.length === 0 && <EmptyState label="Aucune regle marchandise." />}
                  {goods.slice(0, 4).map((rule) => (
                    <RuleItem
                      key={rule.id}
                      title={rule.goods_name}
                      pill={rule.category}
                      body={rule.note || "Aucune note."}
                      tone={rule.is_accepted ? "success" : "danger"}
                      extra={rule.is_accepted ? "ACCEPTED" : "REFUSED"}
                    />
                  ))}
                </RulePanel>

                <RulePanel
                  icon={<Scale size={22} />}
                  title="Pricing"
                  description="Prix cargo par route, type et unite."
                  actionLabel="Add"
                  onAdd={addPricingRule}
                >
                  {pricing.length === 0 && <EmptyState label="Aucune regle tarifaire." />}
                  {pricing.slice(0, 4).map((rule) => (
                    <RuleItem
                      key={rule.id}
                      title={`${rule.origin_country} -> ${rule.destination_country}`}
                      pill={rule.rule_type}
                      body={`${rule.price} ${rule.currency} - ${rule.goods_type || "general"}`}
                      tone="info"
                    />
                  ))}
                </RulePanel>
              </div>
            </SettingsSection>

            <SettingsSection
              id="billing"
              hidden={activeSection !== "billing"}
              icon={<CreditCard size={18} />}
              title="Billing and limits"
              description="Vue produit pour l'abonnement, les limites et les modules actifs."
            >
              <div className="grid gap-4 lg:grid-cols-3">
                <ConsoleCard
                  icon={<CheckCircle2 size={20} />}
                  title="Current plan"
                  description="Plan actif pour l'agence courante."
                  status="Production"
                  statusTone="success"
                />
                <ConsoleCard
                  icon={<Globe2 size={20} />}
                  title="Markets"
                  description="Operations cargo internationales, FR/EN en fondation."
                  status="Global"
                  statusTone="info"
                />
                <ConsoleCard
                  icon={<Wifi size={20} />}
                  title="Active modules"
                  description="WhatsApp, inbox, cargo, finance, warehouse et AI."
                  status="Enabled"
                  statusTone="success"
                />
              </div>
            </SettingsSection>

            <SettingsSection
              id="danger"
              hidden={activeSection !== "danger"}
              icon={<AlertTriangle size={18} />}
              title="Danger zone"
              description="Actions sensibles. Elles doivent rester rares, journalisees et confirmees."
            >
              <div className="rounded-3xl border border-red-200 bg-red-50 p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="font-black text-red-950">
                      Suspend agency operations
                    </h3>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-red-700">
                      Cette zone servira a bloquer temporairement une agence,
                      couper l'auto-reponse ou verrouiller les operations finance.
                    </p>
                  </div>
                  <button
                    disabled
                    className="rounded-2xl border border-red-200 bg-white px-4 py-2.5 text-sm font-bold text-red-500 opacity-60"
                  >
                    Action disabled
                  </button>
                </div>
              </div>
            </SettingsSection>
          </div>
        </div>
      )}
    </CargoPageShell>
  );
}

function SettingsSidebar({
  activeSection,
  onSelect,
}: {
  activeSection: string;
  onSelect: (section: string) => void;
}) {
  const grouped = sections.reduce<Record<string, typeof sections>>(
    (acc, section) => {
      acc[section.group] = acc[section.group] || [];
      acc[section.group].push(section);
      return acc;
    },
    {}
  );

  return (
    <aside className="slaivo-card sticky top-24 h-fit rounded-[1.75rem] p-4">
      <div className="px-2 pb-4">
        <div className="text-lg font-black text-slate-950">
          Agency Settings
        </div>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Console de configuration SLAIVIO.
        </p>
      </div>

      <div className="space-y-5">
        {Object.entries(grouped).map(([group, items]) => (
          <div key={group}>
            <div className="mb-2 px-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
              {group}
            </div>
            <div className="space-y-1">
              {items.map((item) => {
                const Icon = item.icon;
                const active = activeSection === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => onSelect(item.id)}
                    className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-bold transition ${
                      active
                        ? "bg-slate-950 text-white shadow-lg shadow-slate-950/15"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                    }`}
                  >
                    <Icon size={16} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

function SettingsSection({
  id,
  hidden = false,
  icon,
  title,
  description,
  children,
}: {
  id: string;
  hidden?: boolean;
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  if (hidden) return null;

  return (
    <section id={id} className="scroll-mt-24">
      <CargoCard>
        <div className="mb-5 flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-white">
            {icon}
          </span>
          <div>
            <h2 className="text-2xl font-black text-slate-950">{title}</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
              {description}
            </p>
          </div>
        </div>
        {children}
      </CargoCard>
    </section>
  );
}

function SettingsRow({
  label,
  description,
  value,
  copyable = false,
}: {
  label: string;
  description: string;
  value: string;
  copyable?: boolean;
}) {
  return (
    <div className="grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_minmax(260px,420px)] md:items-center">
      <div>
        <div className="text-sm font-black text-slate-950">{label}</div>
        <div className="mt-1 text-sm leading-5 text-slate-500">
          {description}
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700">
        <span className="min-w-0 flex-1 truncate">{value}</span>
        {copyable && (
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600"
          >
            Copy
          </button>
        )}
      </div>
    </div>
  );
}

function SettingsMetric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  return (
    <div className="slaivo-card rounded-3xl p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-slate-500">{label}</div>
        <StatusPill label={tone.toUpperCase()} tone={tone} />
      </div>
      <div className="mt-4 text-3xl font-black tracking-tight text-slate-950">
        {value}
      </div>
      <div className="mt-2 text-xs leading-5 text-slate-500">{hint}</div>
    </div>
  );
}

function ConfigCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone: "success" | "warning" | "danger" | "info";
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="font-bold text-slate-950">{label}</div>
        <StatusPill label={tone.toUpperCase()} tone={tone} />
      </div>
      <div className="mt-3 text-slate-700">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

function ConsoleCard({
  icon,
  title,
  description,
  actionLabel,
  status,
  statusTone = "neutral",
  muted = false,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  status?: string;
  statusTone?: "neutral" | "success" | "warning" | "danger" | "info";
  muted?: boolean;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
          {icon}
        </span>
        {status && <StatusPill label={status} tone={statusTone} />}
      </div>
      <h3 className="mt-4 font-black text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
      {actionLabel && (
        <button
          type="button"
          disabled={muted}
          className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-600 disabled:opacity-60"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function RulePanel({
  icon,
  title,
  description,
  actionLabel,
  onAdd,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  onAdd: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
            {icon}
          </span>
          <div>
            <h3 className="font-black text-slate-950">{title}</h3>
            <p className="mt-1 text-sm leading-5 text-slate-500">
              {description}
            </p>
          </div>
        </div>

        <button
          onClick={onAdd}
          className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-3 py-2 text-xs font-bold text-white shadow-lg shadow-slate-950/20 transition hover:-translate-y-0.5"
        >
          <Plus size={14} />
          {actionLabel}
        </button>
      </div>

      <div className="mt-5 space-y-3">{children}</div>
    </div>
  );
}

function RuleItem({
  title,
  pill,
  body,
  extra,
  tone = "info",
}: {
  title: string;
  pill: string;
  body: string;
  extra?: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="font-bold text-slate-950">{title}</div>
      <div className="mt-2 flex flex-wrap gap-2">
        <StatusPill label={pill} tone={tone} />
        {extra && <StatusPill label={extra} tone={tone} />}
      </div>
      <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">
        {body}
      </p>
    </div>
  );
}
