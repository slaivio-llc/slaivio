import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PricingEnginePage, PricingManagementSection } from "./pricing-engine-page";

const pricingService = vi.hoisted(() => ({
  addGridFee: vi.fn(), addGridRule: vi.fn(), addGridTier: vi.fn(), approveGrid: vi.fn(),
  createGrid: vi.fn(), createGridVersion: vi.fn(), createPricingCategory: vi.fn(), gridDetail: vi.fn(),
  pricingAnalytics: vi.fn(), pricingCatalog: vi.fn(), pricingDashboard: vi.fn(),
  savePricingSettings: vi.fn(), simulatePrice: vi.fn(), transitionGrid: vi.fn(),
}));

vi.mock("@/services/pricing-engine", () => pricingService);
vi.mock("@/components/permissions/permission-guard", () => ({ PermissionGuard: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/components/ui/operation-page-header", () => ({ OperationPageHeader: ({ actions }: { actions: ReactNode }) => <header>{actions}</header> }));
vi.mock("@/components/ui/operation-drawer", () => ({ OperationDrawer: ({ children, open }: { children: ReactNode; open: boolean }) => open ? <div>{children}</div> : null }));
vi.mock("@/components/ui/operation-primitives", () => ({
  OperationMetrics: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  OperationMetricGrid: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  OperationMetric: () => <div />, OperationSearch: () => <div />,
  OperationToolbar: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/ui/operation-controls", () => ({
  OperationButton: ({ children }: { children: ReactNode }) => <button>{children}</button>,
  OperationField: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  OperationFilterPopover: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  OperationMetric: () => <div />, OperationMetricGrid: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/ui/page-state", () => ({
  EmptyState: ({ title }: { title: string }) => <p>{title}</p>,
  ErrorState: ({ title }: { title: string }) => <p>{title}</p>, TableSkeleton: () => <div />,
}));

describe("PricingEnginePage tariff creation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pricingService.pricingDashboard.mockResolvedValue({ stats: {}, settings: {}, alerts: [], grids: [] });
    pricingService.pricingCatalog.mockResolvedValue({
      routes: [{ id: "route-1", route_code: "R1", route_name: "Route 1" }],
      services: [{ id: "service-1", route_id: "route-1", service_code: "S1", service_name: "Service 1", shipping_mode: "AIR" }],
      categories: [], promotions: [],
    });
    pricingService.createGrid.mockResolvedValue({ id: "grid-1" });
    pricingService.gridDetail.mockResolvedValue({
      grid: { id: "grid-1", grid_code: "TARIF-1", name: "Cargo", route_id: "route-1", shipping_service_id: "service-1", route_name: "Route 1", service_name: "Service 1", shipping_mode: "AIR", currency_code: "USD", calculation_method: "PER_KG", visibility: "INTERNAL", status: "DRAFT", effective_from: "2026-10-15T12:00:00Z", version: 1, rule_count: 1, tier_count: 0, fee_count: 0 },
      rules: [{ id: "rule-1", name: "Tarif de base", action_type: "SET_PRICE", conditions: { category_code: "FRAGILE", package_type: "carton" }, amount: 8.5, calculation_method: "PER_KG" }],
      tiers: [], fees: [], costs: [], audit: [],
    });
  });

  it("reviews and saves a unit tariff as a draft", async () => {
    render(<PricingEnginePage />);
    fireEvent.click(await screen.findByRole("button", { name: /Nouveau tarif/ }));
    fireEvent.change(screen.getByLabelText(/Nom du tarif/), { target: { value: "Tarif cargo" } });
    fireEvent.change(screen.getByLabelText(/^Service/), { target: { value: "service-1" } });
    fireEvent.change(screen.getByLabelText(/^Route/), { target: { value: "route-1" } });
    fireEvent.change(screen.getByLabelText(/Prix par kilogramme/), { target: { value: "8.50" } });
    fireEvent.change(screen.getByLabelText(/Cat.gorie de marchandise/), { target: { value: "FRAGILE" } });
    fireEvent.click(screen.getByRole("button", { name: /V.rifier le tarif/ }));
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer le tarif/ }));

    await waitFor(() => expect(pricingService.createGrid).toHaveBeenCalledOnce());
    expect(pricingService.createGrid).toHaveBeenCalledWith(expect.objectContaining({
      name: "Tarif cargo", route_id: "route-1", shipping_service_id: "service-1",
      calculation_method: "PER_KG", initial_price: 8.5, initial_category_code: "FRAGILE",
      initial_package_type: "carton", currency_code: "USD", requires_approval: true,
    }));
  });

  it("places the management tariff action in the page header and opens its form", async () => {
    const header = document.createElement("header");
    document.body.appendChild(header);
    const view = render(<PricingManagementSection headerActionsTarget={header} />);
    try {
      await screen.findByText("Service 1");
      const createButton = within(header).getByRole("button", { name: "Ajouter un tarif" });
      expect(within(view.container).queryByRole("button", { name: "Ajouter un tarif" })).not.toBeInTheDocument();
      fireEvent.click(createButton);
      expect(await screen.findByLabelText(/Nom du tarif/)).toBeVisible();
    } finally {
      view.unmount();
      header.remove();
    }
  });
});
