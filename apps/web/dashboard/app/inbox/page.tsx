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

  useEffect(() => {
    getConversations()
      .then(setConversations)
      .finally(() => setLoading(false));
  }, []);

  async function openConversation(phone: string) {
    setSelectedPhone(phone);
    const data = await getConversationMessages(phone);
    setMessages(data);
  }

  return (
    <DashboardLayout>
      <div className="flex h-screen">
        <section className="w-96 border-r">
          <div className="border-b p-6">
            <h1 className="text-2xl font-bold">Inbox WhatsApp</h1>
            <p className="text-sm text-muted-foreground">
              Conversations clients
            </p>
          </div>

          <div className="divide-y">
            {loading && (
              <div className="p-6 text-sm text-muted-foreground">
                Chargement...
              </div>
            )}

            {conversations.map((conversation) => (
              <button
                key={conversation.from_phone}
                onClick={() => openConversation(conversation.from_phone)}
                className="w-full p-4 text-left hover:bg-muted"
              >
                <div className="font-semibold">
                  {conversation.from_phone}
                </div>

                <div className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                  {conversation.last_message || "Aucun message"}
                </div>

                <div className="mt-2 text-xs text-muted-foreground">
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
                className="max-w-xl rounded-2xl border bg-card p-4"
              >
                <div className="text-sm">
                  {message.text_body}
                </div>

                <div className="mt-2 text-xs text-muted-foreground">
                  {new Date(message.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </DashboardLayout>
