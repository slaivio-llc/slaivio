"use client";

import { useCallback, useEffect, useState } from "react";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import {
  EmptyState,
  StatusPill,
} from "@/components/cargo/cargo-page-shell";
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
import {
  generateAIDraft,
  getAIDrafts,
} from "@/services/ai-drafts";
import {
  getAIWorkflows,
  prepareAIWorkflow,
  updateAIWorkflowStatus,
} from "@/services/ai-workflows";
import {
  executeDossierDraft,
  getAIDossierDrafts,
  prepareAIDossierDraft,
  updateAIDossierDraftStatus,
} from "@/services/ai-dossier-drafts";
import { getPresence } from "@/services/presence";
import { getQueues, updateQueue } from "@/services/queues";
import { getTenantContext } from "@/services/tenant";
import { useInboxRealtime } from "@/hooks/useInboxRealtime";
import type {
  AgentPresence,
  AIDossierDraft,
  AIDraftResponse,
  AIWorkflowRun,
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
  const [aiDrafts, setAiDrafts] = useState<AIDraftResponse[]>([]);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [generatingDraft, setGeneratingDraft] = useState(false);
  const [aiWorkflows, setAiWorkflows] = useState<AIWorkflowRun[]>([]);
  const [preparingWorkflow, setPreparingWorkflow] = useState(false);
  const [dossierDrafts, setDossierDrafts] = useState<AIDossierDraft[]>([]);
  const [preparingDossierDraft, setPreparingDossierDraft] = useState(false);
  const [activeTenant, setActiveTenant] = useState<any>(null);

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
        const tenantData = await getTenantContext();
        setActiveTenant(tenantData.active_tenant || null);
      } catch {
        setActiveTenant(null);
      }

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
    setAiDrafts([]);
    setSelectedDraftId(null);
    setAiWorkflows([]);
    setDossierDrafts([]);

    try {
      const data = await getConversationMessages(phone);
      const assignmentData = await getConversationAssignment(phone);
      const notesData = await getConversationNotes(phone);
      const timelineData = await getConversationTimeline(phone);
      const draftsData = await getAIDrafts(phone);
      const workflowsData = await getAIWorkflows(phone);
      const dossierDraftsData = await getAIDossierDrafts(phone);

      setMessages(data);
      setAssignment(assignmentData);
      setManagerName(assignmentData?.assigned_manager_name || "");
      setConversationStatus(assignmentData?.status || "OPEN");
      setPriority(assignmentData?.priority || "NORMAL");
      setNote(assignmentData?.last_note || "");
      setNotes(notesData);
      setTimeline(timelineData);
      setAiDrafts(draftsData);
      setAiWorkflows(workflowsData);
      setDossierDrafts(dossierDraftsData);
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
    setAiDrafts([]);
    setSelectedDraftId(null);
    setAiWorkflows([]);
    setDossierDrafts([]);
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
    setAiDrafts([]);
    setSelectedDraftId(null);
    setAiWorkflows([]);
    setDossierDrafts([]);
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
        draft_id: selectedDraftId,
      });

      setReplyText("");
      setSelectedDraftId(null);

      const data = await getConversationMessages(selectedPhone);
      const timelineData = await getConversationTimeline(selectedPhone);
      const draftsData = await getAIDrafts(selectedPhone);

      setMessages(data);
      setTimeline(timelineData);
      setAiDrafts(draftsData);
      await loadConversations(roleFilter, queueFilter);
    } catch (err) {
      const apiError = err as {
        response?: {
          data?: {
            detail?: string;
            message?: string;
          };
        };
      };
      const detail =
        apiError.response?.data?.detail ||
        apiError.response?.data?.message ||
        "Impossible d'envoyer la reponse.";

      setError(detail);
    } finally {
      setSendingReply(false);
    }
  }

  function getLastInboundMessage() {
    return [...messages]
      .reverse()
      .find((message) => message.direction === "inbound");
  }

  async function handleGenerateAIDraft() {
    if (!selectedPhone) {
      return;
    }

    const lastInbound = getLastInboundMessage();
    if (!lastInbound?.text_body) {
      setError("Aucun message client a analyser.");
      return;
    }

    setGeneratingDraft(true);
    setError("");

    try {
      const draft = await generateAIDraft(selectedPhone, {
        source_message: lastInbound.text_body,
        manager_id: manager?.id || null,
        manager_name: manager?.full_name || null,
      });

      setReplyText(draft.draft_text);
      setSelectedDraftId(draft.id);
      setAiDrafts(await getAIDrafts(selectedPhone));
    } catch {
      setError("Impossible de generer le brouillon IA.");
    } finally {
      setGeneratingDraft(false);
    }
  }

  async function handlePrepareAIWorkflow() {
    if (!selectedPhone) {
      return;
    }

    const lastInbound = getLastInboundMessage();
    if (!lastInbound?.text_body) {
      setError("Aucun message client a analyser.");
      return;
    }

    setPreparingWorkflow(true);
    setError("");

    try {
      await prepareAIWorkflow(selectedPhone, {
        source_message: lastInbound.text_body,
        manager_id: manager?.id || null,
        manager_name: manager?.full_name || null,
      });
      setAiWorkflows(await getAIWorkflows(selectedPhone));
    } catch {
      setError("Impossible de preparer le workflow IA.");
    } finally {
      setPreparingWorkflow(false);
    }
  }

  async function changeWorkflowStatus(
    workflowId: string,
    status: string
  ) {
    if (!selectedPhone) {
      return;
    }

    await updateAIWorkflowStatus(workflowId, {
      status,
    });
    setAiWorkflows(await getAIWorkflows(selectedPhone));
  }

  async function handlePrepareDossierDraft() {
    if (!selectedPhone) {
      return;
    }

    const lastInbound = getLastInboundMessage();
    if (!lastInbound?.text_body) {
      setError("Aucun message client a analyser.");
      return;
    }

    setPreparingDossierDraft(true);
    setError("");

    try {
      await prepareAIDossierDraft(selectedPhone, {
        source_message: lastInbound.text_body,
        manager_id: manager?.id || null,
        manager_name: manager?.full_name || null,
      });
      setDossierDrafts(await getAIDossierDrafts(selectedPhone));
    } catch {
      setError("Impossible de preparer le dossier IA.");
    } finally {
      setPreparingDossierDraft(false);
    }
  }

  async function changeDossierDraftStatus(
    draftId: string,
    status: string
  ) {
    if (!selectedPhone) {
      return;
    }

    await updateAIDossierDraftStatus(draftId, status);
    setDossierDrafts(await getAIDossierDrafts(selectedPhone));
  }

  async function executeDraft(draftId: string) {
    if (!selectedPhone) {
      return;
    }

    try {
      await executeDossierDraft(draftId);
      setDossierDrafts(await getAIDossierDrafts(selectedPhone));
    } catch {
      setError("Impossible de creer le dossier depuis le draft IA.");
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
    activeTenant?.org_id,
    queueFilter,
    roleFilter,
    selectedPhone,
  ]);

  const socketRef = useInboxRealtime(
    manager?.user_id || manager?.id || null,
    manager?.full_name || manager?.name || null,
    activeTenant?.org_id || manager?.tenant_org_id || manager?.org_id || null,
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
          org_id: activeTenant?.org_id,
          phone: selectedPhone,
        })
      );
    }
  }, [selectedPhone, socketRef]);

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-5rem)] gap-6 p-4 md:p-8">
        <section className="slaivo-card flex w-[430px] flex-col overflow-hidden rounded-[2rem]">
          <div className="border-b border-slate-100 p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-sky-600">
                  Command Center
                </div>
                <h1 className="mt-2 text-2xl font-black text-slate-950">
                  Enterprise Inbox
                </h1>
              </div>

              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                LIVE
              </div>
            </div>

            <p className="mt-2 text-sm text-slate-500">
              Conversations WhatsApp par numero et role
            </p>

            <select
              value={roleFilter}
              onChange={(event) => handleRoleChange(event.target.value)}
              className="slaivo-focus mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold"
            >
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>

          <div className="border-b border-slate-100 bg-slate-50/70 p-4">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleQueueFilterChange("ALL")}
                className={`rounded-full border px-3 py-2 text-xs font-bold transition ${
                  queueFilter === "ALL"
                    ? "border-slate-950 bg-slate-950 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-sky-200 hover:text-sky-700"
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
                  className={`rounded-full border px-3 py-2 text-xs font-bold transition ${
                    queueFilter === queue.queue_name
                      ? "border-slate-950 bg-slate-950 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-sky-200 hover:text-sky-700"
                  }`}
                >
                  {queue.queue_name} ({queue.total})
                </button>
              ))}
            </div>
          </div>

          <div className="border-b border-slate-100 p-4">
            <h3 className="text-sm font-black text-slate-950">Agents</h3>

            <div className="mt-3 space-y-2">
              {presence.map((agent) => (
                <div
                  key={agent.manager_id}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        agent.status === "ONLINE"
                          ? "bg-green-500"
                          : "bg-gray-400"
                      }`}
                    />
                    <span className="font-semibold text-slate-700">
                      {agent.manager_name || agent.manager_id}
                    </span>
                  </div>

                  <span className="text-xs font-bold text-slate-500">
                    {agent.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="m-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          <div className="min-h-0 flex-1 space-y-3 overflow-auto p-4">
            {loading && (
              <EmptyState label="Chargement des conversations..." />
            )}

            {!loading && conversations.length === 0 && (
              <EmptyState label="Aucune conversation." />
            )}

            {conversations.map((conversation) => (
              <button
                key={conversation.from_phone}
                onClick={() => openConversation(conversation.from_phone)}
                className={`w-full rounded-3xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lg ${
                  selectedPhone === conversation.from_phone
                    ? "border-sky-200 bg-sky-50 shadow-md"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="font-black text-slate-950">
                    {conversation.from_phone}
                  </div>

                  <StatusPill label={conversation.number_role || "UNKNOWN"} tone="info" />
                </div>

                <div className="mt-2 line-clamp-1 text-sm text-slate-500">
                  {conversation.last_message || "Aucun message"}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                  <span>{conversation.message_count} message(s)</span>
                  <span>•</span>
                  <span>{conversation.conversation_status || "OPEN"}</span>
                  <span>•</span>
                  <span>{conversation.priority || "NORMAL"}</span>
                  <span>•</span>
                  <span>{conversation.queue_name || "UNASSIGNED"}</span>
                  {conversation.requires_attention && (
                    <>
                      <span>•</span>
                      <span className="text-red-600">ATTENTION</span>
                    </>
                  )}
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="slaivo-card flex min-w-0 flex-1 flex-col overflow-hidden rounded-[2rem]">
          <div className="border-b border-slate-100 p-6">
            <h2 className="text-2xl font-black text-slate-950">
              {selectedPhone || "Selectionnez une conversation"}
            </h2>

            {messages[0]?.number_role && (
              <p className="mt-1 text-sm text-slate-500">
                Role numero : {messages[0].number_role}
              </p>
            )}

            {assignment?.assigned_manager_name && (
              <p className="mt-1 text-sm text-slate-500">
                Responsable : {assignment.assigned_manager_name}
              </p>
            )}
          </div>

          {selectedPhone && (
            <div className="border-b border-slate-100 bg-slate-50/80 p-6">
              <h3 className="font-black text-slate-950">Workflow equipe</h3>

              <div className="mt-4 grid gap-3 xl:grid-cols-5">
                <input
                  value={managerName}
                  onChange={(event) => setManagerName(event.target.value)}
                  placeholder="Manager responsable"
                  className="slaivo-focus rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                />

                <select
                  value={conversationStatus}
                  onChange={(event) =>
                    setConversationStatus(event.target.value)
                  }
                  className="slaivo-focus rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
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
                  className="slaivo-focus rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
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
                  className="slaivo-focus rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                >
                  {QUEUE_OPTIONS.map((queue) => (
                    <option key={queue} value={queue}>
                      {queue}
                    </option>
                  ))}
                </select>

                <button
                  onClick={saveAssignment}
                  className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white shadow-lg shadow-slate-950/20 transition hover:-translate-y-0.5"
                >
                  Sauvegarder
                </button>
              </div>

              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Note interne..."
                className="slaivo-focus mt-3 min-h-[90px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
              />
            </div>
          )}

          <div className="flex-1 space-y-4 overflow-auto bg-slate-50/40 p-6">
            {!selectedPhone && (
              <div className="flex h-full items-center justify-center">
                <EmptyState label="Choisissez une conversation à gauche." />
              </div>
            )}

            {selectedPhone &&
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`max-w-xl rounded-3xl border p-4 shadow-sm ${
                    message.direction === "outbound"
                      ? "ml-auto border-slate-950 bg-slate-950 text-white"
                      : "border-slate-200 bg-white text-slate-800"
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
              <div className="text-sm font-medium text-slate-500">
                {typingUsers.join(", ")} typing...
              </div>
            )}
          </div>

          {selectedPhone && (
            <div className="border-t border-slate-100 bg-white p-4">
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
                  className="slaivo-focus min-h-[70px] flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                />

                <button
                  onClick={handleGenerateAIDraft}
                  disabled={generatingDraft || !selectedPhone}
                  className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  {generatingDraft ? "IA..." : "Generer IA"}
                </button>

                <button
                  onClick={sendReply}
                  disabled={sendingReply || !replyText.trim()}
                  className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-lg shadow-slate-950/20 transition hover:-translate-y-0.5 disabled:opacity-50"
                >
                  {sendingReply ? "Envoi..." : "Envoyer"}
                </button>
              </div>
            </div>
          )}

          {selectedPhone && (
            <div className="max-h-[44vh] overflow-auto border-t p-6">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="font-semibold">Assistant IA</h3>

                <button
                  onClick={handlePrepareAIWorkflow}
                  disabled={preparingWorkflow}
                  className="rounded-md border px-4 py-2 text-xs font-semibold disabled:opacity-50"
                >
                  {preparingWorkflow ? "Preparation..." : "Preparer workflow IA"}
                </button>

                <button
                  onClick={handlePrepareDossierDraft}
                  disabled={preparingDossierDraft}
                  className="rounded-md border px-4 py-2 text-xs font-semibold disabled:opacity-50"
                >
                  {preparingDossierDraft
                    ? "Preparation dossier..."
                    : "Preparer dossier IA"}
                </button>
              </div>

              {aiDrafts.length > 0 && (
                <div className="mt-5">
                  <h4 className="text-sm font-semibold">Brouillons IA</h4>
                  <div className="mt-3 space-y-3">
                    {aiDrafts.map((draft) => (
                      <button
                        key={draft.id}
                        onClick={() => {
                          setReplyText(draft.draft_text);
                          setSelectedDraftId(draft.id);
                        }}
                        className="w-full rounded-md border p-4 text-left text-sm hover:bg-gray-50"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">
                            {draft.intent || "AI Draft"}
                          </span>
                          <span className="text-xs text-gray-500">
                            {draft.status}
                          </span>
                        </div>
                        <p className="mt-2 line-clamp-3 text-gray-600">
                          {draft.draft_text}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {aiWorkflows.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-semibold">Workflows IA</h4>
                  <div className="mt-3 space-y-3">
                    {aiWorkflows.map((workflow) => (
                      <div
                        key={workflow.id}
                        className="rounded-md border p-4 text-sm"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold">
                              {workflow.workflow_type}
                            </div>
                            <div className="mt-1 text-xs text-gray-500">
                              {workflow.intent} | {workflow.confidence ?? "-"}
                            </div>
                          </div>
                          <span className="rounded-full border px-2 py-1 text-xs">
                            {workflow.workflow_status}
                          </span>
                        </div>

                        {workflow.proposed_actions?.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {workflow.proposed_actions.map((action, index) => (
                              <div
                                key={`${workflow.id}-${index}`}
                                className="rounded-md bg-gray-50 p-3"
                              >
                                {action.label}
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() =>
                              changeWorkflowStatus(workflow.id, "APPROVED")
                            }
                            className="rounded-md bg-black px-3 py-2 text-xs font-semibold text-white"
                          >
                            Approuver
                          </button>
                          <button
                            onClick={() =>
                              changeWorkflowStatus(workflow.id, "CANCELLED")
                            }
                            className="rounded-md border px-3 py-2 text-xs font-semibold"
                          >
                            Annuler
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {dossierDrafts.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-semibold">
                    Dossiers IA prepares
                  </h4>
                  <div className="mt-3 space-y-3">
                    {dossierDrafts.map((draft) => (
                      <div
                        key={draft.id}
                        className="rounded-md border p-4 text-sm"
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-semibold">
                            {draft.case_type || "SEND_CARGO"}
                          </div>
                          <span className="rounded-full border px-2 py-1 text-xs">
                            {draft.status}
                          </span>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-gray-500">Origine:</span>{" "}
                            {draft.origin_city || draft.origin_country || "-"}
                          </div>
                          <div>
                            <span className="text-gray-500">Destination:</span>{" "}
                            {draft.destination_city ||
                              draft.destination_country ||
                              "-"}
                          </div>
                          <div>
                            <span className="text-gray-500">Marchandise:</span>{" "}
                            {draft.goods_type || "-"}
                          </div>
                          <div>
                            <span className="text-gray-500">Poids:</span>{" "}
                            {draft.estimated_weight_kg
                              ? `${draft.estimated_weight_kg} kg`
                              : "-"}
                          </div>
                        </div>

                        {draft.missing_fields?.length > 0 && (
                          <div className="mt-4 rounded-md bg-yellow-50 p-3 text-xs text-yellow-800">
                            Champs manquants :{" "}
                            {draft.missing_fields.join(", ")}
                          </div>
                        )}

                        <div className="mt-4 flex gap-2">
                          <button
                            onClick={() => executeDraft(draft.id)}
                            className="rounded-md bg-black px-3 py-2 text-xs font-semibold text-white"
                          >
                            Creer dossier
                          </button>
                          <button
                            onClick={() =>
                              changeDossierDraftStatus(draft.id, "CANCELLED")
                            }
                            className="rounded-md border px-3 py-2 text-xs font-semibold"
                          >
                            Annuler
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
                      {event.created_by_name || "SLAIVIO"} |{" "}
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
