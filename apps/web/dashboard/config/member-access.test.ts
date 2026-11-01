import {describe,it,expect} from 'vitest';
import {canOpenMemberPath,memberLanding} from './member-access';
import {canAccessRoute,getAppNavigation} from './app-navigation';
import {PRODUCT_PROFILES} from './product-profile';

describe('effective member navigation',()=>{
 const support=['clients.read','clients.create','clients.update','packages.read','shipments.read','dossiers.read','tracking.read','inbox.read','inbox.reply','inbox.manage','pickups.read','pickups.notify'];
 it.each(['/app/operations','/app/operations/packages','/app/packages','/app/packages/parcel','/app/shipments','/app/warehouses','/app/departures','/app/batches','/app/pickups'])('keeps Support outside the operational workspace %s',path=>{
  expect(canOpenMemberPath(path,support,'SUPPORT')).toBe(false);
 });
 it.each(Object.values(PRODUCT_PROFILES))('hides Support operational navigation across the %s product profile',profile=>{
  const routes=getAppNavigation(profile).flatMap(group=>group.routes);
  const visible=routes.filter(route=>canAccessRoute(route,support,true,'SUPPORT')).map(route=>route.href);
  expect(visible).not.toContain('/app/operations');
  expect(visible).not.toContain('/app/packages');
  expect(visible).not.toContain('/app/shipments');
  expect(visible).not.toContain('/app/pickups');
 });
 it('preserves customer context permissions without using them to show the operational workspace',()=>{
  expect(memberLanding(support,'SUPPORT')).toBe('/app/inbox');
  expect(canOpenMemberPath('/app/clients/client',support,'SUPPORT')).toBe(true);
  expect(canOpenMemberPath('/app/inbox',support,'SUPPORT')).toBe(true);
  expect(canOpenMemberPath('/app/communication',support,'SUPPORT')).toBe(true);
  expect(memberLanding(['packages.read'],'SUPPORT')).toBeNull();
  expect(canOpenMemberPath('/app/operations',['packages.read'],'OPERATOR')).toBe(true);
 });
 it.each([
  ['OPERATOR','packages.read','/app/operations'],['SUPPORT','inbox.read','/app/inbox'],
  ['WAREHOUSE','warehouses.read','/app/warehouses'],['WAREHOUSE_SUPERVISOR','warehouses.read','/app/warehouses'],
  ['RECEIVER','warehouses.read','/app/warehouses'],['WEIGHER','warehouses.read','/app/warehouses'],
  ['QUALITY_CONTROLLER','warehouses.read','/app/warehouses'],
  ['COUNTER_AGENT','pickups.read','/app/pickups'],['CASHIER','pickups.read','/app/pickups'],
 ])('opens the assigned workplace for %s without granting extra access',(role,permission,path)=>{
  expect(memberLanding([permission],role)).toBe(path);
  expect(canOpenMemberPath(path,[permission],role)).toBe(true);
  for(const forbidden of ['/app','/app/finance','/app/settings','/app/management']){
   expect(canOpenMemberPath(forbidden,[permission],role)).toBe(false);
  }
  expect(memberLanding([],role)).toBeNull();
 });
 const finance=['finance.read','finance.create','finance.issue','finance.payments','finance.export'];
 it('opens finance without requiring general client or parcel rights',()=>{
  expect(memberLanding(finance,'FINANCE')).toBe('/app/finance');
  expect(canOpenMemberPath('/app/finance/invoice',finance,'FINANCE')).toBe(true);
 });
 it.each(['/app','/app/clients','/app/packages','/app/operations','/app/settings','/app/management','/app/unknown'])('denies %s for Finance',path=>{
  expect(canOpenMemberPath(path,finance,'FINANCE')).toBe(false);
 });
 it('does not show unrelated parent menus or fail open during an outage',()=>{
  const routes=getAppNavigation(PRODUCT_PROFILES.PARCEL_FREIGHT).flatMap(g=>g.routes);
  const visible=routes.filter(r=>canAccessRoute(r,finance,true)).map(r=>r.href);
  expect(visible).toContain('/app/finance');
  expect(visible).not.toContain('/app/operations');
  expect(visible).not.toContain('/app/management');
  expect(routes.filter(r=>canAccessRoute(r,finance,false))).toEqual([]);
 });
 it('keeps owner landing and chooses a custom role landing from its real permissions',()=>{
  expect(memberLanding(finance,'OWNER')).toBe('/app');
  expect(memberLanding(['finance.read'],'CUSTOM_ACCOUNTANT')).toBe('/app/finance');
  expect(memberLanding([],'CUSTOM')).toBeNull();
  expect(memberLanding(['support.read'],'CUSTOM_SUPPORT')).toBe('/app/support');
 });
});
