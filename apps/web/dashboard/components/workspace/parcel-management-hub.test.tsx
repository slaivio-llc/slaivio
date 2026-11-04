import {render,screen,within} from '@testing-library/react';
import {beforeEach,expect,it,vi} from 'vitest';
import {ParcelManagementHub} from './parcel-management-hub';
import {getAdmin,type AdminData} from '@/services/organization-admin';
import {getNetworkLocations} from '@/services/organization-network';

vi.mock('@/services/organization-admin',()=>({getAdmin:vi.fn()}));
vi.mock('@/services/organization-network',()=>({getNetworkLocations:vi.fn()}));
vi.mock('@/components/settings/organization-transport-settings',()=>({OrganizationTransportSettings:()=>null}));
vi.mock('@/components/pricing/pricing-engine-page',()=>({PricingManagementSection:()=>null}));

beforeEach(()=>{
  vi.mocked(getAdmin).mockResolvedValue({organization:{id:'root',row_version:1},members:[],locations:[{id:'old-root-location',location_type:'OFFICE'}]} as unknown as AdminData);
  vi.mocked(getNetworkLocations).mockResolvedValue([
    {id:'root',org_id:'root',name:'Kinshasa',location_type:'OFFICE',status:'ACTIVE'},
    {id:'branch',org_id:'branch',name:'Lubumbashi',location_type:'OFFICE',status:'ACTIVE'},
    {id:'warehouse',org_id:'depot',name:'Dépôt Chine',location_type:'WAREHOUSE',status:'ACTIVE'},
  ]);
});

it('counts and lists two network offices and a warehouse instead of the active office only',async()=>{
  render(<ParcelManagementHub/>);
  expect(await screen.findByText('Dépôt Chine')).toBeInTheDocument();
  expect(screen.getByText('Lubumbashi')).toBeInTheDocument();
  const offices=screen.getAllByText('Bureaux').find(node=>node.tagName==='P')!;
  expect(within(offices.parentElement!).getByText('2')).toBeInTheDocument();
  const warehouses=screen.getAllByText('Entrepôts').find(node=>node.tagName==='P')!;
  expect(within(warehouses.parentElement!).getByText('1')).toBeInTheDocument();
});

it('shows an unavailable state instead of misleading local totals when network loading fails',async()=>{
  vi.mocked(getNetworkLocations).mockRejectedValue(new Error('offline'));
  render(<ParcelManagementHub/>);
  expect(await screen.findByText('Gestion indisponible')).toBeInTheDocument();
  expect(screen.queryByText('Aucun entrepôt n’est configuré.')).not.toBeInTheDocument();
});
