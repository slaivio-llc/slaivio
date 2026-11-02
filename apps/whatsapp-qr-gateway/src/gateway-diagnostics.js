import { randomUUID } from "node:crypto";

export function requestDiagnostics(logger) {
  return (req, res, next) => {
    const requestId = randomUUID();
    res.setHeader("X-Slaivio-QR-Gateway", "1");
    res.setHeader("X-Slaivio-QR-Request-ID", requestId);
    res.on("finish", () => {
      if (req.path === "/health") return;
      logger.info({ event: "qr_gateway_http", requestId, method: req.method,
        operation: req.route?.path || "unmatched", status: res.statusCode }, "qr_gateway_http");
    });
    next();
  };
}

// Never include phone numbers, JIDs, bodies, signatures or upstream errors.
export function inboundDiagnostic(logger, connectionId, stage, reason, count = 1) {
  logger.info({ connectionId, stage, reason, count }, "qr_inbound_pipeline");
}
