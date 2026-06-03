"use client";

import { useCallback, useEffect, useState } from "react";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import {
  getConversationAssignment,
  updateConversationAssignment,
} from "@/services/conversation-assignments";
import {
  createConversationNote,
  getConversationNotes,
  getConversationTimeline,
} from "@/services/conversation-timeline";
import {
  getConversations,
  getConversationMessages,
} from "@/services/inbox";
import { sendConversationReply } from "@/services/inbox-replies";
import { getPresence } from "@/services/presence";
import { getQueues, updateQueue } from "@/services/queues";
import { useInboxRealtime } from "@/hooks/useInboxRealtime";
import type {
  AgentPresence,
  Conversation,
  ConversationAssignment,
  ConversationInternalNote,
  ConversationTimelineEvent,
  InboxMessage,
  QueueSummary,
} from "@/types/inbox";
import type { Manager } from "@/types/auth";

const ROLE_OPTIONS = [
  "ALL",
  "SUPPORT",
  "WAREHOUSE",
  "PAYMENTS",
  "VIP",
  "DELIVERY",
  "PRIMARY",
];

const STATUS_OPTIONS = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING_CLIENT",
  "RESOLVED",
  "CLOSED",
];

const PRIORITY_OPTIONS = [
  "LOW",
  "NORMAL",
  "HIGH",
  "URGENT",
];

const QUEUE_OPTIONS = [
  "SUPPORT",
  "WAREHOUSE",
  "PAYMENTS",
  "SALES",
  "VIP",
  "CUSTOMS",
  "DELIVERY",
  "UNASSIGNED",
  "ESCALATIONS",
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
  const [notes, setNotes] = useState<ConversationInternalNote[]>([]);
  const [timeline, setTimeline] = useState<ConversationTimelineEvent[]>([]);
  const [newNote, setNewNote] = useState("");
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [queueFilter, setQueueFilter] = useState("ALL");
  const [queues, setQueues] = useState<QueueSummary[]>([]);
  const [selectedQueue, setSelectedQueue] = useState("UNASSIGNED");
  const [manager, setManager] = useState<Manager | null>(null);
  const [presence, setPresence] = useState<AgentPresence[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  const loadConversations = useCallback(async (
    role: string,
    queue: string
  ) => {
    setLoading(true);
    setError("");

    try {
      const filters: {
        number_role?: string;
        queue_name?: string;
      } = {};

      if (role !== "ALL") {
        filters.number_role = role;
      }

      if (queue !== "ALL") {
        filters.queue_name = queue;
      }

      const data = await getConversations(
        Object.keys(filters).length ? filters : undefined
      );
      setConversations(data);
    } catch {
      setError("Impossible de charger les conversations.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function loadInitialData() {
      const rawManager = localStorage.getItem("slaivo_manager");

      if (rawManager) {
        setManager(JSON.parse(rawManager));
      }

      await loadConversations("ALL", "ALL");

      try {
        const queueData = await getQueues();
        setQueues(queueData);
      } catch {
        setQueues([]);
      }

      try {
        const presenceData = await getPresence();
        setPresence(presenceData);
      } catch {
        setPresence([]);
      }
    }

    loadInitialData();
  }, [loadConversations]);

  async function openConversation(phone: string) {
    setSelectedPhone(phone);
    setAssignment(null);
    setManagerName("");
    setConversationStatus("OPEN");
    setPriority("NORMAL");
    setNote("");
    setNotes([]);
    setTimeline([]);
    setNewNote("");
    setReplyText("");
    setSelectedQueue("UNASSIGNED");
    setTypingUsers([]);

    try {
      const data = await getConversationMessages(phone);
      const assignmentData = await getConversationAssignment(phone);
      const notesData = await getConversationNotes(phone);
      const timelineData = await getConversationTimeline(phone);

      setMessages(data);
      setAssignment(assignmentData);
      setManagerName(assignmentData?.assigned_manager_name || "");
      setConversationStatus(assignmentData?.status || "OPEN");
      setPriority(assignmentData?.priority || "NORMAL");
      setNote(assignmentData?.last_note || "");
      setNotes(notesData);
      setTimeline(timelineData);
      setSelectedQueue(
        assignmentData
          ? conversations.find((item) => item.from_phone === phone)
              ?.queue_name || "UNASSIGNED"
          : "UNASSIGNED"
      );
    } catch {
      setError("Impossible de charger les messages.");
    }
  }

  function handleRoleChange(role: string) {
    setRoleFilter(role);
    setSelectedPhone(null);
    setMessages([]);
    setAssignment(null);
    setNotes([]);
    setTimeline([]);
    setNewNote("");
    setReplyText("");
    setTypingUsers([]);
    loadConversations(role, queueFilter);
  }

  function handleQueueFilterChange(queue: string) {
    setQueueFilter(queue);
    setSelectedPhone(null);
    setMessages([]);
    setAssignment(null);
    setNotes([]);
    setTimeline([]);
    setNewNote("");
    setReplyText("");
    setTypingUsers([]);
    loadConversations(roleFilter, queue);
  }

  async function saveAssignment() {
    if (!selectedPhone) {
      return;
    }

    try {
      const updated = await updateConversationAssignment(selectedPhone, {
        assigned_manager_id: managerName || null,
        assigned_manager_name: managerName || null,
        status: conversationStatus,
        priority,
        last_note: note || null,
      });

      setAssignment(updated);
      await loadConversations(roleFilter, queueFilter);

      if (selectedPhone) {
        const timelineData = await getConversationTimeline(selectedPhone);
        setTimeline(timelineData);
      }
    } catch {
      setError("Impossible de sauvegarder le workflow.");
    }
  }

  async function changeConversationQueue(queue: string) {
    if (!selectedPhone) {
      return;
    }

    try {
      await updateQueue(selectedPhone, queue);
      setSelectedQueue(queue);

      const queueData = await getQueues();
      setQueues(queueData);
      await loadConversations(roleFilter, queueFilter);
    } catch {
      setError("Impossible de changer la file.");
    }
  }

  async function addInternalNote() {
    if (!selectedPhone || !newNote.trim()) {
      return;
    }

    try {
      const rawManager = localStorage.getItem("slaivo_manager");
      const manager = rawManager ? JSON.parse(rawManager) : null;

      await createConversationNote(selectedPhone, {
        note: newNote.trim(),
        manager_id: manager?.id || null,
        manager_name: manager?.full_name || null,
      });

      setNewNote("");

      const notesData = await getConversationNotes(selectedPhone);
      const timelineData = await getConversationTimeline(selectedPhone);

      setNotes(notesData);
      setTimeline(timelineData);
    } catch {
      setError("Impossible d'ajouter la note interne.");
    }
  }

  async function sendReply() {
    if (!selectedPhone || !replyText.trim()) {
      return;
    }

    setSendingReply(true);
    setError("");

    try {
      const rawManager = localStorage.getItem("slaivo_manager");
      const manager = rawManager ? JSON.parse(rawManager) : null;

      await sendConversationReply(selectedPhone, {
        message: replyText.trim(),
        preferred_role: messages[0]?.number_role || "SUPPORT",
        manager_id: manager?.id || null,
        manager_name: manager?.full_name || null,
      });

      setReplyText("");

      const data = await getConversationMessages(selectedPhone);
      const timelineData = await getConversationTimeline(selectedPhone);

      setMessages(data);
      setTimeline(timelineData);
      await loadConversations(roleFilter, queueFilter);
    } catch {
      setError("Impossible d'envoyer la reponse.");
    } finally {
      setSendingReply(false);
    }
  }

  const handleRealtimeMessage = useCallback(async (
    payload: {
      event?: string;
      phone?: string;
      manager_id?: string;
      manager_name?: string;
    }
  ) => {
    if (payload.event === "PRESENCE") {
      const presenceData = await getPresence();
      setPresence(presenceData);
      return;
    }

    if (
      payload.event === "TYPING" &&
      payload.phone === selectedPhone &&
      payload.manager_id !== manager?.id
    ) {
      const typingName =
        payload.manager_name || "Manager";

      setTypingUsers((current) => [
        ...new Set([
          ...current,
          typingName,
        ]),
      ]);

      setTimeout(() => {
        setTypingUsers((current) =>
          current.filter((item) => item !== typingName)
        );
      }, 2000);

      return;
    }

    if (payload.event !== "NEW_MESSAGE") {
      return;
    }

    await loadConversations(roleFilter, queueFilter);

    if (selectedPhone && selectedPhone === payload.phone) {
      const refreshed = await getConversationMessages(selectedPhone);
      const timelineData = await getConversationTimeline(selectedPhone);

      setMessages(refreshed);
      setTimeline(timelineData);
    }
  }, [
    loadConversations,
    manager?.id,
    queueFilter,
    roleFilter,
    selectedPhone,
  ]);

  const socketRef = useInboxRealtime(
    manager?.id || null,
    manager?.full_name || null,
    handleRealtimeMessage
  );

  useEffect(() => {
    if (
      selectedPhone &&
      socketRef.current &&
      socketRef.current.readyState === WebSocket.OPEN
    ) {
      socketRef.current.send(
        JSON.stringify({
          event: "ACTIVE_CONVERSATION",
          phone: selectedPhone,
        })
      );
    }
  }, [selectedPhone, socketRef]);

  return (
    <DashboardLayout>
      <div className="flex h-screen">
        <section className="w-[420px] border-r">
          <div className="border-b p-6">
            <div className="flex items-center justify-between gap-3">
              <h1 className="text-2xl font-bold">Enterprise Inbox</h1>

              <div className="inline-flex items-center gap-2 text-sm text-green-600">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                LIVE
              </div>
            </div>

            <p className="text-sm text-gray-500">
              Conversations WhatsApp par numero et role
            </p>

            <select
              value={roleFilter}
              onChange={(event) => handleRoleChange(event.target.value)}
              className="mt-4 w-full rounded-md border px-4 py-3 text-sm"
            >
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>

          <div className="border-b p-4">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleQueueFilterChange("ALL")}
                className={`rounded-md border px-3 py-2 text-xs ${
                  queueFilter === "ALL"
                    ? "bg-black text-white"
                    : "bg-white"
                }`}
              >
                ALL
              </button>

              {queues.map((queue) => (
                <button
                  key={queue.queue_name}
                  onClick={() =>
                    handleQueueFilterChange(queue.queue_name)
                  }
                  className={`rounded-md border px-3 py-2 text-xs ${
                    queueFilter === queue.queue_name
                      ? "bg-black text-white"
                      : "bg-white"
                  }`}
                >
                  {queue.queue_name} ({queue.total})
                </button>
              ))}
            </div>
          </div>

          <div className="border-b p-4">
            <h3 className="text-sm font-semibold">Agents</h3>

            <div className="mt-3 space-y-2">
              {presence.map((agent) => (
                <div
                  key={agent.manager_id}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        agent.status === "ONLINE"
                          ? "bg-green-500"
                          : "bg-gray-400"
                      }`}
                    />
                    <span>
                      {agent.manager_name || agent.manager_id}
                    </span>
                  </div>

                  <span className="text-xs text-gray-500">
                    {agent.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="m-4 rounded-md bg-red-50 p-4 text-sm text-red-600">
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
                  <span>|</span>
                  <span>{conversation.conversation_status || "OPEN"}</span>
                  <span>|</span>
                  <span>{conversation.priority || "NORMAL"}</span>
                  <span>|</span>
                  <span>{conversation.queue_name || "UNASSIGNED"}</span>
                  {conversation.requires_attention && (
                    <>
                      <span>|</span>
                      <span>ATTENTION</span>
                    </>
                  )}
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="flex flex-1 flex-col">
          <div className="border-b p-6">
            <h2 className="text-xl font-semibold">
              {selectedPhone || "Selectionnez une conversation"}
            </h2>

            {messages[0]?.number_role && (
              <p className="mt-1 text-sm text-gray-500">
                Role numero : {messages[0].number_role}
              </p>
            )}

            {assignment?.assigned_manager_name && (
              <p className="mt-1 text-sm text-gray-500">
                Responsable : {assignment.assigned_manager_name}
              </p>
            )}
          </div>

          {selectedPhone && (
            <div className="border-b bg-gray-50 p-6">
              <h3 className="font-semibold">Workflow equipe</h3>

              <div className="mt-4 grid grid-cols-5 gap-3">
                <input
                  value={managerName}
                  onChange={(event) => setManagerName(event.target.value)}
                  placeholder="Manager responsable"
                  className="rounded-md border px-4 py-3 text-sm"
                />

                <select
                  value={conversationStatus}
                  onChange={(event) =>
                    setConversationStatus(event.target.value)
                  }
                  className="rounded-md border px-4 py-3 text-sm"
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>

                <select
                  value={priority}
                  onChange={(event) => setPriority(event.target.value)}
                  className="rounded-md border px-4 py-3 text-sm"
                >
                  {PRIORITY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedQueue}
                  onChange={(event) =>
                    changeConversationQueue(event.target.value)
                  }
                  className="rounded-md border px-4 py-3 text-sm"
                >
                  {QUEUE_OPTIONS.map((queue) => (
                    <option key={queue} value={queue}>
                      {queue}
                    </option>
                  ))}
                </select>

                <button
                  onClick={saveAssignment}
                  className="rounded-md bg-black px-4 py-3 text-sm font-semibold text-white"
                >
                  Sauvegarder
                </button>
              </div>

              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Note interne..."
                className="mt-3 min-h-[90px] w-full rounded-md border px-4 py-3 text-sm"
              />
            </div>
          )}

          <div className="flex-1 space-y-4 overflow-auto p-6">
            {!selectedPhone && (
              <div className="flex h-full items-center justify-center text-gray-500">
                Choisissez une conversation a gauche.
              </div>
            )}

            {selectedPhone &&
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`max-w-xl rounded-md border p-4 ${
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

            {typingUsers.length > 0 && (
              <div className="text-sm text-gray-500">
                {typingUsers.join(", ")} typing...
              </div>
            )}
          </div>

          {selectedPhone && (
            <div className="border-t p-4">
              <div className="flex gap-3">
                <textarea
                  value={replyText}
                  onChange={(event) => {
                    setReplyText(event.target.value);

                    if (
                      selectedPhone &&
                      socketRef.current &&
                      socketRef.current.readyState === WebSocket.OPEN
                    ) {
                      socketRef.current.send(
                        JSON.stringify({
                          event: "TYPING",
                          manager_id: manager?.id,
                          manager_name: manager?.full_name,
                          phone: selectedPhone,
                        })
                      );
                    }
                  }}
                  placeholder="Repondre au client..."
                  className="min-h-[70px] flex-1 rounded-md border px-4 py-3 text-sm"
                />

                <button
                  onClick={sendReply}
                  disabled={sendingReply || !replyText.trim()}
                  className="rounded-md bg-black px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {sendingReply ? "Envoi..." : "Envoyer"}
                </button>
              </div>
            </div>
          )}

          {selectedPhone && (
            <div className="max-h-[42vh] overflow-auto border-t p-6">
              <h3 className="font-semibold">Notes internes</h3>

              <div className="mt-3 flex gap-3">
                <input
                  value={newNote}
                  onChange={(event) => setNewNote(event.target.value)}
                  placeholder="Ajouter une note interne..."
                  className="flex-1 rounded-md border px-4 py-3 text-sm"
                />

                <button
                  onClick={addInternalNote}
                  className="rounded-md bg-black px-4 py-3 text-sm font-semibold text-white"
                >
                  Ajouter
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {notes.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-md border bg-gray-50 p-4 text-sm"
                  >
                    <div className="font-medium">
                      {item.manager_name || "Manager"}
                    </div>

                    <p className="mt-2">{item.note}</p>

                    <div className="mt-2 text-xs text-gray-500">
                      {new Date(item.created_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>

              <h3 className="mt-8 font-semibold">Timeline</h3>

              <div className="mt-4 space-y-3">
                {timeline.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-md border p-4 text-sm"
                  >
                    <div className="font-medium">
                      {event.event_title || event.event_type}
                    </div>

                    <div className="mt-1 text-xs text-gray-500">
                      {event.created_by_name || "SLAIVO"} |{" "}
                      {new Date(event.created_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}
