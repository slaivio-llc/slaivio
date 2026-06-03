import { api } from "@/services/api";
import type { QueueSummary } from "@/types/inbox";

export async function getQueues(): Promise<QueueSummary[]> {
  const response = await api.get("/queues");

  return response.data.queues;
}

export async function updateQueue(
  phone: string,
  queue: string
) {
  const response = await api.patch(
    `/queues/${encodeURIComponent(phone)}`,
    {},
    {
      params: {
        queue_name: queue,
      },
    }
  );

  return response.data.assignment;
}
