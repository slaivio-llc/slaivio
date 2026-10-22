import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import { ReportsAnalyticsPage } from "./reports-analytics-page";
import * as reportsService from "@/services/reports";
import { getOfficeContext } from "@/services/organization-admin";

vi.mock("@/services/reports", () => ({
  getAnalytics: vi.fn(),
  previewReport: vi.fn(),
  exportReport: vi.fn(),
  saveReportView: vi.fn(),
}));

vi.mock("@/services/organization-admin", () => ({
  getOfficeContext: vi.fn().mockResolvedValue({ offices: [], selected_office_id: null }),
}));
vi.mock("@/components/permissions/permission-guard", () => ({
  PermissionGuard: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/components/ui/operation-page-header", () => ({
  OperationPageHeader: ({ title, actions }: { title: string; actions: ReactNode }) => <header><h1>{title}</h1>{actions}</header>,
}));

const analytics: reportsService.Analytics = {
  period: { start: "2026-10-01", end: "2026-10-30", days: 30 },
  kpis: { clients: 1, packages: 2, shipments: 1, pickups: 0, weight_kg: 0 },
  trend: [], monthly_trend: [], monthly_finance: [], offices: [],
  statuses: { packages: [], shipments: [] }, routes: [], finance: [], warehouses: [],
};

beforeEach(() => {
  vi.mocked(getOfficeContext).mockResolvedValue({ offices: [], selected_office_id: null, office_access_scope: "ALL_OFFICES", allowed_office_ids: [] });
  vi.mocked(reportsService.previewReport).mockReset();
  vi.mocked(reportsService.previewReport).mockResolvedValue([]);
  vi.mocked(reportsService.getAnalytics).mockRejectedValue(new Error("offline"));
});

describe("ReportsAnalyticsPage", () => {
  it("keeps the workspace fixed and scrolls only the report pane when switching tabs", async () => {
    vi.mocked(reportsService.getAnalytics).mockResolvedValue(analytics);
    const { container } = render(<ReportsAnalyticsPage />);
    await screen.findByRole("heading", { name: "Évolution de l’activité" });
    const panel = container.querySelector('[data-ui="report-content"]') as HTMLElement;
    const workspace = container.querySelector('[data-ui="reports-workspace"]')!;
    const navigation = screen.getByRole("navigation", { name: "Sections des rapports" });
    expect(workspace).toHaveClass("h-full", "min-h-0", "overflow-hidden", "flex-col");
    expect(navigation).toHaveClass("shrink-0");
    expect(panel).toHaveClass("flex-1", "min-h-0", "overflow-y-auto", "[scrollbar-gutter:stable]");
    expect(panel.style.minHeight).toBe("");
    panel.scrollTop = 750;

    fireEvent.click(screen.getByRole("button", { name: "Bureaux" }));
    expect(panel.scrollTop).toBe(0);
    expect(screen.getByRole("region", { name: "Contenu du rapport — Bureaux" })).toBe(panel);
    expect(screen.getByRole("navigation", { name: "Sections des rapports" })).toBe(navigation);
    expect(screen.getByRole("heading", { name: "Performances bureaux" })).toBeVisible();

    panel.scrollTop = 120;
    fireEvent.click(screen.getByRole("button", { name: "Clients" }));
    expect(panel.scrollTop).toBe(0);
    expect(panel.style.minHeight).toBe("");
    expect(container.querySelector('[data-ui="reports-workspace"]')).toBe(workspace);
    await waitFor(() => expect(screen.queryByRole("status", { name: "Chargement du rapport…" })).not.toBeInTheDocument());
  });

  it("reuses loaded reports and never displays another tab's rows while loading", async () => {
    vi.mocked(reportsService.getAnalytics).mockResolvedValue(analytics);
    let resolveClients!: (rows: Array<Record<string, unknown>>) => void;
    vi.mocked(reportsService.previewReport).mockImplementation((key) => key === "clients"
      ? new Promise((resolve) => { resolveClients = resolve; })
      : Promise.resolve([{ id: "package-1", package_reference: "COL-123", status: "RECEIVED" }]));
    render(<ReportsAnalyticsPage />);
    await screen.findByRole("heading", { name: "Évolution de l’activité" });

    fireEvent.click(screen.getByRole("button", { name: "Colis" }));
    expect(await screen.findByText("COL-123")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Clients" }));
    expect(screen.queryByText("COL-123")).not.toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Chargement du rapport…" })).toBeVisible();
    await act(async () => { resolveClients([{ id: "client-1", name: "Marie", client_reference: "CLI-001" }]); });
    expect(await screen.findByText("Marie")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Colis" }));
    expect(screen.getByText("COL-123")).toBeVisible();
    expect(screen.queryByRole("status", { name: "Chargement du rapport…" })).not.toBeInTheDocument();
    expect(reportsService.previewReport).toHaveBeenCalledTimes(2);

    fireEvent.change(screen.getByLabelText("Période"), { target: { value: (screen.getByLabelText("Période") as HTMLSelectElement).options[1].value } });
    await waitFor(() => expect(reportsService.previewReport).toHaveBeenCalledTimes(3));
  });

  it("shows one actionable error state when analytics cannot be loaded", async () => {
    render(<ReportsAnalyticsPage />);

    expect(await screen.findByText("Analytics indisponibles")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Réessayer" })).toBeInTheDocument();
    expect(screen.queryByText("Analytics temporairement indisponibles")).not.toBeInTheDocument();
  });

  it("explains when the browser received no HTTP response", async () => {
    vi.mocked(reportsService.getAnalytics).mockRejectedValue(
      Object.assign(new Error("Network Error"), { isAxiosError: true, code: "ERR_NETWORK" }),
    );

    render(<ReportsAnalyticsPage />);

    expect(await screen.findByText(/Aucune réponse HTTP de l’API/)).toBeInTheDocument();
  });

  it("distinguishes a successfully loaded empty period from an API failure", async () => {
    vi.mocked(reportsService.getAnalytics).mockResolvedValue({
      period: { start: "2026-10-01", end: "2026-10-30", days: 30 },
      kpis: { clients: 0, packages: 0, shipments: 0, pickups: 0, weight_kg: 0 },
      trend: [],
      monthly_trend: [],
      monthly_finance: [],
      offices: [],
      statuses: { packages: [], shipments: [] },
      routes: [],
      finance: [],
      warehouses: [],
    });

    render(<ReportsAnalyticsPage />);

    expect(await screen.findByText(/Aucune opération n’a été enregistrée sur la période sélectionnée/)).toHaveAttribute("role", "status");
    expect(screen.queryByText("Analytics indisponibles")).not.toBeInTheDocument();
    expect(screen.queryByText("Dossiers")).not.toBeInTheDocument();
  });
});
