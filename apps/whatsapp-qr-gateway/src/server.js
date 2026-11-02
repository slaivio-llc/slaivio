import express from "express";
import { addGroupParticipants, createGroup, getSession, logoutSession, rehydrateSessions, sendMessage, startSession } from "./session-manager.js";
import { verifyRequest } from "./signature.js";
import { pool } from "./db.js";
import pino from "pino";
import { requestDiagnostics } from "./gateway-diagnostics.js";
import { probeCallback } from "./callback.js";

const secret = process.env.WHATSAPP_QR_GATEWAY_SHARED_SECRET || "";
if (!process.env.DATABASE_URL || !process.env.SLAIVIO_API_URL || secret.length < 32) throw new Error("Incomplete QR gateway configuration");

const app = express();
const logger = pino({ level: process.env.LOG_LEVEL || "info" });
app.use(requestDiagnostics(logger));
app.use(express.json({ limit: "256kb", verify: (req, _res, buffer) => { req.rawBody = Buffer.from(buffer); } }));
app.get("/health", async (_req, res) => {
  try {
    await pool.query("select 1");
    res.json({ status: "ok" });
  } catch {
    res.status(503).json({ status: "unavailable" });
  }
});
app.use((req, res, next) => {
  const body = req.rawBody || Buffer.alloc(0);
  if (!verifyRequest(req.method, req.path, body, req.header("x-slaivio-timestamp"), req.header("x-slaivio-signature"), secret))
    return res.status(401).json({ error: "invalid_signature" });
  next();
});
app.get("/diagnostics", async (_req, res) => {
  res.json({ service: "slaivio-whatsapp-qr-gateway", callback: await probeCallback() });
});
app.post("/connections/:id/start", async (req, res, next) => { try { res.json(await startSession(req.params.id, req.body.org_id)); } catch (e) { next(e); } });
app.get("/connections/:id", (req, res) => { const state = getSession(req.params.id); res.status(state ? 200 : 404).json(state || { error: "session_not_loaded" }); });
app.post("/connections/:id/messages", async (req, res, next) => { try { res.json(await sendMessage(req.params.id, req.body.to, req.body.message)); } catch (e) { next(e); } });
app.post("/connections/:id/groups", async (req, res, next) => { try { res.json(await createGroup(req.params.id, req.body.subject, req.body.participants)); } catch (e) { next(e); } });
app.post("/connections/:id/groups/participants", async (req, res, next) => { try { res.json(await addGroupParticipants(req.params.id, req.body.group_jid, req.body.participants)); } catch (e) { next(e); } });
app.post("/connections/:id/logout", async (req, res, next) => { try { res.json(await logoutSession(req.params.id)); } catch (e) { next(e); } });
app.use((error, req, res, _next) => {
  const remoteLogout = error?.message === "whatsapp_qr_remote_logout_unconfirmed";
  logger.error({ operation: req.route?.path || "unmatched", reason: remoteLogout ? "remote_logout_unconfirmed" : "gateway_operation_failed" }, "qr_gateway_operation_failed");
  res.status(remoteLogout ? 503 : 500).json({ error: remoteLogout ? "whatsapp_qr_remote_logout_unconfirmed" : "gateway_operation_failed" });
});
app.listen(Number(process.env.PORT || 8080), () => {
  rehydrateSessions().catch(error => console.error("session_rehydration_failed", error.message));
  // Reconcile persisted sessions regularly. This recovers automatically when
  // PostgreSQL or WhatsApp was unavailable during a gateway restart.
  const reconciliation = setInterval(() => {
    rehydrateSessions().catch(error => console.error("session_reconciliation_failed", error.message));
  }, 5 * 60 * 1000);
  reconciliation.unref();
});
