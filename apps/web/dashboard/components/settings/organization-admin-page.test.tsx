import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrganizationAdminPage } from "./organization-admin-page";
import { getAdmin, inviteMember, updateMember, updateOrganization, uploadAgencyBrandImage, saveNumbering, updateSettings, type AdminData } from "@/services/organization-admin";

const navigation = vi.hoisted(() => ({ params: new URLSearchParams(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: navigation.replace }), useSearchParams: () => navigation.params }));
vi.mock("@/services/organization-admin", () => ({
  getAdmin: vi.fn(), inviteMember: vi.fn(), updateMember: vi.fn(), updateOrganization: vi.fn(), uploadAgencyBrandImage: vi.fn(),saveNumbering:vi.fn(),updateSettings:vi.fn(),
}));
vi.mock("@/components/permissions/permission-guard", () => ({ PermissionGuard: ({ children, permission }: { children: ReactNode; permission: string }) => permission === "platform.admin.read" ? null : children }));
vi.mock("@/components/ui/geography-fields", () => ({ FormGeographyFields: () => <><input name="country" aria-label="Pays"/><input name="city" aria-label="Ville"/></> }));
vi.mock('./subscription-settings',()=>({SubscriptionSettings:()=> <p>Subscription content</p>}));
vi.mock('./customer-automation-settings',()=>({CustomerAutomationSettings:()=> <p>Automation settings</p>}));

const fixture: AdminData = {
  organization: { organization_name: "Agence Cargo", row_version: 3, logo_url: "https://example.com/current.png" },
  settings: { row_version: 2, settings: {} }, members: [], invitations: [],
  roles: [{ id: "role", role_code: "OPERATOR", role_name: "Agent opérationnel", system_role: true, permission_count: 1, member_count: 0 }],
  permissions: [], audit: [], workspaces: [], locations: [], integrations: [], numbering: [], billing: null, data_requests: [], api_keys: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  navigation.params = new URLSearchParams();
  vi.mocked(getAdmin).mockResolvedValue(fixture);
  vi.mocked(uploadAgencyBrandImage).mockResolvedValue("https://storage.example.com/agency/logo.webp");
  vi.mocked(updateOrganization).mockResolvedValue({});
  vi.mocked(inviteMember).mockResolvedValue({});
});

describe("agency settings navigation and uploads", () => {
  it.each(['packages','delivery'])('saves all fields of the merged %s tab in one versioned request',async(section)=>{
    navigation.params=new URLSearchParams(`section=${section}`);
    const {container}=render(<OrganizationAdminPage/>);
    const save=await screen.findByRole('button',{name:'Enregistrer'});
    expect(screen.getAllByRole('button',{name:'Enregistrer'})).toHaveLength(1);
    expect(container.querySelector('form form')).toBeNull();
    if(section==='packages'){
      fireEvent.change(screen.getByLabelText('Horaires de l’agence'),{target:{value:'09:00 – 18:00'}});
      fireEvent.click(screen.getByLabelText('Autoriser les photos du colis'));
    }else{
      fireEvent.click(screen.getByLabelText('Autoriser le crédit client'));
      fireEvent.change(screen.getByLabelText('Délai indicatif de retrait (jours)'),{target:{value:'21'}});
    }
    fireEvent.click(save);
    await waitFor(()=>expect(updateSettings).toHaveBeenCalledTimes(1));
    const payload=vi.mocked(updateSettings).mock.calls[0][0];
    expect(payload.expected_version).toBe(2);
    if(section==='packages'){
      expect(payload).toMatchObject({timezone:'Africa/Kinshasa',settings:{agency_hours:{text:'09:00 – 18:00'},parcel_receipt_rules:{allow_photos:false,category_required:true}}});
    }else expect(payload).toMatchObject({settings:{shipment_delivery_rules:{pickup_delay_days:21,delivery_proof:true},client_conditions:{allow_customer_credit:true}}});
  });
  it('keeps subscription in the same settings container and groups notifications on demand',async()=>{
    const {container}=render(<OrganizationAdminPage/>);
    await screen.findByRole('heading',{name:'Paramètres de l’agence'});
    const menu=within(container.querySelector('aside')!);
    const frame=container.firstElementChild?.firstElementChild;
    const frameClasses=frame?.className;
    const width=container.querySelector('fieldset')?.className;
    fireEvent.click(menu.getByRole('button',{name:'Abonnement'}));
    expect(screen.getByText('Subscription content')).toBeVisible();
    expect(frame?.className).toBe(frameClasses);
    expect(container.querySelector('fieldset')?.className).toBe(width);
    fireEvent.click(menu.getByRole('button',{name:'Notifications & messages'}));
    expect(screen.queryByText('Automation settings')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Relances et messages'}));
    expect(screen.getByText('Automation settings')).toBeVisible();
  });
  it('groups related settings and keeps language and currency in the simplified profile',async()=>{
    const {container}=render(<OrganizationAdminPage/>);
    await screen.findByRole('heading',{name:'Paramètres de l’agence'});
    const menu=within(container.querySelector('aside')!);
    expect(menu.getByRole('button',{name:'Réception & horaires'})).toBeVisible();
    expect(menu.getByRole('button',{name:'Livraison & conditions clients'})).toBeVisible();
    expect(menu.queryByRole('button',{name:'Langues & devises'})).not.toBeInTheDocument();
    expect(menu.queryByRole('button',{name:'Horaires & disponibilité'})).not.toBeInTheDocument();
    expect(menu.queryByRole('button',{name:'Clients & conditions'})).not.toBeInTheDocument();
    expect(screen.getByLabelText('Langue par défaut')).toBeVisible();
    expect(screen.getByLabelText('Devise de référence')).toBeVisible();
    expect(screen.getAllByRole('button',{name:'Enregistrer'})).toHaveLength(1);
    expect(container.querySelector('form form')).toBeNull();
    for(const name of ['Identifiant fiscal','Numéro d’enregistrement','Slogan','Raison sociale'])expect(screen.queryByLabelText(name)).not.toBeInTheDocument();
    fireEvent.submit(screen.getByLabelText('Nom commercial *').closest('form')!);
    await waitFor(()=>expect(updateOrganization).toHaveBeenCalled());
    for(const name of ['tax_number','registration_number','legal_name','brand_slogan'])expect(vi.mocked(updateOrganization).mock.lastCall?.[0]).not.toHaveProperty(name);
  });
  it('lets an agency create a missing numbering format and configure customer references',async()=>{
    navigation.params=new URLSearchParams('section=numbering');
    vi.mocked(saveNumbering).mockResolvedValue({});
    render(<OrganizationAdminPage/>);
    const format=await screen.findByLabelText('Format de référence');
    expect(format).toHaveValue('COL-{YYYY}-{000001}');
    expect(screen.queryByText(/compteur de références colis n’est pas configuré/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Type de référence'),{target:{value:'CLIENT'}});
    fireEvent.change(screen.getByLabelText('Format de référence'),{target:{value:'CLIENT-{YYYY}-{000001}'}});
    fireEvent.submit(screen.getByLabelText('Format de référence').closest('form')!);
    await waitFor(()=>expect(saveNumbering).toHaveBeenCalledWith('CLIENT','CLIENT-{YYYY}-{000001}',0,'GLOBAL','NEVER'));
  });
  it('removes the tracking preview while keeping public page settings',async()=>{
    navigation.params=new URLSearchParams('section=tracking');
    render(<OrganizationAdminPage/>);
    expect(await screen.findByLabelText('Activer le suivi public')).toBeVisible();
    expect(screen.queryByText('Aperçu de la page client')).not.toBeInTheDocument();
    expect(screen.queryByText('Suivez votre colis')).not.toBeInTheDocument();
  });
  it('keeps the invitation compact and member role controls closed until requested',async()=>{
    const roleCodes=['MANAGER','OPERATOR','WAREHOUSE','SUPPORT','FINANCE'];
    vi.mocked(getAdmin).mockResolvedValue({...fixture,
      roles:roleCodes.map(code=>({...fixture.roles[0],id:code,role_code:code,permission_codes:['warehouses.receive','packages.update','warehouses.quality']})),
      members:[
        {id:'owner',role_code:'OWNER',status:'ACTIVE',row_version:1,office_access_scope:'ALL_OFFICES',office_ids:[]},
        {id:'staff',member_display_name:'Awa',member_email:'awa@example.com',role_code:'OPERATOR',status:'ACTIVE',row_version:2,office_access_scope:'ALL_OFFICES',office_ids:[]},
      ],
    });
    const {container}=render(<OrganizationAdminPage/>);
    await screen.findByRole('heading',{name:'Paramètres de l’agence'});
    fireEvent.click(within(container.querySelector('aside')!).getByRole('button',{name:'Équipe'}));
    expect(screen.getByLabelText('Email professionnel')).toHaveAttribute('type','email');
    expect(screen.queryByText(/Action avancée/)).not.toBeInTheDocument();
    const form=screen.getByPlaceholderText('collaborateur@agence.com').closest('form')!;
    expect(within(form).getAllByRole('combobox')).toHaveLength(2); // Invitation role and bureau scope only.
    expect(form.querySelector('ul')).toBeNull();
    expect(container.querySelectorAll('details')).toHaveLength(1); // Never expose owner controls here.
    const editor=container.querySelector('details')!;
    expect(editor.open).toBe(false);
    expect(within(editor).getByLabelText('Rôle du membre')).not.toBeVisible();
    fireEvent.click(within(editor).getByText('Modifier les accès'));
    expect(editor.open).toBe(true);
    const roleSelect=screen.getByRole('combobox',{name:'Rôle du membre'});
    expect(within(roleSelect).getAllByRole('option').map(option=>option.getAttribute('value'))).toEqual(roleCodes);
    fireEvent.change(roleSelect,{target:{value:'SUPPORT'}});
    fireEvent.click(within(editor).getByRole('button',{name:'Appliquer'}));
    await waitFor(()=>expect(updateMember).toHaveBeenCalledWith('staff',{role_code:'SUPPORT',status:'ACTIVE',expected_version:2}));
  });
  it('offers only five simple invitation roles without deleting specialised or custom roles',async()=>{
    const codes=['MANAGER','OPERATOR','WAREHOUSE','SUPPORT','FINANCE','OWNER','RECEIVER','WEIGHER','QUALITY_CONTROLLER','WAREHOUSE_SUPERVISOR','COUNTER_AGENT','CASHIER','CUSTOM'];
    vi.mocked(getAdmin).mockResolvedValue({...fixture,roles:codes.map(code=>({...fixture.roles[0],id:code,role_code:code,role_name:code,system_role:code!=='CUSTOM'}))});
    const {container}=render(<OrganizationAdminPage/>);
    await screen.findByRole('heading',{name:'Paramètres de l’agence'});
    fireEvent.click(within(container.querySelector('aside')!).getByRole('button',{name:'Équipe'}));
    const select=screen.getByRole('combobox',{name:'Accès du collaborateur'});
    expect(within(select).getAllByRole('option').map(option=>option.getAttribute('value'))).toEqual(['','MANAGER','OPERATOR','WAREHOUSE','SUPPORT','FINANCE']);
    expect(within(select).getAllByRole('option').slice(1).map(option=>option.textContent)).toEqual(['Responsable du bureau','Opérations','Entrepôt','Service client','Finance']);
    expect(getAdmin).toHaveBeenCalledTimes(1);
    expect(inviteMember).not.toHaveBeenCalled();
  });
  it('invites a bureau manager for the whole active workspace without granting network offices',async()=>{
    vi.mocked(getAdmin).mockResolvedValue({...fixture,roles:[{...fixture.roles[0],role_code:'MANAGER',role_name:'Manager',permission_codes:['finance.read','packages.read','team.manage']}]});
    const {container}=render(<OrganizationAdminPage/>);
    await screen.findByRole('heading',{name:'Paramètres de l’agence'});
    fireEvent.click(within(container.querySelector('aside')!).getByRole('button',{name:'Équipe'}));
    fireEvent.change(screen.getByRole('combobox',{name:'Accès du collaborateur'}),{target:{value:'MANAGER'}});
    expect(screen.getByRole('option',{name:'Responsable du bureau'})).toBeVisible();
    expect(screen.getByRole('combobox',{name:'Bureaux autorisés pour l’invitation'})).toHaveValue('ALL_OFFICES');
    expect(screen.getByText(/L’invitation concerne uniquement le bureau actuellement sélectionné/)).toBeVisible();
    fireEvent.change(screen.getByPlaceholderText('collaborateur@agence.com'),{target:{value:'responsable@example.com'}});
    fireEvent.submit(screen.getByPlaceholderText('collaborateur@agence.com').closest('form')!);
    await waitFor(()=>expect(inviteMember).toHaveBeenCalledWith('responsable@example.com','MANAGER',{office_access_scope:'ALL_OFFICES',office_ids:[]}));
  });
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
    expect(screen.getByRole('option',{name:'Entrepôt'})).toBeVisible();
    expect(screen.getByText('Agent entrepôt · En attente')).toBeVisible();
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
    fireEvent.change(screen.getByRole('combobox',{name:'Accès du collaborateur'}),{target:{value:'OPERATOR'}});
    fireEvent.change(screen.getByRole('combobox',{name:'Bureaux autorisés pour l’invitation'}),{target:{value:'ALL_OFFICES'}});
    fireEvent.submit(screen.getByPlaceholderText("collaborateur@agence.com").closest("form")!);
    await waitFor(() => expect(inviteMember).toHaveBeenCalledWith("agent@example.com", "OPERATOR",{office_access_scope:'ALL_OFFICES',office_ids:[]}));
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
