import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import Page from './page';
import {supplierInstructions,type IntakeReceipt} from '@/services/customer-intake';

const {request}=vi.hoisted(()=>({request:vi.fn()}));
vi.mock('@/services/customer-intake',async importOriginal=>({...await importOriginal<typeof import('@/services/customer-intake')>(),publicIntake:request}));
vi.mock('@/components/ui/country-picker',()=>({CountryPicker:({value,change,label}:{value:string;change:(v:string)=>void;label:string})=><select aria-label={label} value={value} onChange={e=>change(e.target.value)}><option value=""/><option value="CD">Congo</option></select>}));

const depot={warehouse_id:'warehouse-a',recipient:'王先生',address:'广州市白云区仓库9号',city:'广州',country:'CN',phone:'+86 123',instructions:'每箱写唛头'};
const receipt:IntakeReceipt={reference:'PRE-123456',shipping_mark:'PRE-123456',full_name:'Alice Client',agency_name:'Agence test',service_name:'Fret Chine',route_name:'Chine → Congo',dropoff:depot,package_count:2,estimated_weight_kg:null};
const context={agency_name:'Agence test',phone:'+33612345678',receipt:null,offerings:[{id:'offering-a',service_name:'Fret Chine',route_name:'Chine → Congo',origin_city:'Guangzhou',origin_country:'China',destination_city:'Kinshasa',destination_country:'Congo',dropoff:depot}]};

describe('WhatsApp customer registration',()=>{
 beforeEach(()=>{vi.clearAllMocks();request.mockReset();window.history.replaceState({},'',`/prepare-shipment#${'a'.repeat(43)}`);Object.defineProperty(navigator,'language',{value:'fr-FR',configurable:true});window.scrollTo=vi.fn();});
 afterEach(cleanup);
 it('rejects missing capability without loading private data',async()=>{
  window.history.replaceState({},'','/prepare-shipment');render(<Page/>);
  expect(await screen.findByRole('alert')).toHaveTextContent('Demandez un nouveau lien');expect(request).not.toHaveBeenCalled();
 });
 it('shows a consumed receipt without another registration form',async()=>{
  request.mockResolvedValue({...context,receipt});render(<Page/>);
  expect(await screen.findByText('Votre envoi est annoncé')).toBeInTheDocument();
  expect(screen.getByText('PRE-123456')).toBeInTheDocument();
  expect(screen.getByText(/Shipping mark/)).toHaveTextContent(depot.address);
  expect(screen.queryByRole('button',{name:'Confirmer mon envoi'})).not.toBeInTheDocument();
 });
 it('keeps edited contact separate and submits one canonical payload',async()=>{
  request.mockResolvedValueOnce(context).mockResolvedValueOnce(receipt);render(<Page/>);
  const name=await screen.findByLabelText('Nom complet');fireEvent.change(name,{target:{value:'Alice Client'}});
  fireEvent.change(screen.getByLabelText('Pays de résidence'),{target:{value:'CD'}});
  fireEvent.change(screen.getByLabelText('Ville'),{target:{value:'Kinshasa'}});
  fireEvent.change(screen.getByLabelText('Numéro de contact'),{target:{value:'+442079460018'}});
  fireEvent.submit(name.closest('form')!);
  fireEvent.change(screen.getByLabelText('Service'),{target:{value:'Fret Chine'}});
  fireEvent.change(screen.getByLabelText('Trajet'),{target:{value:'offering-a'}});
  fireEvent.click(screen.getByLabelText('Mon fournisseur dépose les colis à l’entrepôt'));
  expect(screen.getByText(depot.address)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Nombre de colis prévu'),{target:{value:'2'}});
  fireEvent.click(screen.getByLabelText('J’autorise cette agence à utiliser ces informations pour préparer et suivre mon envoi.'));
  fireEvent.submit(screen.getByRole('button',{name:'Confirmer mon envoi'}).closest('form')!);
  await waitFor(()=>expect(request).toHaveBeenCalledTimes(2));
  const payload=request.mock.calls[1][1];
  expect(payload).toEqual({full_name:'Alice Client',country:'CD',city:'Kinshasa',package_count:2,estimated_weight_kg:null,contact_phone:'+442079460018',offering_id:'offering-a',delivery_method:'SUPPLIER',language:'FR',consent:true});
  expect(payload).not.toHaveProperty('org_id');expect(payload).not.toHaveProperty('weight');
  expect(await screen.findByText('Votre envoi est annoncé')).toBeInTheDocument();
 });
 it('does not offer supplier delivery for an unpublished depot',async()=>{
  request.mockResolvedValue({...context,offerings:[{...context.offerings[0],dropoff:null}]});render(<Page/>);
  const name=await screen.findByLabelText('Nom complet');fireEvent.submit(name.closest('form')!);
  fireEvent.change(screen.getByLabelText('Service'),{target:{value:'Fret Chine'}});
  fireEvent.change(screen.getByLabelText('Trajet'),{target:{value:'offering-a'}});
  expect(screen.queryByText('Mon fournisseur dépose les colis à l’entrepôt')).not.toBeInTheDocument();
 });
 it('explains a changed depot instead of publishing its former address',async()=>{
  request.mockResolvedValue({...context,receipt:{...receipt,dropoff:null,dropoff_withdrawn:true}});render(<Page/>);
  expect(await screen.findByText(/Les consignes de dépôt ont changé/)).toBeInTheDocument();
  expect(screen.queryByText(depot.address)).not.toBeInTheDocument();
 });
 it('offers an English version without dashboard authentication',async()=>{
  Object.defineProperty(navigator,'language',{value:'en-US',configurable:true});request.mockResolvedValue(context);render(<Page/>);
  expect(await screen.findByRole('heading',{name:'Prepare my shipment'})).toBeInTheDocument();
  expect(screen.getByLabelText('Contact number')).toHaveValue('+33612345678');
 });
 it('preserves Chinese supplier text and does not invent a depot',()=>{
  expect(supplierInstructions(receipt)).toContain('Address / 地址: '+depot.address);
  expect(supplierInstructions(receipt)).toContain('Shipping mark / 唛头: PRE-123456');
  expect(supplierInstructions({...receipt,dropoff:null})).toBe('');
 });
});
