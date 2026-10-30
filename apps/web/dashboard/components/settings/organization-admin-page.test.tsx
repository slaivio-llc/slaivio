import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrganizationAdminPage } from "./organization-admin-page";
import { getAdmin, inviteMember, updateOrganization, uploadAgencyBrandImage, type AdminData } from "@/services/organization-admin";

const navigation = vi.hoisted(() => ({ params: new URLSearchParams(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: navigation.replace }), useSearchParams: () => navigation.params }));
vi.mock("@/services/organization-admin", () => ({
  getAdmin: vi.fn(), inviteMember: vi.fn(), updateOrganization: vi.fn(), uploadAgencyBrandImage: vi.fn(),
}));
vi.mock("@/components/permissions/permission-guard", () => ({ PermissionGuard: ({ children, permission }: { children: ReactNode; permission: string }) => permission === "platform.admin.read" ? null : children }));
vi.mock("@/components/ui/geography-fields", () => ({ FormGeographyFields: () => <><input name="country" aria-label="Pays"/><input name="city" aria-label="Ville"/></> }));

const fixture: AdminData = {
  organization: { organization_name: "Agence Cargo", row_version: 3, logo_url: "https://example.com/current.png" },
  settings: { row_version: 2, settings: {} }, members: [], invitations: [],
  roles: [{ id: "role", role_code: "AGENT", role_name: "Agent", system_role: true, permission_count: 1, member_count: 0 }],
  permissions: [], audit: [], workspaces: [], locations: [], integrations: [], numbering: [], billing: null, data_requests: [], api_keys: [],
};

beforeEach(() => {
  navigation.params = new URLSearchParams();
  vi.mocked(getAdmin).mockResolvedValue(fixture);
  vi.mocked(uploadAgencyBrandImage).mockResolvedValue("https://storage.example.com/agency/logo.webp");
  vi.mocked(updateOrganization).mockResolvedValue({});
  vi.mocked(inviteMember).mockResolvedValue({});
});

describe("agency settings navigation and uploads", () => {
  it('requires an explicit office selection before sending a Finance invitation',async()=>{
    vi.mocked(getAdmin).mockResolvedValue({...fixture,
      roles:[{...fixture.roles[0],role_code:'FINANCE',role_name:'Finance',permission_codes:['finance.read','finance.create']}],
      locations:[{id:'site-1',location_type:'OFFICE',status:'ACTIVE',name:'Bureau Kinshasa',city:'Kinshasa'}],
    });
    const {container}=render(<OrganizationAdminPage/>);
    await screen.findByRole('heading',{name:'Paramètres de l’agence'});
    fireEvent.click(within(container.querySelector('aside')!).getByRole('button',{name:'Équipe'}));
    expect(screen.getByRole('button',{name:'Inviter'})).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText('collaborateur@agence.com'),{target:{value:'finance@example.com'}});
    fireEvent.click(screen.getByRole('checkbox',{name:/Bureau Kinshasa/}));
    expect(screen.getByRole('button',{name:'Inviter'})).toBeEnabled();
    fireEvent.submit(screen.getByPlaceholderText('collaborateur@agence.com').closest('form')!);
    await waitFor(()=>expect(inviteMember).toHaveBeenCalledWith('finance@example.com','FINANCE',{office_access_scope:'SELECTED_OFFICES',office_ids:['site-1']}));
  });
  it('shows French roles and invitation statuses without invitation separators',async()=>{
    vi.mocked(getAdmin).mockResolvedValue({...fixture,roles:[{...fixture.roles[0],role_code:'WAREHOUSE',role_name:'Warehouse'}],invitations:[{id:'inv',email:'agent@example.com',role_code:'WAREHOUSE',status:'PENDING'}]});
    const {container}=render(<OrganizationAdminPage/>);
    await screen.findByRole('heading',{name:'Paramètres de l’agence'});
    fireEvent.click(within(container.querySelector('aside')!).getByRole('button',{name:'Équipe'}));
    expect(screen.getByRole('option',{name:'Responsable d’entrepôt'})).toBeVisible();
    expect(screen.getByText('Responsable d’entrepôt · En attente')).toBeVisible();
    expect(container.querySelector('[data-ui="team-invitations"]')).not.toHaveClass('divide-y');
    expect(screen.queryByText('Warehouse')).not.toBeInTheDocument();
  });
  it("removes redundant tabs, exposes Équipe, and uses the same spacing between all groups", async () => {
    const { container } = render(<OrganizationAdminPage/>);
    await screen.findByRole("heading", { name: "Paramètres de l’agence" });
    const menu = container.querySelector("aside")!;
    expect(within(menu).queryByRole("button", { name: "Bureaux & contacts" })).not.toBeInTheDocument();
    expect(within(menu).queryByRole("button", { name: "Paiements & facturation" })).not.toBeInTheDocument();
    expect(within(menu).queryByRole("button", { name: "Identité visuelle" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Identité visuelle" })).not.toBeInTheDocument();
    expect(menu).toHaveClass("space-y-1");
    for (const group of menu.querySelectorAll("section")) expect(group).not.toHaveClass("mb-5");
    fireEvent.click(within(menu).getByRole("button", { name: "Équipe" }));
    expect(screen.getByRole("heading", { name: "Inviter un collaborateur" })).toBeVisible();
    fireEvent.change(screen.getByPlaceholderText("collaborateur@agence.com"), { target: { value: "agent@example.com" } });
    fireEvent.change(screen.getByRole('combobox',{name:'Accès du collaborateur'}),{target:{value:'AGENT'}});
    fireEvent.change(screen.getByRole('combobox',{name:'Bureaux autorisés pour l’invitation'}),{target:{value:'ALL_OFFICES'}});
    fireEvent.submit(screen.getByPlaceholderText("collaborateur@agence.com").closest("form")!);
    await waitFor(() => expect(inviteMember).toHaveBeenCalledWith("agent@example.com", "AGENT",{office_access_scope:'ALL_OFFICES',office_ids:[]}));
  });

  it("uploads the agency logo from the profile before saving its returned URL", async () => {
    render(<OrganizationAdminPage/>);
    const input = await screen.findByLabelText("Logo de l’agence");
    expect(input).toHaveAttribute("type", "file");
    const file = new File(["image"], "logo.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(screen.getByAltText("Aperçu — Logo de l’agence")).toHaveAttribute("src", "blob:test");
    expect(uploadAgencyBrandImage).not.toHaveBeenCalled();
    fireEvent.submit(input.closest("form")!);
    await waitFor(() => expect(updateOrganization).toHaveBeenCalledWith(expect.objectContaining({ expected_version: 3, logo_url: "https://storage.example.com/agency/logo.webp" })));
    expect(uploadAgencyBrandImage).toHaveBeenCalledWith(file);
  });

  it("opens the agency profile for an old visual identity link", async () => {
    navigation.params = new URLSearchParams("section=visual");
    render(<OrganizationAdminPage/>);
    expect(await screen.findByLabelText("Logo de l’agence")).toHaveAttribute("type", "file");
    expect(screen.getByRole("heading", { name: "Profil de l’agence", level: 2 })).toBeVisible();
    expect(screen.queryByLabelText("Couleur principale")).not.toBeInTheDocument();
  });

  it("rejects an unsupported logo without sending it to storage", async () => {
    render(<OrganizationAdminPage/>);
    const input = await screen.findByLabelText("Logo de l’agence");
    fireEvent.change(input, { target: { files: [new File(["svg"], "logo.svg", { type: "image/svg+xml" })] } });
    expect(screen.getByRole("alert")).toHaveTextContent("Choisissez une image PNG, JPG ou WebP.");
    expect(uploadAgencyBrandImage).not.toHaveBeenCalled();
  });

  it("lets the user cancel a selected logo and preserves the existing image", async () => {
    render(<OrganizationAdminPage/>);
    const input = await screen.findByLabelText("Logo de l’agence");
    fireEvent.change(input, { target: { files: [new File(["png"], "logo.png", { type: "image/png" })] } });
    fireEvent.click(screen.getByRole("button", { name: "Annuler le changement d’image" }));
    expect(screen.getByAltText("Aperçu — Logo de l’agence")).toHaveAttribute("src", "https://example.com/current.png");
    fireEvent.submit(input.closest("form")!);
    await waitFor(() => expect(updateOrganization).toHaveBeenCalled());
    expect(vi.mocked(updateOrganization).mock.lastCall?.[0]).not.toHaveProperty("logo_url");
    expect(uploadAgencyBrandImage).not.toHaveBeenCalled();
  });
});
