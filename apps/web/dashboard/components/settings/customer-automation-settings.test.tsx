import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {beforeEach,expect,it,vi} from 'vitest';
import type {ReactNode} from 'react';
import {CustomerAutomationSettings} from './customer-automation-settings';
import {api} from '@/services/api';
import {updateSettings,type AdminData} from '@/services/organization-admin';
import {updateQualifiedProspectAutoCreate} from '@/services/inbox';

vi.mock('@/services/api',()=>({api:{get:vi.fn(),post:vi.fn(),put:vi.fn()}}));
vi.mock('@/services/organization-admin',()=>({updateSettings:vi.fn()}));
vi.mock('@/services/inbox',()=>({updateQualifiedProspectAutoCreate:vi.fn()}));
vi.mock('@/components/permissions/permission-guard',()=>({PermissionGuard:({children}:{children:ReactNode})=>children}));

const base='/organization/admin/customer-automation';
const overview={templates:{awaiting_parcel:'Bonjour {client}, nous attendons votre colis.',documents_ready:'Votre facture : {document_url}'},variables:['client','document_url'],expectations:[] as Array<{id:string;client_name:string;reference:string;reminder_count:number}>,failures:[] as Array<{id:string;kind:string;last_error:string}>,package_problems:[],auto_create_qualified:false,document_shares:[]};
const storage={grace_days:3,daily_storage_fee:0,currency:'USD',otp_ttl_minutes:15,max_otp_attempts:5,require_payment:true,require_identity:true,require_signature:true};
const data:AdminData={organization:{row_version:1},settings:{row_version:4,settings:{}},members:[],invitations:[],roles:[],permissions:[],audit:[],workspaces:[],locations:[],integrations:[],numbering:[],billing:null,data_requests:[],api_keys:[]};
const run=vi.fn((action:()=>Promise<unknown>)=>{void action();});
beforeEach(()=>{
 vi.clearAllMocks();
 vi.mocked(api.get).mockImplementation(async(url)=>({data:url==='/pickups/settings'?storage:url===base?overview:{items:[]}}));
 vi.mocked(api.post).mockResolvedValue({data:{}});vi.mocked(api.put).mockResolvedValue({data:{}});
 vi.mocked(updateSettings).mockResolvedValue({});vi.mocked(updateQualifiedProspectAutoCreate).mockResolvedValue({});
});

it('loads actual settings and does not send a customer message just by opening the page',async()=>{
 render(<CustomerAutomationSettings data={data} run={run}/>);
 expect(await screen.findByText('Aucun colis en attente de réception.')).toBeVisible();
 expect(screen.getByLabelText('Tarif journalier')).toHaveValue(0);
 expect(screen.getByLabelText('Créer automatiquement les clients qualifiés')).not.toBeChecked();
 expect(api.post).not.toHaveBeenCalled();expect(api.put).not.toHaveBeenCalled();
});

it('saves timing and editable messages with the organization row version',async()=>{
 render(<CustomerAutomationSettings data={data} run={run}/>);
 const text=await screen.findByLabelText('Message : Attente d’un colis');
 fireEvent.change(text,{target:{value:'Bonjour {client}, votre envoi est-il prêt ?'}});
 fireEvent.change(screen.getByLabelText('Première relance avant réception (jours)'),{target:{value:'5'}});
 fireEvent.click(screen.getByRole('button',{name:'Enregistrer les automatisations'}));
 await waitFor(()=>expect(updateSettings).toHaveBeenCalledWith(expect.objectContaining({expected_version:4,settings:{customer_automation:expect.objectContaining({awaiting_delay_days:5,messages:expect.objectContaining({awaiting_parcel:'Bonjour {client}, votre envoi est-il prêt ?'})})}})));
});

it('stops a waiting reminder through the authenticated cancellation endpoint',async()=>{
 vi.mocked(api.get).mockImplementation(async(url)=>({data:url==='/pickups/settings'?storage:{...overview,expectations:[{id:'expectation',client_name:'Marie Kanku',reference:'Fournisseur Chine',reminder_count:1}]}}));
 render(<CustomerAutomationSettings data={data} run={run}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Clôturer'}));
 await waitFor(()=>expect(api.post).toHaveBeenCalledWith(`${base}/expectations/expectation/cancel`,undefined));
});

it('shows actionable invoice errors instead of an internal code',async()=>{
 vi.mocked(api.get).mockImplementation(async(url)=>({data:url==='/pickups/settings'?storage:{...overview,failures:[{id:'event',kind:'documents_ready',last_error:'customer_invoice_required'}]}}));
 render(<CustomerAutomationSettings data={data} run={run}/>);
 expect(await screen.findByText('Créez et émettez la facture du colis avant de relancer.')).toBeVisible();
 expect(screen.queryByText('customer_invoice_required')).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Réessayer'}));
 await waitFor(()=>expect(api.post).toHaveBeenCalledWith(`${base}/events/event/retry`,undefined));
});

it('uses the existing permission-checked AI control rather than assuming auto creation is active',async()=>{
 render(<CustomerAutomationSettings data={data} run={run}/>);
 fireEvent.click(await screen.findByLabelText('Créer automatiquement les clients qualifiés'));
 await waitFor(()=>expect(updateQualifiedProspectAutoCreate).toHaveBeenCalledWith(true));
});

it('saves storage settings without weakening identity or payment requirements',async()=>{
 render(<CustomerAutomationSettings data={data} run={run}/>);
 fireEvent.change(await screen.findByLabelText('Tarif journalier'),{target:{value:'2.50'}});
 fireEvent.click(screen.getByRole('button',{name:'Enregistrer les frais de garde'}));
 await waitFor(()=>expect(api.put).toHaveBeenCalledWith('/pickups/settings',{...storage,daily_storage_fee:2.5}));
 expect(await screen.findByText('Paramètres enregistrés pour les prochains colis disponibles au retrait.')).toBeVisible();
});
