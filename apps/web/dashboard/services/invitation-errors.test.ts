import { expect, it } from "vitest";
import { api, apiErrorDetail, API_MUTATION_FAILED_EVENT } from "./api";
import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { invitationErrorMessages } from './invitation-errors';

it.each([
  "invitation_delivery_failed", "invitation_already_pending", "invitation_member_limit_reached",
  "invitation_organization_not_found", "invitation_provider_configuration_invalid",
  "clerk_organization_slugs_disabled",
  "role_exceeds_your_permissions", "invitation_office_scope_exceeds_yours",
  "system_role_is_protected", "finance_office_selection_required",
  "staff_role_not_available",
])("translates %s before displaying a global action error", detail => {
  const message = apiErrorDetail({ isAxiosError: true, response: { data: { detail } } });
  expect(message).not.toContain(detail);
  expect(message).not.toContain("_");
  expect(message.length).toBeGreaterThan(20);
});

it('shows an actionable invitation error without a technical conflict prefix',async()=>{
  let message='';
  const handler=(event:Event)=>{message=(event as CustomEvent).detail.message;};
  window.addEventListener(API_MUTATION_FAILED_EVENT,handler);
  try{
    const adapter=async(config:InternalAxiosRequestConfig)=>{
      throw new AxiosError('Conflict','ERR_BAD_REQUEST',config,undefined,{
        status:409,statusText:'Conflict',headers:{},config,
        data:{detail:'invitation_organization_not_found'},
      });
    };
    await expect(api.post('/organization/invitations',{email:'staff@example.com',role_code:'OPERATOR'},{adapter})).rejects.toThrow();
    expect(message).toBe(invitationErrorMessages.invitation_organization_not_found);
    expect(message).not.toMatch(/conflit|Clerk|backend|reliée/);
  }finally{
    window.removeEventListener(API_MUTATION_FAILED_EVENT,handler);
  }
});
