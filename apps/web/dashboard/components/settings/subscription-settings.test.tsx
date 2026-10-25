import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { SubscriptionSettings } from './subscription-settings';
import * as billing from '@/services/subscription-billing';

const navigation=vi.hoisted(()=>({params:new URLSearchParams()}));
vi.mock('next/navigation',()=>({useSearchParams:()=>navigation.params}));
vi.mock('@/components/permissions/permission-guard',()=>({PermissionGuard:({children}:{children:ReactNode})=>children}));
vi.mock('@/services/subscription-billing',()=>({getSubscriptionBilling:vi.fn(),getSubscriptionPlans:vi.fn(),createSubscriptionCheckout:vi.fn(),verifySubscriptionCheckout:vi.fn(),cancelSubscriptionCheckout:vi.fn(),openSubscriptionCheckout:vi.fn()}));

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

it('does not repeat the header trial reminder in subscription settings or charge automatically',async()=>{
  render(<SubscriptionSettings organization={{organization_name:'Cargo',email:'owner@example.com'}}/>);
  expect(await screen.findByRole('heading',{name:'Une offre adaptée à votre agence'})).toBeVisible();
  expect(screen.queryByRole('heading',{name:'Essai gratuit de 30 jours'})).not.toBeInTheDocument();
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

it('keeps offer selection available but disables payment when the provider is not configured',async()=>{
  vi.mocked(billing.getSubscriptionBilling).mockResolvedValue({...overview,checkout_available:false});
  render(<SubscriptionSettings organization={{}}/>);
  fireEvent.click(await screen.findByRole('button',{name:'Choisir Starter'}));
  expect(screen.getByRole('button',{name:/Payer .* avec SasPay/})).toBeDisabled();
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

it('allows switching plans and shows only current catalogue prices despite a legacy pending checkout',async()=>{
  vi.mocked(billing.getSubscriptionBilling).mockResolvedValue({...overview,pending_checkout:{id:'old-checkout',plan_code:'STARTER',status:'PENDING',amount_minor:4900,currency_code:'USD'}});
  render(<SubscriptionSettings organization={{organization_name:'Cargo',email:'owner@example.com'}}/>);
  await waitFor(()=>expect(billing.verifySubscriptionCheckout).toHaveBeenCalledWith('old-checkout'));
  await waitFor(()=>expect(screen.getByRole('button',{name:'Choisir Pro'})).toBeEnabled());
  fireEvent.click(screen.getByRole('button',{name:'Choisir Pro'}));
  expect(screen.getByRole('button',{name:/Payer 229.* avec SasPay/})).toBeInTheDocument();
  expect(screen.queryByRole('button',{name:/Payer 49/})).not.toBeInTheDocument();
  expect(screen.getByRole('article',{name:'Offre Starter'})).toHaveTextContent('119');
});

it('uses equal grey card borders and only server-supplied features',async()=>{
  vi.mocked(billing.getSubscriptionPlans).mockResolvedValue([{code:'PRO',name:'Pro',monthly_price_minor:22900,currency_code:'USD',max_users:999,included_features:['Gestion des colis et des expéditions']}]);
  render(<SubscriptionSettings organization={{}}/>);
  const card=await screen.findByRole('article',{name:'Offre Pro'});
  expect(card).toHaveClass('border-[#e0e4e7]','hover:border-[#18794e]');
  expect(card).toHaveTextContent('Gestion des colis et des expéditions');
  expect(card).not.toHaveTextContent('999 utilisateurs');
});

it('cancels an old pending checkout with the server before clearing it locally',async()=>{
  vi.mocked(billing.getSubscriptionBilling).mockResolvedValue({...overview,pending_checkout:{id:'old-checkout',plan_code:'STARTER',status:'PENDING',amount_minor:4900,currency_code:'USD'}});
  vi.mocked(billing.cancelSubscriptionCheckout).mockResolvedValue({id:'old-checkout',status:'CANCELLED'});
  render(<SubscriptionSettings organization={{}}/>);
  await waitFor(()=>expect(billing.verifySubscriptionCheckout).toHaveBeenCalled());
  await waitFor(()=>expect(screen.getByRole('button',{name:'Annuler l’ancien paiement'})).toBeEnabled());
  vi.mocked(billing.getSubscriptionBilling).mockResolvedValue(overview);
  fireEvent.click(screen.getByRole('button',{name:'Annuler l’ancien paiement'}));
  expect(await screen.findByText(/L’ancien paiement a été annulé/)).toBeVisible();
  expect(billing.cancelSubscriptionCheckout).toHaveBeenCalledWith('old-checkout');
});
