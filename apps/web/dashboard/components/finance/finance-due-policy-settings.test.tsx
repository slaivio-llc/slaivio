import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FinanceDuePolicySettings } from "./finance-due-policy-settings";
import { getFinanceSettings, listFinanceDuePolicies, saveFinanceDuePolicy } from "@/services/finance";

vi.mock("@/services/finance", () => ({
  getFinanceSettings: vi.fn(),
  listFinanceDuePolicies: vi.fn(),
  saveFinanceDuePolicy: vi.fn(),
}));
vi.mock("@/components/ui/operation-drawer", () => ({
  OperationDrawer: ({ open, children, title }: { open: boolean; children: ReactNode; title: string }) =>
    open ? <section role="dialog" aria-label={title}>{children}</section> : null,
}));

describe("FinanceDuePolicySettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getFinanceSettings).mockResolvedValue({
      legal_name: null, tax_identifier: null, billing_address: null,
      default_currency: "USD", default_tax_rate: 0,
      default_payment_terms_days: 0, document_footer: null,
    });
    vi.mocked(listFinanceDuePolicies).mockResolvedValue([]);
    vi.mocked(saveFinanceDuePolicy).mockResolvedValue({ name: "", trigger_event: "DEPARTURE", rule_type: "PERCENTAGE", currency: "USD", is_active: true });
  });

  it("saves the selected departure rule without reporting a false failure after the async request", async () => {
    render(<FinanceDuePolicySettings open close={vi.fn()} />);
    fireEvent.change(await screen.findByRole("textbox", { name: "Nom de la règle" }), {
      target: { value: "Acompte avant départ" },
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Pourcentage exigible" }), {
      target: { value: "50" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer la condition" }));

    await waitFor(() => expect(saveFinanceDuePolicy).toHaveBeenCalledWith(expect.objectContaining({
      name: "Acompte avant départ",
      trigger_event: "DEPARTURE",
      rule_type: "PERCENTAGE",
      percentage: 50,
      currency: "USD",
      is_active: true,
    })));
    expect(await screen.findByText("Aucune règle configurée pour cette agence.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
