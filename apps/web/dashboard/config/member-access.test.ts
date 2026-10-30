import {describe,it,expect} from 'vitest';
import {canOpenMemberPath,memberLanding} from './member-access';
import {canAccessRoute,getAppNavigation} from './app-navigation';
import {PRODUCT_PROFILES} from './product-profile';

describe('effective member navigation',()=>{
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
