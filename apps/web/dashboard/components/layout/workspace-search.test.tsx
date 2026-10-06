import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceSearch } from "./workspace-search";

const mocks = vi.hoisted(() => ({ search: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/services/dashboard", () => ({ searchDashboardHome: mocks.search }));
beforeEach(() => { vi.useFakeTimers(); mocks.search.mockReset(); mocks.push.mockReset(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("workspace search", () => {
  it("waits for two characters and debounces the request", async () => {
    mocks.search.mockResolvedValue([]);
    render(<WorkspaceSearch locale="fr" close={vi.fn()}/>);
    const input = screen.getByRole("textbox");
    expect(input).toHaveFocus();
    fireEvent.change(input, { target: { value: "J" } });
    await act(async () => { vi.advanceTimersByTime(400); });
    expect(mocks.search).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "Jean" } });
    await act(async () => { vi.advanceTimersByTime(300); });
    expect(mocks.search).toHaveBeenCalledWith("Jean", expect.any(AbortSignal));
    expect(screen.getByRole("status")).toHaveTextContent("Aucun résultat");
  });

  it("groups results and opens the actual object", async () => {
    const close = vi.fn();
    mocks.search.mockResolvedValue([{ kind: "package", id: "p-1", title: "SLV-123", subtitle: "Kinshasa", href: "/app/packages?open=p-1" }]);
    render(<WorkspaceSearch locale="en" close={close}/>);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "123" } });
    await act(async () => { vi.advanceTimersByTime(300); });
    expect(screen.getByRole("heading", { name: "Parcels" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "SLV-123 Kinshasa" }));
    expect(mocks.push).toHaveBeenCalledWith("/app/packages?open=p-1");
    expect(close).toHaveBeenCalled();
  });

  it("shows failures instead of claiming no results", async () => {
    mocks.search.mockRejectedValue(new Error("offline"));
    render(<WorkspaceSearch locale="en" close={vi.fn()}/>);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Jean" } });
    await act(async () => { vi.advanceTimersByTime(300); });
    expect(screen.getByRole("alert")).toHaveTextContent("Search unavailable");
  });

  it("closes with Escape", () => {
    const close = vi.fn();
    render(<WorkspaceSearch locale="fr" close={close}/>);
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });
    expect(close).toHaveBeenCalledOnce();
  });
});
