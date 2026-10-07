import { cleanup, render, screen, waitFor, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CargoDashboard } from './cargo-dashboard';

const mocks=vi.hoisted(()=>({get:vi.fn(),replace:vi.fn(),query:''}));
vi.mock('next/navigation',()=>({useRouter:()=>({replace:mocks.replace}),usePathname:()=>'/app',useSearchParams:()=>new URLSearchParams(mocks.query)}));
vi.mock('@/components/permissions/permission-provider',()=>({usePermissions:()=>({permissions:['packages.read']})}));
vi.mock('@/components/i18n/dashboard-language',()=>({useDashboardLocale:()=> 'en'}));
vi.mock('@/services/cargo-dashboard',()=>({getCargoDashboard:(...args:unknown[])=>mocks.get(...args)}));
const data={workspace:{id:'a',name:'Agency',country:'CD',city:'Kinshasa'},scope:'office',office_count:1,
  generated_at:'2026-10-07T12:00:00Z',period:{timezone:'UTC',current:{start:'2026-10-01',end:'2026-10-07'},previous:null},
  flows:{received:3,shipped:2,delivered:1},previous_flows:null,
  states:{in_transit:4,warehoused:5,ready_for_pickup:6,blocked:0},attention:[],recent:[],destinations:[]};
beforeEach(()=>{mocks.get.mockReset();mocks.replace.mockReset();mocks.query='';});
afterEach(cleanup);
describe('cargo overview',()=>{
  it('opens a KPI with its metric in the URL without losing the period',async()=>{
    mocks.query='preset=7d&comparison=none';mocks.get.mockResolvedValue(data);render(<CargoDashboard/>);
    await screen.findByText('Period flows');
    fireEvent.click(screen.getByRole('button',{name:/Parcels received/}));
    expect(mocks.replace).toHaveBeenCalledWith('/app?preset=7d&comparison=none&metric=received&page=1',{scroll:false});
  });
  it('selects only one KPI and exposes the paginated matching parcels',async()=>{
    mocks.query='metric=blocked&page=1';mocks.get.mockResolvedValue({...data,drilldown:{metric:'blocked',page:1,page_size:25,total:30,items:[]}});render(<CargoDashboard/>);
    await screen.findByText('Period flows');
    expect(screen.getAllByRole('button',{pressed:true})).toHaveLength(1);
    expect(screen.getByRole('region',{name:'Parcels matching selected metric'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Next'}));
    expect(mocks.replace).toHaveBeenCalledWith('/app?metric=blocked&page=2',{scroll:false});
  });
  it('separates flows from current state and shows the reporting timezone',async()=>{
    mocks.get.mockResolvedValue(data);render(<CargoDashboard/>);
    expect(await screen.findByText('Period flows')).toBeInTheDocument();
    expect(screen.getByText('Current state')).toBeInTheDocument();
    expect(screen.getByText('Independent of the selected period')).toBeInTheDocument();
    expect(screen.getAllByRole('status').some(element=>element.textContent?.includes('UTC'))).toBe(true);
    expect(screen.queryByLabelText('Scope')).not.toBeInTheDocument();
  });
  it('does not replace a failed request with zero metrics',async()=>{
    mocks.get.mockRejectedValue(new Error('unavailable'));render(<CargoDashboard/>);
    expect(await screen.findByRole('alert')).toHaveTextContent('Data unavailable');
    expect(screen.queryByText('Period flows')).not.toBeInTheDocument();
  });
  it('applies custom dates to the URL only on submit',async()=>{
    mocks.get.mockResolvedValue(data);render(<CargoDashboard/>);
    await screen.findByText('Period flows');
    fireEvent.change(screen.getByLabelText('Period'),{target:{value:'custom'}});
    fireEvent.change(screen.getByLabelText('From'),{target:{value:'2026-09-01'}});
    fireEvent.change(screen.getByLabelText('To'),{target:{value:'2026-09-30'}});
    expect(mocks.replace).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'Apply'}));
    expect(mocks.replace).toHaveBeenCalledWith('/app?preset=custom&comparison=previous&start=2026-09-01&end=2026-09-30',{scroll:false});
  });
  it('aborts the request when leaving the page',async()=>{
    mocks.get.mockResolvedValue(data);const view=render(<CargoDashboard/>);
    await waitFor(()=>expect(mocks.get).toHaveBeenCalled());
    const signal=mocks.get.mock.calls[0][1];view.unmount();expect(signal.aborted).toBe(true);
  });
});
