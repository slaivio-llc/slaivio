import {render,screen,waitFor} from '@testing-library/react';
import {beforeEach,expect,it,vi} from 'vitest';
import {TrialBanner} from './trial-banner';
import {getSubscriptionStatus} from '@/services/subscription-billing';
vi.mock('@/services/subscription-billing',()=>({getSubscriptionStatus:vi.fn()}));
beforeEach(()=>{vi.clearAllMocks();});
it('shows the real trial deadline and links to subscription settings',async()=>{
  vi.mocked(getSubscriptionStatus).mockResolvedValue({status:'TRIAL',trial_ends_at:new Date(Date.now()+30*86400000).toISOString(),ends_at:null});
  render(<TrialBanner/>);
  expect(await screen.findByLabelText('Essai gratuit')).toHaveTextContent('30 jours restants');
  for(const link of screen.getAllByRole('link',{name:'Choisir une offre'}))expect(link).toHaveAttribute('href','/app/settings?section=subscription');
});
it('does not show a trial banner for paid agencies',async()=>{
  vi.mocked(getSubscriptionStatus).mockResolvedValue({status:'ACTIVE',trial_ends_at:null,ends_at:new Date(Date.now()+86400000).toISOString()});
  render(<TrialBanner/>);
  await waitFor(()=>expect(getSubscriptionStatus).toHaveBeenCalledOnce());
  expect(screen.queryByLabelText('Essai gratuit')).not.toBeInTheDocument();
});
it('shows that an expired trial has ended without restarting its countdown',async()=>{
  vi.mocked(getSubscriptionStatus).mockResolvedValue({status:'TRIAL',trial_ends_at:new Date(Date.now()-86400000).toISOString(),ends_at:null});
  render(<TrialBanner/>);
  expect(await screen.findByLabelText('Essai gratuit')).toHaveTextContent('Essai terminé');
});
it('never invents a 30-day trial when the API is unavailable',async()=>{
  vi.mocked(getSubscriptionStatus).mockRejectedValue(new Error('offline'));
  render(<TrialBanner/>);
  await waitFor(()=>expect(getSubscriptionStatus).toHaveBeenCalledOnce());
  expect(screen.queryByLabelText('Essai gratuit')).not.toBeInTheDocument();
});
