import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrganizationSwitcher } from "./organization-switcher";
import { usePermissions } from "@/components/permissions/permission-provider";
import { switchTenant } from "@/services/tenant";

vi.mock("@/components/permissions/permission-provider", () => ({ usePermissions: vi.fn() }));
vi.mock("@/services/tenant", () => ({ getTenantContext: () => Promise.resolve({
  active_tenant: { org_id: "office", organization_type: "PARCEL_FREIGHT", organization_name: "LUZA RDC", network_name: "Cargo Express", group_id: "group" },
  tenants: [{ org_id: "office", organization_type: "PARCEL_FREIGHT", organization_name: "LUZA RDC", network_name: "Cargo Express", group_id: "group", role_code: "OWNER", city: "Kinshasa" },
    { org_id: "warehouse", organization_type: "PARCEL_FREIGHT", organization_name: "LUZA CHINE", workspace_kind: "WAREHOUSE", group_id: "group" }],
}), switchTenant: vi.fn(), createTenant: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(usePermissions).mockReturnValue({ permissions: ["network.read", "network.offices.manage"], available: true, loading: false, reload: vi.fn() });
});

describe("Sélecteur d’espace", () => {
  it('affiche le menu compact dans la barre du haut et conserve le contexte en cas d’échec',async()=>{
    window.sessionStorage.setItem('slaivio:office-context','old-filter');
    vi.mocked(switchTenant).mockRejectedValueOnce(new Error('offline'));
    render(<OrganizationSwitcher header menuPlacement="down"/>);
    const trigger=await screen.findByRole('button',{name:'Changer de bureau : Cargo Express'});
    expect(trigger).toHaveClass('border','border-[#d8ddda]');
    fireEvent.click(trigger);
    expect(document.querySelector('[data-workspace-menu]')).toHaveClass('w-[320px]','right-0');
    expect(screen.getByRole('region',{name:'Bureaux'})).toContainElement(screen.getByRole('button',{name:/Kinshasa/}));
    expect(screen.getByRole('region',{name:'Entrepôts'})).toContainElement(screen.getByRole('button',{name:/LUZA CHINE/}));
    expect(screen.getByRole('button',{name:/Kinshasa/})).toHaveAttribute('aria-current','true');
    fireEvent.click(screen.getByRole('button',{name:/LUZA CHINE/}));
    await waitFor(()=>expect(switchTenant).toHaveBeenCalledWith('warehouse'));
    expect(await screen.findByText('Changement impossible')).toBeVisible();
    expect(window.sessionStorage.getItem('slaivio:office-context')).toBe('old-filter');
    expect(screen.getByRole('button',{name:/LUZA CHINE/})).toBeEnabled();
  });
  it("ne répète pas les titres techniques et distingue les bureaux des entrepôts", async () => {
    render(<OrganizationSwitcher menuPlacement="down" />);
    const trigger = await screen.findByRole("button", { name: "Changer de bureau : Cargo Express" });
    fireEvent.click(trigger);
    expect(screen.getByRole("button", { name: /LUZA CHINE/ })).toBeInTheDocument();
    expect(screen.getAllByText("Cargo Express")).toHaveLength(2);
    expect(screen.getByText("Bureaux")).toBeInTheDocument();
    expect(screen.getByText("Entrepôts")).toBeInTheDocument();
    expect(screen.queryByText("Bureaux et entrepôts accessibles")).not.toBeInTheDocument();
    expect(screen.queryByText("OWNER")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Créer un bureau" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Créer un entrepôt" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Réseau et équipe" })).not.toBeInTheDocument();
    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
  });

  it("ne propose pas de création à un membre sans autorisation", async () => {
    vi.mocked(usePermissions).mockReturnValue({ permissions: [], available: true, loading: false, reload: vi.fn() });
    render(<OrganizationSwitcher />);
    fireEvent.click(await screen.findByRole("button", { name: "Changer de bureau : Cargo Express" }));
    await waitFor(() => expect(screen.getByRole("button", { name: /LUZA CHINE/ })).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Créer un bureau" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Créer un entrepôt" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Réseau et équipe" })).not.toBeInTheDocument();
  });

  it("affiche un formulaire de création spacieux, centré et adapté aux deux implantations", async () => {
    render(<OrganizationSwitcher menuPlacement="down" />);
    fireEvent.click(await screen.findByRole("button", { name: "Changer de bureau : Cargo Express" }));
    fireEvent.click(screen.getByRole("button", { name: "Créer un bureau" }));

    const dialog = screen.getByRole("dialog", { name: "Créer un bureau ou entrepôt" });
    expect(dialog).toHaveClass("items-center", "justify-center");
    expect(dialog.querySelector("[data-ui='operation-drawer']")).toHaveClass("max-w-4xl");
    expect(screen.getByRole("radio", { name: /Bureau Accueil, dépôt ou retrait/ })).toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: /Entrepôt Stockage et opérations physiques/ }));
    expect(screen.getByRole("button", { name: "Créer l’entrepôt" })).toBeInTheDocument();
  });
});
