import { api } from "@/services/api";

export type KnowledgeDocument = {
  id: string;
  org_id: string;
  title: string;
  content: string;
  source: string | null;
  category: string | null;
  tags: string[] | null;
  priority: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
};

export async function getKnowledgeDocuments(): Promise<KnowledgeDocument[]> {
  const response = await api.get("/knowledge");

  return response.data.documents;
}

export async function createKnowledgeDocument(data: {
  title: string;
  content: string;
  source?: string;
  category?: string | null;
  tags?: string[];
}): Promise<KnowledgeDocument> {
  const response = await api.post("/knowledge", data);

  return response.data.document;
}

export async function deleteKnowledgeDocument(id: string) {
  await api.delete(`/knowledge/${id}`);
}

