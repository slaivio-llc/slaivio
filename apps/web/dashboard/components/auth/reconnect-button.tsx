'use client';

import { useRef, useState } from 'react';
import { useClerk } from '@clerk/nextjs';
import Link from 'next/link';

export function reconnectDestination(returnTo:string) {
  // Do not replay an invitation ticket or accept external redirect destinations.
  const path=returnTo.split(/[?#]/,1)[0];
  const safe=path==='/app'||path.startsWith('/app/')||path==='/onboarding'||path.startsWith('/onboarding/')?path:'/app';
  return `/sign-in?redirect_url=${encodeURIComponent(safe)}`;
}

const style='inline-flex min-h-11 items-center justify-center rounded-lg bg-[#087a46] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#06673b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#087a46] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60';

export function ReconnectButton({returnTo='/app',className=''}:{returnTo?:string;className?:string}){
 const destination=reconnectDestination(returnTo);
 if(!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)return <Link className={`${style} ${className}`} href={destination}>Se reconnecter</Link>;
 return <ClerkReconnectButton destination={destination} className={className}/>;
}

function ClerkReconnectButton({destination,className}:{destination:string;className:string}){
 const {signOut}=useClerk();
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const pending=useRef(false);
 async function reconnect(){
  if(pending.current)return;pending.current=true;setBusy(true);setError('');
  try{await signOut({redirectUrl:destination});}
  catch{setError('La déconnexion n’a pas pu être terminée. Vérifiez votre connexion et réessayez.');setBusy(false);pending.current=false;}
 }
 return <div className={className}><button type="button" className={`${style} w-full`} disabled={busy} onClick={()=>void reconnect()}>{busy?'Déconnexion en cours…':'Se reconnecter'}</button>{error&&<p role="alert" className="mt-3 text-sm leading-5 text-red-700">{error}</p>}</div>;
}
