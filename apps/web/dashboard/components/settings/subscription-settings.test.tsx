import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { SubscriptionSettings } from './subscription-settings';
import * as billing from '@/services/subscription-billing';

const navigation=vi.hoisted(()=>({params:new URLSearchParams()}));
vi.mock('next/navigation',()=>({useSearchParams:()=>navigation.params}));
vi.mock('@/components/permissions/permission-guard',()=>({PermissionGuard:({children}:{children:ReactNode})=>children}));
vi.mock('@/services/subscription-billing',()=>({getSubscriptionBilling:vi.fn(),getSubscriptionPlans:vi.fn(),createSubscriptionCheckout:vi.fn(),verifySubscriptionCheckout:vi.fn(),openSubscriptionCheckout:vi.fn()}));

const overview:billing.BillingOverview={
  billing_account_id:'agency',trial_days:30,access_active:true,checkout_available:true,pending_checkout:null,
  subscription:{plan_code:'STARTER',plan_name:'Starter',status:'TRIAL',monthly_price_minor:11900,currency_code:'USD',trial_ends_at:new Date(Date.now()+30*86400000).toISOString(),ends_at:null},invoices:[],usage:{clients:2,members:1},
};

beforeEach(()=>{
  vi.clearAllMocks();window.sessionStorage.clear();navigation.params=new URLSearchParams();
  vi.mocked(billing.getSubscriptionBilling).mockResolvedValue(overview);
  vi.mocked(billing.getSubscriptionPlans).mockResolvedValue([
    {code:'STARTER',name:'Starter',monthly_price_minor:11900,currency_code:'USD',max_users:3},
    {code:'PRO',name:'Pro',monthly_price_minor:22900,currency_code:'USD',max_users:10},
    {code:'ENTERPRISE',name:'Business',monthly_price_minor:79900,currency_code:'USD',max_users:999},
  ]);
  vi.mocked(billing.createSubscriptionCheckout).mockResolvedValue({id:'checkout',checkout_url:'https://pay.saspay.me/checkout/test',status:'PENDING'});
  vi.mocked(billing.verifySubscriptionCheckout).mockResolvedValue({id:'checkout',status:'PENDING'});
});

it('shows a free 30-day trial without automatically charging or creating a checkout',async()=>{
  render(<SubscriptionSettings organization={{organization_name:'Cargo',email:'owner@example.com'}}/>);
  expect(await screen.findByRole('heading',{name:'Essai gratuit de 30 jours'})).toBeVisible();
  expect(screen.getByText(/Aucun paiement requis pendant l’essai/)).toBeVisible();
  expect(billing.createSubscriptionCheckout).not.toHaveBeenCalled();
});

it('creates a hosted checkout without sending an amount or a success status from the browser',async()=>{
  render(<SubscriptionSettings organization={{organization_name:'Cargo',email:'owner@example.com'}}/>);
  fireEvent.click(await screen.findByRole('button',{name:'Choisir Starter'}));
  const button=await screen.findByRole('button',{name:/Payer .* avec SasPay/});
  fireEvent.submit(button.closest('form')!);
  await waitFor(()=>expect(billing.openSubscriptionCheckout).toHaveBeenCalledWith('https://pay.saspay.me/checkout/test'));
  expect(billing.createSubscriptionCheckout).toHaveBeenCalledWith({plan_code:'STARTER',customer_name:'Cargo',customer_email:'owner@example.com'});
  expect(window.sessionStorage.getItem('slaivio:subscription-checkout:agency')).toBe('checkout');
});

it('does not display an active paid subscription just because the browser returned from checkout',async()=>{
  navigation.params=new URLSearchParams('checkout=checkout');
  render(<SubscriptionSettings organization={{}}/>);
  expect(await screen.findByText('Le paiement est en attente de confirmation.')).toBeVisible();
  expect(billing.verifySubscriptionCheckout).toHaveBeenCalledWith('checkout');
  expect(screen.queryByText('Paiement confirmé. Votre abonnement est actif.')).not.toBeInTheDocument();
});

it('disables checkout when the server has no configured payment credentials',async()=>{
  vi.mocked(billing.getSubscriptionBilling).mockResolvedValue({...overview,checkout_available:false});
  render(<SubscriptionSettings organization={{}}/>);
  expect(await screen.findByRole('button',{name:'Choisir Starter'})).toBeDisabled();
  expect(screen.getByText(/Le paiement SasPay est en cours d’activation/)).toBeVisible();
});

it('presents all three priced offer cards with no plan dropdown',async()=>{
  render(<SubscriptionSettings organization={{}}/>);
  expect(await screen.findByRole('article',{name:'Offre Starter'})).toHaveTextContent('119');
  expect(screen.getByRole('article',{name:'Offre Pro'})).toHaveTextContent('229');
  expect(screen.getByRole('article',{name:'Offre Business'})).toHaveTextContent('799');
  expect(screen.queryByRole('combobox',{name:'Forfait'})).not.toBeInTheDocument();
  expect(screen.queryByRole('form',{name:'Finaliser l’abonnement'})).not.toBeInTheDocument();
});

it('chooses Pro from its card and charges only the server-side plan code',async()=>{
  render(<SubscriptionSettings organization={{organization_name:'Cargo',email:'owner@example.com'}}/>);
  fireEvent.click(await screen.findByRole('button',{name:'Choisir Pro'}));
  expect(screen.getByRole('button',{name:'Offre sélectionnée'})).toHaveAttribute('aria-pressed','true');
  fireEvent.submit(screen.getByRole('form',{name:'Finaliser l’abonnement'}));
  await waitFor(()=>expect(billing.createSubscriptionCheckout).toHaveBeenCalledWith({plan_code:'PRO',customer_name:'Cargo',customer_email:'owner@example.com'}));
});

it('recovers a pending payment from the server even if the browser storage was cleared',async()=>{
  vi.mocked(billing.getSubscriptionBilling).mockResolvedValue({...overview,pending_checkout:{id:'server-checkout',plan_code:'STARTER',status:'PENDING'}});
  render(<SubscriptionSettings organization={{}}/>);
  await waitFor(()=>expect(billing.verifySubscriptionCheckout).toHaveBeenCalledWith('server-checkout'));
});

it('shows the original amount of a pending checkout after a catalogue price change',async()=>{
  vi.mocked(billing.getSubscriptionBilling).mockResolvedValue({...overview,pending_checkout:{id:'old-checkout',plan_code:'STARTER',status:'PENDING',amount_minor:4900,currency_code:'USD'}});
  render(<SubscriptionSettings organization={{organization_name:'Cargo',email:'owner@example.com'}}/>);
  expect(await screen.findByRole('button',{name:/Payer 49.* avec SasPay/})).toBeInTheDocument();
  await waitFor(()=>expect(billing.verifySubscriptionCheckout).toHaveBeenCalledWith('old-checkout'));
  expect(screen.getByRole('button',{name:'Choisir Pro'})).toBeDisabled();
  expect(screen.getByRole('article',{name:'Offre Starter'})).toHaveTextContent('119');
});
