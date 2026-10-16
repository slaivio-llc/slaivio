import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { payFinance, type FinanceDocument } from "@/services/finance";
import { RecordPaymentForm } from "./record-payment-form";

vi.mock("@/services/finance", () => ({ payFinance: vi.fn() }));
const document = { id: "invoice", client_name: "Jean", document_number: "FAC-1", balance_due: 60, currency: "USD" } as FinanceDocument;
beforeEach(() => {
  sessionStorage.clear();
  vi.resetAllMocks();
});

it("retries exactly the same request after an ambiguous failure", async () => {
  vi.mocked(payFinance).mockRejectedValueOnce(new Error("timeout")).mockResolvedValueOnce({} as never);
  const onRecorded = vi.fn().mockResolvedValue(undefined);
  render(<RecordPaymentForm document={document} onRecorded={onRecorded} onCancel={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
  await screen.findByRole("alert");
  expect(screen.getByLabelText(/Montant reçu/)).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Vérifier la même demande" }));
  await waitFor(() => expect(onRecorded).toHaveBeenCalledOnce());
  expect(vi.mocked(payFinance).mock.calls[0]).toEqual(vi.mocked(payFinance).mock.calls[1]);
});

it("does not submit another payment when refreshing a confirmed one fails", async () => {
  vi.mocked(payFinance).mockResolvedValue({} as never);
  const onRecorded = vi.fn().mockRejectedValueOnce(new Error("read failed")).mockResolvedValueOnce(undefined);
  render(<RecordPaymentForm document={document} onRecorded={onRecorded} onCancel={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "Actualiser le paiement confirmé" }));
  await waitFor(() => expect(onRecorded).toHaveBeenCalledTimes(2));
  expect(payFinance).toHaveBeenCalledOnce();
});

it("rejects amounts above the balance before submitting", async () => {
  render(<RecordPaymentForm document={document} onRecorded={vi.fn()} onCancel={vi.fn()} />);
  fireEvent.change(screen.getByLabelText(/Montant reçu/), { target: { value: "61" } });
  fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
  expect(screen.getByRole("alert")).toHaveTextContent("au maximum égal au solde");
  expect(payFinance).not.toHaveBeenCalled();
});
