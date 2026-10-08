import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ClientRecord } from '@/services/clients';
import { Customer360 } from './customer360';

const mocks = vi.hoisted(()=>({get:vi.fn(),permissions:['clients.read'] as string[]}));
vi.mock('@/services/api',()=>({api:{get:(...args:unknown[])=>mocks.get(...args)}}));
vi.mock('@/components/permissions/permission-provider',()=>({usePermissions:()=>({permissions:mocks.permissions,available:true})}));
const client = {id:'client',name:'Jean',display_name:'Jean',customer_type:'individual',row_version:1} as ClientRecord;
beforeEach(()=>{mocks.get.mockReset();mocks.permissions=['clients.read'];});
afterEach(cleanup);
const mount = ()=>render(<Customer360 client={client} close={vi.fn()} edit={vi.fn()} archive={vi.fn()} busy={false}/>);

it('hides protected sections and does not show fictional zero metrics', async()=>{
  mocks.get.mockResolvedValue({data:{client:{...client,phone:'+33612345678'}}});
  mount();
  expect(await screen.findByText('+33612345678')).toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'Finance'})).not.toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'Communications'})).not.toBeInTheDocument();
  expect(screen.queryByText('Dossiers')).not.toBeInTheDocument();
});

it('loads finance separately and renders currency balances without a grand total', async()=>{
  mocks.permissions=['clients.read','finance.read'];
  mocks.get.mockImplementation((url:string)=>Promise.resolve({data:url.endsWith('/finance')?
    {items:[],total:0,balances:[{currency:'USD',paid:10,outstanding:20},{currency:'EUR',paid:30,outstanding:40}]}:{client}}));
  mount();
  await screen.findAllByText('Non renseigné');
  fireEvent.click(screen.getByRole('button',{name:'Finance'}));
  expect(await screen.findByRole('heading',{name:'USD'})).toBeInTheDocument();
  expect(screen.getByRole('heading',{name:'EUR'})).toBeInTheDocument();
  await waitFor(()=>expect(mocks.get).toHaveBeenLastCalledWith('/clients/client/crm/finance',expect.objectContaining({params:{page:1}})));
});

it('shows retry on API failure instead of an empty activity', async()=>{
  mocks.get.mockRejectedValue(new Error('offline'));
  mount();
  expect(await screen.findByRole('alert')).toHaveTextContent('Impossible de charger');
  expect(screen.queryByText('Aucun élément dans cette section.')).not.toBeInTheDocument();
});
