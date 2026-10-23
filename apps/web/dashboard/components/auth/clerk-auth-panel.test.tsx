import { render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ClerkAuthPanel } from "./clerk-auth-panel";

const clerk = vi.hoisted(() => ({ signUp: vi.fn(), signIn: vi.fn() }));
vi.mock("@clerk/nextjs", () => ({
  useUser: () => ({ isLoaded: true, isSignedIn: false }),
  SignUp: (props: Record<string, unknown>) => { clerk.signUp(props); return null; },
  SignIn: (props: Record<string, unknown>) => { clerk.signIn(props); return null; },
}));

beforeEach(() => vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_mock"));
afterEach(() => vi.unstubAllEnvs());

it("keeps onboarding as a fallback without overriding invitation destinations", () => {
  render(<ClerkAuthPanel mode="sign-up"/>);
  expect(clerk.signUp).toHaveBeenCalledWith(expect.objectContaining({ fallbackRedirectUrl: "/onboarding" }));
  expect(clerk.signUp.mock.lastCall?.[0]).not.toHaveProperty("forceRedirectUrl");
});
