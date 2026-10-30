import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import type {ReactNode} from 'react';
import {beforeEach,it,expect,vi} from 'vitest';
import JoinPage from './page';

const state=vi.hoisted(()=>({signedIn:true,params:new URLSearchParams('agency=agency-1'),post:vi.fn(),signIn:vi.fn(),signUp:vi.fn()}));
vi.mock('@clerk/nextjs',()=>({
 useUser:()=>({isLoaded:true,isSignedIn:state.signedIn,user:{primaryEmailAddress:{emailAddress:'finance@example.com'}}}),
 SignIn:(props:unknown)=>{state.signIn(props);return <p>Sign in</p>;},
 SignUp:(props:unknown)=>{state.signUp(props);return <p>Sign up</p>;},
}));
vi.mock('next/navigation',()=>({useSearchParams:()=>state.params}));
vi.mock('@/components/auth/auth-shell',()=>({AuthShell:({children}:{children:ReactNode})=><main>{children}</main>}));
vi.mock('@/components/auth/reconnect-button',()=>({ReconnectButton:()=> <p>Change account</p>}));
vi.mock('@/services/api',()=>({api:{post:state.post}}));
beforeEach(()=>{
 vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY','pk_test_mock');
 state.signedIn=true;state.params=new URLSearchParams('agency=agency-1');
 state.post.mockReset();state.signIn.mockClear();state.signUp.mockClear();
});
it('does not select an agency merely by opening an invitation URL',()=>{
 render(<JoinPage/>);
 expect(screen.getByText('finance@example.com')).toBeVisible();
 expect(state.post).not.toHaveBeenCalled();
});
it('requires server confirmation and keeps a failed verification closed',async()=>{
 state.post.mockRejectedValue(new Error('403'));
 render(<JoinPage/>);
 fireEvent.click(screen.getByRole('button',{name:'Ouvrir mon espace dans l’agence'}));
 await screen.findByRole('alert');
 expect(state.post).toHaveBeenCalledWith('/organization/invitations/complete',{org_id:'agency-1'});
 expect(screen.getByRole('alert')).toHaveTextContent('n’a pas pu être confirmé');
});
it('uses only server-verified agencies as explicit choices',async()=>{
 state.params=new URLSearchParams();
 state.post.mockResolvedValue({data:{status:'select_agency',agencies:[{id:'trusted',name:'Agence vérifiée'}]}});
 render(<JoinPage/>);
 fireEvent.click(screen.getByRole('button',{name:'Ouvrir mon espace dans l’agence'}));
 await screen.findByRole('button',{name:'Agence vérifiée'});
 state.post.mockRejectedValue(new Error('unavailable'));
 fireEvent.click(screen.getByRole('button',{name:'Agence vérifiée'}));
 await waitFor(()=>expect(state.post).toHaveBeenLastCalledWith('/organization/invitations/complete',{org_id:'trusted'}));
 await screen.findByRole('alert');
});
it('returns a newly registering invitee to verification, not personal onboarding',()=>{
 state.signedIn=false;state.params=new URLSearchParams('agency=agency-1&__clerk_status=sign_up&__clerk_ticket=test');
 render(<JoinPage/>);
 expect(state.signUp).toHaveBeenCalledWith(expect.objectContaining({forceRedirectUrl:'/join?agency=agency-1',routing:'hash'}));
 expect(state.post).not.toHaveBeenCalled();
});
