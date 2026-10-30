// Shared by agency settings and tariff creation. Always retain a configured
// ISO-style code, including currencies not present in the usual agency list.
export const AGENCY_CURRENCIES = ['USD','CDF','EUR','CNY','AED','XAF','XOF','AOA','GBP','GHS','KES'] as const;

export function agencyCurrency(value:unknown):string {
  const code=typeof value==='string'?value.trim().toUpperCase():'';
  return /^[A-Z]{3}$/.test(code)?code:'USD';
}

export function agencyCurrencyOptions(value:unknown):string[] {
  return [...new Set([agencyCurrency(value),...AGENCY_CURRENCIES])];
}
