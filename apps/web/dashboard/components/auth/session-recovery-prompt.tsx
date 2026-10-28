'use client';
import { ShieldCheck } from 'lucide-react';
import { ReconnectButton } from './reconnect-button';

export function SessionRecoveryPrompt({returnTo}:{returnTo:string}){
 return <div className="fixed inset-0 z-[80] grid place-items-center bg-black/35 p-4" role="alertdialog" aria-modal="true" aria-labelledby="session-recovery-title" aria-describedby="session-recovery-description"><section className="w-full max-w-sm rounded-xl border border-[#dfe3e4] bg-white p-6 shadow-xl"><div className="mb-4 inline-flex rounded-lg bg-[#e8f8ef] p-2 text-[#087a46]"><ShieldCheck size={22} aria-hidden="true"/></div><h2 id="session-recovery-title" className="text-lg font-semibold text-[#242a30]">Retrouvons votre connexion</h2><p id="session-recovery-description" className="mt-2 text-sm leading-6 text-[#69747f]">Votre connexion n’a pas pu être validée. Reconnectez-vous pour accéder à votre espace.</p><ReconnectButton returnTo={returnTo} className="mt-5"/></section></div>;
}
