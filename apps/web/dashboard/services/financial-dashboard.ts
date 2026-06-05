import { api } from "@/services/api";

export type FinancialDashboard = {
  totals: {
    revenue_minor: number;
    cost_minor: number;
    net_minor: number;
  };
  wallet: {
    balance_minor: number;
    reserved_minor: number;
    wallet_count: number;
  };
  invoices: {
    total_invoiced_minor: number;
    paid_minor: number;
    outstanding_minor: number;
    invoice_count: number;
  };
  cashflow: Array<{
    day: string;
    inflow_minor: number;
    outflow_minor: number;
  }>;
  recent_events: Array<{
    id: string;
    event_type: string;
    amount_minor: number;
    currency_code: string;
    description: string | null;
    created_at: string;
  }>;
};

export async function getFinancialDashboard(): Promise<FinancialDashboard> {
  const response = await api.get("/financial/dashboard");

  return response.data.dashboard;
}

