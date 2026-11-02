"""Read-only API -> gateway -> API check. Run inside the deployed API service."""
import json
from urllib.parse import urlsplit

from app.core.config import settings
from app.services.whatsapp_qr_gateway_client import QRGatewayError, qr_gateway_request


def main() -> int:
    # Print only the configured hostname, never credentials, bodies or QR data.
    try:
        hostname = urlsplit((settings.whatsapp_qr_gateway_url or "").strip()).hostname
    except ValueError:
        print(json.dumps({"ok": False, "error": "gateway_url_invalid"}))
        return 1
    print(json.dumps({"gateway_host": hostname}))
    failed = False
    for path in ("/health", "/diagnostics"):
        try:
            result = qr_gateway_request("GET", path)
            if path == "/health":
                ok = result.get("status") == "ok"
                print(json.dumps({"check": "gateway_health", "ok": ok}))
            else:
                callback = result.get("callback") or {}
                identified = result.get("service") == "slaivio-whatsapp-qr-gateway"
                ok = identified and callback.get("reachable") is True
                print(json.dumps({"check": "signed_round_trip", "ok": ok,
                                  "gateway_identified": identified, "callback_http_status": callback.get("status")}))
            failed = failed or not ok
        except QRGatewayError as exc:
            print(json.dumps({"check": path, "ok": False, "error": exc.code, "http_status": exc.status_code}))
            failed = True
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
