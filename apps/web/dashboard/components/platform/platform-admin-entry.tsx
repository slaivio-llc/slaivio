'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { platformAccess } from '@/services/platform-admin';
import { operationMenuItemClass } from '@/components/ui/operation-styles';

export function PlatformAdminEntry({close}:{close:()=>void}) {
  const [allowed,setAllowed]=useState(false);
  useEffect(()=>{let active=true;platformAccess().then(value=>{if(active)setAllowed(value===true);}).catch(()=>{if(active)setAllowed(false);});return()=>{active=false;};},[]);
  return allowed?<Link href="/app/platform" onClick={close} className={operationMenuItemClass}><ShieldCheck size={16}/>Super Admin SLAIVIO</Link>:null;
}
