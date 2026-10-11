import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { api } from "@/services/api";
import { getParcelOverview } from "@/services/parcel-register";
import { ParcelRegisterPage } from "./parcel-register-page";

vi.mock("@/services/api", () => ({ api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));
vi.mock("@/services/packages", () => ({ createPackage: vi.fn() }));
vi.mock("@/services/parcel-register", () => ({ getParcelOverview: vi.fn() }));
vi.mock("@/services/tenant", () => ({ getTenantContext: () => Promise.resolve({ active_tenant: { organization_type: "PARCEL_FREIGHT" } }) }));
vi.mock("next/navigation", () => ({ usePathname: () => "/app/packages" }));
vi.mock("@/components/ui/use-resource-link", () => ({ useResourceLink: () => () => undefined }));
vi.mock("@/components/permissions/permission-guard", () => ({ PermissionGuard: ({ children }: { children: ReactNode }) => children }));
vi.mock("./parcel-receipt-drawer", () => ({ ParcelPackageCreateDrawer: () => <div>Formulaire de réception</div> }));

const item = { id: "parcel", org_id: "office", reference: "COL-0042", client_id: "client", client_name: "Marie", local_client: true, status: "RECEIVED_AT_ORIGIN", stage: "received", status_label: "Reçu", service_name: "Cargo aérien", office_name: "Guangzhou" };
const response = { items: [item], total: 1, page: 1, total_pages: 1 };
beforeEach(() => {
  vi.mocked(api.post).mockReset();
  vi.mocked(api.patch).mockReset();
  vi.mocked(api.get).mockReset();
  vi.mocked(api.get).mockImplementation(async url => ({ data: String(url).endsWith("/photos") ? { items: [], page: 1, total_pages: 1, total: 0 } : response }));
  vi.mocked(getParcelOverview).mockResolvedValue({ ...item, weight_kg: null, supplier_tracking: "EXT-42", shipment_id: null, received_at: null } as Awaited<ReturnType<typeof getParcelOverview>>);
});

describe("Registre fret", () => {
  it("confirme la disponibilité avec la version de la fiche puis la recharge", async () => {
    const arrived = { ...item, status: "ARRIVED_DESTINATION", stage: "arrived", row_version: 4 } as Awaited<ReturnType<typeof getParcelOverview>>;
    vi.mocked(getParcelOverview).mockResolvedValueOnce(arrived).mockResolvedValue({ ...arrived, status: "READY_FOR_PICKUP", stage: "ready", row_version: 5 });
    vi.mocked(api.post).mockResolvedValue({ data: { changed: true } });
    render(<ParcelRegisterPage/>);
    fireEvent.click(await screen.findByRole("button", { name: "COL-0042" }));
    fireEvent.click(await screen.findByRole("button", { name: "Disponible pour retrait" }));
    expect(api.post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmer" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/packages/register/parcel/ready", { expected_version: 4 }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Confirmer" })).not.toBeInTheDocument());
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  it("conserve la correction lorsque le serveur détecte une version obsolète", async () => {
    vi.mocked(getParcelOverview).mockResolvedValue({ ...item, row_version: 7, weight_editable: true } as Awaited<ReturnType<typeof getParcelOverview>>);
    vi.mocked(api.patch).mockRejectedValue({ isAxiosError: true, response: { data: { detail: "package_version_conflict" } } });
    render(<ParcelRegisterPage/>);
    fireEvent.click(await screen.findByRole("button", { name: "COL-0042" }));
    fireEvent.click(await screen.findByRole("button", { name: "Modifier le colis" }));
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Fragile" } });
    fireEvent.change(screen.getByLabelText("Motif de la correction"), { target: { value: "Contrôle réception" } });
    fireEvent.submit(screen.getByRole("form"));
    expect(await screen.findByRole("alert")).toHaveTextContent("modifié par un autre agent");
    expect(screen.getByLabelText("Description")).toHaveValue("Fragile");
    expect(api.patch).toHaveBeenCalledWith("/packages/register/parcel", { description: "Fragile", reason: "Contrôle réception", expected_version: 7 });
  });

  it("montre un registre compact, sans KPI ni ancien menu de vues", async () => {
    render(<ParcelRegisterPage />);
    await screen.findByRole("button", { name: "COL-0042" });
    expect(screen.getAllByRole("columnheader").map(cell => cell.textContent)).toEqual(["Colis", "Client", "Service", "État"]);
    expect(screen.getByRole("link", { name: "Marie" })).toHaveAttribute("href", "/app/clients?open=client");
    expect(screen.getByRole("link", { name: "Retour aux opérations" })).toHaveAttribute("href", "/app/operations");
    expect(screen.queryByText("Poids total")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Appliquer" })).not.toBeInTheDocument();
    expect(screen.queryByText("Analytics")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer un colis" }));
    expect(screen.getByText("Formulaire de réception")).toBeInTheDocument();
  });

  it("ouvre seulement la vue d’ensemble et l’historique sans inventer un poids", async () => {
    vi.mocked(api.get).mockImplementation(async url => ({ data: String(url).endsWith("/history") ? { items: [{ id: "event", title: "Colis reçu", description: null, created_at: "2026-10-11T10:00:00Z" }], page: 1, total_pages: 1 } : response }));
    render(<ParcelRegisterPage />);
    fireEvent.click(await screen.findByRole("button", { name: "COL-0042" }));
    const drawer = await screen.findByRole("dialog", { name: "COL-0042" });
    expect(within(drawer).getByText("Non pesé")).toBeInTheDocument();
    expect(within(drawer).getByText("EXT-42")).toBeInTheDocument();
    expect(within(drawer).getByText("Pas encore affecté")).toBeInTheDocument();
    expect(within(drawer).queryByText("Paramètres")).not.toBeInTheDocument();
    fireEvent.click(within(drawer).getByRole("button", { name: "Historique" }));
    expect(await within(drawer).findByText("Colis reçu")).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith("/packages/register/parcel/history", expect.objectContaining({ params: { page: 1 } }));
  });

  it("applique la recherche automatiquement et annule la requête précédente", async () => {
    render(<ParcelRegisterPage />);
    await screen.findByRole("button", { name: "COL-0042" });
    const firstSignal = vi.mocked(api.get).mock.calls[0][1]?.signal;
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "EXT-42" } });
    await waitFor(() => expect(api.get).toHaveBeenLastCalledWith("/packages/register", expect.objectContaining({ params: expect.objectContaining({ q: "EXT-42", page: 1 }) })));
    expect(firstSignal?.aborted).toBe(true);
  });

  it("ne transforme pas une panne en liste vide", async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error("offline"));
    render(<ParcelRegisterPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Impossible de charger les colis");
    expect(screen.queryByText("Aucun colis enregistré")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(await screen.findByRole("button", { name: "COL-0042" })).toBeInTheDocument();
  });

  it("n’affiche pas un lien vers le CRM d’un autre bureau", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { ...response, items: [{ ...item, local_client: false }] } });
    render(<ParcelRegisterPage />);
    await screen.findByText("Marie");
    expect(screen.queryByRole("link", { name: "Marie" })).not.toBeInTheDocument();
    expect(screen.getByText("Guangzhou")).toBeInTheDocument();
  });
});
