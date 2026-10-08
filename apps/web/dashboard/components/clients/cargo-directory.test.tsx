import { cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { CargoDirectory } from './cargo-directory';
const mocks=vi.hoisted(()=>({get:vi.fn()}));
vi.mock('@/services/api',()=>({api:{get:(...args:unknown[])=>mocks.get(...args)}}));
beforeEach(()=>{mocks.get.mockReset();});afterEach(cleanup);
it('shows only identity columns and opens the selected client',async()=>{
  mocks.get.mockResolvedValue({data:{items:[{id:'a',client_reference:'CLI-1',display_name:'Jean',phone:'+243812345678',customer_type:'individual',last_activity_at:null}],total:1,page:1,total_pages:1}});
  const open=vi.fn();render(<CargoDirectory revision={0} open={open}/>);
  fireEvent.click(await screen.findByRole('button',{name:/Jean/}));
  expect(open).toHaveBeenCalledWith('a');
  expect(screen.queryByText('Solde')).not.toBeInTheDocument();
  expect(screen.getByText('Aucune activité enregistrée')).toBeInTheDocument();
});
it('distinguishes an empty directory from no search results',async()=>{
  mocks.get.mockResolvedValue({data:{items:[],total:0,page:1,total_pages:0}});
  render(<CargoDirectory revision={0} open={vi.fn()}/>);
  expect(await screen.findByText('Aucun client pour le moment')).toBeInTheDocument();
  fireEvent.change(screen.getByRole('searchbox'),{target:{value:'Missing'}});
  await waitFor(()=>expect(mocks.get).toHaveBeenLastCalledWith('/clients/directory',expect.objectContaining({params:expect.objectContaining({q:'Missing',page:1})})));
  expect(await screen.findByText('Aucun résultat correspondant')).toBeInTheDocument();
});
it('shows an error instead of falsely claiming no clients',async()=>{
  mocks.get.mockRejectedValue(new Error('unavailable'));
  render(<CargoDirectory revision={0} open={vi.fn()}/>);
  expect(await screen.findByRole('alert')).toHaveTextContent('Impossible de charger');
  expect(screen.queryByText('Aucun client pour le moment')).not.toBeInTheDocument();
});
