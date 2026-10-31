import {expect,it} from 'vitest';
import {agencyRoleLabel,agencyStatusLabel} from './agency-labels';
import {apiErrorDetail} from './api';
import {agencyNotification} from './notification-center';

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
