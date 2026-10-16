import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SasPayCheckout } from "./saspay-checkout";
import type { FinanceDocument } from "@/services/finance";

const financeApi = vi.hoisted(() => ({
  getOpenSasPayAttempt: vi.fn(),
  getSasPayAttempt: vi.fn(),
  reconcileSasPayCheckout: vi.fn(),
  startSasPayCheckout: vi.fn(),
}));

vi.mock("@/services/finance", () => financeApi);

const document: FinanceDocument = {
  id: "invoice-1",
  document_type: "INVOICE",
  document_number: "FAC-2026-000001",
  client_id: "client-1",
  client_name: "Client",
  status: "ISSUED",
  currency: "USD",
  subtotal: 50,
  discount_total: 0,
  tax_total: 0,
  total: 50,
  amount_paid: 0,
  balance_due: 50,
  row_version: 1,
  created_at: "2026-10-15T12:00:00Z",
};

const pendingAttempt = {
  id: "attempt-1",
  status: "PENDING" as const,
  requested_amount: "50.00",
  currency: "USD",
  checkout_url: "https://pay.saspay.me/checkout/test",
  created_at: "2026-10-15T12:00:00Z",
};

describe("SasPayCheckout", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_FINANCE_MANUAL_PAYMENTS_ONLY", "0");
    sessionStorage.clear();
    vi.clearAllMocks();
    financeApi.getOpenSasPayAttempt.mockResolvedValue(null);
  });

  it("disables external checkout by default in V1 manual-only mode", () => {
    vi.stubEnv("NEXT_PUBLIC_FINANCE_MANUAL_PAYMENTS_ONLY", "true");
    render(<SasPayCheckout document={document} onConfirmed={vi.fn()} />);
    expect(screen.getByText("Paiement manuel uniquement")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Créer le lien de paiement" })).not.toBeInTheDocument();
  });

  it("stores a stable local key and never treats pending or browser return as payment confirmation", async () => {
    const onConfirmed = vi.fn().mockResolvedValue(undefined);
    financeApi.startSasPayCheckout.mockResolvedValue(pendingAttempt);
    financeApi.reconcileSasPayCheckout.mockResolvedValue({ status: "PENDING" });
    financeApi.getSasPayAttempt.mockResolvedValue(pendingAttempt);
    render(<SasPayCheckout document={document} onConfirmed={onConfirmed} />);

    fireEvent.click(await screen.findByRole("button", { name: "Créer le lien de paiement" }));
    await screen.findByRole("link", { name: "Ouvrir le paiement SasPay" });
    expect(financeApi.startSasPayCheckout).toHaveBeenCalledOnce();
    expect(sessionStorage.getItem("finance:saspay:invoice-1")).toBe("attempt-1");
    expect(onConfirmed).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Vérifier le statut auprès de SasPay" }));
    await screen.findByText("SasPay n’a pas encore confirmé le paiement. Le solde Finance reste inchangé.");
    expect(onConfirmed).not.toHaveBeenCalled();
  });

  it("refreshes Finance only when the server reports a verified success", async () => {
    const onConfirmed = vi.fn().mockResolvedValue(undefined);
    financeApi.getOpenSasPayAttempt.mockResolvedValue(pendingAttempt);
    financeApi.reconcileSasPayCheckout.mockResolvedValue({ status: "SUCCEEDED", payment_id: "payment-1" });
    financeApi.getSasPayAttempt.mockResolvedValue({ ...pendingAttempt, status: "SUCCEEDED", checkout_url: null });
    render(<SasPayCheckout document={document} onConfirmed={onConfirmed} />);

    fireEvent.click(await screen.findByRole("button", { name: "Vérifier le statut auprès de SasPay" }));
    await waitFor(() => expect(onConfirmed).toHaveBeenCalledOnce());
    expect(await screen.findByText("Paiement vérifié et enregistré dans Finance.")).toBeInTheDocument();
  });
});
