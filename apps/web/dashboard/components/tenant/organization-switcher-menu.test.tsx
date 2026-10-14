import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrganizationSwitcher } from "./organization-switcher";
import { usePermissions } from "@/components/permissions/permission-provider";

vi.mock("@/components/permissions/permission-provider", () => ({ usePermissions: vi.fn() }));
vi.mock("@/services/tenant", () => ({ getTenantContext: () => Promise.resolve({
  active_tenant: { org_id: "office", organization_type: "PARCEL_FREIGHT", organization_name: "LUZA RDC", group_id: "group" },
  tenants: [{ org_id: "office", organization_type: "PARCEL_FREIGHT", organization_name: "LUZA RDC", group_id: "group", role_code: "OWNER", city: "Kinshasa" },
    { org_id: "warehouse", organization_type: "PARCEL_FREIGHT", organization_name: "LUZA CHINE", workspace_kind: "WAREHOUSE", group_id: "group" }],
}), switchTenant: vi.fn(), createTenant: vi.fn() }));

beforeEach(() => {
  vi.mocked(usePermissions).mockReturnValue({ permissions: ["network.read", "network.offices.manage"], available: true, loading: false, reload: vi.fn() });
});

describe("Sélecteur d’espace", () => {
  it("ne répète pas les titres techniques et distingue les bureaux des entrepôts", async () => {
    render(<OrganizationSwitcher menuPlacement="down" />);
    const trigger = await screen.findByRole("button", { name: "luza rdc's office" });
    fireEvent.click(trigger);
    expect(screen.getByRole("button", { name: /luza chine's warehouse/ })).toBeInTheDocument();
    expect(screen.queryByText("Bureaux et entrepôts accessibles")).not.toBeInTheDocument();
    expect(screen.queryByText("OWNER")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Créer un bureau ou entrepôt" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Réseau et équipe" })).toHaveAttribute("href", "/app/settings?section=network");
    fireEvent.keyDown(screen.getByRole("button", { name: "Fermer" }), { key: "Escape" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
  });

  it("ne propose pas de création à un membre sans autorisation", async () => {
    vi.mocked(usePermissions).mockReturnValue({ permissions: [], available: true, loading: false, reload: vi.fn() });
    render(<OrganizationSwitcher />);
    fireEvent.click(await screen.findByRole("button", { name: "luza rdc's office" }));
    await waitFor(() => expect(screen.getByRole("button", { name: /luza chine's warehouse/ })).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Créer un bureau ou entrepôt" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Réseau et équipe" })).not.toBeInTheDocument();
  });

  it("affiche un formulaire de création spacieux, centré et adapté aux deux implantations", async () => {
    render(<OrganizationSwitcher menuPlacement="down" />);
    fireEvent.click(await screen.findByRole("button", { name: "luza rdc's office" }));
    fireEvent.click(screen.getByRole("button", { name: "Créer un bureau ou entrepôt" }));

    const dialog = screen.getByRole("dialog", { name: "Créer un bureau ou entrepôt" });
    expect(dialog).toHaveClass("items-center", "justify-center");
    expect(dialog.querySelector("[data-ui='operation-drawer']")).toHaveClass("max-w-4xl");
    expect(screen.getByRole("radio", { name: /Bureau Accueil, dépôt ou retrait/ })).toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: /Entrepôt Stockage et opérations physiques/ }));
    expect(screen.getByRole("button", { name: "Créer l’entrepôt" })).toBeInTheDocument();
  });
});
