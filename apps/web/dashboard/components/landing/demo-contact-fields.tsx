"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';
import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/max';
import 'flag-icons/css/flag-icons.min.css';
import styles from './demo-contact-fields.module.css';

type Locale = 'fr' | 'en';
type Country = {code: CountryCode; name: string; dial: string};
function Flag({code}:{code:CountryCode}) {return <span aria-hidden="true" className={`fi fi-${code.toLowerCase()} ${styles.flag}`}/>;}
function searchable(value:string) {return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}

function CountryPicker({label,value,change,countries,dial=false,locale}:{label:string;value:CountryCode|'';change:(code:CountryCode)=>void;countries:Country[];dial?:boolean;locale:Locale}) {
  const id=useId();
  const root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),search=useRef<HTMLInputElement>(null);
  const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[active,setActive]=useState(0);
  const selected=countries.find(item=>item.code===value);
  const options=countries.filter(item=>searchable(`${item.name} ${item.code} +${item.dial}`).includes(searchable(query)));
  useEffect(()=>{
    if(!open)return;
    search.current?.focus();
    const outside=(event:MouseEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false);};
    document.addEventListener('mousedown',outside);
    return()=>document.removeEventListener('mousedown',outside);
  },[open]);
  useEffect(()=>{if(open)document.getElementById(`${id}-option-${active}`)?.scrollIntoView?.({block:'nearest'});},[active,open,id]);
  function choose(code:CountryCode){change(code);setOpen(false);setQuery('');trigger.current?.focus();}
  function keys(event:KeyboardEvent){
    if(event.key==='Escape'&&open){event.preventDefault();event.stopPropagation();setOpen(false);trigger.current?.focus();}
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){
      event.preventDefault();
      if(!open){setOpen(true);setQuery('');setActive(0);}else setActive(index=>Math.max(0,Math.min(options.length-1,index+(event.key==='ArrowDown'?1:-1))));
    }
    if(event.key==='Enter'&&open){event.preventDefault();if(options[active])choose(options[active].code);}
  }
  return <div ref={root} className={styles.picker} onKeyDown={keys} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setOpen(false);}}>
    <button ref={trigger} id={`${id}-trigger`} type="button" className={styles.trigger} aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={open?`${id}-list`:undefined}
      onClick={()=>{setOpen(value=>!value);setQuery('');setActive(0);}}>
      {selected?<><Flag code={selected.code}/><span>{dial?`+${selected.dial}`:selected.name}</span></>:<span className={styles.placeholder}>{dial?(locale==='fr'?'Indicatif':'Code'):(locale==='fr'?'Sélectionner un pays':'Select a country')}</span>}
      <ChevronDown size={14} aria-hidden="true"/>
    </button>
    {open&&<div className={`${styles.menu} ${dial?'':styles.countryMenu}`}>
      <div className={styles.search}><Search size={15} aria-hidden="true"/><input ref={search} type="search" role="combobox" aria-label={locale==='fr'?'Rechercher un pays ou indicatif':'Search country or calling code'} aria-expanded="true" aria-controls={`${id}-list`} aria-autocomplete="list" aria-activedescendant={options.length?`${id}-option-${active}`:undefined}
        value={query} onChange={event=>{setQuery(event.target.value);setActive(0);}} placeholder={locale==='fr'?'Pays ou indicatif…':'Country or calling code…'}/></div>
      <div role="listbox" id={`${id}-list`} aria-label={label} className={styles.options}>
        {options.map((item,index)=><button type="button" role="option" tabIndex={-1} id={`${id}-option-${index}`} aria-selected={item.code===value} key={item.code} className={`${styles.option} ${index===active?styles.active:''}`}
          onMouseEnter={()=>setActive(index)} onClick={()=>choose(item.code)}><Flag code={item.code}/><span>{item.name}</span><small>+{item.dial}</small>{item.code===value&&<Check size={14} aria-hidden="true"/>}</button>)}
      </div>
      {!options.length&&<p className={styles.empty}>{locale==='fr'?'Aucun pays correspondant.':'No matching countries.'}</p>}
    </div>}
  </div>;
}

export function DemoContactFields({locale,countryLabel,phoneLabel}:{locale:Locale;countryLabel:string;phoneLabel:string}) {
  const countries=useMemo(()=>{
    const names=new Intl.DisplayNames([locale],{type:'region'});
    return getCountries().map(code=>({code,name:names.of(code)||code,dial:getCountryCallingCode(code)})).sort((a,b)=>a.name.localeCompare(b.name,locale));
  },[locale]);
  const [country,setCountry]=useState<CountryCode|''>(''),[region,setRegion]=useState<CountryCode|''>(''),[phone,setPhone]=useState(''),[touched,setTouched]=useState(false);
  const manualRegion=useRef(false),input=useRef<HTMLInputElement>(null);
  const id=useId();
  const parsed=parsePhoneNumberFromString(phone.replace(/^00/,'+'),{defaultCountry:region||undefined,extract:false});
  const valid=!phone.trim()||Boolean(parsed?.isValid()&&!parsed.ext);
  const error=locale==='fr'?'Vérifiez le numéro et l’indicatif du pays.':'Check the phone number and country calling code.';
  useEffect(()=>{input.current?.setCustomValidity(valid?'':error);},[valid,error]);
  function changePhone(value:string){
    setPhone(value);
    if(/^(\+|00)/.test(value)){
      const detected=parsePhoneNumberFromString(value.replace(/^00/,'+'),{extract:false})?.country;
      if(detected){setRegion(detected);manualRegion.current=true;}
    }
  }
  return <>
    <div className={styles.field}><span>{countryLabel}</span><CountryPicker label={countryLabel} value={country} countries={countries} locale={locale} change={code=>{setCountry(code);if(!manualRegion.current)setRegion(code);}}/>
      <input type="hidden" name="country" value={countries.find(item=>item.code===country)?.name||''}/>
    </div>
    <div className={`${styles.field} ${styles.phoneField}`}><label htmlFor={id}>{phoneLabel}</label>
      <div className={styles.phoneRow}><CountryPicker label={locale==='fr'?'Choisir l’indicatif téléphonique':'Choose country calling code'} value={region} countries={countries} locale={locale} dial change={code=>{manualRegion.current=true;setRegion(code);}}/>
        <input ref={input} id={id} type="tel" inputMode="tel" autoComplete="tel-national" maxLength={40} value={phone} onChange={event=>changePhone(event.target.value)} onBlur={()=>setTouched(true)}
          onInvalid={()=>setTouched(true)} placeholder={locale==='fr'?'Numéro de téléphone':'Phone number'} aria-invalid={touched&&!valid} aria-describedby={`${id}-hint`}/>
      </div>
      <input type="hidden" name="phone" value={phone.trim()&&parsed?.isValid()&&!parsed.ext?parsed.number:phone.trim()}/>
      <p id={`${id}-hint`} className={touched&&!valid?styles.error:styles.hint}>{touched&&!valid?error:(locale==='fr'?'Choisissez l’indicatif, puis saisissez votre numéro.':'Choose a calling code, then enter your number.')}</p>
    </div>
  </>;
}
