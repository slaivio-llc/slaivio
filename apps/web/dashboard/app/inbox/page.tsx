"use client";

import { useEffect, useState } from "react";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import {
  getConversations,
  getConversationMessages,
} from "@/services/inbox";
import type { Conversation, InboxMessage } from "@/types/inbox";

export default function InboxPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getConversations()
      .then(setConversations)
      .catch(() => {
        setError("Impossible de charger les conversations.");
      })
      .finally(() => setLoading(false));
  }, []);

  async function openConversation(phone: string) {
    setSelectedPhone(phone);

    try {
      const data = await getConversationMessages(phone);
      setMessages(data);
    } catch {
      setError("Impossible de charger cette conversation.");
    }
  }

  return (
    <DashboardLayout>
      <div className="flex h-screen">
        <section className="w-96 border-r">
          <div className="border-b p-6">
            <h1 className="text-2xl font-bold">Inbox WhatsApp</h1>
            <p className="text-sm text-gray-500">
              Conversations clients
            </p>
          </div>

          {error && (
            <div className="m-4 rounded-xl bg-red-50 p-4 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="divide-y">
            {loading && (
              <div className="p-6 text-sm text-gray-500">
                Chargement...
              </div>
            )}

            {!loading && conversations.length === 0 && (
              <div className="p-6 text-sm text-gray-500">
                Aucune conversation pour le moment.
              </div>
            )}

            {conversations.map((conversation) => (
              <button
                key={conversation.from_phone}
                onClick={() => openConversation(conversation.from_phone)}
                className="w-full p-4 text-left transition hover:bg-gray-50"
              >
                <div className="font-semibold">
                  {conversation.from_phone}
                </div>

                <div className="mt-1 line-clamp-1 text-sm text-gray-500">
                  {conversation.last_message || "Aucun message"}
                </div>

                <div className="mt-2 text-xs text-gray-500">
                  {conversation.message_count} message(s)
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
          </div>

          <div className="flex-1 space-y-4 overflow-auto p-6">
            {messages.map((message) => (
              <div
                key={message.id}
                className="max-w-xl rounded-2xl border bg-white p-4"
              >
                <div className="text-sm">
                  {message.text_body || ""}
                </div>

                <div className="mt-2 text-xs text-gray-500">
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