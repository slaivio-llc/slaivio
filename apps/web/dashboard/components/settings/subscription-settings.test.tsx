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
  subscription:{plan_code:'STARTER',plan_name:'Starter',status:'TRIAL',monthly_price_minor:4900,currency_code:'USD',trial_ends_at:new Date(Date.now()+30*86400000).toISOString(),ends_at:null},invoices:[],usage:{clients:2,members:1},
};

beforeEach(()=>{
  vi.clearAllMocks();window.sessionStorage.clear();navigation.params=new URLSearchParams();
  vi.mocked(billing.getSubscriptionBilling).mockResolvedValue(overview);
  vi.mocked(billing.getSubscriptionPlans).mockResolvedValue([{code:'STARTER',name:'Starter',monthly_price_minor:4900,currency_code:'USD'}]);
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
  expect(await screen.findByRole('button',{name:/Payer .* avec SasPay/})).toBeDisabled();
  expect(screen.getByText(/Le paiement SasPay est en cours d’activation/)).toBeVisible();
});

it('recovers a pending payment from the server even if the browser storage was cleared',async()=>{
  vi.mocked(billing.getSubscriptionBilling).mockResolvedValue({...overview,pending_checkout:{id:'server-checkout',plan_code:'STARTER',status:'PENDING'}});
  render(<SubscriptionSettings organization={{}}/>);
  await waitFor(()=>expect(billing.verifySubscriptionCheckout).toHaveBeenCalledWith('server-checkout'));
});
