import {fireEvent,render,screen,within} from '@testing-library/react';
import {beforeEach,expect,it,vi} from 'vitest';
import WelcomePage from './page';

const push=vi.hoisted(()=>vi.fn());
vi.mock('next/navigation',()=>({useRouter:()=>({push}),usePathname:()=>'/onboarding/welcome'}));
vi.mock('@/components/ui/slaivio-brand',()=>({SlaivioBrand:()=> <span>Slaivio</span>}));
beforeEach(()=>vi.clearAllMocks());

it('welcomes the agency with plain copy and no decorative icons',()=>{
  const {container}=render(<WelcomePage/>);
  expect(screen.getByRole('heading',{level:1,name:'Installons votre agence, simplement.'})).toBeVisible();
  expect(container.querySelector('svg')).toBeNull();
  expect(screen.queryByText(/Temps moyen|WhatsApp et IA|réponses de l’IA/)).not.toBeInTheDocument();
});
it('keeps the actual five configuration steps understandable',()=>{
  render(<WelcomePage/>);
  const steps=within(screen.getByRole('complementary',{name:'Ce que nous allons préparer'}));
  expect(steps.getAllByRole('listitem')).toHaveLength(5);
  expect(steps.getByText('Votre dépôt principal')).toBeVisible();
  expect(steps.getByText('Vos réponses clients')).toBeVisible();
});
it('starts at the agency profile and keeps support available',()=>{
  render(<WelcomePage/>);
  fireEvent.click(screen.getByRole('button',{name:'Configurer mon agence'}));
  expect(push).toHaveBeenCalledWith('/onboarding/agency-profile');
  expect(screen.getByRole('link',{name:'Besoin d’un coup de main ?'})).toHaveAttribute('href','mailto:support@slaivio.com');
});
