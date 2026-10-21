import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { OperationDrawer, OperationDrawerAction, OperationDrawerTabs } from "./operation-drawer";
import { businessLabel } from "./business-labels";

describe("OperationDrawer", () => {
  it("supports a right-side panel and keeps keyboard focus inside it", () => {
    const close = vi.fn();
    render(<OperationDrawer open title="Réception" close={close} placement="right"><button type="button">Enregistrer</button></OperationDrawer>);
    const dialog = screen.getByRole("dialog", { name: "Réception" });
    expect(dialog.parentElement).toBe(document.body);
    expect(dialog).toHaveClass("justify-end");
    expect(dialog.querySelector('section')).toHaveClass("h-dvh");
    expect(dialog.querySelector('[data-ui="operation-drawer"]')).toHaveClass("max-w-[650px]");
    expect(dialog.querySelector('[data-ui="operation-drawer"]')).toHaveAttribute("data-variant", "auto");
    screen.getByRole("button", { name: "Enregistrer" }).focus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(screen.getByRole("button", { name: "Fermer" })).toHaveFocus();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(close).toHaveBeenCalledTimes(1);
  });
  it("uses the shared segmented navigation for detail panels", () => {
    const change = vi.fn();
    render(
      <OperationDrawer
        open
        title="Fiche opérationnelle"
        close={vi.fn()}
        tabsVariant="segmented"
        tabs={
          <OperationDrawerTabs
            items={[
              { key: "summary", label: "Vue d’ensemble" },
              { key: "operations", label: "Opérations" },
              { key: "history", label: "Historique" },
            ]}
            value="summary"
            onChange={change}
          />
        }
      >
        Contenu
      </OperationDrawer>,
    );

    expect(screen.getByRole("button", { name: "Vue d’ensemble" })).toHaveAttribute("aria-current", "page");
    fireEvent.click(screen.getByRole("button", { name: "Opérations" }));
    expect(screen.getByRole("dialog", { name: "Fiche opérationnelle" }).querySelector('[data-ui="operation-drawer"]')).toHaveAttribute("data-variant", "detail");
    expect(change).toHaveBeenCalledWith("operations");
  });

  it("supports the payment-detail layout explicitly for simple records", () => {
    render(<OperationDrawer open title="Fiche client" close={vi.fn()} variant="detail">Détails</OperationDrawer>);
    expect(screen.getByRole("dialog", { name: "Fiche client" }).querySelector('[data-ui="operation-drawer"]')).toHaveAttribute("data-variant", "detail");
  });

  it("keeps all detail tabs visible in a horizontally scrollable row", () => {
    render(
      <OperationDrawerTabs
        items={[
          { key: "summary", label: "Résumé" },
          { key: "packages", label: "Colis" },
          { key: "documents", label: "Documents" },
          { key: "history", label: "Historique" },
          { key: "audit", label: "Audit" },
        ]}
        value="summary"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Audit" })).toBeInTheDocument();
  });

  it("shares professional action buttons and human business labels", () => {
    render(<OperationDrawerAction intent="danger" icon="archive">Archiver</OperationDrawerAction>);
    expect(screen.getByRole("button", { name: "Archiver" })).toHaveAttribute("data-ui", "operation-drawer-action");
    expect(businessLabel("DOCUMENT_MISSING")).toBe("Document manquant");
    expect(businessLabel("DUE")).toBe("À effectuer");
  });
});
