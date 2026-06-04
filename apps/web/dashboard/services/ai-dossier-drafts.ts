import { api } from "@/services/api";
import type { AIDossierDraft } from "@/types/inbox";

export async function prepareAIDossierDraft(
  phone: string,
  data: {
    source_message: string;
    workflow_id?: string | null;
    manager_id?: string | null;
    manager_name?: string | null;
  }
): Promise<AIDossierDraft> {
  const response = await api.post(
    `/inbox/conversations/${encodeURIComponent(phone)}/ai-dossier-draft`,
    data
  );

  return response.data.draft;
}

export async function getAIDossierDrafts(
  phone: string
): Promise<AIDossierDraft[]> {
  const response = await api.get(
    `/inbox/conversations/${encodeURIComponent(phone)}/ai-dossier-drafts`
  );

  return response.data.drafts;
}

export async function updateAIDossierDraftStatus(
  draftId: string,
  status: string
): Promise<AIDossierDraft> {
  const response = await api.patch(
    `/ai-dossier-drafts/${draftId}/status`,
    {
      status,
    }
  );

  return response.data.draft;
}

export async function executeDossierDraft(
  draftId: string
) {
  const response = await api.post(
    `/ai-dossier-drafts/${draftId}/execute`
  );

  return response.data;
}

