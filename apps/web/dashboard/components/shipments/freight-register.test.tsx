import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { api } from "@/services/api";
import { FreightShipmentRegister } from "./freight-register";

vi.mock("@/services/api",()=>({api:{get:vi.fn(),post:vi.fn()}}));
vi.mock("@/services/tenant",()=>({getTenantContext:()=>Promise.resolve({active_tenant:{organization_type:"PARCEL_FREIGHT"}})}));
vi.mock("next/navigation",()=>({usePathname:()=>"/app/shipments"}));
vi.mock("@/components/permissions/permission-guard",()=>({PermissionGuard:({children}:{children:ReactNode})=>children}));
const item={id:"shipment",reference:"EXP-0048",origin_country:"CN",origin_city:"Guangzhou",destination_country:"CD",destination_city:"Kinshasa",stage:"planned",status:"PREPARING",packages_count:3,planned_departure_at:null,departed_at:null};
const route={id:"route",route_name:"Chine RDC aérien",origin_country:"CN",origin_city:"Guangzhou",destination_country:"CD",destination_city:"Kinshasa",transport_mode:"AIR"};
beforeEach(()=>{
  vi.mocked(api.get).mockReset();vi.mocked(api.post).mockReset();
  vi.mocked(api.get).mockImplementation(async url=>({data:String(url).endsWith("/routes")?{items:[route]}:{items:[item],page:1,total:1,total_pages:1}}));
});
async function openCreation(){
  fireEvent.click(screen.getByRole("button",{name:"Nouvelle expédition"}));
  await screen.findByRole("option",{name:"Guangzhou, CN"});
  fireEvent.change(screen.getByLabelText("Origine"),{target:{value:JSON.stringify(["CN","Guangzhou"])}});
  fireEvent.change(screen.getByLabelText("Destination"),{target:{value:"route"}});
}

describe("Registre Expéditions fret",()=>{
  it("présente quatre colonnes et une liste mobile sans KPI historiques",async()=>{
    render(<FreightShipmentRegister/>);
    await screen.findAllByRole("link",{name:"EXP-0048"});
    expect(screen.getAllByRole("columnheader").map(cell=>cell.textContent)).toEqual(["Référence","Trajet","État","Départ"]);
    expect(screen.getAllByText("Prévue").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button",{name:"Appliquer"})).not.toBeInTheDocument();
    expect(screen.queryByText("Marge")).not.toBeInTheDocument();
  });
  it("recherche automatiquement et annule la requête précédente",async()=>{
    render(<FreightShipmentRegister/>);await screen.findAllByText("EXP-0048");
    const signal=vi.mocked(api.get).mock.calls[0][1]?.signal;
    fireEvent.change(screen.getByRole("searchbox"),{target:{value:"EXP-00"}});
    await waitFor(()=>expect(api.get).toHaveBeenLastCalledWith("/shipments/register",expect.objectContaining({params:expect.objectContaining({q:"EXP-00",page:1})})));
    expect(signal?.aborted).toBe(true);
  });
  it("ne présente pas une panne comme une liste vide",async()=>{
    vi.mocked(api.get).mockRejectedValueOnce(new Error("offline"));
    render(<FreightShipmentRegister/>);
    expect(await screen.findByRole("alert")).toHaveTextContent("Impossible de charger");
    expect(screen.queryByText("Aucune expédition enregistrée")).not.toBeInTheDocument();
  });
  it("crée depuis la route sans imposer de date ni de champs techniques",async()=>{
    vi.mocked(api.post).mockResolvedValue({data:{id:"new",reference:"EXP-NEW"}});
    render(<FreightShipmentRegister/>);await openCreation();
    expect(screen.queryByLabelText("Transporteur")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:"Créer l’expédition"}));
    await waitFor(()=>expect(api.post).toHaveBeenCalledWith("/shipments/register",{route_id:"route",request_key:expect.any(String),planned_departure_at:null}));
    expect(await screen.findByText("EXP-NEW créée.")).toBeInTheDocument();
  });
  it("réessaie la même demande après perte de réponse et conserve les champs",async()=>{
    vi.mocked(api.post).mockRejectedValueOnce(new Error("timeout")).mockResolvedValueOnce({data:{id:"new",reference:"EXP-NEW"}});
    render(<FreightShipmentRegister/>);await openCreation();
    fireEvent.click(screen.getByRole("button",{name:"Créer l’expédition"}));
    expect(await screen.findByRole("alert")).toHaveTextContent("Confirmation non reçue");
    expect(screen.getByLabelText("Origine")).toBeDisabled();
    fireEvent.click(screen.getByRole("button",{name:"Réessayer la confirmation"}));
    await waitFor(()=>expect(api.post).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api.post).mock.calls[0][1]).toEqual(vi.mocked(api.post).mock.calls[1][1]);
  });
});
