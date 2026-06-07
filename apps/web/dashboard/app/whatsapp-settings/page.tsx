"use client";

import { useEffect, useState } from "react";
import { MessageCircle, Save, ShieldCheck, Webhook } from "lucide-react";

import {
  CargoCard,
  CargoPageShell,
  EmptyState,
  MetricCard,
  StatusPill,
} from "@/components/cargo/cargo-page-shell";
import {
  getWhatsAppSettings,
  saveWhatsAppSettings,
} from "@/services/whatsapp-settings";

export default function WhatsAppSettingsPage() {
  const [orgId, setOrgId] = useState("demo_agency");
  const [provider, setProvider] = useState("meta");
  const [environment, setEnvironment] = useState("production");
  const [metaPhoneNumberId, setMetaPhoneNumberId] = useState("");
  const [metaWabaId, setMetaWabaId] = useState("");
  const [metaDisplayPhone, setMetaDisplayPhone] = useState("");
  const [metaAppId, setMetaAppId] = useState("");
  const [senderStatus, setSenderStatus] = useState("ACTIVE");
  const [senderCountry, setSenderCountry] = useState("CD");
  const [defaultLanguage, setDefaultLanguage] = useState("fr");
  const [defaultTimezone, setDefaultTimezone] = useState("Africa/Kinshasa");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const rawManager = localStorage.getItem("slaivo_manager");
    const currentOrgId = rawManager
      ? JSON.parse(rawManager).org_id || "demo_agency"
      : "demo_agency";

    setOrgId(currentOrgId);

    getWhatsAppSettings(currentOrgId)
      .then((settings) => {
        if (!settings) return;

        setProvider(settings.provider || "meta");
        setEnvironment(settings.environment || "production");
        setMetaPhoneNumberId(settings.meta_phone_number_id || "");
        setMetaWabaId(settings.meta_waba_id || "");
        setMetaDisplayPhone(settings.meta_whatsapp_display_phone || "");
        setMetaAppId(settings.meta_app_id || "");
        setSenderStatus(settings.sender_status || "ACTIVE");
        setSenderCountry(settings.sender_country || "CD");
        setDefaultLanguage(settings.default_language || "fr");
        setDefaultTimezone(settings.default_timezone || "Africa/Kinshasa");
      })
      .catch(() => {
        setError("Impossible de charger la configuration WhatsApp.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  async function handleSave() {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await saveWhatsAppSettings({
        org_id: orgId,
        provider,
        environment,
        meta_phone_number_id: metaPhoneNumberId.trim(),
        meta_waba_id: metaWabaId.trim(),
        meta_whatsapp_display_phone: metaDisplayPhone.trim(),
        meta_app_id: metaAppId.trim(),
        sender_status: senderStatus,
        sender_country: senderCountry,
        default_language: defaultLanguage,
        default_timezone: defaultTimezone,
        is_active: true,
      });

      setSuccess("Configuration WhatsApp Meta sauvegardée.");
    } catch {
      setError("Impossible de sauvegarder la configuration WhatsApp.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <CargoPageShell
      eyebrow="WhatsApp Enterprise"
      title="WhatsApp Settings"
      description="Contrôlez le numéro d'envoi, le WABA, l'environnement Meta et les informations webhook nécessaires au canal WhatsApp."
      action={
        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 shadow-lg transition hover:-translate-y-0.5 disabled:opacity-50"
        >
          <Save size={16} />
          {saving ? "Sauvegarde..." : "Sauvegarder"}
        </button>
      }
    >
      {loading && <EmptyState label="Chargement de la configuration WhatsApp..." />}

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

      {!loading && (
        <>
          <section className="grid gap-4 md:grid-cols-4">
            <MetricCard label="Provider" value={provider.toUpperCase()} hint="Canal WhatsApp principal" />
            <MetricCard label="Environment" value={environment} hint="Mode de connexion Meta" />
            <MetricCard label="Sender" value={senderStatus} hint="Statut du numéro d'envoi" />
            <MetricCard label="Language" value={defaultLanguage.toUpperCase()} hint="Langue par défaut" />
          </section>

          <section className="mt-8 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <CargoCard>
              <div className="flex items-start gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
                  <MessageCircle size={22} />
                </span>
                <div>
                  <h2 className="text-xl font-black text-slate-950">
                    Configuration Meta
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Ces valeurs viennent du onboarding OAuth Meta ou de votre configuration manuelle.
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <Field label="Org ID" value={orgId} onChange={setOrgId} />
                <SelectField label="Provider" value={provider} onChange={setProvider} options={["meta", "mock"]} />
                <SelectField label="Environment" value={environment} onChange={setEnvironment} options={["production", "sandbox"]} />
                <SelectField label="Sender Status" value={senderStatus} onChange={setSenderStatus} options={["ACTIVE", "PENDING", "FAILED", "DISABLED"]} />
                <Field label="Meta Phone Number ID" value={metaPhoneNumberId} onChange={setMetaPhoneNumberId} />
                <Field label="Meta WABA ID" value={metaWabaId} onChange={setMetaWabaId} />
                <Field label="Meta Display Phone" value={metaDisplayPhone} onChange={setMetaDisplayPhone} />
                <Field label="Meta App ID" value={metaAppId} onChange={setMetaAppId} />
                <Field label="Sender Country" value={senderCountry} onChange={setSenderCountry} />
                <Field label="Default Language" value={defaultLanguage} onChange={setDefaultLanguage} />
                <Field label="Default Timezone" value={defaultTimezone} onChange={setDefaultTimezone} />
              </div>
            </CargoCard>

            <CargoCard>
              <div className="flex items-start gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <Webhook size={22} />
                </span>
                <div>
                  <h2 className="text-xl font-black text-slate-950">
                    Webhook Meta
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Points de contrôle pour la réception des messages entrants et statuts.
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-5">
                <WebhookInfo
                  label="Callback URL"
                  value="https://slaivio-production.up.railway.app/webhook/meta/whatsapp"
                />
                <WebhookInfo
                  label="Verify Token"
                  value="Même valeur que META_WA_VERIFY_TOKEN dans Railway"
                />

                <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-4">
                  <div className="flex items-center gap-2 font-bold text-emerald-800">
                    <ShieldCheck size={18} />
                    Enterprise-ready checklist
                  </div>
                  <div className="mt-4 space-y-2">
                    <StatusPill label="OAuth Meta" tone="success" />
                    <StatusPill label="Webhook Routing" tone="success" />
                    <StatusPill label="Multi-WABA Ready" tone="info" />
                  </div>
                </div>
              </div>
            </CargoCard>
          </section>
        </>
      )}
    </CargoPageShell>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-2">
      <div className="text-sm font-bold text-slate-700">{label}</div>
      <input
        className="slaivo-focus w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="space-y-2">
      <div className="text-sm font-bold text-slate-700">{label}</div>
      <select
        className="slaivo-focus w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function WebhookInfo({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="text-sm font-bold text-slate-700">{label}</div>
      <code className="mt-2 block rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-700">
        {value}
      </code>
    </div>
  );
}
