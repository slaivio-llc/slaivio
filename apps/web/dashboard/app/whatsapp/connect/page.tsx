"use client";

import { useEffect, useRef, useState } from "react";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import {
  getMetaOauthUrl,
  onboardWhatsapp,
} from "@/services/meta-oauth";
import { getCurrentManager } from "@/services/auth";

type ConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "error";

export default function WhatsappConnectPage() {
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [message, setMessage] = useState("");
  const processedCodeRef = useRef<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const returnedState = params.get("state");
    const error = params.get("error");

    if (error) {
      setStatus("error");
      setMessage(`Meta OAuth a échoué : ${error}`);
      return;
    }

    if (!code) return;

    if (processedCodeRef.current === code) return;
    processedCodeRef.current = code;

    const expectedState = sessionStorage.getItem("slaivo_meta_oauth_state");

    if (!expectedState || expectedState !== returnedState) {
      setStatus("error");
      setMessage("État OAuth invalide. Relancez la connexion.");
      return;
    }

    setStatus("connecting");
    setMessage("Configuration WhatsApp en cours...");

    getCurrentManager()
      .then((manager) => onboardWhatsapp(
        code,
        manager.org_id || manager.tenant_org_id || "demo_agency"
      ))
      .then((result) => {
        sessionStorage.removeItem("slaivo_meta_oauth_state");
        window.history.replaceState({}, "", "/whatsapp/connect");
        setStatus("connected");
        setMessage(
          `${result.connection_count} numéro(s) WhatsApp connecté(s).`
        );
      })
      .catch((error) => {
        const detail = error?.response?.data?.detail;
        const stage = detail?.stage;
        const metaError =
          detail?.meta_response?.error?.message
          || detail?.meta_response?.error
          || detail;

        setStatus("error");
        setMessage(
          stage
            ? `Impossible de terminer la connexion WhatsApp (${stage}) : ${JSON.stringify(metaError)}`
            : "Impossible de terminer la connexion WhatsApp."
        );
      });
  }, []);

  async function connectWhatsapp() {
    setStatus("connecting");
    setMessage("Ouverture de Meta OAuth...");

    try {
      const result = await getMetaOauthUrl();

      sessionStorage.setItem("slaivo_meta_oauth_state", result.state);
      window.location.assign(result.authorization_url);
    } catch {
      setStatus("error");
      setMessage("Impossible de démarrer Meta OAuth.");
    }
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-2xl p-8">
        <h1 className="text-3xl font-bold">
          Connecter WhatsApp Business
        </h1>

        <p className="mt-3 text-gray-500">
          Autorisez SLAIVIO à récupérer vos WABA et vos numéros WhatsApp.
        </p>

        {message && (
          <div
            className={`mt-6 rounded-xl p-4 text-sm ${
              status === "error"
                ? "bg-red-50 text-red-700"
                : "bg-gray-50 text-gray-700"
            }`}
          >
            {message}
          </div>
        )}

        <button
          onClick={connectWhatsapp}
          disabled={status === "connecting"}
          className="mt-8 rounded-xl bg-black px-6 py-3 font-semibold text-white disabled:opacity-50"
        >
          {status === "connecting"
            ? "Connexion..."
            : "Connecter mon WhatsApp Business"}
        </button>
      </div>
    </DashboardLayout>
  );
}
