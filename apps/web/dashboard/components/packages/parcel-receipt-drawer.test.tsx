import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { ParcelPackageCreateDrawer } from "./parcel-receipt-drawer";
import { receiptCatalog } from "@/services/route-catalog";
import { listClients } from "@/services/clients";

vi.mock("@/services/route-catalog", () => ({ receiptCatalog: vi.fn() }));
vi.mock("@/services/clients", () => ({ listClients: vi.fn() }));
vi.mock("@/components/permissions/permission-guard", () => ({ PermissionGuard: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/components/clients/inline-client-creator", () => ({ InlineClientCreator: ({ onCreated }: { onCreated: (client: unknown) => void }) =>
  <button type="button" onClick={() => onCreated({ id: "new", display_name: "Nouveau client", phone: "+243812345679" })}>Créer un client</button> }));

beforeEach(() => {
  vi.mocked(receiptCatalog).mockResolvedValue({ routes: [
    { id: "route", active: true, route_name: "Chine → RDC", origin_country: "CN", destination_country: "CD" },
    { id: "route-2", active: true, route_name: "Dubaï → RDC", origin_country: "AE", destination_country: "CD" },
    { id: "inactive", active: false, route_name: "Route suspendue" },
  ], services: [
    { id: "air", route_ids: ["route", "route-2"], service_name: "Cargo aérien", active: true, status: "ACTIVE" },
    { id: "old", route_id: "route", service_name: "Service suspendu", active: false, status: "INACTIVE" },
  ] } as Awaited<ReturnType<typeof receiptCatalog>>);
  vi.mocked(listClients).mockResolvedValue({ items: [{ id: "client", display_name: "Marie", phone: "+243812345678" }] } as Awaited<ReturnType<typeof listClients>>);
});

function renderForm(onSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault())) {
  render(<ParcelPackageCreateDrawer warehouses={[]} saving={false} error="" onClose={vi.fn()} onSubmit={onSubmit} />);
  return onSubmit;
}

async function selectClientAndService() {
  await screen.findByRole("option", { name: /Marie/ });
  fireEvent.change(screen.getByRole('combobox',{name:/^Client/}), { target: { value: "client" } });
  fireEvent.change(screen.getByRole('combobox',{name:/^Service/}), { target: { value: "air" } });
  fireEvent.change(screen.getByRole('combobox',{name:/^Origine/}), {target:{value:JSON.stringify(['CN',''])}});
}

describe("Réception d’un colis fret", () => {
  it("propose toutes les routes associées au service actif et autorise un poids inconnu", async () => {
    renderForm();
    expect(screen.getByRole("button", { name: "Enregistrer le colis" })).toBeDisabled();
    await selectClientAndService();
    expect(screen.queryByRole("option", { name: /Service suspendu/ })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox',{name:/^Destination/})).toHaveValue("route");
    expect(screen.getByRole('combobox',{name:/^Origine/})).toHaveTextContent('AE');
    fireEvent.change(screen.getByRole('combobox',{name:/^Origine/}), { target: { value: JSON.stringify(['AE','']) } });
    expect(screen.getByLabelText("Poids (kg)")).not.toBeRequired();
    expect(screen.getByRole("button", { name: "Enregistrer le colis" })).toBeEnabled();
    const data = new FormData(document.querySelector("form")!);
    expect(data.get("weight_kg")).toBe("");
    expect(data.get("route_id")).toBe("route-2");
    expect(data.has("tracking_id")).toBe(false);
    expect(data.has("status")).toBe(false);
  });

  it("affiche un service actif sans route et explique pourquoi la réception reste bloquée", async () => {
    vi.mocked(receiptCatalog).mockResolvedValueOnce({
      routes: [],
      services: [{
        id: "unassigned",
        route_id: null,
        route_ids: [],
        service_code: "EXPRESS",
        service_name: "Fret express",
        shipping_mode: "AIR",
        service_type: "TRANSPORT",
        currency_code: "USD",
        eta_min_days: 1,
        eta_max_days: 3,
        pricing_count: 0,
        active: true,
        status: "ACTIVE",
      }],
    } as Awaited<ReturnType<typeof receiptCatalog>>);
    renderForm();

    expect(await screen.findByRole("option", { name: 'Fret express' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox',{name:/^Service/}), { target: { value: "unassigned" } });
    expect(screen.getByRole('combobox',{name:/^Destination/})).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("aucune route disponible");
    expect(screen.getByRole("button", { name: "Enregistrer le colis" })).toBeDisabled();
  });

  it("préserve le brouillon et sélectionne le client créé sans rouvrir le formulaire", async () => {
    renderForm();
    await selectClientAndService();
    fireEvent.change(screen.getByLabelText(/^Référence fournisseur/), { target: { value: "EXT-42" } });
    fireEvent.click(screen.getByRole("button", { name: "Créer un client" }));
    expect(screen.getByRole('combobox',{name:/^Client/})).toHaveValue("new");
    expect(screen.getByLabelText(/^Référence fournisseur/)).toHaveValue("EXT-42");
    expect(screen.getByRole('combobox',{name:/^Service/})).toHaveValue("air");
    expect(screen.getByRole('combobox',{name:/^Destination/})).toHaveValue('route');
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
    vi.mocked(receiptCatalog).mockRejectedValueOnce(new Error("offline"));
    renderForm();
    expect(await screen.findByRole("alert")).toHaveTextContent("Impossible de charger les services");
    expect(screen.getByRole("button", { name: "Enregistrer le colis" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    await screen.findByRole("option", { name: /Cargo aérien/ });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it('applique les exigences et les consignes de l’agence au formulaire réel',async()=>{
    const catalog=await vi.mocked(receiptCatalog).getMockImplementation()!();
    vi.mocked(receiptCatalog).mockResolvedValueOnce({...catalog,operational_settings:{timezone:'Africa/Kinshasa',currency_code:'USD',language_code:'fr',settings:{parcel_receipt_rules:{category_required:true,packaging_required:true,allow_unmeasured:false,allow_photos:false,auto_rate_lookup:true},goods_restrictions:{regulated_goods_check:true,agent_instructions:'Batteries à vérifier'}}}});
    renderForm();await selectClientAndService();
    expect(screen.getByLabelText('Catégorie de marchandise')).toBeRequired();
    expect(screen.getByLabelText('Conditionnement')).toBeRequired();
    expect(screen.getByText('Batteries à vérifier')).toBeInTheDocument();
    expect(screen.getByText(/Un poids ou un volume est obligatoire/)).toBeInTheDocument();
  });
});
