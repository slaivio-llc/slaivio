import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PilotSettingsPage } from "./pilot-settings-page";
import * as adminService from "@/services/organization-admin";
import * as knowledgeService from "@/services/knowledge";

const replace = vi.fn();
let requestedSection: string | null = null;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(requestedSection ? `?section=${requestedSection}` : ""),
  usePathname: () => "/app/settings",
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
  return { ...actual, getPilotSettings: vi.fn(), getPilotWhatsappQRStatus: vi.fn(), disconnectPilotWhatsappQR: vi.fn() };
});

vi.mock("@/services/knowledge", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/knowledge")>();
  return {
    ...actual,
    listPilotKnowledge: vi.fn(),
    getPilotKnowledgeStats: vi.fn(),
  };
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
    pilot_handoff_to_human: true,
    pilot_use_organization_name: true,
    welcome_message_enabled: true,
    welcome_message: "Bonjour !",
    away_message_enabled: false,
    away_message: "",
    fallback_reply_enabled: true,
    fallback_reply: "Je transmets votre demande à notre équipe.",
    auto_create_qualified_whatsapp_clients: false,
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
  requestedSection = null;
  vi.mocked(adminService.getPilotWhatsappQRStatus).mockResolvedValue(null);
  vi.mocked(adminService.getPilotSettings).mockResolvedValue(settings);
  vi.mocked(knowledgeService.listPilotKnowledge).mockResolvedValue({
    total: 1,
    items: [{
      id: "knowledge-1",
      reference: "KN-1",
      subject: "Tarif Kinshasa–Goma",
      answer: "Le tarif confirmé est de 8 USD par kilogramme.",
      kind: "CLIENT_ANSWER",
      category: "SERVICES",
      client_visible: true,
      status: "PUBLISHED",
      internal_status: "PUBLISHED",
      language: "FR",
      version: 1,
      updated_at: "2026-09-18T00:00:00Z",
    }],
  });
  vi.mocked(knowledgeService.getPilotKnowledgeStats).mockResolvedValue({
    total: 1,
    published: 1,
    drafts: 0,
    needs_review: 0,
    available_to_ai: 1,
    archived: 0,
    default_language: "FR",
    pilot_default_review_days: 90,
  });
});

describe("PilotSettingsPage navigation", () => {
  it('keeps a failed WhatsApp disconnection visible and allows retrying it',async()=>{
    const user=userEvent.setup();
    requestedSection='channels';
    vi.mocked(adminService.getPilotWhatsappQRStatus).mockResolvedValue({connection_id:'connection-1',status:'CONNECTED'});
    vi.mocked(adminService.disconnectPilotWhatsappQR).mockRejectedValueOnce({response:{data:{detail:'pilot_whatsapp_qr_remote_logout_unconfirmed'}}});
    render(<PilotSettingsPage scope="communication"/>);
    await user.click(await screen.findByRole('button',{name:'Gérer WhatsApp'}));
    await user.click(screen.getByRole('button',{name:'Supprimer le compte'}));
    expect(await screen.findByRole('alert')).toHaveTextContent('WhatsApp n’a pas confirmé la déconnexion');
    expect(adminService.disconnectPilotWhatsappQR).toHaveBeenCalledWith('connection-1');
    expect(screen.getByRole('button',{name:'Supprimer le compte'})).toBeEnabled();
  });
  it("keeps every settings section visible and switches sections without a filter menu", async () => {
    const user = userEvent.setup();
    render(<PilotSettingsPage />);

    const labels = [
      "Entreprise",
      "Réseau et équipe",
      "Services",
      "Routes",
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

  it("keeps notification preferences in general settings, not communication settings", async () => {
    render(<PilotSettingsPage scope="communication" />);

    expect(await screen.findByRole("button", { name: "WhatsApp" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Assistant IA" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Réponses" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Notifications" })).not.toBeInTheDocument();
  });

  it("hides parcel network settings from a vehicle-import agency", async () => {
    vi.mocked(adminService.getPilotSettings).mockResolvedValue({
      ...settings,
      organization: { ...settings.organization, organization_type: "VEHICLE_IMPORT" },
      parcel_operations: null,
    });

    render(<PilotSettingsPage />);

    expect(await screen.findByRole("button", { name: "Entreprise" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Réseau et équipe" })).not.toBeInTheDocument();
  });

  it("keeps only knowledge defaults in settings", async () => {
    const user = userEvent.setup();
    render(<PilotSettingsPage />);

    await user.click(await screen.findByRole("button", { name: "Connaissances" }));

    expect(await screen.findByRole("heading", { name: "Valeurs proposées par défaut" })).toBeVisible();
    expect(screen.queryByText("Tarif Kinshasa–Goma")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ajouter une information" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Gérer les connaissances" })).not.toBeInTheDocument();
  });
});
