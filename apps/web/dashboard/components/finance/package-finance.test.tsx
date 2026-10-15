import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { createPackageInvoice, getPackageInvoice, type FinanceDocument } from "@/services/finance";
import { PackageFinance } from "./package-finance";

vi.mock("@/services/finance", () => ({ getPackageInvoice: vi.fn(), createPackageInvoice: vi.fn() }));
vi.mock("@/components/permissions/permission-guard", () => ({ PermissionGuard: ({ children }: { children: ReactNode }) => children }));
beforeEach(() => vi.resetAllMocks());

it("does not replace unavailable financial information with zeros", async () => {
  vi.mocked(getPackageInvoice).mockRejectedValue(new Error("offline"));
  render(<PackageFinance packageId="parcel" version={3} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("indisponible");
  expect(screen.queryByText("Paiements reçus")).not.toBeInTheDocument();
});

it("creates a draft from the server price without sending a client-entered amount", async () => {
  vi.mocked(getPackageInvoice).mockResolvedValue(null);
  vi.mocked(createPackageInvoice).mockResolvedValue({id:"invoice", document_number:"FAC-1", status:"DRAFT", currency:"USD", total:100, amount_paid:0, balance_due:100} as FinanceDocument);
  render(<PackageFinance packageId="parcel" version={3} />);
  fireEvent.click(await screen.findByRole("button", {name:"Préparer la facture depuis le tarif"}));
  expect(await screen.findByText(/aucun paiement demandé/)).toBeInTheDocument();
  expect(createPackageInvoice).toHaveBeenCalledWith("parcel",3);
  expect(screen.getByRole("link",{name:"Ouvrir dans Finance"})).toHaveAttribute("href","/app/finance?open=invoice");
});

it("explains the office access restriction", async () => {
  vi.mocked(getPackageInvoice).mockRejectedValue({response:{data:{detail:"finance_office_scope_not_supported"}}});
  render(<PackageFinance packageId="parcel" version={3} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("vue organisation complète et autorisée");
});
