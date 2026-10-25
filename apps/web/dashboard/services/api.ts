import axios from "axios";
import { invitationErrorMessages } from "./invitation-errors";

type TokenOptions = { skipCache?: boolean };
type AccessTokenProvider = (options?: TokenOptions) => Promise<string | null>;
type RetriableRequest = {
  _slaivioAuthRetried?: boolean;
  _slaivioNetworkRetries?: number;
};
let accessTokenProvider: AccessTokenProvider | null = null;
let billingRedirectPending = false;
export const SESSION_EXPIRED_EVENT = "slaivio:session-expired";
export const MFA_REQUIRED_EVENT = "slaivio:mfa-required";
export const API_MUTATION_FAILED_EVENT = "slaivio:api-mutation-failed";
export const API_MUTATION_SUCCEEDED_EVENT = "slaivio:api-mutation-succeeded";

const apiDetailMessages: Record<string, string> = {
  billing_checkout_already_paid:"Ce paiement est déjà confirmé. Actualisez votre abonnement avant de continuer.",
  billing_payment_processing:"Un paiement est en cours de traitement. Attendez sa confirmation avant de changer d’offre.",
  billing_checkout_cancellation_unconfirmed:"L’annulation du précédent paiement n’a pas encore été confirmée. Aucun nouveau paiement n’a été créé.",
  subscription_expired:"Votre essai ou votre abonnement est terminé. Ouvrez les paramètres d’abonnement pour continuer.",
  saspay_not_configured:"Le paiement en ligne n’est pas encore activé. Contactez le support SLAIVIO.",
  billing_account_identity_unavailable:"L’adresse e-mail de votre compte n’a pas pu être vérifiée. Réessayez dans quelques instants ou contactez le support SLAIVIO.",
  saspay_unavailable:"Le service de paiement est temporairement indisponible. Vérifiez l’état du paiement avant de réessayer.",
  saspay_invalid_response:"Le service de paiement n’a pas renvoyé une réponse valide. Contactez le support SLAIVIO.",
  saspay_payment_mismatch:"Le paiement ne correspond pas à cet abonnement. Contactez le support SLAIVIO.",
  billing_checkout_creation_uncertain:"Un paiement est déjà en préparation. Ne le relancez pas ; vérifiez son état ou contactez le support SLAIVIO.",
  billing_plan_unavailable:"Ce forfait n’est pas disponible actuellement.",
  billing_currency_not_enabled:"La devise de ce forfait n’est pas encore activée pour le paiement. Contactez le support SLAIVIO.",
  billing_checkout_plan_locked:"Un paiement pour un autre forfait est déjà en cours. Vérifiez-le avant de changer de forfait.",
  ...invitationErrorMessages,
  package_category_required:"La catégorie de marchandise est obligatoire.",
  reference_office_required:"Sélectionnez un bureau pour générer la référence du colis, ou configurez un bureau dans les paramètres.",
  package_packaging_required:"Le type de conditionnement est obligatoire.",
  package_measurement_required:"Renseignez un poids ou un volume pour ce colis.",
  package_photos_disabled:"L’ajout de photos est désactivé pour cette agence.",
  delivery_proof_required:"Une preuve de remise est nécessaire pour livrer ce colis.",
  customer_credit_disabled:"Le crédit client est désactivé dans les paramètres de l’agence.",
  regulated_goods_review_required:"La marchandise doit être validée avant son expédition.",
  goods_not_accepted:"Cette marchandise est interdite par les règles de l’agence.",
  tracking_slug_unavailable:"L’identifiant public est déjà utilisé par une autre agence.",
  mfa_setup_required:"Activez la double authentification de votre compte, puis reconnectez-vous avant de l’imposer à l’agence.",
  organization_mfa_required:"Votre agence exige une connexion avec double authentification.",
  knowledge_antivirus_unavailable: "Le service de sécurité des fichiers est temporairement indisponible. Réessayez dans quelques instants.",
  knowledge_antivirus_not_configured: "L’analyse de sécurité des fichiers n’est pas encore configurée sur cet environnement.",
  knowledge_antivirus_invalid_response: "Le service de sécurité n’a pas pu confirmer le résultat de l’analyse.",
  knowledge_ocr_not_configured: "La lecture des images et PDF n’est pas encore configurée sur cet environnement.",
  knowledge_file_malware_detected: "Ce fichier a été bloqué par l’analyse de sécurité.",
  invalid_knowledge_file: "Le fichier est vide, trop volumineux ou dans un format non accepté.",
};

function agencyErrorMessage(raw:string):string {
  if(apiDetailMessages[raw])return apiDetailMessages[raw];
  if(/^[A-Za-z][A-Za-z0-9_.:-]*_[A-Za-z0-9_.:-]+$/.test(raw)||/\b[A-Z]+(?:_[A-Z0-9]+)+\b/.test(raw))return "L’action n’a pas pu être effectuée. Réessayez ou contactez le support SLAIVIO si le problème persiste.";
  if(/^(Input should|Field required|String should|Value error|Invalid |Not found|Internal server)/i.test(raw))return "Vérifiez les informations saisies, puis réessayez. Si le problème persiste, contactez le support SLAIVIO.";
  return raw;
}

export function apiErrorDetail(error: unknown): string {
  if (!axios.isAxiosError(error)) return "";
  const detail = error.response?.data?.detail;
  const raw = Array.isArray(detail)
    ? detail.map((item: { msg?: string }) => item.msg).filter(Boolean).join(" · ")
    : typeof detail === "string" ? detail : "";
  return agencyErrorMessage(raw);
}

function normalizeApiBaseUrl(value?: string) {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return withProtocol.replace(/\/+$/, "");
}

export const API_BASE_URL = normalizeApiBaseUrl(
  process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_URL,
);

export function setAccessTokenProvider(provider: AccessTokenProvider | null) {
  accessTokenProvider = provider;
}

function mutationSuccessMessage(method: string, rawUrl?: string, data?: unknown): string | null {
  const url = String(rawUrl || "").split("?")[0];
  const payload = data as { whatsapp_group?: { status?: string } } | undefined;

  if (method === "POST" && url === "/clients") return "Client créé avec succès.";
  if (method === "PATCH" && /^\/clients\/[^/]+$/.test(url)) return "Client modifié avec succès.";
  if (method === "DELETE" && /^\/clients\/[^/]+$/.test(url)) return "Client archivé avec succès.";
  if (method === "POST" && /^\/clients\/[^/]+\/restore$/.test(url)) return "Client restauré avec succès.";
  if (method === "POST" && url === "/clients/import") return "Import des clients terminé.";

  if (method === "POST" && url === "/dossiers") return "Dossier créé avec succès.";
  if (method === "PATCH" && /^\/dossiers\/[^/]+$/.test(url)) return "Dossier modifié avec succès.";
  if (method === "DELETE" && /^\/dossiers\/[^/]+$/.test(url)) return "Dossier archivé avec succès.";
  if (method === "POST" && /^\/dossiers\/[^/]+\/restore$/.test(url)) return "Dossier restauré avec succès.";
  if (method === "POST" && /^\/dossiers\/[^/]+\/clients\/new$/.test(url)) return "Client créé et ajouté au dossier avec succès.";
  if (method === "POST" && /^\/dossiers\/[^/]+\/clients$/.test(url)) return "Client rattaché au dossier avec succès.";
  if (method === "DELETE" && /^\/dossiers\/[^/]+\/clients\/[^/]+$/.test(url)) return "Client retiré du dossier.";
  if (method === "POST" && /^\/dossiers\/[^/]+\/whatsapp-group\/sync$/.test(url)) {
    return payload?.whatsapp_group?.status === "waiting_for_participant" ? null : "Groupe WhatsApp synchronisé avec succès.";
  }

  if (method === "POST" && url === "/followups") return "Relance créée avec succès.";
  if (method === "PATCH" && /^\/followups\/[^/]+$/.test(url)) return "Relance modifiée avec succès.";
  if (method === "POST" && /^\/followups\/[^/]+\/execute$/.test(url)) return "Relance envoyée avec succès.";
  if (method === "POST" && url === "/followups/pilot/drafts") return "Brouillon enregistré avec succès.";
  if (method === "POST" && /^\/followups\/pilot\/[^/]+\/confirm$/.test(url)) return "Destinataires confirmés avec succès.";
  if (method === "POST" && /^\/followups\/pilot\/[^/]+\/send$/.test(url)) return "Envoi WhatsApp lancé avec succès.";

  if (method === "POST" && url === "/packages") return "Colis enregistré avec succès.";
  if (method === "PATCH" && /^\/packages\/[^/]+$/.test(url)) return "Colis modifié avec succès.";
  if (method === "POST" && /^\/packages\/[^/]+\/transition$/.test(url)) return "Statut du colis mis à jour avec succès.";
  if (method === "POST" && /^\/packages\/[^/]+\/notifications$/.test(url)) return "Message client envoyé avec succès.";

  if (method === "POST" && url === "/departures") return "Départ créé avec succès.";
  if (method === "PATCH" && /^\/departures\/[^/]+$/.test(url)) return "Départ modifié avec succès.";
  if (method === "POST" && /^\/departures\/[^/]+\/transition$/.test(url)) return "Statut du départ mis à jour avec succès.";
  if (method === "POST" && /^\/departures\/[^/]+\/packages$/.test(url)) return "Colis affecté au départ avec succès.";
  if (method === "DELETE" && /^\/departures\/[^/]+\/packages\/[^/]+$/.test(url)) return "Colis retiré du départ.";

  if (method === "POST" && url === "/organization/admin/locations") return "Site opérationnel ajouté avec succès.";
  if (method === "POST" && url === "/organization/invitations") return "Invitation envoyée avec succès.";
  if (method === "POST" && url === "/knowledge/pilot") return "Connaissance créée avec succès.";
  if (method === "PATCH" && /^\/knowledge\/pilot\/[^/]+$/.test(url)) return "Connaissance modifiée avec succès.";
  if (method === "POST" && /^\/knowledge\/pilot\/[^/]+\/publish$/.test(url)) return "Connaissance publiée avec succès.";
  if (["PATCH", "PUT"].includes(method) && url.startsWith("/organization/admin")) return "Paramètres de l’agence enregistrés.";

  // Les lectures marquées, recherches, brouillons IA, tests et changements
  // d'état déjà visibles à l'écran ne doivent pas déclencher de toast global.
  return null;
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
});

api.interceptors.request.use(async (config) => {
  // Let Axios/browser generate the multipart boundary for FormData. Forcing the
  // global JSON content type makes FastAPI treat uploads as missing (`422`).
  if (typeof FormData !== "undefined" && config.data instanceof FormData) {
    config.headers.delete("Content-Type");
  }
  if (typeof window !== "undefined") {
    const officeId = window.sessionStorage.getItem("slaivio:office-context");
    if (officeId) config.headers["X-Slaivio-Office-ID"] = officeId;
    else config.headers.delete("X-Slaivio-Office-ID");
    const retried = (config as typeof config & RetriableRequest)._slaivioAuthRetried;
    let token = accessTokenProvider ? await accessTokenProvider({ skipCache: Boolean(retried) }) : null;
    const clerk = (window as Window & { Clerk?: { session?: { getToken?: () => Promise<string | null> } } }).Clerk;

    if (!token && clerk?.session?.getToken) {
      token = await clerk.session.getToken();
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }

  return config;
});

api.interceptors.response.use(
  (response) => {
    if (typeof window !== "undefined") {
      const method = String(response.config.method || "get").toUpperCase();
      if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
        const message = mutationSuccessMessage(method, response.config.url, response.data);
        if (message) window.dispatchEvent(new CustomEvent(API_MUTATION_SUCCEEDED_EVENT, { detail: { message } }));
      }
    }
    return response;
  },
  async (error: unknown) => {
    if(typeof window !== 'undefined' && axios.isAxiosError(error) && error.response?.status===403 && error.response.data?.detail==='organization_mfa_required'){
      window.dispatchEvent(new Event(MFA_REQUIRED_EVENT));
    }
    if (axios.isAxiosError(error) && !error.response && error.config) {
      const config = error.config as typeof error.config & RetriableRequest;
      const method = String(config.method || "get").toUpperCase();
      const retries = config._slaivioNetworkRetries || 0;
      if (["GET", "HEAD", "OPTIONS"].includes(method) && retries < 2) {
        config._slaivioNetworkRetries = retries + 1;
        await new Promise((resolve) =>
          setTimeout(resolve, retries === 0 ? 500 : 1200),
        );
        return api.request(config);
      }
    }
    if (
      typeof window !== "undefined" &&
      axios.isAxiosError(error) &&
      error.response?.status === 401
    ) {
      const config = error.config as (typeof error.config & RetriableRequest) | undefined;
      const hadAuthorization = Boolean(config?.headers?.Authorization);
      if (config && hadAuthorization && !config._slaivioAuthRetried && accessTokenProvider) {
        config._slaivioAuthRetried = true;
        const refreshedToken = await accessTokenProvider({ skipCache: true });
        if (refreshedToken) {
          config.headers.Authorization = `Bearer ${refreshedToken}`;
          return api.request(config);
        }
      }
      if (hadAuthorization) window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }
    if (typeof window !== "undefined" && axios.isAxiosError(error)) {
      if (error.response?.status===402 && error.response.data?.detail==='subscription_expired' && !billingRedirectPending && !window.location.pathname.startsWith('/app/settings')) {
        billingRedirectPending=true;
        window.location.assign('/app/settings?section=subscription');
      }
      const method = String(error.config?.method || "get").toUpperCase();
      const requestUrl = String(error.config?.url || "").split("?")[0];
      // Onboarding forms render an error beside the field group. A second
      // global toast would duplicate it and obscure the mobile submit button.
      const hasLocalOnboardingFeedback = requestUrl.startsWith("/api/onboarding/");
      if (!["GET", "HEAD", "OPTIONS"].includes(method) && !hasLocalOnboardingFeedback) {
        const detail = error.response?.data?.detail;
        const raw = Array.isArray(detail)
          ? detail.map((item: { msg?: string }) => item.msg).filter(Boolean).join(" · ")
          : typeof detail === "string" ? detail : "";
        const detailMessage = agencyErrorMessage(raw);
        const conflictMessage = raw === "workflow_execution_in_progress"
          ? "La création est déjà en cours. Patientez quelques instants avant de réessayer."
          : raw === "workflow_already_decided"
            ? "Cette action a déjà été traitée. Rechargez la page pour voir son état actuel."
            : `Cette opération entre en conflit avec l’état actuel.${detailMessage ? ` ${detailMessage}` : ""}`;
        const message = !error.response
          ? "Le serveur est injoignable. Vérifiez le déploiement du backend."
          : error.response.status === 403
            ? "Vous n’avez pas la permission d’effectuer cette action."
            : error.response.status === 409
              ? conflictMessage
              : error.response.status === 422
                ? `Certaines données sont invalides ou incompatibles.${detailMessage ? ` ${detailMessage}` : ""}`
                : detailMessage || `L’opération a échoué (erreur ${error.response.status}).`;
        window.dispatchEvent(new CustomEvent(API_MUTATION_FAILED_EVENT, { detail: { message, status: error.response?.status } }));
      }
    }
    return Promise.reject(error);
  },
);
