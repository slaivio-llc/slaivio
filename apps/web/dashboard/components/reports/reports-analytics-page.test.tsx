import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ReportsAnalyticsPage } from "./reports-analytics-page";
import * as reportsService from "@/services/reports";

vi.mock("@/services/reports", () => ({
  getAnalytics: vi.fn(),
  previewReport: vi.fn(),
  exportReport: vi.fn(),
  saveReportView: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(reportsService.getAnalytics).mockRejectedValue(new Error("offline"));
});

describe("ReportsAnalyticsPage", () => {
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
      statuses: { packages: [], shipments: [] },
      routes: [],
      finance: [],
      warehouses: [],
    });

    render(<ReportsAnalyticsPage />);

    expect(await screen.findByRole("status")).toHaveTextContent("Aucune opération n’a été enregistrée sur la période sélectionnée.");
    expect(screen.queryByText("Analytics indisponibles")).not.toBeInTheDocument();
    expect(screen.queryByText("Dossiers")).not.toBeInTheDocument();
  });
});
