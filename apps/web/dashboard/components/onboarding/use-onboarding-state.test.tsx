import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useOnboardingState } from './use-onboarding-state';
import { OnboardingError } from './OnboardingShell';
import { getOnboardingExperienceState, type OnboardingExperienceState } from '@/services/onboarding-experience';

const clerk=vi.hoisted(()=>({signOut:vi.fn()}));
vi.mock('@clerk/nextjs',()=>({useClerk:()=>clerk}));
vi.mock('next/navigation',()=>({usePathname:()=>'/onboarding/agency-profile'}));
vi.mock('@/services/onboarding-experience',()=>({getOnboardingExperienceState:vi.fn()}));
vi.mock('@/components/ui/slaivio-brand',()=>({SlaivioBrand:()=> <span>SLAIVIO</span>}));
beforeEach(()=>{vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY','pk_test_mock');vi.mocked(getOnboardingExperienceState).mockReset();clerk.signOut.mockReset().mockResolvedValue(undefined);});
afterEach(()=>vi.unstubAllEnvs());
function Harness(){const {state,error,reload,authenticationRequired}=useOnboardingState();return error?<OnboardingError message={error} retry={()=>void reload()} authenticationRequired={authenticationRequired}/>:state?<p>Configuration chargée</p>:<p>Chargement</p>;}

it('offers a real reconnect instead of endlessly retrying onboarding after a 401',async()=>{
 vi.mocked(getOnboardingExperienceState).mockRejectedValue({isAxiosError:true,response:{status:401}});
 render(<Harness/>);
 expect(await screen.findByRole('heading',{name:'Retrouvons votre connexion'})).toBeInTheDocument();
 expect(screen.queryByRole('button',{name:'Réessayer'})).not.toBeInTheDocument();
 expect(clerk.signOut).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Se reconnecter'}));
 await waitFor(()=>expect(clerk.signOut).toHaveBeenCalledWith({redirectUrl:'/sign-in?redirect_url=%2Fonboarding%2Fagency-profile'}));
});

it('keeps network failures retryable without automatically signing the user out',async()=>{
 vi.mocked(getOnboardingExperienceState).mockRejectedValueOnce(new Error('offline'));
 render(<Harness/>);
 expect(await screen.findByRole('heading',{name:'Configuration indisponible'})).toBeInTheDocument();
 expect(screen.queryByRole('button',{name:'Se reconnecter'})).not.toBeInTheDocument();
 const state:OnboardingExperienceState={journey:{},business_type:'PARCEL_FREIGHT',steps:[],progress:0,readiness_score:0,current_step:null,warnings:[]};
 vi.mocked(getOnboardingExperienceState).mockResolvedValueOnce(state);
 fireEvent.click(screen.getByRole('button',{name:'Réessayer'}));
 expect(await screen.findByText('Configuration chargée')).toBeInTheDocument();
 expect(clerk.signOut).not.toHaveBeenCalled();
});

it('does not call a forbidden agency action an expired session',async()=>{
 vi.mocked(getOnboardingExperienceState).mockRejectedValue({isAxiosError:true,response:{status:403}});
 render(<Harness/>);
 expect(await screen.findByRole('button',{name:'Réessayer'})).toBeInTheDocument();
 expect(screen.queryByRole('button',{name:'Se reconnecter'})).not.toBeInTheDocument();
});
