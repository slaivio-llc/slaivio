import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {cleanup, render, screen} from "@testing-library/react";
import PublicTrackingSearchPage from "./page";

const {lookup} = vi.hoisted(() => ({lookup: vi.fn()}));
vi.mock("@/services/tracking", () => ({findPublicPackageTracking: lookup}));

describe("customer package tracking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/track?reference=LUZA-001");
  });
  afterEach(cleanup);

  it("opens the reference from WhatsApp and displays the agency identity and milestone", async () => {
    lookup.mockResolvedValue({
      agency_name: "LUZA SERVICES", agency_logo_url: "https://example.com/luza.png",
      tracking_id: "LUZA-001", status: "IN_TRANSIT", updated_at: "2026-09-24T10:00:00Z",
      events: [{event_type: "STATUS_CHANGED", title: "Statut modifié", new_status: "SHIPPED", occurred_at: "2026-09-24T09:00:00Z"}],
    });
    render(<PublicTrackingSearchPage/>);
    expect(await screen.findByText("LUZA SERVICES")).toBeInTheDocument();
    expect(lookup).toHaveBeenCalledWith("LUZA-001");
    expect(screen.getByRole("img", {name: "Logo LUZA SERVICES"})).toBeInTheDocument();
    expect(screen.getByText("Expédié")).toBeInTheDocument();
    expect(screen.queryByText("SLAIVIO")).not.toBeInTheDocument();
  });

  it("does not show an agency or a parcel when lookup fails", async () => {
    lookup.mockRejectedValue(new Error("not found"));
    render(<PublicTrackingSearchPage/>);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByText("Historique")).not.toBeInTheDocument();
  });
});
