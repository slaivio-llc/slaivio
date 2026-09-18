import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PilotSettingsPage } from "./pilot-settings-page";
import * as adminService from "@/services/organization-admin";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/permissions/permission-guard", () => ({
  PermissionGuard: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/components/ui/geography-fields", () => ({
  FormGeographyFields: () => <div data-testid="geography-fields" />,
  PhoneField: ({ name }: { name: string }) => <input name={name} />,
}));

vi.mock("@/services/organization-admin", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/organization-admin")>();
  return { ...actual, getPilotSettings: vi.fn() };
});

const settings: adminService.PilotSettingsData = {
  organization: {
    id: "org-1",
    organization_name: "Agence test",
    organization_type: "PARCEL_FREIGHT",
    country: "CD",
    city: "Kinshasa",
    row_version: 1,
    whatsapp_group_on_dossier_create: false,
  },
  responsible: null,
  team: [],
  locations: [],
  numbering: [],
  whatsapp_numbers: [],
  whatsapp_configuration: {
    provider: "QR_LINKED_DEVICE",
    activation_available: true,
    qr_linked_device_available: true,
  },
  ai: {
    pilot_response_mode: "CONTROLLED_AUTO",
    pilot_require_published_knowledge: true,
    system_prompt: "Répondre comme le service client.",
    user_prompt_template: "Message : {message}",
    communication_style: "PROFESSIONAL",
    prompt_row_version: 1,
    updated_at: "2026-09-18T00:00:00Z",
  },
  knowledge: {
    default_language: "FR",
    pilot_default_review_days: 90,
    pilot_row_version: 1,
    published_count: 2,
    draft_count: 0,
    whatsapp_ready_count: 2,
  },
  parcel_operations: {
    package_number_pattern: "COL-{YYYY}-{000001}",
    prospect_followup_delay_hours: 24,
    incomplete_profile_followup_hours: 12,
    notify_next_departure: true,
    notify_package_milestones: true,
    require_payment_clearance: true,
    required_profile_fields: ["display_name", "country", "city"],
    row_version: 1,
    updated_at: "2026-09-18T00:00:00Z",
  },
};

beforeEach(() => {
  replace.mockReset();
  vi.mocked(adminService.getPilotSettings).mockResolvedValue(settings);
});

describe("PilotSettingsPage navigation", () => {
  it("keeps every settings section visible and switches sections without a filter menu", async () => {
    const user = userEvent.setup();
    render(<PilotSettingsPage />);

    const labels = [
      "Entreprise",
      "Bureaux, routes & services",
      "Identifiants",
      "Canaux",
      "IA",
      "Connaissances",
      "Confidentialité & données",
      "Notifications",
    ];

    for (const label of labels) {
      expect(await screen.findByRole("button", { name: label })).toBeVisible();
    }

    expect(screen.getByRole("button", { name: "Entreprise" })).toHaveAttribute("aria-current", "page");
    await user.click(screen.getByRole("button", { name: "IA" }));

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/app/settings?section=ai", { scroll: false });
      expect(screen.getByRole("button", { name: "IA" })).toHaveAttribute("aria-current", "page");
    });
    expect(screen.getByRole("heading", { name: "Intelligence artificielle" })).toBeVisible();
  });
});
