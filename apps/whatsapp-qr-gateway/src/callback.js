import { signRequest } from "./signature.js";

export async function emitCallback(event) {
  const path = "/internal/whatsapp-qr/events";
  const body = JSON.stringify(event);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const secret = process.env.WHATSAPP_QR_GATEWAY_SHARED_SECRET || "";
  let response;
  try { response = await fetch(`${(process.env.SLAIVIO_API_URL || "").replace(/\/$/, "")}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-slaivio-timestamp": timestamp,
      "x-slaivio-signature": signRequest("POST", path, Buffer.from(body), timestamp, secret) },
    body,
    signal: AbortSignal.timeout(60000),
    redirect: "error",
  }); } catch {
    const error = new Error("api_callback_unreachable");
    error.stage = "api_callback";
    throw error;
  }
  if (!response.ok) {
    const error = new Error("api_callback_rejected");
    error.stage = "api_callback";
    error.statusCode = response.status;
    throw error;
  }
}

export async function probeCallback(fetcher = fetch) {
  const path = "/internal/whatsapp-qr/health";
  const timestamp = String(Math.floor(Date.now() / 1000));
  let origin;
  try {
    const url = new URL(process.env.SLAIVIO_API_URL || "");
    if (url.pathname !== "/" || url.search || url.hash || url.username || url.password) return { reachable: false, reason: "api_url_invalid" };
    origin = url.origin;
  }
  catch { return { reachable: false, reason: "api_url_invalid" }; }
  try {
    const response = await fetcher(`${origin}${path}`, {
      headers: { "x-slaivio-timestamp": timestamp, "x-slaivio-signature": signRequest(
        "GET", path, Buffer.alloc(0), timestamp, process.env.WHATSAPP_QR_GATEWAY_SHARED_SECRET || "") },
      signal: AbortSignal.timeout(5000), redirect: "error",
    });
    if (!response.ok) return { reachable: false, status: response.status, reason: "api_probe_rejected" };
    const data = await response.json();
    return { reachable: data.service === "slaivio-whatsapp-qr-api", status: response.status,
      reason: data.service === "slaivio-whatsapp-qr-api" ? "ok" : "unexpected_api_service" };
  } catch { return { reachable: false, reason: "api_probe_unreachable" }; }
}
