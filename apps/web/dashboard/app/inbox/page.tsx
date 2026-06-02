"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import {
  getConversationAssignment,
  updateConversationAssignment,
} from "@/services/conversation-assignments";

import type {
  ConversationAssignment,
} from "@/types/inbox";
import {
  getConversations,
  getConversationMessages,
} from "@/services/inbox";

import type {
  Conversation,
  InboxMessage,
} from "@/types/inbox";

const ROLE_OPTIONS = [
  "ALL",
  "SUPPORT",
  "WAREHOUSE",
  "PAYMENTS",
  "VIP",
  "DELIVERY",
  "PRIMARY",
];

export default function InboxPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [error, setError] = useState("");
  const [assignment, setAssignment] =
    useState<ConversationAssignment | null>(null);
  const [managerName, setManagerName] = useState("");
  const [conversationStatus, setConversationStatus] = useState("OPEN");
  const [priority, setPriority] = useState("NORMAL");
  const [note, setNote] = useState("");

  async function loadConversations(role = roleFilter) {
    setLoading(true);
    setError("");

    try {
      const data = await getConversations(
        role === "ALL"
          ? undefined
          : {
              number_role: role,
            }
      );

      setConversations(data);
    } catch {
      setError("Impossible de charger les conversations.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadConversations("ALL");
  }, []);

  async function openConversation(phone: string) {
    setSelectedPhone(phone);

    try {
      const data = await getConversationMessages(phone);
      setMessages(data);
      const assignmentData = await getConversationAssignment(phone);
      setAssignment(assignmentData);
      setManagerName(assignmentData?.assigned_manager_name || "");
      setConversationStatus(assignmentData?.status || "OPEN");
      setPriority(assignmentData?.priority || "NORMAL");
      setNote(assignmentData?.last_note || "");

    } catch {
      setError("Impossible de charger les messages.");
    }
  }

  async function saveAssignment() {
    if (!selectedPhone) return;

    const updated = await updateConversationAssignment(
      selectedPhone,
      {
        assigned_manager_id: managerName || null,
        assigned_manager_name: managerName || null,
        status: conversationStatus,
        priority,
        last_note: note || null,
      }
    );

    setAssignment(updated);

    await loadConversations(roleFilter);
}


  function handleRoleChange(role: string) {
    setRoleFilter(role);
    setSelectedPhone(null);
    setMessages([]);
    loadConversations(role);
  }

  return (
    <DashboardLayout>
      <div className="flex h-screen">
        <section className="w-[420px] border-r">
          <div className="border-b p-6">
            <h1 className="text-2xl font-bold">
              Enterprise Inbox
            </h1>

            <p className="text-sm text-gray-500">
              Conversations WhatsApp par numéro et rôle
            </p>

            <select
              value={roleFilter}
              onChange={(event) => handleRoleChange(event.target.value)}
              className="mt-4 w-full rounded-xl border px-4 py-3 text-sm"
            >
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="m-4 rounded-xl bg-red-50 p-4 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="divide-y overflow-auto">
            {loading && (
              <div className="p-6 text-sm text-gray-500">
                Chargement...
              </div>
            )}

            {!loading && conversations.length === 0 && (
              <div className="p-6 text-sm text-gray-500">
                Aucune conversation.
              </div>
            )}

            {conversations.map((conversation) => (
              <button
                key={conversation.from_phone}
                onClick={() => openConversation(conversation.from_phone)}
                className="w-full p-4 text-left transition hover:bg-gray-50"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold">
                    {conversation.from_phone}
                  </div>

                  <span className="rounded-full border px-2 py-1 text-xs">
                    {conversation.number_role || "UNKNOWN"}
                  </span>
                </div>

                <div className="mt-2 line-clamp-1 text-sm text-gray-500">
                  {conversation.last_message || "Aucun message"}
                </div>

                <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                  <span>{conversation.message_count} message(s)</span>
                  <span>•</span>
                  <span>{conversation.conversation_status || "OPEN"}</span>
                  <span>•</span>
                  <span>{conversation.priority || "NORMAL"}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="flex flex-1 flex-col">
          <div className="border-b p-6">
            <h2 className="text-xl font-semibold">
              {selectedPhone || "Sélectionnez une conversation"}
            </h2>

            {messages[0]?.number_role && (
              <p className="mt-1 text-sm text-gray-500">
                Rôle numéro : {messages[0].number_role}
              </p>
            )}
          </div>

          <div className="flex-1 space-y-4 overflow-auto p-6">
            {!selectedPhone && (
              <div className="flex h-full items-center justify-center text-gray-500">
                Choisissez une conversation à gauche.
              </div>
            )}

            {selectedPhone &&
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`max-w-xl rounded-2xl border p-4 ${
                    message.direction === "outbound"
                      ? "ml-auto bg-black text-white"
                      : "bg-white"
                  }`}
                >
                  <div className="text-sm">
                    {message.text_body || ""}
                  </div>

                  <div
                    className={`mt-2 text-xs ${
                      message.direction === "outbound"
                        ? "text-gray-300"
                        : "text-gray-500"
                    }`}
                  >
                    {new Date(message.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
