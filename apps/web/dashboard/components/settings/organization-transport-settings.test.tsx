import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { OrganizationTransportSettings } from "./organization-transport-settings";
import { catalog, createRoute } from "@/services/route-catalog";
import { createService } from "@/services/service-catalog";
import { getOfficeContext } from "@/services/organization-admin";

vi.mock("@/services/route-catalog", () => ({
  catalog: vi.fn(),
  createRoute: vi.fn(),
  reactivateRoute: vi.fn(),
  suspendRoute: vi.fn(),
}));
vi.mock("@/services/service-catalog", () => ({
  createService: vi.fn(),
  transitionService: vi.fn(),
}));
vi.mock("@/components/permissions/permission-guard", () => ({
  PermissionGuard: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/services/organization-admin", () => ({
  getOfficeContext: vi.fn().mockResolvedValue({ offices: [], selected_office_id: null }),
}));
vi.mock("@/components/ui/geography-fields", () => ({
  FormGeographyFields: ({
    countryName,
    cityName,
    countryLabel,
    cityLabel,
  }: {
    countryName: string;
    cityName: string;
    countryLabel: string;
    cityLabel: string;
  }) => <div>
    <label>{countryLabel}<input name={countryName} /></label>
    <label>{cityLabel}<input name={cityName} /></label>
  </div>,
}));

const fixture = {
  routes: [{
    id: "route-1",
    route_name: "Guangzhou → Kinshasa",
    origin_city: "Guangzhou",
    origin_country: "Chine",
    destination_city: "Kinshasa",
    destination_country: "RDC",
    service_names: ["Fret aérien"],
    active: true,
    status: "ACTIVE",
  }],
  services: [{
    id: "service-1",
    route_id: null,
    route_ids: ["route-1"],
    service_code: "AIR-001",
    service_name: "Fret aérien",
    shipping_mode: "AIR",
    service_type: "TRANSPORT",
    currency_code: "USD",
    eta_min_days: 5,
    eta_max_days: 10,
    pricing_count: 0,
    route_count: 1,
    active: true,
    status: "ACTIVE",
  }],
} as Awaited<ReturnType<typeof catalog>>;

beforeEach(() => {
  vi.mocked(getOfficeContext).mockResolvedValue({ offices: [], selected_office_id: null } as Awaited<ReturnType<typeof getOfficeContext>>);
  vi.mocked(catalog).mockResolvedValue(fixture);
  vi.mocked(createRoute).mockResolvedValue({});
  vi.mocked(createService).mockResolvedValue({});
});

describe("agency transport settings", () => {
  it("places management creation actions in the page header without a duplicate title", async () => {
    const header = document.createElement("header");
    document.body.appendChild(header);
    const view = render(<OrganizationTransportSettings section="management" headerActionsTarget={header} />);
    try {
      const createServiceButton = await within(header).findByRole("button", { name: "Nouveau service" });
      expect(within(header).getByRole("button", { name: "Nouvelle route" })).toBeVisible();
      expect(within(view.container).queryByRole("button", { name: "Nouveau service" })).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Services & Routes" })).not.toBeInTheDocument();
      expect(screen.queryByText("Prestations et corridors de transport.")).not.toBeInTheDocument();
      fireEvent.click(createServiceButton);
      expect(await screen.findByRole("dialog")).toBeVisible();
    } finally {
      view.unmount();
      header.remove();
    }
  });

  it("shows services as configuration cards rather than a module table", async () => {
    render(<OrganizationTransportSettings section="services" />);

    expect(await screen.findByRole("heading", { name: "Fret aérien" })).toBeVisible();
    expect(screen.getByText("Aérien · 1 route associée")).toBeVisible();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("requires and saves at least one active service on a route", async () => {
    render(<OrganizationTransportSettings section="routes" />);
    await screen.findByRole("heading", { name: "Guangzhou → Kinshasa" });
    fireEvent.click(screen.getByRole("button", { name: "Ajouter une route" }));

    fireEvent.change(screen.getByLabelText("Pays d’origine"), { target: { value: "Chine" } });
    fireEvent.change(screen.getByLabelText("Ville d’origine"), { target: { value: "Guangzhou" } });
    fireEvent.change(screen.getByLabelText("Pays de destination"), { target: { value: "RDC" } });
    fireEvent.change(screen.getByLabelText("Ville de destination"), { target: { value: "Kinshasa" } });
    fireEvent.submit(document.getElementById("create-commercial-route")!);
    expect(await screen.findByText("Associez au moins un service actif à cette route.")).toBeVisible();
    expect(createRoute).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("checkbox", { name: /Fret aérien/ }));
    fireEvent.submit(document.getElementById("create-commercial-route")!);

    await waitFor(() => expect(createRoute).toHaveBeenCalledWith(expect.objectContaining({
      origin_country: "Chine",
      origin_city: "Guangzhou",
      destination_country: "RDC",
      destination_city: "Kinshasa",
      service_ids: ["service-1"],
    })));
  });
});
