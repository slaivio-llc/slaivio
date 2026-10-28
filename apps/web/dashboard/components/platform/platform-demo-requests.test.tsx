import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { PlatformAdminPage } from './platform-admin-page';
import { PlatformDemoRequests } from './platform-demo-requests';
import { PlatformAdminEntry } from './platform-admin-entry';
import { platformAccess, platformAccessDetails, platformAgencies, platformOverview, platformTickets, platformDemoRequests, platformDemoRequest, updatePlatformDemoRequest, type DemoDetail, type DemoRequest, type PlatformMetrics } from '@/services/platform-admin';

vi.mock('@/services/platform-admin',async original=>({...await original<typeof import('@/services/platform-admin')>(),platformAccess:vi.fn(),platformAccessDetails:vi.fn(),platformOverview:vi.fn(),platformAgencies:vi.fn(),platformTickets:vi.fn(),platformDemoRequests:vi.fn(),platformDemoRequest:vi.fn(),updatePlatformDemoRequest:vi.fn()}));
vi.mock('@/services/tenant',()=>({getTenantContext:()=>Promise.resolve({active_tenant:{organization_type:'PARCEL_FREIGHT'}})}));
vi.mock('next/navigation',()=>({usePathname:()=>'/app/platform'}));

const item:DemoRequest={id:'lead',full_name:'Awa Sossou',email:'awa@example.com',agency_name:'Cargo Express',country:'Bénin',phone:'+2290197123456',message:'Nous souhaitons découvrir le suivi des colis.',monthly_shipments:null,status:'NEW',source:'landing',created_at:'2026-10-28T10:00:00Z',updated_at:'2026-10-28T10:00:00.123456Z'};
const detail:DemoDetail={request:item,history:[]};
const metrics:PlatformMetrics={agencies:4,active_agencies:3,active_offices:8,active_users:12,trials:2,paid_subscriptions:1,open_tickets:2,urgent_tickets:0,quarantined_events:0,demo_requests:4,new_demo_requests:2,demos_last_30_days:3,packages_month:25,shipments_month:4,demo_statuses:[{status:'NEW',count:2},{status:'CONTACTED',count:2}],revenues_by_currency:[{currency_code:'USD',collected_minor:11900,month_collected_minor:11900},{currency_code:'XOF',collected_minor:50000,month_collected_minor:50000}],plan_distribution:[{code:'PRO',name:'Pro',count:1}]};

beforeEach(()=>{
  vi.resetAllMocks();
  vi.mocked(platformAccess).mockResolvedValue(false);
  vi.mocked(platformAccessDetails).mockResolvedValue({allowed:true,permissions:['platform.admin.read','platform.agencies.manage']});
  vi.mocked(platformOverview).mockResolvedValue(metrics);
  vi.mocked(platformAgencies).mockResolvedValue([]);
  vi.mocked(platformTickets).mockResolvedValue([]);
  vi.mocked(platformDemoRequests).mockResolvedValue({items:[item],total:1,page:1,page_size:25,total_pages:1});
  vi.mocked(platformDemoRequest).mockResolvedValue(detail);
  vi.mocked(updatePlatformDemoRequest).mockResolvedValue({...item,status:'CONTACTED',updated_at:'2026-10-28T11:00:00.123456Z'});
});

it('shows real business figures without claiming unmeasured service health or mixing currencies',async()=>{
  render(<PlatformAdminPage/>);
  await screen.findByRole('heading',{name:'Super Admin'});
  expect(screen.getByText('Colis enregistrés').nextElementSibling).toHaveTextContent('25');
  expect(screen.getByText(/USD · Total enregistré/)).toBeInTheDocument();
  expect(screen.getByText(/XOF · Total enregistré/)).toBeInTheDocument();
  expect(screen.getByText(/XOF · Total enregistré/).nextElementSibling?.textContent).toBe(new Intl.NumberFormat('fr-FR',{style:'currency',currency:'XOF'}).format(500));
  expect(screen.queryByText('Opérationnelle')).not.toBeInTheDocument();
  expect(platformTickets).not.toHaveBeenCalled();
  expect(platformAgencies).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Voir les demandes de démo'}));
  expect(await screen.findByRole('button',{name:'Ouvrir la demande de Awa Sossou'})).toBeInTheDocument();
});

it('does not disclose data when platform access is denied',async()=>{
  vi.mocked(platformAccessDetails).mockRejectedValueOnce({isAxiosError:true,response:{status:403}});
  render(<PlatformAdminPage/>);
  expect(await screen.findByText(/opérateurs internes SLAIVIO explicitement autorisés/)).toBeInTheDocument();
  expect(platformOverview).not.toHaveBeenCalled();
  expect(platformDemoRequests).not.toHaveBeenCalled();
});

it('shows filters, opens a real request and saves the exact timestamp and note',async()=>{
  const saved=vi.fn();
  render(<PlatformDemoRequests canManage onSaved={saved}/>);
  fireEvent.click(await screen.findByRole('button',{name:'Ouvrir la demande de Awa Sossou'}));
  const dialog=await screen.findByRole('dialog',{name:'Demande de Awa Sossou'});
  expect(within(dialog).getByRole('link',{name:'awa@example.com'})).toHaveAttribute('href','mailto:awa%40example.com');
  expect(dialog).toHaveTextContent('Nous souhaitons découvrir le suivi des colis.');
  fireEvent.change(within(dialog).getByLabelText('Statut'),{target:{value:'CONTACTED'}});
  fireEvent.change(within(dialog).getByLabelText('Note interne'),{target:{value:' Appel effectué, démonstration demain. '}});
  fireEvent.click(within(dialog).getByRole('button',{name:'Enregistrer le suivi'}));
  await waitFor(()=>expect(updatePlatformDemoRequest).toHaveBeenCalledWith('lead',{status:'CONTACTED',expected_updated_at:'2026-10-28T10:00:00.123456Z',note:'Appel effectué, démonstration demain.'}));
  expect(await within(dialog).findByRole('status')).toHaveTextContent('Suivi enregistré.');
  expect(saved).toHaveBeenCalledOnce();
});

it('preserves the note and allows reloading after a conflict instead of reporting success',async()=>{
  vi.mocked(updatePlatformDemoRequest).mockRejectedValueOnce({isAxiosError:true,response:{status:409}});
  render(<PlatformDemoRequests canManage onSaved={vi.fn()}/>);
  fireEvent.click(await screen.findByRole('button',{name:'Ouvrir la demande de Awa Sossou'}));
  const dialog=await screen.findByRole('dialog');
  fireEvent.change(within(dialog).getByLabelText('Note interne'),{target:{value:'Mon échange à conserver'}});
  fireEvent.click(within(dialog).getByRole('button',{name:'Enregistrer le suivi'}));
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('modifiée par un autre membre');
  expect(within(dialog).getByLabelText('Note interne')).toHaveValue('Mon échange à conserver');
  expect(within(dialog).queryByText('Suivi enregistré.')).not.toBeInTheDocument();
  vi.mocked(platformDemoRequest).mockResolvedValue({...detail,request:{...item,updated_at:'2026-10-28T12:00:00Z'}});
  fireEvent.click(within(dialog).getByRole('button',{name:'Recharger la demande'}));
  await waitFor(()=>expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument());
  expect(within(dialog).getByLabelText('Note interne')).toHaveValue('Mon échange à conserver');
});

it('allows consultation without presenting mutation actions to a read-only operator',async()=>{
  render(<PlatformDemoRequests canManage={false} onSaved={vi.fn()}/>);
  fireEvent.click(await screen.findByRole('button',{name:'Ouvrir la demande de Awa Sossou'}));
  const dialog=await screen.findByRole('dialog');
  expect(dialog).toHaveTextContent('Consultation seule');
  expect(within(dialog).queryByRole('button',{name:'Enregistrer le suivi'})).not.toBeInTheDocument();
  expect(updatePlatformDemoRequest).not.toHaveBeenCalled();
});

it('does not disguise a request failure as an empty register',async()=>{
  vi.mocked(platformDemoRequests).mockRejectedValueOnce(new Error('offline'));
  render(<PlatformDemoRequests canManage onSaved={vi.fn()}/>);
  expect(await screen.findByRole('alert')).toHaveTextContent('Impossible de charger');
  expect(screen.queryByText('Aucune demande de démo reçue pour le moment.')).not.toBeInTheDocument();
});

it('uses server-side search and resets to the first page when the status changes',async()=>{
  render(<PlatformDemoRequests canManage onSaved={vi.fn()}/>);
  await screen.findByRole('button',{name:'Ouvrir la demande de Awa Sossou'});
  fireEvent.change(screen.getByLabelText('Rechercher une demande de démo'),{target:{value:'Congo'}});
  fireEvent.change(screen.getByLabelText('Statut des demandes'),{target:{value:'SCHEDULED'}});
  await waitFor(()=>expect(platformDemoRequests).toHaveBeenLastCalledWith({q:'Congo',status:'SCHEDULED',page:1},expect.any(AbortSignal)));
});

it('only exposes the Super Admin entry after an explicit platform access response',async()=>{
  vi.mocked(platformAccess).mockResolvedValueOnce(true);
  const close=vi.fn();render(<PlatformAdminEntry close={close}/>);
  const link=await screen.findByRole('link',{name:'Super Admin SLAIVIO'});
  expect(link).toHaveAttribute('href','/app/platform');
  link.addEventListener('click',event=>event.preventDefault());
  fireEvent.click(link);expect(close).toHaveBeenCalledOnce();
});

it('keeps the Super Admin entry hidden when access checking fails',async()=>{
  vi.mocked(platformAccess).mockRejectedValueOnce(new Error('offline'));
  render(<PlatformAdminEntry close={vi.fn()}/>);
  await waitFor(()=>expect(platformAccess).toHaveBeenCalledOnce());
  expect(screen.queryByRole('link',{name:'Super Admin SLAIVIO'})).not.toBeInTheDocument();
});
