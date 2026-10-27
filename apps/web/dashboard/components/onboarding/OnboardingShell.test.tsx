import { render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { OnboardingLoading } from './OnboardingShell';

vi.mock('next/navigation',()=>({usePathname:()=>'/onboarding/whatsapp'}));
vi.mock('@/components/ui/slaivio-brand',()=>({SlaivioBrand:()=> <span>Slaivio</span>}));

it('keeps the branded onboarding frame while the next step is loading',()=>{
  render(<OnboardingLoading/>);
  expect(screen.getByRole('main')).toHaveAttribute('aria-busy','true');
  expect(screen.getByRole('link',{name:'SLAIVIO'})).toBeVisible();
  const navigation=screen.getByRole('navigation',{name:'Progression de la configuration'});
  expect(within(navigation).getAllByRole('listitem')).toHaveLength(5);
  expect(within(navigation).getByText('WhatsApp')).toHaveClass('text-[#087f4f]');
  expect(within(navigation).queryByRole('link')).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveClass('sr-only');
  expect(screen.queryByText(/Chargement de cette étape|Chargement.*page suivante/i)).not.toBeInTheDocument();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});
