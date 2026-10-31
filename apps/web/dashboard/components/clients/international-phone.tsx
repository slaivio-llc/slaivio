"use client";
import {dashboardText,useDashboardMessages} from '@/components/i18n/dashboard-messages';


import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/max';

export function InternationalPhone({defaultValue = '', required = false, className = '', label = 'Téléphone', showHelp = true}: {
  defaultValue?: string; required?: boolean; className?: string; label?: string; showHelp?: boolean;
}) {
  const locale=useDashboardMessages();
  const countries=useMemo(()=>{
    const names=new Intl.DisplayNames([locale],{type:'region'});
    return getCountries().map(code=>({code,name:names.of(code)||code,dial:getCountryCallingCode(code)})).sort((a,b)=>a.name.localeCompare(b.name,locale));
  },[locale]);
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
  const controlHeight = /\bh-10\b/.test(className) ? 'h-10' : 'h-9';
  useEffect(() => { input.current?.setCustomValidity(dashboardText(error)); }, [error,locale]);
  const options = useMemo(() => countries.filter(item =>
    `${item.name} ${item.code} +${item.dial}`.toLocaleLowerCase(locale).includes(query.toLocaleLowerCase(locale))), [query,countries,locale]);
  return <div className="grid gap-2 text-sm">
    <label htmlFor={id}>{dashboardText(label)}{required ? ' *' : dashboardText(" (facultatif)")}</label>
    <div className="flex min-w-0 gap-2">
      <details ref={menu} className={`relative ${controlHeight} w-[132px] shrink-0`}>
        <summary className={`${className} ${controlHeight} flex w-full cursor-pointer list-none items-center justify-between gap-2`} aria-label={dashboardText("Choisir l’indicatif du pays")}>
          {country ? `${country} +${getCountryCallingCode(country)}` : dashboardText("Indicatif")}
        </summary>
        <div className="absolute left-0 top-full z-30 mt-1 w-64 max-w-[80vw] rounded-lg border bg-white p-2 shadow-lg">
          <input aria-label={dashboardText("Rechercher un pays ou indicatif")} value={query} onChange={e => setQuery(e.target.value)} className={className} placeholder={dashboardText("Pays ou indicatif")}/>
          <div className="mt-2 max-h-48 overflow-y-auto">
            {options.map(item => <button type="button" key={item.code} className="block w-full rounded px-2 py-2 text-left text-sm hover:bg-emerald-50 focus-visible:outline-emerald-600"
              onClick={() => {setCountry(item.code); setQuery(''); if(menu.current) menu.current.open = false; input.current?.focus();}}>
              {item.name} (+{item.dial})
            </button>)}
            {!options.length && <p className="p-2 text-xs">{dashboardText("Aucun pays correspondant.")}</p>}
          </div>
        </div>
      </details>
      <input ref={input} id={id} type="tel" inputMode="tel" autoComplete="tel" required={required}
        value={value} onChange={e => setValue(e.target.value)} onBlur={() => setTouched(true)}
        aria-invalid={touched && !valid} aria-describedby={showHelp || (touched && error) ? `${id}-help` : undefined}
        className={`${className} min-w-0 flex-1`} placeholder={dashboardText("Numéro de téléphone")}/>
    </div>
    <input type="hidden" name="phone" value={parsed?.isValid() && !parsed.ext ? parsed.number : value}/>
    <input type="hidden" name="phone_region" value={country}/>
    {(showHelp || (touched && error)) && <p id={`${id}-help`} className={`text-xs ${touched && error ? 'text-red-700' : 'text-slate-500'}`}>
      {touched && error ? dashboardText(error) : dashboardText("Choisissez le pays pour un numéro local, ou collez un numéro avec + et son indicatif.")}
    </p>}
  </div>;
}
