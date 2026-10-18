import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { api } from "@/services/api";
import { FreightShipmentDetail } from "./freight-detail";

vi.mock("@/services/api",()=>({api:{get:vi.fn(),patch:vi.fn()}}));
vi.mock("@/services/tenant",()=>({getTenantContext:()=>Promise.resolve({active_tenant:{organization_type:"PARCEL_FREIGHT"}})}));
vi.mock("next/navigation",()=>({usePathname:()=>"/app/shipments/one",useRouter:()=>({replace:vi.fn()})}));
vi.mock("@/components/permissions/permission-guard",()=>({PermissionGuard:({children}:{children:ReactNode})=>children}));
const overview={id:"one",reference:"EXP-01",stage:"planned",status:"PREPARING",version:3,origin_city:"Guangzhou",origin_country:"CN",destination_city:"Kinshasa",destination_country:"CD",route_label:"Chine RDC",planned_departure_at:null,departed_at:null,arrived_at:null,packages_count:3,weighed_count:0,known_weight_kg:null,is_delayed:false,delay_reason:null};
beforeEach(()=>{
  vi.mocked(api.get).mockReset();vi.mocked(api.patch).mockReset();
  vi.mocked(api.get).mockImplementation(async url=>({data:String(url).endsWith("/one")?overview:{items:[],page:1,total_pages:0,total:0}}));
});
describe("Fiche Expédition fret",()=>{
  it("affiche une fiche unique compacte avec progression, colis, manifeste et historique",async()=>{
    render(<FreightShipmentDetail shipmentId="one"/>);
    await screen.findByText("EXP-01");
    expect(screen.queryByRole("navigation",{name:"Sections de l’expédition"})).not.toBeInTheDocument();
    expect(screen.getByText("Informations de l’expédition")).toBeInTheDocument();
    expect(screen.getByText("Progression")).toBeInTheDocument();
    expect(screen.getByText("Colis de l’expédition")).toBeInTheDocument();
    expect(screen.getByRole("region",{name:"Manifeste"})).toBeInTheDocument();
    expect(screen.getByRole("heading",{name:"Historique"})).toBeInTheDocument();
    expect(screen.queryByText("Finance")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog",{name:"EXP-01"})).toBeInTheDocument();
    expect(screen.getByRole("button",{name:"Retour aux expéditions"})).toBeInTheDocument();
    expect(screen.queryByRole("button",{name:"Actions"})).not.toBeInTheDocument();
    expect(screen.getByRole("button",{name:"Ajouter des colis"})).toBeInTheDocument();
  });
  it("garde le bouton Ajouter visible mais désactivé après l’arrivée",async()=>{
    vi.mocked(api.get).mockImplementation(async url=>({data:String(url).endsWith("/one")?{...overview,stage:"arrived",status:"ARRIVED_DESTINATION",arrived_at:"2026-10-18T12:00:00Z"}:{items:[],page:1,total_pages:0,total:0}}));
    render(<FreightShipmentDetail shipmentId="one"/>);
    expect(await screen.findByRole("button",{name:"Manifeste PDF"})).toBeInTheDocument();
    expect(screen.queryByRole("button",{name:"Ajouter des colis"})).not.toBeInTheDocument();
    expect(screen.getByText("L’ajout de colis est désactivé ici car cette expédition est déjà arrivée.")).toBeInTheDocument();
  });
  it("ne présente pas la composition actuelle comme un manifeste figé après départ",async()=>{
    vi.mocked(api.get).mockImplementation(async url=>{if(String(url).endsWith('/manifest'))throw {isAxiosError:true,response:{status:409}};return {data:String(url).endsWith("/one")?{...overview,stage:"departed",departed_at:"2026-10-14T12:00:00Z"}:{items:[],page:1,total_pages:0}};});
    render(<FreightShipmentDetail shipmentId="one"/>);await screen.findByText("EXP-01");
    expect(screen.queryByRole("button",{name:"Modifier le planning"})).not.toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent("Aucun manifeste figé");
    expect(screen.queryByRole('button',{name:'Excel'})).not.toBeInTheDocument();
  });
  it("n’interprète pas les communications en attente comme livrées",async()=>{
    vi.mocked(api.get).mockImplementation(async url=>({data:String(url).endsWith("/one")?overview:String(url).includes("/communications")?{items:[{id:"message",channel:"whatsapp",status:"PENDING",created_at:"2026-10-14T12:00:00Z"}],page:1,total_pages:1}:{items:[],page:1,total_pages:0}}));
    render(<FreightShipmentDetail shipmentId="one"/>);await screen.findByText("EXP-01");
    fireEvent.click(screen.getByText("Communications de l’expédition"));
    expect(await screen.findByText("En attente")).toBeInTheDocument();
    expect(screen.queryByText("Livré")).not.toBeInTheDocument();
  });
  it("conserve le motif en cas de conflit de version",async()=>{
    vi.mocked(api.patch).mockRejectedValue({isAxiosError:true,response:{data:{detail:"stale_shipment_version"}}});
    render(<FreightShipmentDetail shipmentId="one"/>);
    fireEvent.click(await screen.findByRole("button",{name:"Modifier le départ prévu"}));
    fireEvent.change(screen.getByLabelText("Motif"),{target:{value:"Date à confirmer"}});
    fireEvent.click(screen.getByRole("button",{name:"Enregistrer"}));
    expect(await screen.findByRole("alert")).toHaveTextContent("La fiche a changé");
    expect(screen.getByLabelText("Motif")).toHaveValue("Date à confirmer");
    expect(api.patch).toHaveBeenCalledWith("/shipments/workspace/one/planning",{expected_version:3,planned_departure_at:null,reason:"Date à confirmer"});
  });
  it("recharge la fiche après modification du planning",async()=>{
    vi.mocked(api.patch).mockResolvedValue({data:{changed:true}});
    render(<FreightShipmentDetail shipmentId="one"/>);
    fireEvent.click(await screen.findByRole("button",{name:"Modifier le départ prévu"}));
    fireEvent.change(screen.getByLabelText("Motif"),{target:{value:"Nouvelle estimation"}});
    fireEvent.click(screen.getByRole("button",{name:"Enregistrer"}));
    await waitFor(()=>expect(screen.queryByRole("heading",{name:"Modifier le départ prévu"})).not.toBeInTheDocument());
    await waitFor(()=>expect(vi.mocked(api.get).mock.calls.filter(call=>call[0]==="/shipments/workspace/one")).toHaveLength(2));
  });
});
