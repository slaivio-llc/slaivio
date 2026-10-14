"use client";

import { Building2, Check, ChevronDown, Plus, Settings2, Warehouse, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { usePermissions } from "@/components/permissions/permission-provider";
import { FormGeographyFields, PhoneField } from "@/components/ui/geography-fields";
import { OperationButton } from "@/components/ui/operation-controls";
import { OperationDrawer } from "@/components/ui/operation-drawer";
import { createNetworkOffice } from "@/services/organization-network";
import { createTenant, getTenantContext, switchTenant } from "@/services/tenant";

import { operationInputClass, operationMenuClass, operationMenuItemClass } from "@/components/ui/operation-styles";

type Tenant = { org_id:string; organization_name?:string|null; organization_type?:string|null; workspace_kind?:string|null; role_code?:string|null; group_id?:string|null; network_name?:string|null; country?:string|null; city?:string|null };
const inputClass=operationInputClass;

function workspaceLabel(tenant:Tenant){return tenant.workspace_kind==="WAREHOUSE" ? formatWarehouseDisplayName(tenant.organization_name) : formatOfficeDisplayName(tenant.organization_name);}
function normalizedWorkspaceName(value?:string|null){return value?.trim().replace(/\s+/g," ").toLowerCase()||"";}
export function formatOrganizationDisplayName(value?:string|null){const normalized=normalizedWorkspaceName(value);if(!normalized)return "organisation";return normalized.endsWith("'s org")?normalized:`${normalized}'s org`;}
export function formatWarehouseDisplayName(value?:string|null){const normalized=normalizedWorkspaceName(value);if(!normalized)return "entrepôt";return normalized.endsWith("'s warehouse")?normalized:`${normalized}'s warehouse`;}
export function formatOfficeDisplayName(value?:string|null){const normalized=normalizedWorkspaceName(value);if(!normalized)return "bureau";return normalized.endsWith("'s office")?normalized:`${normalized}'s office`;}

export function OrganizationSwitcher({collapsed=false,menuPlacement="up",header=false}:{collapsed?:boolean;menuPlacement?:"up"|"down";header?:boolean}){
  const rootRef=useRef<HTMLDivElement>(null);
  const triggerRef=useRef<HTMLButtonElement>(null);
  const menuId=useId();
  const [search,setSearch]=useState("");
  const {permissions,available}=usePermissions();
  const [tenants,setTenants]=useState<Tenant[]>([]);const [activeTenant,setActiveTenant]=useState<Tenant|null>(null);
  const [loading,setLoading]=useState(true);const [switching,setSwitching]=useState(false);const [open,setOpen]=useState(false);const [createOpen,setCreateOpen]=useState(false);
  const [organizationName,setOrganizationName]=useState("");const [creating,setCreating]=useState(false);const [error,setError]=useState("");const [workspaceKind,setWorkspaceKind]=useState<"OFFICE"|"WAREHOUSE">("OFFICE");
  const parcelFreight=["PARCEL_FREIGHT","CARGO"].includes(activeTenant?.organization_type||"");const networkConfigured=parcelFreight&&Boolean(activeTenant?.group_id);
  const canManageNetwork=available&&permissions.some(permission=>["network.read","network.offices.manage","network.members.manage"].includes(permission));
  const canCreateOffice=parcelFreight&&available&&permissions.includes("network.offices.manage");
  const networkTenants=activeTenant?.group_id?tenants.filter(tenant=>tenant.group_id===activeTenant.group_id):[];
  const otherTenants=activeTenant?.group_id?tenants.filter(tenant=>tenant.group_id!==activeTenant.group_id):tenants;
  const activeLabel=parcelFreight?workspaceLabel(activeTenant!):formatOrganizationDisplayName(activeTenant?.organization_name);

  const load=useCallback(async()=>{try{const data=await getTenantContext();setTenants(data.tenants||[]);setActiveTenant(data.active_tenant||null);setError("");}catch{setError("Espaces indisponibles");}finally{setLoading(false);}},[]);
  useEffect(()=>{load();},[load]);
  useEffect(()=>{function outside(event:MouseEvent){if(!rootRef.current?.contains(event.target as Node))setOpen(false);}document.addEventListener("mousedown",outside);return()=>document.removeEventListener("mousedown",outside);},[]);

  useEffect(()=>{if(!open)return;setSearch("");const frame=requestAnimationFrame(()=>rootRef.current?.querySelector<HTMLElement>("[data-workspace-menu] input, [data-workspace-menu] button")?.focus());return()=>cancelAnimationFrame(frame);},[open]);
  function closeMenu(){setOpen(false);triggerRef.current?.focus();}
  function matching(tenant:Tenant){return `${tenant.organization_name||""} ${tenant.city||""} ${tenant.country||""}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());}

  async function handleSwitch(tenant:Tenant){if(switching)return;if(tenant.org_id===activeTenant?.org_id){setOpen(false);return;}setSwitching(true);setError("");try{await switchTenant(tenant.org_id);window.sessionStorage.removeItem("slaivio:dashboard-home");window.location.reload();}catch{setError("Changement impossible");setSwitching(false);}}
  async function handleCreate(event:React.FormEvent<HTMLFormElement>){event.preventDefault();const form=new FormData(event.currentTarget);setCreating(true);setError("");try{if(parcelFreight){const value=(key:string)=>String(form.get(key)||"").trim();await createNetworkOffice({workspace_kind:value("workspace_kind") as "OFFICE"|"WAREHOUSE",organization_name:value("organization_name"),office_code:value("office_code"),country:value("country"),country_code:value("country_code"),city:value("city"),currency_code:value("currency_code")||"USD",timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC",address:[value("address_line_1"),value("address_line_2")].filter(Boolean).join("\n")||null,phone:value("phone")||null,email:value("email")||null});setCreateOpen(false);await load();}else{const name=organizationName.trim();if(name.length<2){setError("Saisissez un nom d’organisation.");return;}await createTenant(name);window.sessionStorage.removeItem("slaivio:dashboard-home");window.location.assign("/onboarding");}}catch{setError(parcelFreight?`La création du ${workspaceKind==="WAREHOUSE"?"entrepôt":"bureau"} a échoué.`:"La création de l’organisation a échoué.");}finally{setCreating(false);}}
  function tenantRow(tenant:Tenant,office=false){
    const Icon=tenant.workspace_kind==="WAREHOUSE"?Warehouse:Building2;
    const label=(office||["PARCEL_FREIGHT","CARGO"].includes(tenant.organization_type||""))?workspaceLabel(tenant):formatOrganizationDisplayName(tenant.organization_name);
    return <button key={tenant.org_id} type="button" disabled={switching} onClick={()=>handleSwitch(tenant)} aria-current={tenant.org_id===activeTenant?.org_id?"true":undefined} className={operationMenuItemClass}>
      <Icon size={15} aria-hidden="true" className="shrink-0 text-slate-400"/><span className="min-w-0 flex-1 py-1"><span className="block truncate font-medium">{label}</span>{(tenant.city||tenant.country)&&<span className="mt-0.5 block truncate text-xs text-slate-500">{[tenant.city,tenant.country].filter(Boolean).join(" · ")}</span>}</span>{tenant.org_id===activeTenant?.org_id&&<Check size={15} aria-label="Actif" className="shrink-0 text-emerald-700"/>}
    </button>;
  }

  return <div ref={rootRef} onKeyDown={event=>{if(event.key==="Escape"&&open){event.stopPropagation();closeMenu();}if(open&&["ArrowDown","ArrowUp"].includes(event.key)&&event.target instanceof HTMLButtonElement){const choices=Array.from(rootRef.current?.querySelectorAll<HTMLElement>("[data-workspace-menu] button:not(:disabled),[data-workspace-menu] a")||[]);const index=choices.indexOf(event.target);event.preventDefault();choices[(index+(event.key==="ArrowDown"?1:-1)+choices.length)%choices.length]?.focus();}}} className={`relative ${collapsed?"lg:p-0":""} ${header?"w-[min(190px,44vw)]":""}`}>
    <button ref={triggerRef} type="button" aria-controls={open?menuId:undefined} aria-label={activeLabel} onClick={()=>setOpen(value=>!value)} disabled={loading||switching} aria-expanded={open} title={collapsed?activeLabel:undefined} className={`flex w-full items-center rounded-[6px] border border-[#d8dadd] bg-white text-left shadow-[0_1px_1px_rgba(15,23,42,.03)] hover:border-[#c7cbcf] hover:bg-[#f7f7f6] disabled:opacity-60 ${header?"min-h-9 gap-2 px-3":"min-h-10"} ${collapsed?"lg:justify-center lg:px-1":header?"":"gap-2 px-3"}`}>
      {(collapsed||header)&&<Building2 size={16} className={`${collapsed?"hidden lg:block":""} shrink-0 text-[#16855f]`}/>}<span className={`min-w-0 flex-1 ${collapsed?"lg:hidden":""}`}><span className="block truncate text-[13px] font-medium text-[#25292e]">{loading?"…":activeTenant?activeLabel:"Choisir un espace"}</span></span><ChevronDown size={15} className={`shrink-0 text-[#73777c] transition ${collapsed?"lg:hidden":""} ${open?"rotate-180":""}`}/>
    </button>
    {open&&<div id={menuId} data-workspace-menu className={`absolute z-50 w-[280px] max-w-[calc(100vw-24px)] ${operationMenuClass} ${collapsed?"bottom-0 left-[48px]":menuPlacement==="down"?header?"right-0 top-[44px]":"left-0 top-[48px]":"bottom-[48px] left-0"}`}>
      <div className="flex items-center justify-between px-2.5 py-1.5"><span className="text-xs font-medium text-slate-500">{parcelFreight?"Changer d’espace":"Changer d’organisation"}</span><button type="button" onClick={closeMenu} className="rounded-md p-1 text-slate-400 hover:bg-slate-50" aria-label="Fermer"><X size={14}/></button></div>
      {tenants.length>6&&<input type="search" aria-label="Rechercher un espace" placeholder="Rechercher…" value={search} onChange={event=>setSearch(event.target.value)} className={inputClass}/>}
      <div className="max-h-64 overflow-y-auto py-1">
        {networkConfigured&&networkTenants.filter(matching).map(tenant=>tenantRow(tenant,true))}
        {networkConfigured&&otherTenants.some(matching)&&<p className="px-2.5 pb-1 pt-2 text-xs text-slate-400">Autres entreprises</p>}
        {(networkConfigured?otherTenants:tenants).filter(matching).map(tenant=>tenantRow(tenant,false))}
        {!tenants.some(matching)&&<p className="px-2.5 py-3 text-xs text-slate-500">Aucun espace trouvé.</p>}
      </div>
      {(canCreateOffice||parcelFreight&&canManageNetwork||!parcelFreight)&&<div className="mt-1 border-t border-slate-100 pt-1">
        {canCreateOffice&&<button type="button" className={operationMenuItemClass} onClick={()=>{setOpen(false);setError("");setCreateOpen(true);}}><Plus size={15}/>Créer un bureau ou entrepôt</button>}
        {parcelFreight&&canManageNetwork&&<Link href="/app/settings?section=network" onClick={()=>setOpen(false)} className={operationMenuItemClass}><Settings2 size={15}/>Réseau et équipe</Link>}
        {!parcelFreight&&<button type="button" className={operationMenuItemClass} onClick={()=>{setOpen(false);setError("");setCreateOpen(true);}}><Plus size={15}/>Créer une organisation</button>}
      </div>}
    </div>}
    {error&&<p className="mt-1 px-1 text-[11px] text-red-600">{error}</p>}
    <OperationDrawer
      open={createOpen}
      close={()=>{if(!creating)setCreateOpen(false);}}
      title={parcelFreight?"Créer un bureau ou entrepôt":"Créer une organisation"}
      description={parcelFreight?"Ajoutez une implantation à votre réseau, avec ses coordonnées et son contexte opérationnel.":"Un espace indépendant pour votre entreprise."}
      width={parcelFreight?"max-w-4xl":"max-w-xl"}
      placement="center"
      bodyClassName={parcelFreight?"bg-[#f5f7f8] p-4 sm:p-8":""}
      headerLeading={parcelFreight&&<div className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-50 text-emerald-700">{workspaceKind==="WAREHOUSE"?<Warehouse size={21}/>:<Building2 size={21}/>}</div>}
      footer={<><OperationButton type="button" onClick={()=>setCreateOpen(false)} disabled={creating}>Annuler</OperationButton><OperationButton type="submit" form="create-workspace-form" variant="primary" disabled={creating||(!parcelFreight&&organizationName.trim().length<2)}>{creating?"Création…":parcelFreight?`Créer ${workspaceKind==="WAREHOUSE"?"l’entrepôt":"le bureau"}`:"Créer"}</OperationButton></>}
    >
      <form id="create-workspace-form" onSubmit={handleCreate} className={parcelFreight?"mx-auto grid w-full max-w-3xl gap-5":"grid gap-4"}>
        {parcelFreight?<>
          <section className="rounded-2xl border border-[#e4e9e8] bg-white p-5 shadow-[0_2px_10px_rgba(20,35,32,.03)] sm:p-6">
            <div className="mb-4">
              <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-emerald-700">01 · Type d’implantation</p>
              <h3 className="mt-1 text-[16px] font-semibold text-[#222a30]">Que souhaitez-vous ajouter ?</h3>
              <p className="mt-1 text-[13px] text-[#69747c]">Vous pourrez créer d’autres implantations plus tard.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {([
                {kind:"OFFICE" as const,label:"Bureau",hint:"Accueil, dépôt ou retrait",Icon:Building2},
                {kind:"WAREHOUSE" as const,label:"Entrepôt",hint:"Stockage et opérations physiques",Icon:Warehouse},
              ]).map(({kind,label,hint,Icon})=><label key={kind} className={`flex min-h-[82px] cursor-pointer items-center gap-3 rounded-xl border p-4 transition focus-within:ring-2 focus-within:ring-emerald-600/20 ${workspaceKind===kind?"border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-600/10":"border-[#e4e8eb] hover:border-[#b8c5c0] hover:bg-[#fafcfb]"}`}>
                <input className="sr-only" type="radio" name="workspace_kind" value={kind} checked={workspaceKind===kind} onChange={()=>setWorkspaceKind(kind)}/>
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${workspaceKind===kind?"bg-white text-emerald-700":"bg-[#f3f5f5] text-[#68747b]"}`}><Icon size={19}/></span>
                <span className="min-w-0 flex-1"><span className="block text-[14px] font-semibold text-[#283138]">{label}</span><span className="mt-0.5 block text-[12px] text-[#6b757d]">{hint}</span></span>
                <span aria-hidden="true" className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${workspaceKind===kind?"border-emerald-600 bg-emerald-600 text-white":"border-[#c9d0d4] bg-white"}`}>{workspaceKind===kind&&<Check size={13}/>}</span>
              </label>)}
            </div>
          </section>
          <section className="rounded-2xl border border-[#e4e9e8] bg-white p-5 shadow-[0_2px_10px_rgba(20,35,32,.03)] sm:p-6">
            <div className="mb-4">
              <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-emerald-700">02 · Identification</p>
              <h3 className="mt-1 text-[16px] font-semibold text-[#222a30]">Les informations de l’espace</h3>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-[13px] font-semibold text-[#414950]">Nom de l’espace<input required name="organization_name" maxLength={120} autoFocus placeholder={workspaceKind==="WAREHOUSE"?"Ex. Entrepôt Guangzhou":"Ex. Bureau de Kinshasa"} className={`${inputClass} h-11 rounded-lg px-3.5 text-[14px]`}/></label>
              <label className="grid gap-2 text-[13px] font-semibold text-[#414950]">Code de l’espace<input required name="office_code" pattern="[A-Za-z0-9_-]{2,30}" placeholder="Ex. KIN-01" className={`${inputClass} h-11 rounded-lg px-3.5 text-[14px]`}/><span className="-mt-1 text-[11px] font-normal text-[#7a858c]">Identifiant court utilisé par votre équipe.</span></label>
            </div>
          </section>
          <section className="rounded-2xl border border-[#e4e9e8] bg-white p-5 shadow-[0_2px_10px_rgba(20,35,32,.03)] sm:p-6">
            <div className="mb-4">
              <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-emerald-700">03 · Localisation et contact</p>
              <h3 className="mt-1 text-[16px] font-semibold text-[#222a30]">Où se trouve cet espace ?</h3>
              <p className="mt-1 text-[13px] text-[#69747c]">Ces informations aideront votre équipe à identifier la bonne implantation.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormGeographyFields required countryCodeName="country_code" className={`${inputClass} h-11 rounded-lg px-3.5 text-[14px]`} fieldClassName="grid gap-2 text-[13px] font-semibold text-[#414950]"/>
              <label className="grid gap-2 text-[13px] font-semibold text-[#414950]">Devise<select name="currency_code" className={`${inputClass} h-11 rounded-lg px-3.5 text-[14px]`} defaultValue="USD"><option>USD</option><option>EUR</option><option>CDF</option><option>AOA</option><option>CNY</option><option>XOF</option></select></label>
              <label className="grid gap-2 text-[13px] font-semibold text-[#414950]">Téléphone <span className="font-normal text-[#849097]">· facultatif</span><PhoneField name="phone" className={`${inputClass} h-11 rounded-lg px-3.5 text-[14px]`}/></label>
              <label className="grid gap-2 text-[13px] font-semibold text-[#414950]">Email <span className="font-normal text-[#849097]">· facultatif</span><input name="email" type="email" placeholder="contact@entreprise.com" className={`${inputClass} h-11 rounded-lg px-3.5 text-[14px]`}/></label>
              <label className="grid gap-2 text-[13px] font-semibold text-[#414950] sm:col-span-2">Adresse · ligne 1 <span className="font-normal text-[#849097]">· facultative</span><input name="address_line_1" placeholder="Rue, numéro et repère utile" className={`${inputClass} h-11 rounded-lg px-3.5 text-[14px]`}/></label>
              <label className="grid gap-2 text-[13px] font-semibold text-[#414950] sm:col-span-2">Complément d’adresse <span className="font-normal text-[#849097]">· facultatif</span><input name="address_line_2" placeholder="Bâtiment, étage, quartier…" className={`${inputClass} h-11 rounded-lg px-3.5 text-[14px]`}/></label>
            </div>
          </section>
        </>:<label htmlFor="organization-name" className="grid gap-2 text-[13px] font-semibold text-[#414950]">Nom de l’organisation<input id="organization-name" value={organizationName} onChange={event=>setOrganizationName(event.target.value)} maxLength={120} autoFocus placeholder="Ex. Slaivio France" className={inputClass}/></label>}
        {error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</p>}
      </form>
    </OperationDrawer>
  </div>;
}
