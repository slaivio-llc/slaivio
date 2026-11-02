import {expect,it} from 'vitest';
import {agencyRoleLabel,agencyStatusLabel} from './agency-labels';
import {apiErrorDetail} from './api';
import {agencyNotification} from './notification-center';
import {pilotWhatsappQrErrorMessage} from './organization-admin';

it.each(['pilot_whatsapp_qr_gateway_unavailable','pilot_whatsapp_qr_gateway_unreachable','pilot_whatsapp_qr_gateway_auth_failed','pilot_whatsapp_qr_gateway_start_failed','pilot_whatsapp_qr_gateway_invalid_response','pilot_whatsapp_qr_gateway_request_rejected','pilot_whatsapp_qr_cohort_full','unknown'])('explains WhatsApp failures to agencies without infrastructure jargon: %s',code=>{
 const message=pilotWhatsappQrErrorMessage({response:{data:{detail:code}}});
 expect(message).not.toMatch(/backend|gateway|Railway|Render|API|JSON|SHARED_SECRET|WHATSAPP_QR|cohorte/i);
 expect(message).toMatch(/WhatsApp/);
});
it.each(['Traceback sqlalchemy.exc.IntegrityError SELECT secret FROM organizations','Le gateway ne répond pas, vérifiez le backend et JSON','WHATSAPP_QR_GATEWAY_URL invalid'])('does not show technical server details: %s',detail=>{
 expect(apiErrorDetail({isAxiosError:true,response:{data:{detail}}})).not.toMatch(/backend|gateway|JSON|sqlalchemy|SELECT|Traceback|WHATSAPP_QR/i);
});
it('does not show an arbitrary server error body to an agency',()=>{
 const message=apiErrorDetail({isAxiosError:true,response:{status:500,data:{detail:'private provider details'}}});
 expect(message).toContain('support SLAIVIO');
 expect(message).not.toContain('private');
});

it('translates built-in roles and statuses while preserving custom French names',()=>{
  expect(agencyRoleLabel('OWNER','Owner')).toBe('Propriétaire');
  expect(agencyRoleLabel('MANAGER','Manager')).toBe('Responsable du bureau');
  expect(agencyRoleLabel('WAREHOUSE','Warehouse')).toBe('Agent entrepôt');
  expect(agencyRoleLabel('WAREHOUSE_SUPERVISOR')).toBe('Superviseur entrepôt');
  expect(agencyRoleLabel('RECEIVER')).toBe('Réceptionnaire');
  expect(agencyRoleLabel('WEIGHER')).toBe('Peseur');
  expect(agencyRoleLabel('QUALITY_CONTROLLER')).toBe('Contrôleur qualité');
  expect(agencyRoleLabel('COUNTER_AGENT')).toBe('Agent guichet');
  expect(agencyRoleLabel('CASHIER')).toBe('Caissier');
  expect(agencyRoleLabel('CUSTOM','Chargé des retraits')).toBe('Chargé des retraits');
  expect(agencyRoleLabel('CUSTOM_INTERNAL')).toBe('Rôle personnalisé');
  expect(agencyStatusLabel('PENDING')).toBe('En attente');
});
it('does not expose unknown backend codes in errors',()=>{
  const message=apiErrorDetail({isAxiosError:true,response:{data:{detail:'new_backend_internal_failure'}}});
  expect(message).not.toContain('_');expect(message).toContain('support SLAIVIO');
});
it('handles old provider notification copy without guessing a successful delivery',()=>{
  const item={id:'1',source:'IN_APP' as const,category:'NOTIFICATION_UPDATED',title:'Message fournisseur envoyé',message:'provider_message_sent',priority:'NORMAL',created_at:'2026-10-25'};
  expect(agencyNotification({...item,delivery_status:'FAILED'}).title).toBe('Message client non envoyé');
  expect(agencyNotification(item).title).toBe('Suivi d’un message client');
});
