import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { api } from "@/services/api";
import { getPackageMediaUrl, uploadPackageMedia } from "@/services/packages";
import type { ParcelOverview } from "@/services/parcel-register";
import { ParcelEditForm, ParcelPhotos } from "./parcel-operations";

vi.mock("@/services/api", () => ({ api: { get: vi.fn(), patch: vi.fn() } }));
vi.mock("@/services/packages", () => ({ uploadPackageMedia: vi.fn(), getPackageMediaUrl: vi.fn() }));
vi.mock("@/components/permissions/permission-guard", () => ({ PermissionGuard: ({ children }: { children: ReactNode }) => children }));

const item = { id: "parcel", local_client: true, weight_editable: true, weight_kg: 12,
  description: "Carton", supplier_tracking: null, warehouse_location: "A1" } as ParcelOverview;
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockResolvedValue({ data: { items: [], page: 1, total_pages: 1, total: 0 } });
});

describe("Corrections du colis", () => {
  it("envoie uniquement les informations modifiées et le motif", () => {
    const save = vi.fn();
    render(<ParcelEditForm item={item} saving={false} error="" save={save} cancel={vi.fn()}/>);
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Carton fragile" } });
    fireEvent.change(screen.getByLabelText("Motif de la correction"), { target: { value: "Étiquette vérifiée" } });
    fireEvent.submit(screen.getByRole("form"));
    expect(save).toHaveBeenCalledWith({ description: "Carton fragile" }, "Étiquette vérifiée");
    expect(screen.getByLabelText("Motif de la correction")).toBeRequired();
  });
  it("exclut le poids verrouillé des modifications", () => {
    const save = vi.fn();
    render(<ParcelEditForm item={{ ...item, weight_editable: false }} saving={false} error="" save={save} cancel={vi.fn()}/>);
    expect(screen.getByLabelText("Poids (kg)")).toBeDisabled();
    fireEvent.submit(screen.getByRole("form"));
    expect(save).toHaveBeenCalledWith({}, "");
  });
  it("limite le bureau destinataire à l’emplacement de stockage", () => {
    render(<ParcelEditForm item={{ ...item, local_client: false }} saving={false} error="" save={vi.fn()} cancel={vi.fn()}/>);
    expect(screen.queryByLabelText("Description")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Poids (kg)")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Emplacement de stockage")).toBeInTheDocument();
  });
});

describe("Photos privées", () => {
  it("demande une URL privée seulement à l’ouverture de la photo", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { items: [{ id: "photo", file_name: "carton.png", caption: null }], page: 1, total_pages: 1, total: 1 } });
    vi.mocked(getPackageMediaUrl).mockResolvedValue("https://storage.example/private-signed");
    render(<ParcelPhotos item={item} changed={vi.fn()} busyChanged={vi.fn()}/>);
    const photo = await screen.findByRole("button", { name: "carton.png" });
    expect(getPackageMediaUrl).not.toHaveBeenCalled();
    fireEvent.click(photo);
    expect(await screen.findByRole("img")).toHaveAttribute("referrerpolicy", "no-referrer");
    expect(getPackageMediaUrl).toHaveBeenCalledWith("parcel", "photo");
  });
  it("partage une photo avec le client uniquement après une action explicite", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { items: [{ id: "photo", file_name: "carton.png", caption: null, customer_visible: false }], page: 1, total_pages: 1, total: 1 } });
    vi.mocked(api.patch).mockResolvedValue({ data: { status: "ok", customer_visible: true } });
    const changed = vi.fn().mockResolvedValue(undefined);
    render(<ParcelPhotos item={item} changed={changed} busyChanged={vi.fn()}/>);
    fireEvent.click(await screen.findByRole("button", { name: "Partager dans le suivi client" }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith("/packages/parcel/media/photo/customer-visibility", { customer_visible: true }));
    expect(await screen.findByText("Photo maintenant visible dans le suivi client.")).toBeInTheDocument();
    expect(changed).toHaveBeenCalledTimes(1);
  });
  it("signale les échecs partiels sans réenvoyer les photos réussies", async () => {
    vi.mocked(uploadPackageMedia).mockResolvedValueOnce({} as Awaited<ReturnType<typeof uploadPackageMedia>>).mockRejectedValueOnce(new Error("offline"));
    const changed = vi.fn().mockResolvedValue(undefined);
    render(<ParcelPhotos item={item} changed={changed} busyChanged={vi.fn()}/>);
    await screen.findByText("Aucune photo ajoutée.");
    fireEvent.change(screen.getByLabelText("Ajouter des photos"), { target: { files: [new File(["ok"], "a.png", { type: "image/png" }), new File(["ok"], "b.png", { type: "image/png" })] } });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("1 photo(s) ajoutée(s). À vérifier avant de renvoyer : b.png"));
    expect(uploadPackageMedia).toHaveBeenCalledTimes(2);
    expect(changed).toHaveBeenCalledTimes(1);
  });
  it("refuse un format non autorisé avant tout téléversement", async () => {
    render(<ParcelPhotos item={item} changed={vi.fn()} busyChanged={vi.fn()}/>);
    await screen.findByText("Aucune photo ajoutée.");
    fireEvent.change(screen.getByLabelText("Ajouter des photos"), { target: { files: [new File(["pdf"], "a.pdf", { type: "application/pdf" })] } });
    expect(await screen.findByRole("alert")).toHaveTextContent("JPEG, PNG ou WebP");
    expect(uploadPackageMedia).not.toHaveBeenCalled();
  });
  it("ne propose pas d’ajout au bureau destinataire", async () => {
    render(<ParcelPhotos item={{ ...item, local_client: false }} changed={vi.fn()} busyChanged={vi.fn()}/>);
    await screen.findByText("Aucune photo ajoutée.");
    expect(screen.queryByLabelText("Ajouter des photos")).not.toBeInTheDocument();
  });
});
