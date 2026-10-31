"use client";
import {dashboardText,useDashboardMessages} from '@/components/i18n/dashboard-messages';


import {useCallback,useEffect,useState,type FormEvent} from 'react';
import {api} from '@/services/api';
import {PermissionGuard} from '@/components/permissions/permission-guard';

type GoodsRule={id:string;goods_name:string;category:string|null;accepted:boolean;requires_manual_validation:boolean};
const field='h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm';

export function GoodsRuleSettings(){
  useDashboardMessages();
  const [rules,setRules]=useState<GoodsRule[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const load=useCallback(async()=>{setLoading(true);try{setRules((await api.get<{rules:GoodsRule[]}>('/goods/rules')).data.rules);}catch{setError('Impossible de charger les règles de marchandises.');}finally{setLoading(false);}},[]);
  useEffect(()=>{void load();},[load]);
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();const form=event.currentTarget;const values=new FormData(form);
    setBusy(true);setError('');
    try{await api.post('/goods/rules',{goods_name:String(values.get('name')||'').trim(),category:String(values.get('category')||'').trim()||null,accepted:values.get('decision')!=='PROHIBITED',requires_manual_validation:values.get('decision')==='REVIEW'});form.reset();await load();}
    catch{setError('La règle n’a pas pu être enregistrée.');}finally{setBusy(false);}
  }
  async function deactivate(id:string){setBusy(true);setError('');try{await api.patch(`/goods/rules/${id}`,{is_active:false});await load();}catch{setError('La règle n’a pas pu être désactivée.');}finally{setBusy(false);}}
  return <section className="grid gap-4 border-t border-slate-200 pt-5">
    <h3 className="text-[15px] font-semibold">{dashboardText("Règles par marchandise")}</h3>
    <p className="text-xs leading-5 text-slate-500">{dashboardText("Ces contrôles utilisent la catégorie ou le nom exact de la marchandise. Les marchandises soumises à vérification doivent être validées avant leur chargement.")}</p>
    {loading?<p className="text-sm text-slate-500">{dashboardText("Chargement des règles…")}</p>:rules.length?<ul className="divide-y divide-slate-100">{rules.map(rule=><li key={rule.id} className="flex items-center justify-between gap-3 py-3 text-sm"><span>{rule.goods_name}{rule.category&&<span className="block text-xs text-slate-500">{rule.category}</span>}<span className="block text-xs text-slate-500">{!rule.accepted?dashboardText("Interdit"):rule.requires_manual_validation?dashboardText("Validation requise"):dashboardText("Accepté")}</span></span><PermissionGuard permission="settings.write"><button type="button" disabled={busy} onClick={()=>void deactivate(rule.id)} className="text-xs text-slate-600 underline disabled:opacity-50">{dashboardText("Désactiver")}</button></PermissionGuard></li>)}</ul>:<p className="text-sm text-slate-500">{dashboardText("Aucune règle spécifique configurée.")}</p>}
    <PermissionGuard permission="settings.write"><form onSubmit={submit} className="grid gap-3"><fieldset disabled={busy} className="grid gap-3">
      <label className="grid gap-1.5 text-sm">{dashboardText("Marchandise")}<input name="name" minLength={2} maxLength={160} required className={field}/></label>
      <label className="grid gap-1.5 text-sm">{dashboardText("Catégorie concernée (facultatif)")}<input name="category" maxLength={120} className={field}/></label>
      <label className="grid gap-1.5 text-sm">{dashboardText("Décision")}<select name="decision" className={field}><option value="REVIEW">{dashboardText("Validation requise")}</option><option value="PROHIBITED">{dashboardText("Interdit")}</option><option value="ACCEPTED">{dashboardText("Accepté")}</option></select></label>
      <div className="flex justify-end"><button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{busy?dashboardText("Enregistrement…"):dashboardText("Ajouter une règle")}</button></div>
    </fieldset></form></PermissionGuard>
    {error&&<p role="alert" className="text-sm text-red-700">{dashboardText(error)}</p>}
  </section>;
}
