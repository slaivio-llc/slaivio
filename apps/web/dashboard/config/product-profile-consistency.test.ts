import {afterEach,expect,it,vi} from 'vitest';
import {getOrganizationProductProfile,PRODUCT_PROFILES} from './product-profile';

afterEach(()=>vi.unstubAllEnvs());
it.each(['PARCEL_FREIGHT','AGENCY','VEHICLE_IMPORT',undefined])('keeps historical agency type %s in the parcel experience',type=>{
  vi.stubEnv('NEXT_PUBLIC_PRODUCT_PROFILE','PARCEL_FREIGHT');
  vi.stubEnv('NEXT_PUBLIC_PILOT_MODE','1');
  expect(getOrganizationProductProfile(type)).toBe(PRODUCT_PROFILES.PARCEL_FREIGHT);
});
it('does not silently delete an explicitly selected legacy profile',()=>{
  expect(getOrganizationProductProfile('CARGO_OS')).toBe(PRODUCT_PROFILES.CARGO_OS);
});
