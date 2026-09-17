import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ClientsPage } from "./clients-page";
import * as clientService from "@/services/clients";
import * as tenantService from "@/services/tenant";

let grantedPermissions: string[] = [];

vi.mock("@/components/permissions/permission-provider", () => ({
  usePermissions: () => ({ permissions: grantedPermissions, available: true }),
}));

vi.mock("@/components/permissions/permission-guard", () => ({
  PermissionGuard: ({ permission, children, fallback = null }: {
    permission: string; children: ReactNode; fallback?: ReactNode;
  }) => grantedPermissions.includes(permission) ? children : fallback,
}));

vi.mock("@/services/tenant", () => ({
  getTenantContext: vi.fn(),
}));

vi.mock("@/services/clients", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/clients")>();
  return {
    ...actual,
    listClients: vi.fn(),
    listArchivedClients: vi.fn(),
    getClientStats: vi.fn(),
    getClient: vi.fn(),
    getClientTimeline: vi.fn(),
    findClientDuplicates: vi.fn(),
    exportClients: vi.fn(),
    deleteClient: vi.fn(),
    restoreClient: vi.fn(),
    mergeClients: vi.fn(),
    importClients: vi.fn(),
    createClient: vi.fn(),
    updateClient: vi.fn(),
  };
});

const client: clientService.ClientRecord = {
  id: "client-1",
  org_id: "org-a",
  display_name: "Agence Test Client",
  name: "Agence Test Client",
  company_name: null,
  phone: "+243999000000",
  whatsapp_phone: "+243999000000",
  email: "client@example.test",
  country: "RDC",
  city: "Kinshasa",
  customer_type: "individual",
  lifecycle_status: "active",
  source: "manual",
  credit_enabled: false,
  credit_limit: 0,
  current_balance: 0,
  total_spent: 0,
  payment_amount_due: 0,
  payment_amount_paid: 0,
  payment_currency: "USD",
  payment_status: "NOT_SET",
  dossiers_count: 0,
  shipments_count: 0,
  last_activity_at: null,
  created_at: "2026-08-02T00:00:00Z",
  updated_at: "2026-08-02T00:00:00Z",
  row_version: 3,
};

const listResponse = {
  status: "ok" as const,
  items: [client],
  pagination: { page: 1, page_size: 30, total: 1, total_pages: 1 },
};

beforeEach(() => {
  grantedPermissions = [
    "clients.read", "clients.create", "clients.update", "clients.archive",
    "clients.import", "clients.export", "clients.merge",
  ];
  vi.mocked(clientService.listClients).mockResolvedValue(listResponse);
  vi.mocked(tenantService.getTenantContext).mockResolvedValue({
    active_tenant: { organization_type: "PARCEL_FREIGHT" },
    tenants: [],
  });
  vi.mocked(clientService.listArchivedClients).mockResolvedValue({ ...listResponse, items: [] });
  vi.mocked(clientService.getClientStats).mockResolvedValue({
    total: 1, leads: 0, active: 1, pending: 0, inactive: 0, blocked: 0, new_this_month: 1,
  });
  vi.mocked(clientService.getClient).mockResolvedValue(client);
  vi.mocked(clientService.getClientTimeline).mockResolvedValue([]);
  vi.mocked(clientService.findClientDuplicates).mockResolvedValue([]);
  vi.mocked(clientService.exportClients).mockResolvedValue(new Blob(["clients"]));
  vi.mocked(clientService.deleteClient).mockResolvedValue({ status: "ok" });
  vi.mocked(clientService.importClients).mockResolvedValue({
    processed: 1, created: 1, skipped: 0, errors: [], clients: [client],
  });
});

describe("ClientsPage production interactions", () => {
  it("keeps the archived view locked without clients.archive", async () => {
    grantedPermissions = ["clients.read"];
    render(<ClientsPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Filtres" }));
    const archived = await screen.findByRole("option", { name: /Clients archivés · accès requis/i });
    expect(archived).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Exporter" })).not.toBeInTheDocument();
  });

  it("uses the KPI cards as the client view navigation", async () => {
    render(<ClientsPage />);

    const activeClients = await screen.findByRole("button", { name: /Clients avec colis/i });
    await userEvent.click(activeClients);

    expect(activeClients).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(clientService.listClients).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "active" }),
    ));
    expect(screen.queryByRole("navigation", { name: "Vues du module" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Autres" })).not.toBeInTheDocument();
  });

  it("uses the shared client form without a currency field", async () => {
    render(<ClientsPage />);
    await userEvent.click(await screen.findByRole("button", { name: /Nouveau client/i }));

    expect(await screen.findByRole("dialog", { name: "Nouveau client" })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Nom complet/).closest("label")).toHaveAttribute("data-ui", "operation-field");
    expect(screen.queryByLabelText(/Devise/i)).not.toBeInTheDocument();
  });

  it("shows the vehicle payment tracker only in the vehicle journey", async () => {
    vi.mocked(tenantService.getTenantContext).mockResolvedValueOnce({
      active_tenant: { organization_type: "VEHICLE_IMPORT" },
      tenants: [],
    });
    render(<ClientsPage />);
    await userEvent.click(await screen.findByRole("button", { name: /Nouveau client/i }));

    expect(await screen.findByLabelText("Montant attendu")).toBeInTheDocument();
    expect(screen.getByLabelText("Montant payé")).toBeInTheDocument();
    expect(screen.getByLabelText("Devise du paiement")).toBeInTheDocument();
  });

  it("recovers after a temporary list failure", async () => {
    vi.mocked(clientService.listClients)
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(listResponse);
    render(<ClientsPage />);

    const retry = await screen.findByRole("button", { name: "Réessayer" });
    await userEvent.click(retry);

    expect(await screen.findByText("Agence Test Client")).toBeInTheDocument();
    expect(clientService.listClients).toHaveBeenCalledTimes(2);
  });

  it("does not start a second export while the first one is pending", async () => {
    let finishExport: ((blob: Blob) => void) | undefined;
    vi.mocked(clientService.exportClients).mockReturnValue(new Promise((resolve) => {
      finishExport = resolve;
    }));
    render(<ClientsPage />);

    const exportButton = await screen.findByRole("button", { name: "Exporter" });
    await userEvent.dblClick(exportButton);
    expect(clientService.exportClients).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Export..." })).toBeDisabled();

    finishExport?.(new Blob(["clients"]));
    await waitFor(() => expect(screen.getByRole("button", { name: "Exporter" })).toBeEnabled());
  });

  it("archives the selected client with its current concurrency version", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<ClientsPage />);

    await userEvent.click(await screen.findByText("Agence Test Client"));
    await userEvent.click(await screen.findByRole("button", { name: "Archiver le client" }));

    await waitFor(() => expect(clientService.deleteClient).toHaveBeenCalledWith("client-1", 3));
  });

  it("imports the exact CSV file selected by the user", async () => {
    render(<ClientsPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Importer" }));
    const file = new File(["nom,telephone\nJean,+243999000000"], "clients.csv", {
      type: "text/csv",
    });
    const input = document.querySelector<HTMLInputElement>('input[name="file"]');
    expect(input).not.toBeNull();
    Object.defineProperty(input!, "files", { configurable: true, value: [file] });
    fireEvent.change(input!);
    expect(input!.form).not.toBeNull();
    fireEvent.submit(input!.form!);

    await waitFor(() => expect(clientService.importClients).toHaveBeenCalledWith(file));
    expect(await screen.findByText(/1 ligne\(s\) traitée\(s\)/i)).toBeInTheDocument();
  });
});
