import {render,screen} from '@testing-library/react';
import {expect,it,vi} from 'vitest';
import {api} from '@/services/api';
import {FreightManifest} from './freight-workflow';

vi.mock('@/services/api',()=>({api:{get:vi.fn()}}));

it('reports a malformed manifest instead of crashing the whole shipment sheet',async()=>{
  vi.mocked(api.get).mockResolvedValue({data:{items:[]}});
  render(<FreightManifest shipmentId="test" revision={0}/>);
  expect(await screen.findByRole('alert')).toHaveTextContent('Le manifeste reçu est incomplet');
  expect(screen.queryByRole('button',{name:'Excel'})).not.toBeInTheDocument();
});
