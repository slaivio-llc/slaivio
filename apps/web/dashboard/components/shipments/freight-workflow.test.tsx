import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { api } from "@/services/api";
import { FreightWorkflow, FreightManifest } from "./freight-workflow";

vi.mock("@/services/api",()=>({api:{get:vi.fn(),post:vi.fn()}}));
vi.mock("@/components/permissions/permission-guard",()=>({PermissionGuard:({children}:{children:ReactNode})=>children}));
const item={id:"one",reference:"EXP-1",version:3,workflow_version:2,stage:"planned",packages_count:2};
beforeEach(()=>{vi.mocked(api.get).mockReset();vi.mocked(api.post).mockReset();});
describe("Commandes du mouvement fret",()=>{
  it("ne déclenche le départ qu’après confirmation explicite",async()=>{
    const saved=vi.fn();vi.mocked(api.post).mockResolvedValue({data:{changed:true}});
    render(<FreightWorkflow item={item} saved={saved}/>);
    fireEvent.click(screen.getByRole("button",{name:"Confirmer le départ"}));
    expect(api.post).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toHaveTextContent("2 colis");
    fireEvent.click(screen.getByRole("button",{name:"Confirmer"}));
    await waitFor(()=>expect(saved).toHaveBeenCalledOnce());
    expect(api.post).toHaveBeenCalledWith("/shipments/workspace/one/milestone",{expected_version:3,action:"depart"});
  });
  it("conserve le refus financier sans annoncer un départ",async()=>{
    const saved=vi.fn();vi.mocked(api.post).mockRejectedValue({isAxiosError:true,response:{data:{detail:{code:"payment_clearance_required"}}}});
    render(<FreightWorkflow item={item} saved={saved}/>);
    fireEvent.click(screen.getByRole("button",{name:"Confirmer le départ"}));
    fireEvent.click(screen.getByRole("button",{name:"Confirmer"}));
    expect(await screen.findByRole("alert")).toHaveTextContent("Paiement à vérifier");
    expect(saved).not.toHaveBeenCalled();
  });
  it("affecte uniquement la sélection compatible, pas tous les résultats",async()=>{
    vi.mocked(api.get).mockResolvedValue({data:{items:[{id:"a",reference:"COL-A",client_name:"Client A",blockers:[]},{id:"b",reference:"COL-B",client_name:"Client B",blockers:["already_assigned"]}],page:1,total_pages:1}});
    const saved=vi.fn();vi.mocked(api.post).mockResolvedValue({data:{changed:1}});
    render(<FreightWorkflow item={item} saved={saved}/>);
    fireEvent.click(screen.getByRole("button",{name:"Ajouter des colis"}));
    const available=await screen.findByRole("checkbox",{name:/COL-A/});
    expect(screen.getByRole("checkbox",{name:/COL-B/})).toBeDisabled();
    fireEvent.click(available);fireEvent.click(screen.getByRole("button",{name:"Affecter les colis"}));
    await waitFor(()=>expect(saved).toHaveBeenCalledOnce());
    expect(api.post).toHaveBeenCalledWith("/shipments/workspace/one/loading",{expected_version:3,package_ids:["a"]});
  });
  it("n’ouvre pas les nouvelles commandes sur une expédition historique",()=>{
    render(<FreightWorkflow item={{...item,workflow_version:1}} saved={vi.fn()}/>);
    expect(screen.queryByRole("button",{name:"Confirmer le départ"})).not.toBeInTheDocument();
  });
  it("ne propose plus le chargement après départ",()=>{
    render(<FreightWorkflow item={{...item,stage:"departed"}} saved={vi.fn()}/>);
    expect(screen.queryByRole("button",{name:"Ajouter des colis"})).not.toBeInTheDocument();
    expect(screen.getByRole("button",{name:"Confirmer l’arrivée"})).toBeInTheDocument();
  });
  it("recherche le manifeste figé en gardant le poids inconnu",async()=>{
    vi.mocked(api.get).mockResolvedValue({data:{historical_snapshot:true,departed_at:"2026-10-14T09:00:00Z",shipment:{reference:"EXP-1",origin_city:"A",destination_city:"B"},items:[{id:"a",reference:"COL-A",client_name:"Nom historique",supplier_tracking:"EXT-A",weight_kg:null}]}});
    render(<FreightManifest shipmentId="one" revision={0}/>);
    expect(await screen.findByText("Manifeste figé au départ")).toBeInTheDocument();
    expect(screen.getByRole("region",{name:"Manifeste"})).toHaveTextContent("Poids inconnu");
    fireEvent.change(screen.getByRole("searchbox"),{target:{value:"introuvable"}});
    expect(screen.getByText("Aucun colis correspondant.")).toBeInTheDocument();
    expect(screen.getByRole("button",{name:"Imprimer / PDF"})).toBeInTheDocument();
  });
});
