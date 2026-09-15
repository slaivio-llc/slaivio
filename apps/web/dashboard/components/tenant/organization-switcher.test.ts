import { describe, expect, it } from "vitest";

import { formatOrganizationDisplayName } from "./organization-switcher";

describe("organization display name", () => {
  it("normalizes the organization label without changing the stored name", () => {
    expect(formatOrganizationDisplayName("OTIE CARGO")).toBe("otie cargo's org");
    expect(formatOrganizationDisplayName("  Otie   Cargo  ")).toBe("otie cargo's org");
  });

  it("does not append the suffix twice", () => {
    expect(formatOrganizationDisplayName("otie cargo's org")).toBe("otie cargo's org");
  });
});
