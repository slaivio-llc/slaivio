import { expect, it } from 'vitest';
import { accountDisplayName } from './account-identity';

it('keeps the email out of the display name even without a personal name',()=>{
  expect(accountDisplayName({primaryEmailAddress:{emailAddress:'agent@example.com'}})).toBe('Mon compte');
  expect(accountDisplayName({fullName:'agent@example.com',primaryEmailAddress:{emailAddress:'agent@example.com'}})).toBe('Mon compte');
  expect(accountDisplayName({fullName:'Awa Sossou',primaryEmailAddress:{emailAddress:'awa@example.com'}})).toBe('Awa Sossou');
  expect(accountDisplayName({firstName:'Awa'})).toBe('Awa');
});
