import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { OperationButton, OperationMetric, OperationMetricGrid, OperationTab } from "./operation-controls";
import { OperationPageHeader } from "./operation-page-header";
import { OperationMetrics, OperationSearch, OperationTable, OperationToolbar } from "./operation-primitives";

describe("Pilot visual foundation", () => {
  it("exposes one shared structure for operational pages", () => {
    const change = vi.fn();
    render(
      <main>
        <OperationPageHeader
          title="Dossiers"
          description="Suivez le travail de l’agence."
          actions={<OperationButton variant="primary">Nouveau dossier</OperationButton>}
          tabs={<OperationTab active>Tous</OperationTab>}
        />
        <OperationMetrics>
          <OperationMetricGrid><OperationMetric label="Actifs" value={12} /></OperationMetricGrid>
        </OperationMetrics>
        <OperationToolbar search={<OperationSearch value="" onChange={change} placeholder="Rechercher un dossier" />} />
        <OperationTable><table><tbody><tr><td>DOS-001</td></tr></tbody></table></OperationTable>
      </main>,
    );

    const pageHeader = screen.getByRole("heading", { name: "Dossiers" }).closest("header");
    expect(pageHeader).toHaveAttribute("data-ui", "operation-page-header");
    expect(pageHeader?.firstElementChild).toHaveClass("mx-auto", "w-full", "max-w-[1200px]", "px-6", "sm:px-8", "lg:pt-12");
    expect(pageHeader?.firstElementChild?.firstElementChild).toHaveClass("border-b", "pb-6", "sm:pb-8");
    expect(screen.queryByRole("menu", { name: "Vues du module" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Choisir une vue" }));
    expect(screen.getByRole("menu", { name: "Vues du module" })).toBeInTheDocument();
    expect(screen.getByText("Actifs").closest("section")).toHaveAttribute("data-ui", "operation-metrics");
    expect(screen.getByText("Actifs").closest("section")?.firstElementChild).toHaveClass("mx-auto", "max-w-[1200px]", "px-6", "sm:px-8");
    expect(screen.getByText("Actifs").closest("section")?.firstElementChild?.firstElementChild).toHaveClass("border-b", "py-3");
    expect(screen.getByText("12")).toHaveClass("text-[21px]", "mt-0.5");
    expect(screen.getByText("DOS-001").closest("section")).toHaveAttribute("data-ui", "operation-table");

    fireEvent.change(screen.getByRole("textbox", { name: "Rechercher un dossier" }), { target: { value: "DOS" } });
    expect(change).toHaveBeenCalledWith("DOS");
  });
});
