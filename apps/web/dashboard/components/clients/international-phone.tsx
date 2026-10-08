"use client";

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/max';

const names = new Intl.DisplayNames(['fr'], { type: 'region' });
const countries = getCountries().map(code => ({ code, name: names.of(code) || code, dial: getCountryCallingCode(code) }))
  .sort((a, b) => a.name.localeCompare(b.name, 'fr'));

export function InternationalPhone({defaultValue = '', required = false, className = ''}: {
  defaultValue?: string; required?: boolean; className?: string;
}) {
  const initial = parsePhoneNumberFromString(defaultValue);
  const [country, setCountry] = useState<CountryCode | ''>(initial?.country || '');
  const [value, setValue] = useState(defaultValue);
  const [query, setQuery] = useState('');
  const [touched, setTouched] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const menu = useRef<HTMLDetailsElement>(null);
  const id = useId();
  const parsed = parsePhoneNumberFromString(value.replace(/^00/, '+'), {defaultCountry: country || undefined, extract: false});
  const valid = !value.trim() || Boolean(parsed?.isValid() && !parsed.ext);
  const error = valid ? '' : 'Saisissez un numéro valide pour le pays choisi, ou avec son indicatif international.';
  useEffect(() => { input.current?.setCustomValidity(error); }, [error]);
  const options = useMemo(() => countries.filter(item =>
    `${item.name} ${item.code} +${item.dial}`.toLocaleLowerCase('fr').includes(query.toLocaleLowerCase('fr'))), [query]);
  return <div className="grid gap-2 text-sm">
    <label htmlFor={id}>Téléphone{required ? ' *' : ' (facultatif)'}</label>
    <div className="flex min-w-0 gap-2">
      <details ref={menu} className="relative shrink-0">
        <summary className={`${className} cursor-pointer list-none`} aria-label="Choisir l’indicatif du pays">
          {country ? `${country} +${getCountryCallingCode(country)}` : 'Indicatif'}
        </summary>
        <div className="absolute left-0 top-full z-30 mt-1 w-64 max-w-[80vw] rounded-lg border bg-white p-2 shadow-lg">
          <input aria-label="Rechercher un pays ou indicatif" value={query} onChange={e => setQuery(e.target.value)} className={className} placeholder="Pays ou indicatif"/>
          <div className="mt-2 max-h-48 overflow-y-auto">
            {options.map(item => <button type="button" key={item.code} className="block w-full rounded px-2 py-2 text-left text-sm hover:bg-emerald-50 focus-visible:outline-emerald-600"
              onClick={() => {setCountry(item.code); setQuery(''); if(menu.current) menu.current.open = false; input.current?.focus();}}>
              {item.name} (+{item.dial})
            </button>)}
            {!options.length && <p className="p-2 text-xs">Aucun pays correspondant.</p>}
          </div>
        </div>
      </details>
      <input ref={input} id={id} type="tel" inputMode="tel" autoComplete="tel" required={required}
        value={value} onChange={e => setValue(e.target.value)} onBlur={() => setTouched(true)}
        aria-invalid={touched && !valid} aria-describedby={`${id}-help`}
        className={`${className} min-w-0 flex-1`} placeholder="Numéro de téléphone"/>
    </div>
    <input type="hidden" name="phone" value={parsed?.isValid() && !parsed.ext ? parsed.number : value}/>
    <input type="hidden" name="phone_region" value={country}/>
    <p id={`${id}-help`} className={`text-xs ${touched && error ? 'text-red-700' : 'text-slate-500'}`}>
      {touched && error ? error : 'Choisissez le pays pour un numéro local, ou collez un numéro avec + et son indicatif.'}
    </p>
  </div>;
}
