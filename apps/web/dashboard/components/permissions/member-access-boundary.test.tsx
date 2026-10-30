import {render,screen,fireEvent} from '@testing-library/react';
import {beforeEach,describe,it,expect,vi} from 'vitest';
import {MemberAccessBoundary} from './member-access-boundary';

const state=vi.hoisted(()=>({path:'/app',replace:vi.fn(),reload:vi.fn(),loading:false,available:true,permissions:['finance.read'],roleCode:'FINANCE'}));
vi.mock('next/navigation',()=>({usePathname:()=>state.path,useRouter:()=>({replace:state.replace})}));
vi.mock('./permission-provider',()=>({usePermissions:()=>state}));
vi.mock('@/components/ui/page-state',()=>({
 LoadingState:()=> <p>Verification</p>,
 ErrorState:({retry}:{retry:()=>void})=><button onClick={retry}>Reessayer</button>,
 ForbiddenState:()=> <p>Acces refuse</p>,
}));
beforeEach(()=>{state.path='/app';state.loading=false;state.available=true;state.replace.mockClear();state.reload.mockClear();});
describe('member content boundary',()=>{
 it('redirects a Finance member before mounting the operational dashboard',()=>{
  render(<MemberAccessBoundary><p>Private dashboard</p></MemberAccessBoundary>);
  expect(state.replace).toHaveBeenCalledWith('/app/finance');
  expect(screen.queryByText('Private dashboard')).not.toBeInTheDocument();
 });
 it('mounts authorized Finance content',()=>{
  state.path='/app/finance';
  render(<MemberAccessBoundary><p>Invoices</p></MemberAccessBoundary>);
  expect(screen.getByText('Invoices')).toBeVisible();
 });
 it('blocks a manually entered unauthorized module URL',()=>{
  state.path='/app/clients';
  render(<MemberAccessBoundary><p>Customer data</p></MemberAccessBoundary>);
  expect(screen.queryByText('Customer data')).not.toBeInTheDocument();
  expect(screen.getByText('Acces refuse')).toBeVisible();
 });
 it('keeps private children unmounted while verifying permissions',()=>{
  state.loading=true;state.path='/app/finance';
  render(<MemberAccessBoundary><p>Invoices</p></MemberAccessBoundary>);
  expect(screen.queryByText('Invoices')).not.toBeInTheDocument();
 });
 it('fails closed when verification is unavailable and offers retry',()=>{
  state.available=false;state.path='/app/finance';
  render(<MemberAccessBoundary><p>Invoices</p></MemberAccessBoundary>);
  expect(screen.queryByText('Invoices')).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('Reessayer'));
  expect(state.reload).toHaveBeenCalledOnce();
 });
});
