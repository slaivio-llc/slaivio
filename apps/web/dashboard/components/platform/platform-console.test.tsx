import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { PlatformRegister } from './platform-register';
import { PlatformAgencySheet } from './platform-agency-sheet';
import { PlatformSupportSheet } from './platform-support-sheet';
import { PlatformOperators } from './platform-operators';
import { PlatformBilling } from './platform-billing';
import { PlatformOperations } from './platform-operations';
import { platformRegister, platformAgency, platformPlans, platformReply, platformTicketDetail, platformOperators, savePlatformOperator, platformOperations, changeAgencyStatus, platformCapacity } from '@/services/platform-admin';

vi.mock('@/services/platform-admin',()=>({platformRegister:vi.fn(),platformAgency:vi.fn(),platformPlans:vi.fn(),platformReply:vi.fn(),platformTicketDetail:vi.fn(),platformOperators:vi.fn(),savePlatformOperator:vi.fn(),platformOperations:vi.fn(),changeAgencyStatus:vi.fn(),changeSubscription:vi.fn(),addPlatformNote:vi.fn(),platformCapacity:vi.fn()}));
vi.mock('next/navigation',()=>({usePathname:()=>'/app/platform'}));
vi.mock('@/services/tenant',()=>({getTenantContext:()=>Promise.resolve({active_tenant:{organization_type:'PARCEL_FREIGHT'}})}));
const agency={organization:{id:'org',name:'Cargo Express',status:'ACTIVE',row_version:3},subscription:{status:'TRIAL',row_version:4,plan_code:'STARTER'},members:[{id:'member',member_email:'awa@example.test',status:'ACTIVE'}],notes:[],invoices:[],spaces:[{id:'office',name:'Guangzhou',agency_type:'WAREHOUSE',status:'ACTIVE'}]};
beforeEach(()=>{
 vi.resetAllMocks();
 vi.mocked(platformRegister).mockResolvedValue({items:[],total:0,page:1,page_size:25,total_pages:1});
 vi.mocked(platformAgency).mockResolvedValue(agency);
 vi.mocked(platformPlans).mockResolvedValue([{id:'plan',code:'STARTER',name:'Starter',active:true,monthly_price_minor:11900,currency_code:'USD',limits:{max_users:3,max_monthly_packages:500}}]);
 vi.mocked(platformCapacity).mockResolvedValue({limits:{max_monthly_packages:500},usage:{max_monthly_packages:42},transition_active:false,enforce_from:null,period_ends_at:'2026-11-01T00:00:00Z',timezone:'UTC'});
 vi.mocked(platformOperators).mockResolvedValue([{user_id:'user_self',permissions:['platform.admin.read','platform.permissions.manage']},{user_id:'user_other',permissions:['platform.admin.read']}]);
 vi.mocked(savePlatformOperator).mockResolvedValue({});
 vi.mocked(platformTicketDetail).mockResolvedValue({ticket:{id:'ticket',ticket_reference:'SUP-001',agency:'Cargo Express',subject:'Connexion WhatsApp',description:'Le numéro ne se connecte pas.',status:'OPEN',priority:'URGENT',platform_row_version:7},messages:[{id:'message',author_type:'CUSTOMER',author_name:'Awa',message:'Voici les précisions demandées.',created_at:'2026-10-28T10:00:00Z'}]});
 vi.mocked(platformReply).mockResolvedValue({});
});

it('searches the bounded register on the server and translates states',async()=>{
 vi.mocked(platformRegister).mockResolvedValue({items:[{id:'org',name:'Cargo Express',status:'ACTIVE',subscription_status:'TRIAL'}],total:1,page:1,page_size:25,total_pages:1});
 const open=vi.fn();render(<PlatformRegister kind="agencies" onOpen={open}/>);
 expect(await screen.findByText('Essai gratuit')).toBeInTheDocument();
 expect(screen.queryByText('TRIAL')).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Ouvrir Cargo Express'}));expect(open).toHaveBeenCalledWith(expect.objectContaining({id:'org'}));
 fireEvent.change(screen.getByLabelText('Rechercher dans Agences'),{target:{value:'Burkina'}});
 fireEvent.change(screen.getByLabelText('Filtrer Agences'),{target:{value:'SUSPENDED'}});
 await waitFor(()=>expect(platformRegister).toHaveBeenLastCalledWith('agencies',{q:'Burkina',status:'SUSPENDED',page:1},expect.any(AbortSignal)));
});

it('shows an error instead of claiming the register is empty',async()=>{
 vi.mocked(platformRegister).mockRejectedValue(new Error('offline'));
 render(<PlatformRegister kind="invoices"/>);
 expect(await screen.findByRole('alert')).toHaveTextContent('Impossible de charger');
 expect(screen.queryByText('Aucun résultat pour cette recherche.')).not.toBeInTheDocument();
});

it('keeps a read-only agency dossier free of mutation and billing controls',async()=>{
 render(<PlatformAgencySheet id="org" granted={['platform.admin.read']} close={vi.fn()} saved={vi.fn()}/>);
 expect(await screen.findByText('awa@example.test')).toBeInTheDocument();
 expect(screen.getByText('Guangzhou')).toBeInTheDocument();
 expect(screen.queryByText('Mettre à jour l’accès')).not.toBeInTheDocument();
 expect(screen.queryByText('Enregistrer la correction')).not.toBeInTheDocument();
 expect(screen.queryByRole('textbox',{name:'Note interne'})).not.toBeInTheDocument();
 expect(platformPlans).not.toHaveBeenCalled();expect(platformCapacity).not.toHaveBeenCalled();
});

it('uses actual capacity data for the selected agency',async()=>{
 render(<PlatformAgencySheet id="org" granted={['platform.admin.read','platform.billing.manage']} close={vi.fn()} saved={vi.fn()}/>);
 expect(await screen.findByText('42 / 500')).toBeInTheDocument();
 expect(platformCapacity).toHaveBeenCalledWith('org');
 expect(screen.getByLabelText('colis par mois')).toHaveAttribute('value','42');
});

it('preserves agency input when a version conflict prevents saving',async()=>{
 vi.mocked(changeAgencyStatus).mockRejectedValue({isAxiosError:true,response:{status:409}});
 render(<PlatformAgencySheet id="org" granted={['platform.admin.read','platform.agencies.manage']} close={vi.fn()} saved={vi.fn()}/>);
 await screen.findByText('Mettre à jour l’accès');
 fireEvent.change(screen.getByLabelText('Motif'),{target:{value:'Vérification du compte'}});
 fireEvent.click(screen.getByLabelText('Je confirme cette modification d’accès.'));
 fireEvent.click(screen.getByRole('button',{name:'Mettre à jour l’accès'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('modifiée');
 expect(screen.getByLabelText('Motif')).toHaveValue('Vérification du compte');
 expect(changeAgencyStatus).toHaveBeenCalledWith('org',{status:'ACTIVE',reason:'Vérification du compte',expected_version:3});
});

it('shows the support conversation before submitting a versioned reply',async()=>{
 const saved=vi.fn();render(<PlatformSupportSheet id="ticket" close={vi.fn()} saved={saved}/>);
 expect(await screen.findByText('Voici les précisions demandées.')).toBeInTheDocument();
 expect(screen.getByText('Le numéro ne se connecte pas.')).toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('Réponse'),{target:{value:'Bonjour, nous vérifions votre connexion.'}});
 fireEvent.click(screen.getByRole('button',{name:'Envoyer la réponse'}));
 await waitFor(()=>expect(platformReply).toHaveBeenCalledWith('ticket',{message:'Bonjour, nous vérifions votre connexion.',status:'IN_PROGRESS',expected_version:7}));
 expect(await screen.findByRole('status')).toHaveTextContent('Réponse enregistrée');expect(saved).toHaveBeenCalledOnce();
});

it('allows revocation with an exact permission snapshot and protects the current account',async()=>{
 render(<PlatformOperators currentUser="user_self" revision={0} saved={vi.fn()}/>);
 const own=await screen.findByText('user_self · Votre compte');
 expect(within(own.closest('li')!).getByRole('button',{name:'Gérer les accès'})).toBeDisabled();
 const other=screen.getByText('user_other');fireEvent.click(within(other.closest('li')!).getByRole('button',{name:'Gérer les accès'}));
 fireEvent.click(screen.getByLabelText('Consulter la console et les agences'));
 fireEvent.change(screen.getByLabelText('Motif'),{target:{value:'Fin de la mission support'}});
 fireEvent.click(screen.getByLabelText('Je confirme avoir vérifié le compte et les droits sélectionnés.'));
 fireEvent.click(screen.getByRole('button',{name:'Révoquer les accès'}));
 await waitFor(()=>expect(savePlatformOperator).toHaveBeenCalledWith('user_other',[],['platform.admin.read'],'Fin de la mission support'));
 expect(await screen.findByRole('status')).toHaveTextContent('révoqués');
});

it('renders actual catalog limits without inventing an editable price control',async()=>{
 render(<PlatformBilling revision={0} openAgency={vi.fn()}/>);
 fireEvent.click(screen.getByRole('button',{name:'Forfaits et limites'}));
 expect(await screen.findByText('500 colis par mois')).toBeInTheDocument();
 expect(screen.getByText('3 membres')).toBeInTheDocument();
 expect(screen.queryByRole('button',{name:/Modifier le prix/})).not.toBeInTheDocument();
});

it('shows measured backlog counts without claiming provider availability',async()=>{
 vi.mocked(platformOperations).mockResolvedValue({notifications:[{status:'FAILED',count:2,oldest_at:'2026-10-01'}],automations:[{status:'PENDING',count:3,oldest_at:'2026-10-02'}],overdue_automations:1});
 render(<PlatformOperations revision={0}/>);
 expect(await screen.findByText('Échec')).toBeInTheDocument();
 expect(screen.getByText('Automatisations en attente prolongée')).toBeInTheDocument();
 expect(screen.queryByText('Opérationnelle')).not.toBeInTheDocument();
});
