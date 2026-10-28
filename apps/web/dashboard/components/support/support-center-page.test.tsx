import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { SupportCenterPage } from './support-center-page';
import { addTicketMessage, getTicket, listTickets, uploadTicketAttachment } from '@/services/support';

vi.mock('@/services/support', () => ({
  listArticles: vi.fn().mockResolvedValue([]), listTickets: vi.fn(), getTicket: vi.fn(),
  addTicketMessage: vi.fn(), uploadTicketAttachment: vi.fn(),
  createTicket: vi.fn(), ticketAttachmentUrl: vi.fn(), transitionTicket: vi.fn(),
}));
vi.mock('@/services/tenant', () => ({getTenantContext: () => Promise.resolve({active_tenant:{organization_type:'PARCEL_FREIGHT'}})}));
vi.mock('@/components/permissions/permission-guard', () => ({PermissionGuard:({children}:{children:ReactNode})=>children}));
const ticket={id:'ticket',ticket_reference:'SUP-001',subject:'Suivi du colis',description:'Question sur le suivi',category:'OPERATIONS',priority:'HIGH',status:'WAITING_CUSTOMER',first_response_overdue:false,resolution_overdue:false,message_count:1,row_version:1,updated_at:'2026-10-24T12:00:00Z'};
beforeEach(()=>{
  vi.clearAllMocks();
  window.history.replaceState({},'', '/app/support?view=tickets');
  vi.mocked(listTickets).mockResolvedValue([ticket]);
  vi.mocked(getTicket).mockResolvedValue({ticket,messages:[],attachments:[],events:[]});
  vi.mocked(addTicketMessage).mockResolvedValue({});
  vi.mocked(uploadTicketAttachment).mockResolvedValue({});
});
async function open(){
  render(<SupportCenterPage/>);
  fireEvent.click(await screen.findByRole('button',{name:'Voir SUP-001'}));
  return screen.findByRole('dialog',{name:'Suivi du colis'});
}
it('shows understandable status and priority in the ticket sheet',async()=>{
  const dialog=await open();
  expect(dialog).toHaveTextContent('Votre réponse est attendue');
  expect(dialog).toHaveTextContent('Priorité haute');
  expect(dialog).not.toHaveTextContent('WAITING_CUSTOMER');
});
it('clears a sent message after the async response without a false failure',async()=>{
  const dialog=await open();
  const field=within(dialog).getByPlaceholderText('Ajouter une réponse...');
  fireEvent.change(field,{target:{value:'Voici les précisions demandées.'}});
  fireEvent.submit(field.closest('form')!);
  await waitFor(()=>expect(getTicket).toHaveBeenCalledTimes(2));
  expect(addTicketMessage).toHaveBeenCalledWith('ticket','Voici les précisions demandées.');
  expect(field).toHaveValue('');
  expect(within(dialog).queryByText('Message non envoyé.')).not.toBeInTheDocument();
});
it('keeps the message draft if sending fails',async()=>{
  vi.mocked(addTicketMessage).mockRejectedValueOnce(new Error('offline'));
  const dialog=await open();
  const field=within(dialog).getByPlaceholderText('Ajouter une réponse...');
  fireEvent.change(field,{target:{value:'Mon message à conserver'}});
  fireEvent.submit(field.closest('form')!);
  expect(await within(dialog).findByText('Message non envoyé.')).toBeInTheDocument();
  expect(field).toHaveValue('Mon message à conserver');
});
it('resets the file input safely after an attachment is uploaded',async()=>{
  const dialog=await open();
  const input=dialog.querySelector<HTMLInputElement>('input[type="file"]')!;
  const file=new File(['image'],'colis.png',{type:'image/png'});
  fireEvent.change(input,{target:{files:[file]}});
  await waitFor(()=>expect(uploadTicketAttachment).toHaveBeenCalledWith('ticket',file));
  await waitFor(()=>expect(getTicket).toHaveBeenCalledTimes(2));
  expect(input.value).toBe('');
});
