"use client";

import { useEffect, useMemo, useState } from "react";
import { Bot, Brain, PackageCheck, Plus, Scale } from "lucide-react";

import {
  CargoCard,
  CargoPageShell,
  EmptyState,
  MetricCard,
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

export default function SettingsPage() {
  const [knowledge, setKnowledge] = useState<any[]>([]);
  const [goods, setGoods] = useState<any[]>([]);
  const [pricing, setPricing] = useState<any[]>([]);
  const [aiSettings, setAiSettings] = useState<AISettings | null>(null);
  const [whatsappSender, setWhatsappSender] =
    useState<WhatsAppSenderStatus | null>(null);
  const [savingAI, setSavingAI] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      const [k, g, p, ai] = await Promise.all([
        getKnowledgeItems(),
        getGoodsRules(),
        getPricingRules(),
        getAISettings(),
      ]);

      setKnowledge(k);
      setGoods(g);
      setPricing(p);
      setAiSettings(ai.settings);
      setWhatsappSender(ai.whatsapp_sender);
    } catch {
      setError("Impossible de charger les réglages.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const metrics = useMemo(
    () => ({
      knowledge: knowledge.length,
      goods: goods.length,
      pricing: pricing.length,
      autoReply: aiSettings?.auto_reply_enabled ? "ON" : "OFF",
    }),
    [aiSettings?.auto_reply_enabled, goods.length, knowledge.length, pricing.length]
  );

  async function addKnowledge() {
    await createKnowledgeItem({
      title: "Adresse Kinshasa",
      content: "Notre bureau est situé à Kinshasa, Lingwala.",
      category: "ADDRESS",
    });
    load();
  }

  async function addGoodsRule() {
    await createGoodsRule({
      goods_name: "Téléphone",
      category: "ELECTRONICS",
      is_accepted: true,
      pricing_mode: "PER_PIECE",
      note: "Téléphone accepté avec contrôle.",
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

  return (
    <CargoPageShell
      eyebrow="Platform Control"
      title="Settings"
      description="Configurez les connaissances, règles marchandises, tarifs et comportements IA qui rendent SLAIVIO utile au quotidien."
      action={<RefreshButton onClick={load} />}
    >
      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {loading && <EmptyState label="Chargement des réglages..." />}

      {!loading && (
        <>
          <section className="grid gap-4 md:grid-cols-4">
            <MetricCard label="Knowledge" value={String(metrics.knowledge)} hint="Réponses et informations agence" />
            <MetricCard label="Goods Rules" value={String(metrics.goods)} hint="Marchandises acceptées/refusées" />
            <MetricCard label="Pricing" value={String(metrics.pricing)} hint="Règles tarifaires actives" />
            <MetricCard label="Auto Reply" value={metrics.autoReply} hint="Réponse IA automatique" />
          </section>

          <CargoCard>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
                    <Bot size={22} />
                  </span>
                  <div>
                    <h2 className="text-xl font-black text-slate-950">
                      AI Auto Reply
                    </h2>
                    <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
                      L'IA peut répondre seule aux demandes sûres. Les plaintes,
                      demandes humaines et cas incertains restent pour l'équipe.
                    </p>
                  </div>
                </div>
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
                {aiSettings?.auto_reply_enabled ? "Désactiver" : "Activer"}
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <ConfigCard
                label="Statut"
                value={
                  aiSettings?.auto_reply_enabled
                    ? "Auto-réponse activée"
                    : "Auto-réponse désactivée"
                }
                tone={aiSettings?.auto_reply_enabled ? "success" : "warning"}
              />
              <ConfigCard
                label="WhatsApp sender"
                value={
                  whatsappSender?.can_send
                    ? `Disponible (${whatsappSender.strategy})`
                    : "Aucun numéro d'envoi disponible"
                }
                hint={whatsappSender?.display_phone_number || undefined}
                tone={whatsappSender?.can_send ? "success" : "danger"}
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

            {!whatsappSender?.can_send && (
              <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm font-medium text-amber-800">
                L'auto-réponse peut être activée ici, mais elle ne pourra pas
                envoyer réellement tant qu'aucun numéro WhatsApp Business n'est connecté.
              </div>
            )}
          </CargoCard>

          <section className="mt-8 grid gap-6 xl:grid-cols-3">
            <RulePanel
              icon={<Brain size={22} />}
              title="Knowledge"
              description="Base de connaissances utilisée par l'IA et les agents."
              actionLabel="Add"
              onAdd={addKnowledge}
            >
              {knowledge.length === 0 && <EmptyState label="Aucune connaissance." />}
              {knowledge.map((item) => (
                <div key={item.id} className="rounded-3xl border border-slate-200 bg-white p-4">
                  <div className="font-bold text-slate-950">{item.title}</div>
                  <div className="mt-2">
                    <StatusPill label={item.category} tone="info" />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{item.content}</p>
                </div>
              ))}
            </RulePanel>

            <RulePanel
              icon={<PackageCheck size={22} />}
              title="Goods Rules"
              description="Contrôle marchandises et restrictions opérationnelles."
              actionLabel="Add"
              onAdd={addGoodsRule}
            >
              {goods.length === 0 && <EmptyState label="Aucune règle marchandise." />}
              {goods.map((rule) => (
                <div key={rule.id} className="rounded-3xl border border-slate-200 bg-white p-4">
                  <div className="font-bold text-slate-950">{rule.goods_name}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <StatusPill label={rule.category} />
                    <StatusPill label={rule.is_accepted ? "ACCEPTED" : "REFUSED"} tone={rule.is_accepted ? "success" : "danger"} />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{rule.note || "Aucune note."}</p>
                </div>
              ))}
            </RulePanel>

            <RulePanel
              icon={<Scale size={22} />}
              title="Pricing"
              description="Prix cargo par pays, type de marchandise et règle."
              actionLabel="Add"
              onAdd={addPricingRule}
            >
              {pricing.length === 0 && <EmptyState label="Aucune règle tarifaire." />}
              {pricing.map((rule) => (
                <div key={rule.id} className="rounded-3xl border border-slate-200 bg-white p-4">
                  <div className="font-bold text-slate-950">
                    {rule.origin_country} → {rule.destination_country}
                  </div>
                  <div className="mt-2 text-2xl font-black text-slate-950">
                    {rule.price} {rule.currency}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <StatusPill label={rule.rule_type} tone="info" />
                    <StatusPill label={rule.goods_type || "general"} />
                  </div>
                </div>
              ))}
            </RulePanel>
          </section>
        </>
      )}
    </CargoPageShell>
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
  tone: "success" | "warning" | "danger";
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

function RulePanel({
  icon,
  title,
  description,
  actionLabel,
  onAdd,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <CargoCard>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
            {icon}
          </span>
          <div>
            <h2 className="text-xl font-black text-slate-950">{title}</h2>
            <p className="mt-1 text-sm leading-5 text-slate-500">{description}</p>
          </div>
        </div>

        <button
          onClick={onAdd}
          className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-slate-950/20 transition hover:-translate-y-0.5"
        >
          <Plus size={16} />
          {actionLabel}
        </button>
      </div>

      <div className="mt-5 space-y-3">{children}</div>
    </CargoCard>
  );
}
