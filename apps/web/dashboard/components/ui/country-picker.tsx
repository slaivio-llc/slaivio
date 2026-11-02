'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {ChevronDown,Search} from 'lucide-react';
import {dashboardText} from '@/components/i18n/dashboard-messages';
import 'flag-icons/css/flag-icons.min.css';

export function CountryPicker({value,options,label,change,className,required=false,placeholder='Choisir un pays'}:{value:string;options:Array<{code:string;name:string;shortLabel?:string}>;label:string;change:(code:string)=>void;className:string;required?:boolean;placeholder?:string}){
 const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[active,setActive]=useState(0);
 const root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),search=useRef<HTMLInputElement>(null);const id=useId();
 const normalize=(text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const filtered=options.filter(option=>normalize(option.name+' '+option.code).includes(normalize(query)));
 const selected=options.find(option=>option.code===value);
 useEffect(()=>{if(!open)return;search.current?.focus();const outside=(event:MouseEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false);};document.addEventListener('mousedown',outside);return()=>document.removeEventListener('mousedown',outside);},[open]);
 function choose(code:string){change(code);setOpen(false);setQuery('');trigger.current?.focus();}
 return <div ref={root} className="relative min-w-0" onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();setOpen(false);trigger.current?.focus();}if(open&&event.key==='ArrowDown'){event.preventDefault();setActive(index=>Math.min(index+1,filtered.length-1));}if(open&&event.key==='ArrowUp'){event.preventDefault();setActive(index=>Math.max(0,index-1));}if(open&&event.key==='Enter'){event.preventDefault();if(filtered[active])choose(filtered[active].code);}}}>
  <button ref={trigger} type="button" aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={open?id:undefined} onClick={()=>{setOpen(!open);setQuery('');setActive(0);}} className={`${className} flex items-center gap-2 text-left`}>
   {selected&&<span aria-hidden="true" className={`fi fi-${selected.code.toLowerCase()} shrink-0 rounded-sm`}/>}<span className="min-w-0 flex-1 truncate">{selected?.shortLabel||selected?.name||dashboardText(placeholder)}</span><ChevronDown size={14} className="shrink-0"/>
  </button>
  {required&&<select aria-hidden="true" tabIndex={-1} required value={selected?.code||''} onChange={event=>choose(event.target.value)} onInvalid={event=>{event.preventDefault();trigger.current?.focus();setOpen(true);}} className="pointer-events-none absolute left-0 top-0 h-px w-px opacity-0"><option value=""/>{options.map(option=><option key={option.code} value={option.code}>{option.name}</option>)}</select>}
  {open&&<div className="absolute left-0 top-full z-50 w-[max(100%,18rem)] max-w-[calc(100vw-4rem)] mt-1 rounded-lg border border-[#dce2de] bg-white p-2 shadow-lg"><div className="flex items-center gap-2 px-2"><Search size={14}/><input ref={search} aria-label={dashboardText('Rechercher un pays')} role="combobox" aria-controls={id} aria-expanded="true" aria-activedescendant={filtered[active]?`${id}-${active}`:undefined} value={query} onChange={event=>{setQuery(event.target.value);setActive(0);}} className="h-9 min-w-0 flex-1 bg-white text-sm outline-none"/></div><div id={id} role="listbox" aria-label={label} className="max-h-56 overflow-y-auto">{filtered.map((option,index)=><button type="button" role="option" id={`${id}-${index}`} aria-selected={option.code===value} key={option.code} onMouseEnter={()=>setActive(index)} onClick={()=>choose(option.code)} className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm ${index===active?'bg-[#edf6f0]':'hover:bg-[#f6f8f7]'}`}><span aria-hidden="true" className={`fi fi-${option.code.toLowerCase()} shrink-0 rounded-sm`}/>{option.name}</button>)}{!filtered.length&&<p className="p-2 text-xs text-[#697178]">{dashboardText('Aucun pays trouvé')}</p>}</div></div>}
 </div>;
}
