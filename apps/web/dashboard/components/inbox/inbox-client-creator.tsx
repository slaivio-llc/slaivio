"use client";

import { useEffect, useState } from 'react';
import { getTenantContext } from '@/services/tenant';
import type { ClientRecord } from '@/services/clients';
import { PermissionGuard } from '@/components/permissions/permission-guard';
import { InlineClientCreator } from '@/components/clients/inline-client-creator';

export function InboxClientCreator({phone,onCreated}:{phone:string;onCreated:(client:ClientRecord)=>void}) {
  const [cargo,setCargo]=useState(false);
  useEffect(()=>{
    let active=true;
    getTenantContext().then(context=>{if(active)setCargo(['PARCEL_FREIGHT','CARGO'].includes(context.active_tenant?.organization_type));}).catch(()=>undefined);
    return ()=>{active=false;};
  },[]);
  if(!cargo)return null;
  return <PermissionGuard permission="inbox.manage"><PermissionGuard permission="clients.create">
    <InlineClientCreator initialPhone={phone} source="whatsapp" onCreated={onCreated}/>
  </PermissionGuard></PermissionGuard>;
}
