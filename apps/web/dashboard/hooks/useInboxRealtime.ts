"use client";

import { useEffect, useRef } from "react";

export type InboxRealtimePayload = {
  event?: string;
  org_id?: string;
  phone?: string;
  message?: string;
  direction?: string;
  manager_id?: string;
  manager_name?: string;
  status?: string;
  active_conversation?: string | null;
};

export function useInboxRealtime(
  managerId: string | null,
  managerName: string | null,
  orgId: string | null,
  onMessage: (payload: InboxRealtimePayload) => void
) {
  const socketRef = useRef<WebSocket | null>(null);
  const handlerRef = useRef(onMessage);

  useEffect(() => {
    handlerRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    const apiBaseUrl =
      process.env.NEXT_PUBLIC_API_URL ||
      process.env.NEXT_PUBLIC_API_BASE_URL;

    if (!apiBaseUrl || !managerId || !orgId) {
      return;
    }

    const resolvedApiBaseUrl = apiBaseUrl;
    const resolvedManagerId = managerId;
    const resolvedOrgId = orgId;

    async function connect() {
      const clerk = (window as any).Clerk;
      const clerkToken = clerk?.session?.getToken
        ? await clerk.session.getToken()
        : null;

      if (!clerkToken) {
        return;
      }

      const url = new URL(resolvedApiBaseUrl);
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
      url.pathname = `/ws/inbox/${encodeURIComponent(resolvedManagerId)}`;
      url.searchParams.set("org_id", resolvedOrgId);
      url.searchParams.set("token", clerkToken);
      url.searchParams.set(
        "manager_name",
        managerName || resolvedManagerId
      );

      const socket = new WebSocket(url.toString());
      socketRef.current = socket;

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);

          if (payload.org_id && payload.org_id !== resolvedOrgId) {
            return;
          }

          handlerRef.current(payload);
        } catch {
          // Ignore malformed realtime payloads.
        }
      };
    }

    connect();

    return () => {
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [managerId, managerName, orgId]);

  return socketRef;
}
