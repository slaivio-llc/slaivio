import {expect,it} from 'vitest';
import {AGENCY_CURRENCIES,agencyCurrency,agencyCurrencyOptions} from './currencies';

it('shares all settings currencies without duplicates',()=>{
 const values=agencyCurrencyOptions('CNY');
 expect(values[0]).toBe('CNY');
 expect(new Set(values).size).toBe(values.length);
 for(const code of AGENCY_CURRENCIES)expect(values).toContain(code);
});
it('retains and normalizes currencies configured outside the usual list',()=>{
 expect(agencyCurrency(' sar ')).toBe('SAR');
 expect(agencyCurrencyOptions('sar')).toContain('SAR');
 expect(agencyCurrency(undefined)).toBe('USD');
 expect(agencyCurrency('invalid')).toBe('USD');
});
