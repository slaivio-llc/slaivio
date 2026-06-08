"use client";

import { ReactNode, useEffect, useState } from "react";
import {
  AlertTriangle,
  Bell,
  Bot,
  Brain,
  Building2,
  Camera,
  CheckCircle2,
  CreditCard,
  Database,
  Globe2,
  KeyRound,
  Languages,
  Link2,
  LockKeyhole,
  Mail,
  MessageCircle,
  PackageCheck,
  Palette,
  Plus,
  Scale,
  ShieldCheck,
  Trash2,
  Truck,
  Users,
  Wallet,
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
    id: "profile",
    label: "Profile",
    group: "Configuration",
    icon: Building2,
  },
  {
    id: "security",
    label: "Security",
    group: "Configuration",
    icon: LockKeyhole,
  },
  {
    id: "appearance",
    label: "Appearance",
    group: "Configuration",
    icon: Palette,
  },
  {
    id: "notifications",
    label: "Notifications",
    group: "Configuration",
    icon: Bell,
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
    id: "payment",
    label: "Payment methods",
    group: "Business",
    icon: Wallet,
  },
  {
    id: "privacy",
    label: "Privacy",
    group: "Business",
    icon: ShieldCheck,
  },
  {
    id: "danger",
    label: "Close account",
    group: "Business",
    icon: Trash2,
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
  const [activeSection, setActiveSection] = useState("profile");
  const [savingAI, setSavingAI] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [agencyDescription, setAgencyDescription] = useState("");
  const [defaultLanguage, setDefaultLanguage] = useState("fr");
  const [themeMode, setThemeMode] = useState("light");
  const [notifyClientMessages, setNotifyClientMessages] = useState(true);
  const [notifyCustoms, setNotifyCustoms] = useState(true);
  const [notifyFinance, setNotifyFinance] = useState(false);

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
    setSuccess("");
  }

  function saveLocalSettings(label: string) {
    setSuccess(`${label} sauvegardé pour cette session.`);
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

      {success && (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
          {success}
        </div>
      )}

      {loading && <EmptyState label="Chargement des reglages..." />}

      {!loading && (
        <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
          <SettingsSidebar
            activeSection={activeSection}
            onSelect={jumpTo}
          />

          <div className="min-w-0">
            <SettingsSection
              id="profile"
              hidden={activeSection !== "profile"}
              icon={<Building2 size={18} />}
              title="Agency profile"
              description="Identité visible par vos équipes et utilisée dans l'expérience client."
            >
              <div className="grid gap-6 xl:grid-cols-[280px_1fr]">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200">
                    <Camera className="text-slate-400" size={30} />
                  </div>
                  <button
                    onClick={() => saveLocalSettings("Logo agence")}
                    className="mt-5 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700"
                  >
                    Upload agency logo
                  </button>
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    Le logo sera affiché dans l'espace agence et les documents.
                  </p>
                </div>

                <div className="divide-y divide-slate-100 rounded-3xl border border-slate-200 bg-white">
                  <EditableField
                    label="Agency name"
                    value={activeTenant?.organization_name || "SLAIVIO Demo Agency"}
                  />
                  <EditableArea
                    label="Description"
                    value={agencyDescription}
                    placeholder="Décrivez votre agence cargo, vos pays, vos services..."
                    onChange={setAgencyDescription}
                  />
                  <SettingsRow
                    label="Organization ID"
                    description="Référence interne utilisée par les APIs SLAIVIO."
                    value={activeTenant?.org_id || "Non disponible"}
                    copyable
                  />
                  <div className="grid gap-4 p-5 md:grid-cols-2">
                    <SelectField
                      icon={<Languages size={16} />}
                      label="Default language"
                      value={defaultLanguage}
                      options={[
                        ["fr", "Français"],
                        ["en", "English"],
                      ]}
                      onChange={setDefaultLanguage}
                    />
                    <EditableField label="Timezone" value="Africa/Kinshasa" />
                  </div>
                  <div className="p-5">
                    <div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-950">
                      <Link2 size={16} />
                      Social and support links
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <EditableField label="Website" value="https://slaivio.com" compact />
                      <EditableField label="WhatsApp channel" value="Non renseigné" compact />
                      <EditableField label="Facebook" value="Non renseigné" compact />
                      <EditableField label="Instagram" value="Non renseigné" compact />
                    </div>
                  </div>
                  <div className="p-5 text-right">
                    <button
                      onClick={() => saveLocalSettings("Profil agence")}
                      className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white"
                    >
                      Save profile
                    </button>
                  </div>
                </div>
              </div>
            </SettingsSection>

            <SettingsSection
              id="security"
              hidden={activeSection !== "security"}
              icon={<ShieldCheck size={18} />}
              title="Account security"
              description="Sécurisez les accès manager, email, mot de passe et sessions."
            >
              <div className="grid gap-4 lg:grid-cols-2">
                <ConsoleCard
                  icon={<Mail size={20} />}
                  title="Email address"
                  description="Adresse utilisée pour se connecter et recevoir les alertes."
                  status={activeTenant?.org_id ? "Verified" : "Pending"}
                  statusTone="success"
                />
                <ConsoleCard
                  icon={<LockKeyhole size={20} />}
                  title="Password"
                  description="Modifier le mot de passe depuis l'espace sécurisé Clerk."
                  actionLabel="Open security"
                />
                <ConsoleCard
                  icon={<KeyRound size={20} />}
                  title="Two-factor authentication"
                  description="Ajoutez un second facteur pour protéger les opérations sensibles."
                  status="Recommended"
                  statusTone="warning"
                />
                <ConsoleCard
                  icon={<Users size={20} />}
                  title="Team access"
                  description={`${tenantCount} organisation(s) disponible(s) pour cet utilisateur.`}
                  status="Active"
                  statusTone="success"
                />
              </div>
            </SettingsSection>

            <SettingsSection
              id="appearance"
              hidden={activeSection !== "appearance"}
              icon={<Palette size={18} />}
              title="Appearance"
              description="Adaptez l'interface SLAIVIO à l'environnement de travail de l'agence."
            >
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  ["light", "Light Mode", "Interface claire pour équipes opérationnelles."],
                  ["classic-dark", "Classic Dark", "Mode sombre pour supervision longue."],
                  ["system", "System", "Suit le thème de l'appareil."],
                ].map(([value, label, description]) => (
                  <button
                    key={value}
                    onClick={() => setThemeMode(value)}
                    className={`rounded-3xl border p-5 text-left transition ${
                      themeMode === value
                        ? "border-blue-300 bg-blue-50 ring-4 ring-blue-100"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div className="h-24 rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-100" />
                    <div className="mt-4 font-black text-slate-950">{label}</div>
                    <p className="mt-1 text-sm leading-5 text-slate-500">{description}</p>
                  </button>
                ))}
              </div>
              <div className="mt-5 text-right">
                <button
                  onClick={() => saveLocalSettings("Apparence")}
                  className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white"
                >
                  Save appearance
                </button>
              </div>
            </SettingsSection>

            <SettingsSection
              id="notifications"
              hidden={activeSection !== "notifications"}
              icon={<Bell size={18} />}
              title="Notification preferences"
              description="Choisissez les alertes qui doivent remonter aux managers."
            >
              <div className="rounded-3xl border border-slate-200 bg-white">
                <ToggleRow
                  label="New client messages"
                  description="Alerter quand une conversation WhatsApp attend une réponse."
                  enabled={notifyClientMessages}
                  onChange={setNotifyClientMessages}
                />
                <ToggleRow
                  label="Customs and blocked cargo"
                  description="Alerter sur les cas douane, risques et blocages."
                  enabled={notifyCustoms}
                  onChange={setNotifyCustoms}
                />
                <ToggleRow
                  label="Payments and billing"
                  description="Alerter sur paiements, preuves et facturation."
                  enabled={notifyFinance}
                  onChange={setNotifyFinance}
                />
              </div>
              <div className="mt-5 text-right">
                <button
                  onClick={() => saveLocalSettings("Notifications")}
                  className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white"
                >
                  Save notifications
                </button>
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
              title="Billing and usage"
              description="Plan actif, limites, usage et modules inclus dans l'abonnement."
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
              <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white">
                {[
                  ["WhatsApp conversations", "1,240", "Included"],
                  ["AI assisted replies", "860", "Included"],
                  ["Cargo shipments", "128", "Included"],
                ].map(([label, value, status]) => (
                  <div
                    key={label}
                    className="grid gap-3 border-b border-slate-100 p-5 text-sm last:border-b-0 md:grid-cols-[1fr_160px_160px]"
                  >
                    <div className="font-bold text-slate-950">{label}</div>
                    <div className="text-slate-600">{value}</div>
                    <StatusPill label={status} tone="success" />
                  </div>
                ))}
              </div>
            </SettingsSection>

            <SettingsSection
              id="payment"
              hidden={activeSection !== "payment"}
              icon={<Wallet size={18} />}
              title="Payment methods"
              description="Moyens de paiement utilisés pour l'abonnement SLAIVIO."
            >
              <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
                <div className="rounded-3xl border border-slate-200 bg-white p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-black text-slate-950">Saved cards</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Ajoutez une carte pour payer les abonnements et extensions.
                      </p>
                    </div>
                    <StatusPill label="No card" tone="warning" />
                  </div>
                  <div className="mt-5 rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                    <CreditCard className="mx-auto text-slate-300" size={36} />
                    <div className="mt-3 font-black text-slate-950">
                      Aucun moyen de paiement
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      Le branchement Stripe/checkout viendra quand le plan billing sera activé.
                    </p>
                  </div>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <h3 className="font-black text-slate-950">Billing contact</h3>
                  <div className="mt-4 space-y-3">
                    <EditableField label="Billing email" value="billing@slaivio.com" compact />
                    <EditableField label="Tax ID" value="Non renseigné" compact />
                    <EditableField label="Billing country" value="RDC" compact />
                  </div>
                  <button
                    onClick={() => saveLocalSettings("Billing contact")}
                    className="mt-5 w-full rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white"
                  >
                    Save billing contact
                  </button>
                </div>
              </div>
            </SettingsSection>

            <SettingsSection
              id="privacy"
              hidden={activeSection !== "privacy"}
              icon={<ShieldCheck size={18} />}
              title="Privacy and data"
              description="Contrôle des données, exports et conservation pour les agences internationales."
            >
              <div className="grid gap-4 lg:grid-cols-2">
                <ConsoleCard
                  icon={<Database size={20} />}
                  title="Data export"
                  description="Exporter conversations, dossiers, shipments et preuves opérationnelles."
                  actionLabel="Prepare export"
                />
                <ConsoleCard
                  icon={<ShieldCheck size={20} />}
                  title="Data retention"
                  description="Politique de conservation pour messages, preuves, paiements et documents."
                  status="Default"
                  statusTone="info"
                />
                <ConsoleCard
                  icon={<KeyRound size={20} />}
                  title="Access audit"
                  description="Historique des accès et actions sensibles de l'équipe."
                  status="Planned"
                  statusTone="warning"
                />
                <ConsoleCard
                  icon={<Globe2 size={20} />}
                  title="International readiness"
                  description="Fondation FR/EN et préparation multi-pays."
                  status="FR/EN"
                  statusTone="success"
                />
              </div>
            </SettingsSection>

            <SettingsSection
              id="danger"
              hidden={activeSection !== "danger"}
              icon={<AlertTriangle size={18} />}
              title="Close account"
              description="Actions sensibles liées à la fermeture ou suspension de l'espace agence."
            >
              <div className="rounded-3xl border border-red-200 bg-red-50 p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="font-black text-red-950">
                      Close agency workspace
                    </h3>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-red-700">
                      Cette action doit être protégée par confirmation, audit et export préalable des données.
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

function EditableField({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <label className={compact ? "block" : "grid gap-3 p-5 md:grid-cols-[220px_1fr] md:items-center"}>
      <div>
        <div className="text-sm font-black text-slate-950">{label}</div>
      </div>
      <input
        defaultValue={value}
        className="slaivo-focus mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 md:mt-0"
      />
    </label>
  );
}

function EditableArea({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-3 p-5 md:grid-cols-[220px_1fr]">
      <div className="text-sm font-black text-slate-950">{label}</div>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="slaivo-focus min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
      />
    </label>
  );
}

function SelectField({
  icon,
  label,
  value,
  options,
  onChange,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-2 text-sm font-black text-slate-950">
        <span className="text-blue-600">{icon}</span>
        {label}
      </div>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function ToggleRow({
  label,
  description,
  enabled,
  onChange,
}: {
  label: string;
  description: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-slate-100 p-5 last:border-b-0">
      <div>
        <div className="font-black text-slate-950">{label}</div>
        <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
      </div>
      <button
        onClick={() => onChange(!enabled)}
        className={`relative h-8 w-14 rounded-full transition ${
          enabled ? "bg-blue-600" : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition ${
            enabled ? "left-7" : "left-1"
          }`}
        />
      </button>
    </div>
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
