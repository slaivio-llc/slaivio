// Navigation convenience only. Every API still checks the effective agency role.
const modules:ReadonlyArray<readonly [string,readonly string[]]>=[
 ['/app/finance',['finance.read']],['/app/clients',['clients.read']],
 ['/app/operations',['packages.read','shipments.read','warehouses.read','pickups.read']],
 ['/app/packages',['packages.read']],['/app/shipments',['shipments.read']],['/app/warehouses',['warehouses.read']],
 ['/app/departures',['departures.read']],['/app/batches',['batches.read']],['/app/pickups',['pickups.read']],
 ['/app/communication',['inbox.read','followups.read','broadcasts.read','knowledge.read','pilot.knowledge.read']],
 ['/app/inbox',['inbox.read']],['/app/followups',['followups.read']],['/app/broadcasts',['broadcasts.read']],
 ['/app/knowledge',['knowledge.read','pilot.knowledge.read']],['/app/dossiers',['dossiers.read']],
 ['/app/tracking',['tracking.read']],['/app/documents',['documents.read']],['/app/reports',['analytics.read']],
 ['/app/pricing',['pricing.read']],['/app/management',['organization.read','team.read','roles.manage','routes.read','services.read','pricing.read']],
 ['/app/settings',['organization.read','pilot.settings.read']],['/app/support',['support.read']],
 ['/app/assistant',['inbox.read','knowledge.read','pilot.knowledge.read']],['/app/notifications',['notifications.read']],
];
export function memberLanding(permissions:readonly string[],role?:string):string|null{
 if(role==='OWNER'||role==='MANAGER'||permissions.includes('organization.manage'))return '/app';
 if(role==='FINANCE'&&permissions.includes('finance.read'))return '/app/finance';
 for(const path of ['/app/operations','/app/communication','/app/clients','/app/finance','/app/dossiers','/app/reports','/app/management','/app/settings']){
  const entry=modules.find(([key])=>key===path);
  if(entry?.[1].some(p=>permissions.includes(p)))return path;
 }
 return modules.find(([,required])=>required.some(permission=>permissions.includes(permission)))?.[0]||null;
}
export function canOpenMemberPath(path:string,permissions:readonly string[],role?:string):boolean{
 if(path==='/app/platform'||path.startsWith('/app/platform/'))return true; // Protected by independent platform API grants.
 if(path==='/app')return role==='OWNER'||role==='MANAGER'||permissions.includes('organization.manage');
 const entry=modules.find(([key])=>path===key||path.startsWith(key+'/'));
 return Boolean(entry?.[1].some(p=>permissions.includes(p)));
}
