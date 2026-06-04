"use client";

import { useEffect, useState } from "react";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import {
  createKnowledgeDocument,
  deleteKnowledgeDocument,
  getKnowledgeDocuments,
  type KnowledgeDocument,
} from "@/services/knowledge";


export default function KnowledgePage() {
  const [docs, setDocs] = useState<KnowledgeDocument[]>([]);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      setDocs(await getKnowledgeDocuments());
    } catch {
      setError("Impossible de charger la knowledge base.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createDoc() {
    if (!title.trim() || !content.trim()) {
      return;
    }

    setError("");

    try {
      await createKnowledgeDocument({
        title: title.trim(),
        content: content.trim(),
        category: category.trim() || null,
        tags: tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      });

      setTitle("");
      setCategory("");
      setTags("");
      setContent("");
      await load();
    } catch {
      setError("Impossible de creer le document.");
    }
  }

  async function removeDoc(id: string) {
    await deleteKnowledgeDocument(id);
    await load();
  }

  return (
    <DashboardLayout>
      <div className="flex h-screen">
        <section className="w-[440px] border-r p-6">
          <h1 className="text-2xl font-bold">Knowledge Base</h1>
          <p className="mt-1 text-sm text-gray-500">
            Regles, tarifs et informations agence pour l'IA.
          </p>

          {error && (
            <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="mt-6 space-y-3">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Titre"
              className="w-full rounded-md border px-4 py-3 text-sm"
            />
            <input
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              placeholder="Categorie: pricing, warehouse, payment..."
              className="w-full rounded-md border px-4 py-3 text-sm"
            />
            <input
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="Tags separes par virgules"
              className="w-full rounded-md border px-4 py-3 text-sm"
            />
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Texte agence"
              className="min-h-[260px] w-full rounded-md border px-4 py-3 text-sm"
            />
            <button
              onClick={createDoc}
              className="w-full rounded-md bg-black px-4 py-3 text-sm font-semibold text-white"
            >
              Ajouter
            </button>
          </div>
        </section>

        <section className="flex-1 overflow-auto p-6">
          {loading && (
            <div className="text-sm text-gray-500">Chargement...</div>
          )}

          {!loading && docs.length === 0 && (
            <div className="text-sm text-gray-500">
              Aucun document knowledge.
            </div>
          )}

          <div className="grid gap-4">
            {docs.map((doc) => (
              <div
                key={doc.id}
                className="rounded-md border p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold">{doc.title}</h3>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
                      {doc.category && (
                        <span className="rounded-full border px-2 py-1">
                          {doc.category}
                        </span>
                      )}
                      {(doc.tags || []).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border px-2 py-1"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => removeDoc(doc.id)}
                    className="rounded-md border px-3 py-2 text-xs font-semibold"
                  >
                    Supprimer
                  </button>
                </div>

                <p className="mt-4 whitespace-pre-wrap text-sm text-gray-700">
                  {doc.content}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}

