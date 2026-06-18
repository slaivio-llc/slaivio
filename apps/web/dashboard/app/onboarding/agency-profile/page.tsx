"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { OnboardingShell } from "@/components/onboarding/OnboardingShell";
import {
  getOnboardingExperienceState,
  type OnboardingExperienceState,
} from "@/services/onboarding-experience";
import { saveAgencyProfile } from "@/services/onboarding";
import { completeOnboardingStep } from "@/services/onboarding-experience";

export default function AgencyProfilePage() {
  const router = useRouter();
  const [state, setState] = useState<OnboardingExperienceState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    legal_name: "",
    brand_name: "",
    country: "",
    city: "",
    address: "",
    phone: "",
    email: "",
    website: "",
    default_language: "fr",
    default_currency: "USD",
    business_type: "CARGO_AGENCY",
  });

  useEffect(() => {
    getOnboardingExperienceState().then(setState);
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      await saveAgencyProfile(form);
      await completeOnboardingStep("AGENCY_PROFILE");
      router.push("/onboarding/workspaces");
    } catch {
      setError("Impossible de sauvegarder le profil agence.");
    } finally {
      setSaving(false);
    }
  }

  if (!state) {
    return <main className="p-8">Chargement...</main>;
  }

  return (
    <OnboardingShell state={state}>
      <form
        onSubmit={submit}
        className="mx-auto max-w-4xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:p-8"
      >
        <p className="text-xs font-black uppercase tracking-[0.22em] text-sky-600">
          Step 1
        </p>
        <h1 className="mt-2 text-3xl font-black text-slate-950">
          Profil réel de l’agence
        </h1>
        <p className="mt-3 text-slate-600">
          Ces informations servent à identifier l’agence dans les documents,
          notifications, workflows cargo et opérations WhatsApp.
        </p>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Field label="Nom légal" value={form.legal_name} onChange={(value) => setForm({ ...form, legal_name: value })} />
          <Field label="Nom commercial" required value={form.brand_name} onChange={(value) => setForm({ ...form, brand_name: value })} />
          <Field label="Pays" required value={form.country} onChange={(value) => setForm({ ...form, country: value })} />
          <Field label="Ville" value={form.city} onChange={(value) => setForm({ ...form, city: value })} />
          <Field label="Téléphone" value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} />
          <Field label="Email" type="email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} />
          <Field label="Site web" value={form.website} onChange={(value) => setForm({ ...form, website: value })} />
          <Field label="Adresse" value={form.address} onChange={(value) => setForm({ ...form, address: value })} />

          <Select
            label="Langue par défaut"
            value={form.default_language}
            options={[
              ["fr", "Français"],
              ["en", "English"],
            ]}
            onChange={(value) => setForm({ ...form, default_language: value })}
          />
          <Select
            label="Devise"
            value={form.default_currency}
            options={[
              ["USD", "USD"],
              ["CDF", "CDF"],
              ["EUR", "EUR"],
            ]}
            onChange={(value) => setForm({ ...form, default_currency: value })}
          />
          <Select
            label="Type d’agence"
            value={form.business_type}
            options={[
              ["CARGO_AGENCY", "Cargo agency"],
              ["FREIGHT_FORWARDER", "Freight forwarder"],
              ["SOURCING_AGENT", "Sourcing agent"],
              ["HYBRID", "Hybrid"],
            ]}
            onChange={(value) => setForm({ ...form, business_type: value })}
          />
        </div>

        <button
          disabled={saving}
          className="mt-8 rounded-2xl bg-slate-950 px-6 py-4 font-black text-white disabled:opacity-50"
        >
          {saving ? "Sauvegarde..." : "Sauvegarder et continuer"}
        </button>
      </form>
    </OnboardingShell>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-black text-slate-700">{label}</span>
      <input
        required={required}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
      />
    </label>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-black text-slate-700">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
      >
        {options.map(([optionValue, labelText]) => (
          <option key={optionValue} value={optionValue}>
            {labelText}
          </option>
        ))}
      </select>
    </label>
  );
}
