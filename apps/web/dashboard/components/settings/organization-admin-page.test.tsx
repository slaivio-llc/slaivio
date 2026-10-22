import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrganizationAdminPage } from "./organization-admin-page";
import { getAdmin, inviteMember, saveAgencyBrand, updateOrganization, uploadAgencyBrandImage, type AdminData } from "@/services/organization-admin";

const navigation = vi.hoisted(() => ({ params: new URLSearchParams(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: navigation.replace }), useSearchParams: () => navigation.params }));
vi.mock("@/services/organization-admin", () => ({
  getAdmin: vi.fn(), inviteMember: vi.fn(), saveAgencyBrand: vi.fn(), updateOrganization: vi.fn(), uploadAgencyBrandImage: vi.fn(),
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
  vi.mocked(saveAgencyBrand).mockResolvedValue({});
  vi.mocked(inviteMember).mockResolvedValue({});
});

describe("agency settings navigation and uploads", () => {
  it("removes redundant tabs, exposes Équipe, and uses the same spacing between all groups", async () => {
    const { container } = render(<OrganizationAdminPage/>);
    await screen.findByRole("heading", { name: "Paramètres de l’agence" });
    const menu = container.querySelector("aside")!;
    expect(within(menu).queryByRole("button", { name: "Bureaux & contacts" })).not.toBeInTheDocument();
    expect(within(menu).queryByRole("button", { name: "Paiements & facturation" })).not.toBeInTheDocument();
    expect(menu).toHaveClass("space-y-1");
    for (const group of menu.querySelectorAll("section")) expect(group).not.toHaveClass("mb-5");
    fireEvent.click(within(menu).getByRole("button", { name: "Équipe" }));
    expect(screen.getByRole("heading", { name: "Inviter un collaborateur" })).toBeVisible();
    fireEvent.change(screen.getByPlaceholderText("collaborateur@agence.com"), { target: { value: "agent@example.com" } });
    fireEvent.submit(screen.getByPlaceholderText("collaborateur@agence.com").closest("form")!);
    await waitFor(() => expect(inviteMember).toHaveBeenCalledWith("agent@example.com", "AGENT"));
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

  it("does not erase the main logo when saving visual identity", async () => {
    navigation.params = new URLSearchParams("section=visual");
    render(<OrganizationAdminPage/>);
    const color = await screen.findByLabelText("Couleur principale");
    expect(screen.queryByLabelText("Logo de l’agence")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Logo pour fond sombre")).toHaveAttribute("type", "file");
    expect(screen.getByLabelText("Favicon")).toHaveAttribute("type", "file");
    fireEvent.submit(color.closest("form")!);
    await waitFor(() => expect(saveAgencyBrand).toHaveBeenCalled());
    expect(vi.mocked(saveAgencyBrand).mock.calls[0][0]).not.toHaveProperty("logo_url");
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
