"""Validate the API -> ClamAV private-network connection before a pilot."""

from __future__ import annotations

import os
import socket
import sys


def main() -> int:
    host = os.getenv("CLAMAV_HOST", "").strip()
    port = int(os.getenv("CLAMAV_PORT", "3310"))
    if not host:
        print("ERROR: CLAMAV_HOST is empty", file=sys.stderr)
        return 2

    try:
        with socket.create_connection((host, port), timeout=5) as connection:
            connection.sendall(b"zPING\0")
            response = connection.recv(64).rstrip(b"\0").decode("ascii", "replace")
    except OSError as exc:
        print(
            f"ERROR: cannot reach ClamAV at {host}:{port}: "
            f"{type(exc).__name__}: {exc}",
            file=sys.stderr,
        )
        return 1

    if response != "PONG":
        print(f"ERROR: unexpected ClamAV response: {response!r}", file=sys.stderr)
        return 1

    print(f"OK: ClamAV is reachable at {host}:{port} and returned PONG")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
