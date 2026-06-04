import { api } from "@/services/api";
import type { AIWorkflowRun } from "@/types/inbox";

export async function prepareAIWorkflow(
  phone: string,
  data: {
    source_message: string;
    manager_id?: string | null;
    manager_name?: string | null;
  }
): Promise<AIWorkflowRun> {
  const response = await api.post(
    `/inbox/conversations/${encodeURIComponent(phone)}/ai-workflow`,
    data
  );

  return response.data.workflow;
}

export async function getAIWorkflows(
  phone: string
): Promise<AIWorkflowRun[]> {
  const response = await api.get(
    `/inbox/conversations/${encodeURIComponent(phone)}/ai-workflows`
  );

  return response.data.workflows;
}

export async function updateAIWorkflowStatus(
  workflowId: string,
  data: {
    status: string;
    result_payload?: Record<string, unknown>;
  }
): Promise<AIWorkflowRun> {
  const response = await api.patch(
    `/ai-workflows/${workflowId}/status`,
    data
  );

  return response.data.workflow;
}

