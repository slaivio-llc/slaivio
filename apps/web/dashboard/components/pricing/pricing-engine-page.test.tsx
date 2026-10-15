import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PricingEnginePage } from "./pricing-engine-page";

const pricingService = vi.hoisted(() => ({
  addGridFee: vi.fn(),
  addGridRule: vi.fn(),
  addGridTier: vi.fn(),
  approveGrid: vi.fn(),
  createGrid: vi.fn(),
  createGridVersion: vi.fn(),
  createPricingCategory: vi.fn(),
  gridDetail: vi.fn(),
  pricingAnalytics: vi.fn(),
  pricingCatalog: vi.fn(),
  pricingDashboard: vi.fn(),
  savePricingSettings: vi.fn(),
  simulatePrice: vi.fn(),
  transitionGrid: vi.fn(),
}));

vi.mock("@/services/pricing-engine", () => pricingService);
vi.mock("@/components/permissions/permission-guard", () => ({
  PermissionGuard: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/components/ui/operation-page-header", () => ({
  OperationPageHeader: ({ actions }: { actions: ReactNode }) => <header>{actions}</header>,
}));
vi.mock("@/components/ui/operation-drawer", () => ({
  OperationDrawer: ({ children, open }: { children: ReactNode; open: boolean }) =>
    open ? <div>{children}</div> : null,
}));
vi.mock("@/components/ui/operation-primitives", () => ({
  OperationMetrics: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  OperationMetricGrid: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  OperationMetric: () => <div />,
  OperationSearch: () => <div />,
  OperationToolbar: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/ui/operation-controls", () => ({
  OperationButton: ({ children }: { children: ReactNode }) => <button>{children}</button>,
  OperationField: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  OperationFilterPopover: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  OperationMetric: () => <div />,
  OperationMetricGrid: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/ui/page-state", () => ({
  EmptyState: ({ title }: { title: string }) => <p>{title}</p>,
  ErrorState: ({ title }: { title: string }) => <p>{title}</p>,
  TableSkeleton: () => <div />,
}));

describe("PricingEnginePage grid creation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pricingService.pricingDashboard.mockResolvedValue({
      stats: {},
      settings: {},
      alerts: [],
      grids: [],
    });
    pricingService.pricingCatalog.mockResolvedValue({
      routes: [{ id: "route-1", route_code: "R1", route_name: "Route 1" }],
      services: [{
        id: "service-1",
        route_id: "route-1",
        service_code: "S1",
        service_name: "Service 1",
        shipping_mode: "AIR",
      }],
      categories: [],
      promotions: [],
    });
    pricingService.createGrid.mockResolvedValue({ id: "grid-1" });
  });

  it("submits values from all wizard steps", async () => {
    render(<PricingEnginePage />);

    fireEvent.click(await screen.findByRole("button", { name: /Nouvelle grille/ }));
    fireEvent.change(screen.getByLabelText("Code de la grille"), {
      target: { value: "AIR-ROUTE-2026" },
    });
    fireEvent.change(screen.getByLabelText("Nom de la grille"), {
      target: { value: "Tarif aérien" },
    });
    fireEvent.change(screen.getByLabelText("Route"), {
      target: { value: "route-1" },
    });
    fireEvent.change(screen.getByLabelText("Service"), {
      target: { value: "service-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continuer" }));

    fireEvent.click(screen.getByRole("button", { name: "Continuer" }));
    fireEvent.click(screen.getByRole("button", { name: "Créer le brouillon" }));

    await waitFor(() => expect(pricingService.createGrid).toHaveBeenCalledOnce());
    expect(pricingService.createGrid).toHaveBeenCalledWith(expect.objectContaining({
      grid_code: "AIR-ROUTE-2026",
      name: "Tarif aérien",
      route_id: "route-1",
      shipping_service_id: "service-1",
      calculation_method: "PER_KG",
      volumetric_divisor: 6000,
      chargeable_weight_rule: "MAX",
      rounding_increment: 0.5,
    }));
  });
});
