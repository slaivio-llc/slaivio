import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { AuthSessionState } from './auth-session-state';

const clerk=vi.hoisted(()=>({signOut:vi.fn()}));
vi.mock('@clerk/nextjs',()=>({useClerk:()=>clerk}));
vi.mock('@/components/ui/slaivio-logo-loader',()=>({SlaivioLogoLoader:()=> <p>Déconnexion en cours</p>}));
beforeEach(()=>vi.clearAllMocks());

it('offers explicit resumption without automatically signing out',()=>{
  render(<AuthSessionState/>);
  expect(screen.getByRole('link',{name:'Reprendre mon activité'})).toHaveAttribute('href','/app');
  expect(clerk.signOut).not.toHaveBeenCalled();
});

it('allows another attempt when explicit sign out fails',async()=>{
  clerk.signOut.mockRejectedValue(new Error('offline'));
  render(<AuthSessionState/>);
  fireEvent.click(screen.getByRole('button',{name:'Se déconnecter'}));
  await waitFor(()=>expect(screen.getByRole('button',{name:'Se déconnecter'})).toBeEnabled());
  expect(clerk.signOut).toHaveBeenCalledWith({redirectUrl:'/sign-in'});
});
