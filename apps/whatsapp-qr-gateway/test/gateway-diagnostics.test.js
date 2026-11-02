import test from "node:test";
import assert from "node:assert/strict";
import { requestDiagnostics, inboundDiagnostic } from "../src/gateway-diagnostics.js";
import { probeCallback } from "../src/callback.js";
import { verifyRequest } from "../src/signature.js";

test("HTTP diagnostics expose service identity without logging payloads or signatures", () => {
  const logs = [], headers = {};
  let finished;
  requestDiagnostics({ info: entry => logs.push(entry) })({ method: "POST", path: "/connections/private/logout", route: { path: "/connections/:id/logout" }, body: "SECRET" },
    { setHeader: (key, value) => { headers[key] = value; }, on: (_, fn) => { finished = fn; }, statusCode: 503 }, () => {});
  finished();
  assert.equal(headers["X-Slaivio-QR-Gateway"], "1");
  assert.equal(logs[0].operation, "/connections/:id/logout");
  assert.equal(JSON.stringify(logs).includes("SECRET"), false);
  assert.equal(JSON.stringify(logs).includes("private"), false);
});

test("inbound diagnostics contain stage counts only", () => {
  const logs = [];
  inboundDiagnostic({ info: entry => logs.push(entry) }, "connection-id", "ignored", "outgoing_message", 2);
  assert.deepEqual(logs, [{ connectionId: "connection-id", stage: "ignored", reason: "outgoing_message", count: 2 }]);
});

test("round-trip probe signs an empty GET and rejects other services", async () => {
  const oldUrl = process.env.SLAIVIO_API_URL, oldSecret = process.env.WHATSAPP_QR_GATEWAY_SHARED_SECRET;
  process.env.SLAIVIO_API_URL = "https://api.example.test";
  process.env.WHATSAPP_QR_GATEWAY_SHARED_SECRET = "s".repeat(32);
  try {
    const result = await probeCallback(async (url, options) => {
      assert.equal(url, "https://api.example.test/internal/whatsapp-qr/health");
      assert.equal(verifyRequest("GET", "/internal/whatsapp-qr/health", Buffer.alloc(0), options.headers["x-slaivio-timestamp"], options.headers["x-slaivio-signature"], "s".repeat(32)), true);
      return { ok: true, status: 200, json: async () => ({ service: "slaivio-whatsapp-qr-api" }) };
    });
    assert.equal(result.reachable, true);
    assert.equal((await probeCallback(async () => ({ ok: false, status: 401 }))).reachable, false);
    assert.equal((await probeCallback(async () => ({ ok: true, status: 200, json: async () => ({ service: "wrong" }) }))).reachable, false);
    assert.equal((await probeCallback(async () => { throw new Error("PRIVATE"); })).reason, "api_probe_unreachable");
  } finally {
    if (oldUrl === undefined) delete process.env.SLAIVIO_API_URL; else process.env.SLAIVIO_API_URL = oldUrl;
    if (oldSecret === undefined) delete process.env.WHATSAPP_QR_GATEWAY_SHARED_SECRET; else process.env.WHATSAPP_QR_GATEWAY_SHARED_SECRET = oldSecret;
  }
});
