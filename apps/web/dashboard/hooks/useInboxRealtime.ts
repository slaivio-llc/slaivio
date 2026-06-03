"use client";

import { useEffect, useRef } from "react";

export type InboxRealtimePayload = {
  event?: string;
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
  onMessage: (payload: InboxRealtimePayload) => void
) {
  const socketRef = useRef<WebSocket | null>(null);
  const handlerRef = useRef(onMessage);

  useEffect(() => {
    handlerRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

    if (!apiBaseUrl || !managerId) {
      return;
    }

    const url = new URL(apiBaseUrl);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.pathname = `/ws/inbox/${encodeURIComponent(managerId)}`;
    url.searchParams.set(
      "manager_name",
      managerName || managerId
    );

    const socket = new WebSocket(url.toString());
    socketRef.current = socket;

    socket.onmessage = (event) => {
      try {
        handlerRef.current(JSON.parse(event.data));
      } catch {
        // Ignore malformed realtime payloads.
      }
    };

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [managerId, managerName]);

  return socketRef;
}
