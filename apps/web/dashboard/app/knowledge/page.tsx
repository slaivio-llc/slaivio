"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, Layers3, Plus, Trash2 } from "lucide-react";

import { CargoCard, CargoPageShell, EmptyState, StatusPill } from "@/components/cargo/cargo-page-shell";
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

  const categories = useMemo(() => {
    return new Set(docs.map((doc) => doc.category).filter(Boolean)).size;
  }, [docs]);

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
      setError("Titre et contenu obligatoires.");
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
      setError("Impossible de créer le document.");
    }
  }

  async function removeDoc(id: string) {
    await deleteKnowledgeDocument(id);
    await load();
  }

  return (
    <CargoPageShell
      title="Knowledge Intelligence"
      description="Centralisez les règles agence, tarifs, paiements, warehouse et réponses métier utilisées par l’IA."
      eyebrow="AI Knowledge Base"
    >
      {error && (
        <div className="rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-600">
          {error}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        <Metric label="Documents" value={String(docs.length)} hint="Base métier agence" />
        <Metric label="Catégories" value={String(categories)} hint="Pricing, warehouse, payment..." />
        <Metric label="AI Ready" value="Oui" hint="Utilisé par les brouillons IA" />
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <CargoCard>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
              <Plus size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-950">
                Ajouter une règle métier
              </h2>
              <p className="text-sm text-slate-500">
                Information exploitable par SLAIVIO AI.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Titre"
              className="slaivo-focus w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
            />
            <input
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              placeholder="Catégorie : pricing, warehouse, payment..."
              className="slaivo-focus w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
            />
            <input
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="Tags séparés par virgules"
              className="slaivo-focus w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
            />
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Exemple : Pour les colis fragiles, demander photo fournisseur et confirmation emballage..."
              className="slaivo-focus min-h-[260px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
            />
            <button
              onClick={createDoc}
              className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5"
            >
              Ajouter à la base
            </button>
          </div>
        </CargoCard>

        <CargoCard>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-950">
                Documents knowledge
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Référentiel opérationnel consulté par l’IA.
              </p>
            </div>
            <BookOpen className="text-slate-300" size={30} />
          </div>

          <div className="mt-5 grid gap-4">
            {loading && <EmptyState label="Chargement..." />}
            {!loading && docs.length === 0 && (
              <EmptyState label="Aucun document knowledge." />
            )}

            {docs.map((doc) => (
              <div
                key={doc.id}
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-black text-slate-950">{doc.title}</h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {doc.category && (
                        <StatusPill label={doc.category} tone="info" />
                      )}
                      {(doc.tags || []).slice(0, 4).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-600"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => removeDoc(doc.id)}
                    className="rounded-2xl border border-slate-200 p-2 text-slate-500 transition hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {doc.content}
                </p>
              </div>
            ))}
          </div>
        </CargoCard>
      </div>
    </CargoPageShell>
  );
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="slaivo-card rounded-3xl p-5">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-500">{label}</div>
        <Layers3 size={17} className="text-slate-300" />
      </div>
      <div className="mt-3 text-3xl font-black text-slate-950">{value}</div>
      <div className="mt-2 text-xs text-slate-500">{hint}</div>
    </div>
  );
}

