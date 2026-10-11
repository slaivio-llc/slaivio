import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { ParcelPackageCreateDrawer } from "./parcel-receipt-drawer";
import { catalog } from "@/services/route-catalog";
import { listClients } from "@/services/clients";

vi.mock("@/services/route-catalog", () => ({ catalog: vi.fn() }));
vi.mock("@/services/clients", () => ({ listClients: vi.fn() }));
vi.mock("@/components/permissions/permission-guard", () => ({ PermissionGuard: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/components/clients/inline-client-creator", () => ({ InlineClientCreator: ({ onCreated }: { onCreated: (client: unknown) => void }) =>
  <button type="button" onClick={() => onCreated({ id: "new", display_name: "Nouveau client", phone: "+243812345679" })}>Créer un client</button> }));

beforeEach(() => {
  vi.mocked(catalog).mockResolvedValue({ routes: [
    { id: "route", active: true, route_name: "Chine → RDC", origin_country: "CN", destination_country: "CD" },
    { id: "inactive", active: false, route_name: "Route suspendue" },
  ], services: [
    { id: "air", route_id: "route", service_name: "Cargo aérien" },
    { id: "old", route_id: "inactive", service_name: "Service suspendu" },
  ] } as Awaited<ReturnType<typeof catalog>>);
  vi.mocked(listClients).mockResolvedValue({ items: [{ id: "client", display_name: "Marie", phone: "+243812345678" }] } as Awaited<ReturnType<typeof listClients>>);
});

function renderForm(onSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault())) {
  render(<ParcelPackageCreateDrawer warehouses={[]} saving={false} error="" onClose={vi.fn()} onSubmit={onSubmit} />);
  return onSubmit;
}

async function selectClientAndService() {
  await screen.findByRole("option", { name: /Marie/ });
  fireEvent.change(screen.getByLabelText("Client associé"), { target: { value: "client" } });
  fireEvent.change(screen.getByLabelText("Service utilisé"), { target: { value: "air" } });
}

describe("Réception d’un colis fret", () => {
  it("propose uniquement la route du service actif et autorise un poids inconnu", async () => {
    renderForm();
    expect(screen.getByRole("button", { name: "Enregistrer le colis" })).toBeDisabled();
    await selectClientAndService();
    expect(screen.queryByRole("option", { name: /Service suspendu/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Route")).toHaveValue("route");
    expect(screen.getByLabelText("Poids en kg (si connu)")).not.toBeRequired();
    expect(screen.getByRole("button", { name: "Enregistrer le colis" })).toBeEnabled();
    const data = new FormData(document.querySelector("form")!);
    expect(data.get("weight_kg")).toBe("");
    expect(data.get("route_id")).toBe("route");
    expect(data.has("tracking_id")).toBe(false);
    expect(data.has("status")).toBe(false);
  });

  it("préserve le brouillon et sélectionne le client créé sans rouvrir le formulaire", async () => {
    renderForm();
    await selectClientAndService();
    fireEvent.change(screen.getByLabelText("Référence fournisseur (facultatif)"), { target: { value: "EXT-42" } });
    fireEvent.click(screen.getByRole("button", { name: "Créer un client" }));
    expect(screen.getByLabelText("Client associé")).toHaveValue("new");
    expect(screen.getByLabelText("Référence fournisseur (facultatif)")).toHaveValue("EXT-42");
    expect(screen.getByLabelText("Service utilisé")).toHaveValue("air");
    fireEvent.change(screen.getByLabelText("Rechercher un client"), { target: { value: "autre" } });
    await waitFor(() => expect(listClients).toHaveBeenCalledWith(expect.objectContaining({ q: "autre" })));
    expect(screen.getByLabelText("Client associé")).toHaveValue("new");
  });

  it("empêche deux soumissions immédiates du même formulaire", async () => {
    const onSubmit = renderForm();
    await selectClientAndService();
    const form = document.querySelector("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("rend un échec du catalogue explicite et permet de réessayer", async () => {
    vi.mocked(catalog).mockRejectedValueOnce(new Error("offline"));
    renderForm();
    expect(await screen.findByRole("alert")).toHaveTextContent("Impossible de charger les services");
    expect(screen.getByRole("button", { name: "Enregistrer le colis" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    await screen.findByRole("option", { name: /Cargo aérien/ });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
