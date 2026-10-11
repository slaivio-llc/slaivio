import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CargoAccountMenu } from "./cargo-account-menu";

vi.mock("@clerk/nextjs", () => ({
  useUser: () => ({ user: { fullName: null, primaryEmailAddress: { emailAddress: "agent@example.com" } } }),
  useClerk: () => ({ openUserProfile: vi.fn(), signOut: vi.fn() }),
}));

describe("Menu compte fret", () => {
  it("affiche l’identité une seule fois et conserve trois actions claires", () => {
    const close = vi.fn(); const preferences = vi.fn();
    render(<CargoAccountMenu locale="fr" close={close} preferences={preferences} />);
    expect(screen.getAllByText("agent@example.com")).toHaveLength(1);
    expect(screen.getAllByRole("button").map(button => button.textContent)).toEqual(["Profil et sécurité", "Langue", "Se déconnecter"]);
    expect(screen.getByRole("button", { name: "Profil et sécurité" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Langue" }));
    expect(preferences).toHaveBeenCalledOnce();
    fireEvent.keyDown(screen.getByRole("button", { name: "Langue" }), { key: "Escape" });
    expect(close).toHaveBeenCalledOnce();
  });
});
