import { expect, it } from "vitest";
import { apiErrorDetail } from "./api";

it.each([
  "invitation_delivery_failed", "invitation_already_pending", "invitation_member_limit_reached",
  "invitation_organization_not_found", "invitation_provider_configuration_invalid",
])("translates %s before displaying a global action error", detail => {
  const message = apiErrorDetail({ isAxiosError: true, response: { data: { detail } } });
  expect(message).not.toContain(detail);
  expect(message).not.toContain("_");
  expect(message.length).toBeGreaterThan(20);
});
