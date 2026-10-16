import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { createPackageInvoice, getPackageInvoice, type FinanceDocument } from "@/services/finance";
import { pricePackage, type PackageRecord } from "@/services/packages";
import { PackageFinance } from "./package-finance";

vi.mock("@/services/finance", () => ({ getPackageInvoice: vi.fn(), createPackageInvoice: vi.fn() }));
vi.mock("@/services/packages", () => ({ pricePackage: vi.fn() }));
vi.mock("@/components/permissions/permission-guard", () => ({ PermissionGuard: ({ children }: { children: ReactNode }) => children }));

const makePackage = (overrides: Partial<PackageRecord> = {}) => ({
  id: "parcel",
  row_version: 3,
  route_id: "route",
  shipping_service_id: "service",
  fees_total: null,
  currency: "USD",
  pricing_snapshot: {},
  ...overrides,
} as PackageRecord);

beforeEach(() => vi.resetAllMocks());

it("does not replace unavailable financial information with zeros", async () => {
  vi.mocked(getPackageInvoice).mockRejectedValue(new Error("offline"));
  render(<PackageFinance item={makePackage()} onUpdated={vi.fn()} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("indisponible");
  expect(screen.queryByText("Paiements reçus")).not.toBeInTheDocument();
});

it("calculates and persists the configured tariff before offering invoice creation", async () => {
  vi.mocked(getPackageInvoice).mockResolvedValue(null);
  const updated = makePackage({ row_version: 4, fees_total: 100, pricing_snapshot: { total: 100 } });
  vi.mocked(pricePackage).mockResolvedValue(updated);
  const onUpdated = vi.fn();
  render(<PackageFinance item={makePackage()} onUpdated={onUpdated} />);
  fireEvent.click(await screen.findByRole("button", { name: "Calculer le tarif du colis" }));
  expect(await screen.findByRole("button", { name: "Créer la facture depuis le tarif enregistré" })).toBeInTheDocument();
  expect(pricePackage).toHaveBeenCalledWith("parcel", "service");
  expect(onUpdated).toHaveBeenCalledWith(updated);
});

it("creates a draft using the latest package version and does not accept a manual amount", async () => {
  vi.mocked(getPackageInvoice).mockResolvedValue(null);
  vi.mocked(createPackageInvoice).mockResolvedValue({id:"invoice", document_number:"FAC-1", status:"DRAFT", currency:"USD", total:100, amount_paid:0, balance_due:100} as FinanceDocument);
  render(<PackageFinance item={makePackage({ row_version: 4, fees_total: 100, pricing_snapshot: { total: 100 } })} onUpdated={vi.fn()} />);
  fireEvent.click(await screen.findByRole("button", {name:"Créer la facture depuis le tarif enregistré"}));
  expect(await screen.findByText(/aucun paiement demandé/)).toBeInTheDocument();
  expect(createPackageInvoice).toHaveBeenCalledWith("parcel", 4);
  expect(screen.getByRole("link",{name:"Ouvrir dans Finance"})).toHaveAttribute("href","/app/finance?open=invoice");
});

it("explains the office access restriction", async () => {
  vi.mocked(getPackageInvoice).mockRejectedValue({response:{data:{detail:"finance_office_scope_not_supported"}}});
  render(<PackageFinance item={makePackage()} onUpdated={vi.fn()} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("vue organisation complète et autorisée");
});
