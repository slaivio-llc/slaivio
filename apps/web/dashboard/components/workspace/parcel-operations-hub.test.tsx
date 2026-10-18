import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ParcelOperationsHub } from "./parcel-operations-hub";

const mocks = vi.hoisted(() => ({
  packageStats: vi.fn(),
  shipmentStats: vi.fn(),
  departureCalendar: vi.fn(),
  tracking: vi.fn(),
  permissions: ["packages.read", "shipments.read", "tracking.read"],
}));

vi.mock("@/components/permissions/permission-provider", () => ({
  usePermissions: () => ({ permissions: mocks.permissions, loading: false, available: true }),
}));
vi.mock("@/services/packages", () => ({ getPackageStats: mocks.packageStats }));
vi.mock("@/services/shipments", () => ({
  getShipmentStats: mocks.shipmentStats,
  getShipmentDepartureCalendar: mocks.departureCalendar,
}));
vi.mock("@/services/tracking", () => ({ listTracking: mocks.tracking }));

describe("ParcelOperationsHub", () => {
  beforeEach(() => {
    mocks.packageStats.mockReset().mockResolvedValue({ received: 12, ready_for_pickup: 4 });
    mocks.shipmentStats.mockReset().mockResolvedValue({ active: 3 });
    mocks.departureCalendar.mockReset().mockResolvedValue({
      truncated: false,
      items: [{ id: "shipment-1", reference: "EXP-001", status: "PREPARING", calendar_at: new Date(Date.now() + 86400000).toISOString(), departed_at: null, route_label: "Paris → Dakar", origin_city: "Paris", origin_country: "FR", destination_city: "Dakar", destination_country: "SN", packages_count: 7 }],
    });
    mocks.tracking.mockReset().mockResolvedValue({ items: [
      { id: "tracking-1", tracking_id: "EXP-002", status: "IN_TRANSIT", is_delayed: true, route_label: "Lyon → Abidjan" },
    ] });
    mocks.permissions = ["packages.read", "shipments.read", "tracking.read"];
  });

  it("displays live KPI values, scheduled routes and operational tracking", async () => {
    render(<ParcelOperationsHub />);

    expect(await screen.findByText("Paris → Dakar")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("7", { selector: "a span" })).toBeInTheDocument();
    expect(screen.getByText("Retard signalé")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Paris → Dakar/ })).toHaveAttribute("href", "/app/shipments/shipment-1");
  });

  it("does not invent zero-valued metrics when an API fails", async () => {
    mocks.packageStats.mockRejectedValue(new Error("offline"));
    render(<ParcelOperationsHub />);

    expect(await screen.findAllByText("Indisponible")).toHaveLength(2);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
});
