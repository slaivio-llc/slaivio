import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ReconnectButton, reconnectDestination } from './reconnect-button';
import { SessionRecoveryPrompt } from './session-recovery-prompt';

const clerk=vi.hoisted(()=>({signOut:vi.fn()}));
vi.mock('@clerk/nextjs',()=>({useClerk:()=>clerk}));
beforeEach(()=>{vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY','pk_test_mock');clerk.signOut.mockReset().mockResolvedValue(undefined);});
afterEach(()=>vi.unstubAllEnvs());

it('does not terminate a session until the user explicitly requests reconnection',()=>{
 render(<SessionRecoveryPrompt returnTo="/app"/>);
 expect(screen.getByRole('alertdialog',{name:'Retrouvons votre connexion'})).toBeVisible();
 expect(screen.queryByText('Votre session a expiré')).not.toBeInTheDocument();
 expect(clerk.signOut).not.toHaveBeenCalled();
});

it('ends the rejected session before asking for a fresh sign in, without replaying a ticket',async()=>{
 render(<ReconnectButton returnTo="/onboarding/agency-profile?__clerk_ticket=private#fragment"/>);
 fireEvent.click(screen.getByRole('button',{name:'Se reconnecter'}));
 await waitFor(()=>expect(clerk.signOut).toHaveBeenCalledWith({redirectUrl:'/sign-in?redirect_url=%2Fonboarding%2Fagency-profile'}));
 expect(screen.getByRole('button',{name:'Déconnexion en cours…'})).toBeDisabled();
 expect(JSON.stringify(clerk.signOut.mock.calls)).not.toContain('private');
});

it('allows retrying a failed sign out without redirecting with the old session',async()=>{
 clerk.signOut.mockRejectedValueOnce(new Error('offline'));
 render(<ReconnectButton/>);
 fireEvent.click(screen.getByRole('button',{name:'Se reconnecter'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('déconnexion n’a pas pu être terminée');
 expect(screen.getByRole('button',{name:'Se reconnecter'})).toBeEnabled();
 fireEvent.click(screen.getByRole('button',{name:'Se reconnecter'}));
 await waitFor(()=>expect(clerk.signOut).toHaveBeenCalledTimes(2));
});

it.each(['https://evil.example','//evil.example','/sign-up?__clerk_ticket=private','/other','/application'])('rejects unsafe or unrelated return destinations: %s',value=>{
 expect(reconnectDestination(value)).toBe('/sign-in?redirect_url=%2Fapp');
});

it('does not call Clerk in local configurations without a publishable key',()=>{
 vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY','');
 render(<ReconnectButton returnTo="/app/settings?section=subscription"/>);
 expect(screen.getByRole('link',{name:'Se reconnecter'})).toHaveAttribute('href','/sign-in?redirect_url=%2Fapp%2Fsettings');
 expect(clerk.signOut).not.toHaveBeenCalled();
});
