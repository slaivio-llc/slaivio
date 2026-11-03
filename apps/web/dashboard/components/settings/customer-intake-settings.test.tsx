import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {CustomerIntakeRequests} from './customer-intake-settings';

const state=vi.hoisted(()=>({allowed:true,get:vi.fn()}));
vi.mock('@/hooks/usePermission',()=>({usePermission:()=>({allowed:state.allowed,loading:false})}));
vi.mock('@/services/api',()=>({api:{get:state.get},apiErrorDetail:()=>''}));
vi.mock('@/components/i18n/dashboard-language',()=>({useDashboardLocale:()=> 'fr'}));
beforeEach(()=>{state.allowed=true;state.get.mockReset();});
afterEach(cleanup);

it('does not load agency-wide requests for a member without settings access',()=>{
 state.allowed=false;render(<CustomerIntakeRequests/>);
 expect(screen.queryByRole('button')).not.toBeInTheDocument();
 expect(state.get).not.toHaveBeenCalled();
});
it('loads on demand and links to the canonical client profile',async()=>{
 state.get.mockResolvedValue({data:{items:[{id:'r',reference:'PRE-ONE',client_id:'client-one',status:'EXPECTED',declared_profile:{full_name:'Alice Client',city:'Kinshasa',country:'CD',package_count:2,contact_phone:'+442079460018'},receipt:{service_name:'Fret Chine',route_name:'Chine → Congo'}}]}});
 render(<CustomerIntakeRequests/>);
 expect(state.get).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Envois annoncés depuis WhatsApp'}));
 expect(await screen.findByRole('link',{name:'Alice Client'})).toHaveAttribute('href','/app/clients?open=client-one');
 expect(screen.getByText(/Contact déclaré \(à vérifier\)/)).toHaveTextContent('+442079460018');
 expect(state.get).toHaveBeenCalledWith('/organization/customer-intake/requests');
});
