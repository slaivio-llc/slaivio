import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {setDashboardLocale} from './dashboard-language';
import {RecordPaymentForm} from '@/components/finance/record-payment-form';
import {InternationalPhone} from '@/components/clients/international-phone';
import {ApiMutationFeedback} from '@/components/ui/api-mutation-feedback';
import {API_MUTATION_SUCCEEDED_EVENT} from '@/services/api';
import {payFinance,type FinanceDocument} from '@/services/finance';

vi.mock('@/services/finance',()=>({payFinance:vi.fn()}));
beforeEach(()=>{localStorage.clear();sessionStorage.clear();setDashboardLocale('en');vi.resetAllMocks();});
afterEach(()=>{cleanup();setDashboardLocale('fr');});

it('records a payment in English without changing the currency, method or customer note',async()=>{
  vi.mocked(payFinance).mockResolvedValue({} as never);
  const done=vi.fn().mockResolvedValue(undefined);
  render(<RecordPaymentForm document={{id:'tz-invoice',client_name:'Agence de Tanzanie',document_number:'FAC-TZ',balance_due:60,currency:'TZS'} as FinanceDocument} onRecorded={done} onCancel={vi.fn()}/>);
  fireEvent.change(screen.getByLabelText(/Amount received/),{target:{value:'12.50'}});
  fireEvent.change(screen.getByLabelText('Internal note (optional)'),{target:{value:'Colis à retirer — customer note'}});
  fireEvent.click(screen.getByRole('button',{name:'Save'}));
  await waitFor(()=>expect(done).toHaveBeenCalledOnce());
  expect(payFinance).toHaveBeenCalledWith('tz-invoice',expect.objectContaining({amount:12.5,currency:'TZS',method:'CASH',internal_note:'Colis à retirer — customer note'}));
});

it('uses English country names and leaves the submitted international phone number intact',()=>{
  const {container}=render(<form><InternationalPhone required/></form>);
  fireEvent.click(screen.getByLabelText('Choose country calling code'));
  fireEvent.change(screen.getByLabelText('Search country or calling code'),{target:{value:'Tanzania'}});
  fireEvent.click(screen.getByRole('button',{name:'Tanzania (+255)'}));
  fireEvent.change(screen.getByLabelText('Phone *'),{target:{value:'0712 345 678'}});
  expect(new FormData(container.querySelector('form')!).get('phone')).toBe('+255712345678');
  expect(new FormData(container.querySelector('form')!).get('phone_region')).toBe('TZ');
  act(()=>setDashboardLocale('fr'));
  expect(screen.getByLabelText('Téléphone *')).toHaveValue('0712 345 678');
});

it('translates global feedback and updates it when the language changes',()=>{
  render(<ApiMutationFeedback/>);
  act(()=>window.dispatchEvent(new CustomEvent(API_MUTATION_SUCCEEDED_EVENT,{detail:{message:'Client créé avec succès.'}})));
  expect(screen.getByRole('status')).toHaveTextContent('Customer created successfully.');
  act(()=>setDashboardLocale('fr'));
  expect(screen.getByRole('status')).toHaveTextContent('Client créé avec succès.');
});
