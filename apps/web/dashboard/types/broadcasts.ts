export type BroadcastCampaign = {
  id: string;

  title: string;
  message_body: string;

  audience_type: string;
  status: string;

  total_recipients: number;
  total_sent: number;
  total_failed: number;

  created_at: string;
};