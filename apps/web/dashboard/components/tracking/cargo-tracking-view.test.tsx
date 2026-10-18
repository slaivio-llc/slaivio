import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CargoTrackingView } from "./cargo-tracking-view";

const mocks = vi.hoisted(() => ({ list: vi.fn(), stats: vi.fn() }));
vi.mock("@/services/tracking", () => ({ listTracking: mocks.list, getTrackingStats: mocks.stats }));
beforeEach(() => {
  mocks.list.mockReset();
  mocks.stats.mockReset();
  mocks.stats.mockResolvedValue({ in_transit_shipments: 2, delays: 1, arrived_shipments: 1 });
});
afterEach(cleanup);

it("renders actual tracking fields and explicitly labels missing location and ETA", async () => {
  mocks.list.mockResolvedValue({ items: [{ id: "exp-1", tracking_id: "EXP-001", status: "IN_TRANSIT", is_delayed: false, packages_count: 4, route_label: "Chine → RDC", last_location: null, last_signal_at: null, eta_at: null }], pagination: { page: 1, page_size: 30, total: 1, total_pages: 1 } });
  render(<CargoTrackingView revision={0} open={vi.fn()} />);
  expect(await screen.findByText("EXP-001")).toBeInTheDocument();
  expect(screen.getByText("Localisation non renseignée")).toBeInTheDocument();
  expect(screen.getByText("ETA non renseignée")).toBeInTheDocument();
  expect(screen.getByText("Chine → RDC · 4 colis")).toBeInTheDocument();
});

it("applies the delayed filter on the server and opens the selected shipment", async () => {
  mocks.list.mockResolvedValue({ items: [{ id: "exp-2", tracking_id: "EXP-002", status: "IN_TRANSIT", is_delayed: true, is_overdue: true, packages_count: 2, route_label: "Dubai → RDC", last_location: "Dubai", last_signal_at: "2026-10-17T10:00:00Z", eta_at: "2026-10-25T00:00:00Z" }], pagination: { page: 1, page_size: 30, total: 1, total_pages: 1 } });
  const open = vi.fn();
  render(<CargoTrackingView revision={0} open={open} />);
  fireEvent.click(await screen.findByRole("button", { name: /EXP-002/ }));
  expect(open).toHaveBeenCalledWith("exp-2");
  fireEvent.click(screen.getByRole("button", { name: /Retards/ }));
  await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith(expect.objectContaining({ phase: "delayed", page: 1, page_size: 30 })));
});
