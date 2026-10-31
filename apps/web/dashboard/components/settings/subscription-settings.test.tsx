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

it('shows server-enforced capacities, an 80 percent warning and a transition without inventing unlimited access',async()=>{
  vi.mocked(billing.getSubscriptionBilling).mockResolvedValue({...overview,capacity:{limits:{max_monthly_packages:500,max_users:3},usage:{max_monthly_packages:400,max_users:3},transition_active:true,enforce_from:'2026-11-26T00:00:00Z',period_ends_at:'2026-11-01T00:00:00Z',timezone:'Africa/Kinshasa'}});
  render(<SubscriptionSettings organization={{}}/>);
  expect(await screen.findByRole('progressbar',{name:'Colis créés par mois'})).toHaveAttribute('value','400');
  expect(screen.getByText(/au moins 80 %/)).toBeVisible();
  expect(screen.getByText(/Limite atteinte/)).toBeVisible();
  expect(screen.getByText(/Période de transition/)).toBeVisible();
});

beforeEach(()=>{
  vi.clearAllMocks();window.sessionStorage.clear();navigation.params=new URLSearchParams();
  vi.mocked(billing.getSubscriptionBilling).mockResolvedValue(overview);
  vi.mocked(billing.getSubscriptionPlans).mockResolvedValue([
    {code:'STARTER',name:'Starter',monthly_price_minor:11900,currency_code:'USD',max_users:3},
    {code:'PRO',name:'Pro',monthly_price_minor:29900,currency_code:'USD',max_users:10},
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
  expect(screen.queryByRole('textbox',{name:/email/i})).not.toBeInTheDocument();
  expect(screen.queryByRole('textbox',{name:'Nom du payeur'})).not.toBeInTheDocument();
  const button=await screen.findByRole('button',{name:/Payer .* avec SasPay/});
  fireEvent.submit(button.closest('form')!);
  await waitFor(()=>expect(billing.openSubscriptionCheckout).toHaveBeenCalledWith('https://pay.saspay.me/checkout/test'));
  expect(billing.createSubscriptionCheckout).toHaveBeenCalledWith({plan_code:'STARTER'});
  expect(window.sessionStorage.getItem('slaivio:subscription-checkout:agency')).toBe('checkout');
});

it('shows real account details, history and a working offer toggle without fake saved payment methods',async()=>{
  vi.mocked(billing.getSubscriptionBilling).mockResolvedValue({...overview,payer:{name:'Awa Sossou',email:'awa@example.com'},invoices:[{id:'invoice',invoice_number:'SLA-2026-1',status:'PAID',total_minor:11900,currency_code:'USD',created_at:'2026-10-25T10:00:00Z'}]});
  render(<SubscriptionSettings organization={{email:'wrong-agency@example.com'}}/>);
  expect(await screen.findByText('awa@example.com')).toBeVisible();
  expect(screen.queryByText('wrong-agency@example.com')).not.toBeInTheDocument();
  expect(screen.getByText('SLA-2026-1')).toBeVisible();
  expect(screen.getByText('Payée')).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'Masquer les offres'}));
  expect(screen.queryByRole('article',{name:'Offre Starter'})).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Gérer mon offre'}));
  expect(screen.getByRole('article',{name:'Offre Starter'})).toBeVisible();
  expect(screen.queryByRole('button',{name:/Ajouter.*carte/i})).not.toBeInTheDocument();
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
  expect(screen.getByRole('article',{name:'Offre Pro'})).toHaveTextContent('299');
  expect(screen.getByRole('article',{name:'Offre Business'})).toHaveTextContent('799');
  expect(screen.queryByRole('combobox',{name:'Forfait'})).not.toBeInTheDocument();
  expect(screen.queryByRole('form',{name:'Finaliser l’abonnement'})).not.toBeInTheDocument();
});

it('explains team seats and shows real benefits returned by the catalogue',async()=>{
  vi.mocked(billing.getSubscriptionPlans).mockResolvedValue([
    {code:'PRO',name:'Pro',monthly_price_minor:29900,currency_code:'USD',limits:{max_users:10},positioning:'Suivre vos clients au-delà des confirmations.',value_highlights:['Relancer les colis attendus et les départs bloqués selon vos réglages'],included_features:['Relances clients programmées']},
  ]);
  render(<SubscriptionSettings organization={{}}/>);
  const card=await screen.findByRole('article',{name:'Offre Pro'});
  expect(card).toHaveTextContent('Ce que cela change au quotidien');
  expect(card).toHaveTextContent('départs bloqués');
  expect(card).toHaveTextContent('Membres de votre équipe');
  expect(screen.getByText(/Ce n’est pas un client de votre agence/)).toBeVisible();
  expect(screen.getByText(/il n’ajoute pas de fonctions exclusives/)).toBeVisible();
});

it('chooses Pro from its card and charges only the server-side plan code',async()=>{
  render(<SubscriptionSettings organization={{organization_name:'Cargo',email:'owner@example.com'}}/>);
  fireEvent.click(await screen.findByRole('button',{name:'Choisir Pro'}));
  expect(screen.getByRole('button',{name:'Offre sélectionnée'})).toHaveAttribute('aria-pressed','true');
  fireEvent.submit(screen.getByRole('form',{name:'Finaliser l’abonnement'}));
  await waitFor(()=>expect(billing.createSubscriptionCheckout).toHaveBeenCalledWith({plan_code:'PRO'}));
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
  expect(screen.getByRole('button',{name:/Payer 299.* avec SasPay/})).toBeInTheDocument();
  expect(screen.queryByRole('button',{name:/Payer 49/})).not.toBeInTheDocument();
  expect(screen.getByRole('article',{name:'Offre Starter'})).toHaveTextContent('119');
});

it('uses equal grey card borders and only server-supplied features',async()=>{
  vi.mocked(billing.getSubscriptionPlans).mockResolvedValue([{code:'PRO',name:'Pro',monthly_price_minor:29900,currency_code:'USD',max_users:999,included_features:['Gestion des colis et des expéditions']}]);
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
