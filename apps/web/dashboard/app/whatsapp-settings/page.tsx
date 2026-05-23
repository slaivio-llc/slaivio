"use client";

import { useEffect, useState } from "react";

import { DashboardLayout } from "@/components/layout/dashboard-layout";

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
    <DashboardLayout>
      <div className="p-8">
        <h1 className="text-3xl font-bold">
          WhatsApp Settings
        </h1>

        <p className="mt-2 text-gray-500">
          Configuration Meta WhatsApp Cloud API pour cette agence.
        </p>

        {loading && (
          <div className="mt-8 text-sm text-gray-500">
            Chargement...
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-600">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-6 rounded-xl bg-green-50 p-4 text-sm text-green-700">
            {success}
          </div>
        )}

        {!loading && (
          <>
            <div className="mt-8 grid max-w-5xl grid-cols-2 gap-6">
              <Field label="Org ID" value={orgId} onChange={setOrgId} />

              <SelectField
                label="Provider"
                value={provider}
                onChange={setProvider}
                options={["meta", "mock"]}
              />

              <SelectField
                label="Environment"
                value={environment}
                onChange={setEnvironment}
                options={["production", "sandbox"]}
              />

              <SelectField
                label="Sender Status"
                value={senderStatus}
                onChange={setSenderStatus}
                options={["ACTIVE", "PENDING", "FAILED", "DISABLED"]}
              />

              <Field
                label="Meta Phone Number ID"
                value={metaPhoneNumberId}
                onChange={setMetaPhoneNumberId}
              />

              <Field
                label="Meta WABA ID"
                value={metaWabaId}
                onChange={setMetaWabaId}
              />

              <Field
                label="Meta Display Phone"
                value={metaDisplayPhone}
                onChange={setMetaDisplayPhone}
              />

              <Field
                label="Meta App ID"
                value={metaAppId}
                onChange={setMetaAppId}
              />

              <Field
                label="Sender Country"
                value={senderCountry}
                onChange={setSenderCountry}
              />

              <Field
                label="Default Language"
                value={defaultLanguage}
                onChange={setDefaultLanguage}
              />

              <Field
                label="Default Timezone"
                value={defaultTimezone}
                onChange={setDefaultTimezone}
              />
            </div>

            <div className="mt-8 rounded-2xl border p-6">
              <h2 className="text-xl font-semibold">
                Webhook Meta
              </h2>

              <div className="mt-4 space-y-4 text-sm">
                <div>
                  <div className="font-medium">
                    Callback URL
                  </div>

                  <code className="mt-2 block rounded-xl bg-gray-50 p-3">
                    https://slaivio-production.up.railway.app/webhook/meta/whatsapp
                  </code>
                </div>

                <div>
                  <div className="font-medium">
                    Verify Token
                  </div>

                  <code className="mt-2 block rounded-xl bg-gray-50 p-3">
                    Même valeur que META_WA_VERIFY_TOKEN dans Railway
                  </code>
                </div>
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="mt-8 rounded-xl bg-black px-6 py-3 font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Sauvegarde..." : "Sauvegarder"}
            </button>
          </>
        )}
      </div>
    </DashboardLayout>
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
      <div className="text-sm font-medium">
        {label}
      </div>

      <input
        className="w-full rounded-xl border px-4 py-3"
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
      <div className="text-sm font-medium">
        {label}
      </div>

      <select
        className="w-full rounded-xl border px-4 py-3"
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
