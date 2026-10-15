import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FinanceOfficeAssignment } from "./finance-office-assignment";
import { assignFinanceOffice } from "@/services/finance";
import { getOfficeContext } from "@/services/organization-admin";

vi.mock("@/services/finance", () => ({
  assignFinanceOffice: vi.fn(),
}));
vi.mock("@/services/organization-admin", () => ({
  getOfficeContext: vi.fn(),
}));

describe("FinanceOfficeAssignment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOfficeContext).mockResolvedValue({
      office_access_scope: "SELECTED_OFFICES",
      offices: [
        { location_id: "office-1", name: "Bureau Centre", city: "Kinshasa", country: "CD" },
        { location_id: "office-2", name: "Bureau Nord", city: "Goma", country: "CD" },
      ],
      selected_office_id: null,
      allowed_office_ids: ["office-1", "office-2"],
    });
    vi.mocked(assignFinanceOffice).mockResolvedValue({});
  });

  it("shows offices the user is allowed to assign and saves the selected office", async () => {
    render(
      <FinanceOfficeAssignment
        documentId="invoice-1"
        version={3}
        onSaved={vi.fn()}
      />,
    );

    const select = await screen.findByRole("combobox", { name: "Bureau responsable" });
    expect(screen.getByRole("option", { name: "Bureau Centre · Kinshasa" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Bureau Nord · Goma" })).toBeInTheDocument();

    fireEvent.change(select, { target: { value: "office-2" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmer l’attribution" }));

    await waitFor(() => {
      expect(assignFinanceOffice).toHaveBeenCalledWith("invoice-1", "office-2", 3);
    });
  });
});
