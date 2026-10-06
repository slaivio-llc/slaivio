import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { AppProviders } from "./app-providers";

const state = vi.hoisted(() => ({ pathname: "/fr", loaded: false, clerk: vi.fn(), privateProvider: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => state.pathname }));
vi.mock("@clerk/nextjs", () => ({
  ClerkProvider: ({ children }: { children: ReactNode }) => { state.clerk(); return children; },
  useAuth: () => ({ isLoaded: state.loaded, isSignedIn: false }),
}));
vi.mock("@/components/permissions/permission-provider", () => ({ PermissionProvider: ({ children }: { children: ReactNode }) => { state.privateProvider(); return children; } }));
vi.mock("@/components/features/feature-provider", () => ({ FeatureProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/components/entitlements/entitlement-provider", () => ({ EntitlementProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/components/offline/pilot-offline-provider", () => ({ PilotOfflineProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/components/ui/api-mutation-feedback", () => ({ ApiMutationFeedback: () => null }));
vi.mock("@/components/ui/slaivio-logo-loader", () => ({ SlaivioLogoLoader: () => <p>Chargement sécurisé</p> }));
vi.mock("@/services/api", () => ({ setAccessTokenProvider: vi.fn() }));
vi.mock("@/services/pilot-offline", () => ({ clearPilotOfflineData: vi.fn() }));

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_mock");
  state.loaded = false;
  state.clerk.mockClear();
  state.privateProvider.mockClear();
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllEnvs(); });

describe("public landing isolation", () => {
  it.each(["/", "/fr", "/en", "/landing", "/fr/pricing"])("renders %s without authentication or private providers", pathname => {
    state.pathname = pathname;
    render(<AppProviders><h1>Accueil public</h1></AppProviders>);
    expect(screen.getByText("Accueil public")).toBeInTheDocument();
    expect(state.clerk).not.toHaveBeenCalled();
    expect(state.privateProvider).not.toHaveBeenCalled();
  });

  it.each(["/app", "/onboarding", "/sign-in"])("does not bypass authentication on %s", pathname => {
    vi.useFakeTimers();
    state.pathname = pathname;
    render(<AppProviders><h1>Contenu protégé</h1></AppProviders>);
    expect(screen.queryByText("Contenu protégé")).not.toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(15000); });
    expect(screen.getByRole("alert")).toHaveTextContent("Connexion temporairement indisponible");
    expect(screen.getByRole("link", { name: "Retour à l’accueil" })).toHaveAttribute("href", "/fr");
    expect(screen.queryByText("Contenu protégé")).not.toBeInTheDocument();
  });
});
