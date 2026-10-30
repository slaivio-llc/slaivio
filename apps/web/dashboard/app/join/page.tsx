'use client';
import {useRef,useState} from 'react';
import {SignIn,SignUp,useUser} from '@clerk/nextjs';
import {useSearchParams} from 'next/navigation';
import {AuthShell} from '@/components/auth/auth-shell';
import {clerkAppearance} from '@/components/auth/clerk-appearance';
import {SlaivioLogoLoader} from '@/components/ui/slaivio-logo-loader';
import {OperationButton} from '@/components/ui/operation-controls';
import {api} from '@/services/api';
import {ReconnectButton} from '@/components/auth/reconnect-button';

export default function JoinPage(){
 if(!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)return <AuthShell title="Invitation indisponible" description="La connexion à votre équipe ne peut pas être préparée pour le moment. Réessayez plus tard ou contactez le support SLAIVIO."><p role="alert">Le service de connexion n’est pas configuré.</p></AuthShell>;
 return <AuthShell title="Rejoignez votre équipe" description="Retrouvez l’agence et les accès qui vous ont été attribués pour gérer les colis et le fret."><InvitationContent/></AuthShell>;
}
function InvitationContent(){
 const {isLoaded,isSignedIn,user}=useUser();const params=useSearchParams();
 const agency=params.get('agency'),status=params.get('__clerk_status');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[choices,setChoices]=useState<Array<{id:string;name:string}>>([]);
 const pending=useRef(false);
 const returnTo=agency?`/join?agency=${encodeURIComponent(agency)}`:'/join';
 async function complete(org=agency){
  if(pending.current)return;pending.current=true;setBusy(true);setError('');
  try{
   const {data}=await api.post<{status:string;agencies?:Array<{id:string;name:string}>}>('/organization/invitations/complete',{org_id:org||null});
   if(data.status==='select_agency'){setChoices(data.agencies||[]);setBusy(false);pending.current=false;return;}
   if(data.status!=='ok')throw new Error('verification_incomplete');
   // Reload all agency-bound providers after the server selected the verified membership.
   window.sessionStorage.removeItem('slaivio:office-context');window.location.replace('/app');
  }catch{setError('L’accès à cette agence n’a pas pu être confirmé. Vérifiez que vous utilisez l’adresse invitée et un lien encore valide, puis réessayez. Si le problème persiste, contactez le responsable de l’agence.');setBusy(false);pending.current=false;}
 }
 if(!isLoaded)return <SlaivioLogoLoader label="Vérification de votre connexion…"/>;
 if(isSignedIn)return <div className="grid gap-4"><p className="text-sm leading-6 text-[#69747f]">Compte connecté : <strong className="break-all font-medium text-[#242a30]">{user.primaryEmailAddress?.emailAddress||'Votre compte'}</strong>. Nous allons vérifier votre appartenance à l’agence avant d’ouvrir votre espace.</p>{error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}{choices.length?<div className="grid gap-3">{choices.map(item=><OperationButton key={item.id} disabled={busy} onClick={()=>void complete(item.id)}>{item.name}</OperationButton>)}</div>:<OperationButton variant="primary" disabled={busy} onClick={()=>void complete()}>{busy?'Vérification de vos accès…':'Ouvrir mon espace dans l’agence'}</OperationButton>}<p className="text-xs leading-5 text-[#69747f]">Ce n’est pas le compte invité ? Déconnectez-vous, puis rouvrez le lien de votre email avec le bon compte.</p><ReconnectButton returnTo="/app"/></div>;
 return status==='sign_up'?<SignUp appearance={clerkAppearance} routing="hash" signInUrl="/sign-in" forceRedirectUrl={returnTo}/>:<SignIn appearance={clerkAppearance} routing="hash" signUpUrl="/sign-up" forceRedirectUrl={returnTo}/>;
}
