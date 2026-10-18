"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import axios from "axios";
import { ImageIcon, Upload, RefreshCw } from "lucide-react";
import { api } from "@/services/api";
import { uploadPackageMedia, getPackageMediaUrl, createPackageNotification } from "@/services/packages";
import { type ParcelOverview } from "@/services/parcel-register";
import { OperationButton } from "@/components/ui/operation-controls";
import { operationInputClass as field } from "@/components/ui/operation-styles";
import { PermissionGuard } from "@/components/permissions/permission-guard";

export function parcelError(cause: unknown) {
  const detail = axios.isAxiosError(cause) ? cause.response?.data?.detail : null;
  const messages: Record<string,string> = {
    package_version_conflict: "Ce colis a été modifié par un autre agent. Actualisez la fiche avant de reprendre.",
    parcel_weight_requires_review: "Le poids est lié à une tarification ou une expédition. Une réévaluation est nécessaire.",
    parcel_edit_closed: "Ce colis est clôturé. Une correction encadrée est nécessaire.",
    parcel_not_arrived: "Le colis doit être arrivé avant sa mise à disposition.",
    supplier_tracking_already_exists: "Cette référence fournisseur existe déjà. Vérifiez le colis concerné.",
    package_media_owner_required: "Les photos doivent être ajoutées depuis le bureau d’origine.",
    invalid_image_content: "Le contenu du fichier ne correspond pas au format d’image annoncé.",
    document_storage_not_configured: "Le stockage des photos n’est pas configuré. Contactez votre administrateur.",
    client_phone_unavailable: "Aucun numéro WhatsApp n’est enregistré pour ce client.",
  };
  return messages[String(detail)] || "Opération impossible. Vérifiez vos droits et la connexion, puis réessayez.";
}

export function ParcelEditForm({ item, saving, error, save, cancel }: {
  item: ParcelOverview; saving: boolean; error: string;
  save: (changes: Record<string, unknown>, reason: string) => void; cancel: () => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    const changes: Record<string, unknown> = {};
    for (const key of ["description", "supplier_tracking", "warehouse_location", "weight_kg"] as const) {
      if (!data.has(key)) continue;
      const raw = String(data.get(key) || "").trim();
      const value = !raw ? null : key === "weight_kg" ? Number(raw) : raw;
      if (value !== (item[key] ?? null)) changes[key] = value;
    }
    save(changes, String(data.get("reason") || "").trim());
  }
  return <form onSubmit={submit} className="grid gap-4" aria-label="Modifier les informations du colis">
    <fieldset disabled={saving} className="grid gap-4">
      {item.local_client && <><label className="grid gap-1.5 text-sm">Description<input name="description" maxLength={260} defaultValue={item.description || ""} className={field}/></label>
        <label className="grid gap-1.5 text-sm">Référence fournisseur<input name="supplier_tracking" maxLength={180} defaultValue={item.supplier_tracking || ""} className={field}/></label>
        <label className="grid gap-1.5 text-sm">Poids (kg)<input name="weight_kg" type="number" min="0.001" step="0.001" defaultValue={item.weight_kg ?? ""} disabled={!item.weight_editable} className={field}/></label>
        {!item.weight_editable && <p className="text-xs text-slate-500">La correction du poids nécessite une réévaluation du tarif ou de l’expédition.</p>}</>}
      <label className="grid gap-1.5 text-sm">Emplacement de stockage<input name="warehouse_location" maxLength={160} defaultValue={item.warehouse_location || ""} className={field}/></label>
      <label className="grid gap-1.5 text-sm">Motif de la correction<input name="reason" required minLength={3} maxLength={500} className={field} placeholder="Ex. poids vérifié à la réception"/></label>
    </fieldset>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <div className="flex justify-end gap-2"><OperationButton disabled={saving} onClick={cancel}>Annuler</OperationButton><OperationButton type="submit" variant="primary" disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</OperationButton></div>
  </form>;
}

type Photos = {items: {id:string;file_name:string;caption:string|null;customer_visible:boolean}[];page:number;total_pages:number;total:number;customer_visible_count:number};
export function ParcelPhotos({ item, changed, busyChanged, disabled = false }: { item: ParcelOverview; changed: () => Promise<void>; busyChanged: (value: boolean) => void; disabled?: boolean }) {
  const [result,setResult]=useState<Photos|null>(null);
  const [error,setError]=useState("");const [notice,setNotice]=useState("");
  const [busy,setBusy]=useState(false);const pending=useRef(false);
  const [revision,setRevision]=useState(0);const [page,setPage]=useState(1);
  const [preview,setPreview]=useState<{url:string;name:string}|null>(null);
  const input=useRef<HTMLInputElement>(null);
  useEffect(()=>{
    const controller=new AbortController();setResult(null);setError("");
    api.get<Photos>(`/packages/register/${item.id}/photos`,{params:{page},signal:controller.signal})
      .then(response=>{if(!controller.signal.aborted)setResult(response.data);})
      .catch(()=>{if(!controller.signal.aborted)setError("Photos indisponibles. Réessayez.");});
    return()=>controller.abort();
  },[item.id,page,revision]);
  async function upload(files: File[]) {
    if(disabled||pending.current||!files.length)return;
    if(files.length>10){setError("Ajoutez au maximum 10 photos à la fois.");return;}
    if(files.some(file=>!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>25*1024*1024||file.size===0)){
      setError("Choisissez des photos JPEG, PNG ou WebP de 25 Mo maximum.");return;
    }
    pending.current=true;setBusy(true);busyChanged(true);setError("");setNotice("");
    let succeeded=0;const failed:string[]=[];
    try {
      for(const file of files){
        setNotice(`Ajout de ${succeeded+failed.length+1} sur ${files.length}…`);
        try{await uploadPackageMedia(item.id,file,"RECEPTION");succeeded++;}catch{failed.push(file.name);}
      }
      setPage(1);setRevision(value=>value+1);
      setNotice(`${succeeded} photo(s) ajoutée(s).${failed.length?` À vérifier avant de renvoyer : ${failed.join(", ")}. Une réponse perdue peut masquer un ajout réussi.`:""}`);
      if(succeeded)await changed();
    } finally {pending.current=false;setBusy(false);busyChanged(false);if(input.current)input.current.value="";}
  }
  async function view(id:string,name:string){
    if(disabled||pending.current)return;setError("");pending.current=true;setBusy(true);busyChanged(true);
    try{setPreview({url:await getPackageMediaUrl(item.id,id),name});}
    catch(cause){setError(parcelError(cause));}
    finally{pending.current=false;setBusy(false);busyChanged(false);}
  }
  async function toggleCustomerVisibility(photo:{id:string;customer_visible:boolean}){
    if(disabled||pending.current)return;pending.current=true;setBusy(true);busyChanged(true);setError("");setNotice("");
    try{
      await api.patch(`/packages/${item.id}/media/${photo.id}/customer-visibility`,{customer_visible:!photo.customer_visible});
      setNotice(!photo.customer_visible?"Photo maintenant visible dans le suivi client.":"Photo retirée du suivi client.");
      setRevision(value=>value+1);
      await changed();
    }catch(cause){setError(parcelError(cause));}
    finally{pending.current=false;setBusy(false);busyChanged(false);}
  }
  async function sendTrackingLink(){
    if(disabled||pending.current||!item.public_tracking_enabled||!result?.customer_visible_count||!item.reference)return;
    pending.current=true;setBusy(true);busyChanged(true);setError("");setNotice("");
    try{
      const url=new URL("/track",window.location.origin);url.searchParams.set("reference",item.reference);
      await createPackageNotification(item.id,{
        channel:"whatsapp",notification_type:`PACKAGE_SHARED_PHOTOS:${item.id}:${Date.now()}`,
        message:`Bonjour${item.client_name?` ${item.client_name}`:""}, l’agence a partagé des photos de votre colis ${item.reference}. Consultez-les dans votre suivi : ${url.toString()}`,
      });
      setNotice("Lien préparé dans la file WhatsApp de l’agence. Vérifiez le statut réel dans l’historique des notifications.");
    }catch(cause){setError(parcelError(cause));}
    finally{pending.current=false;setBusy(false);busyChanged(false);}
  }
  return <section aria-label="Photos du colis" className="grid gap-3">
    <div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-semibold">Photos</h3><p className="mt-1 text-xs text-slate-500">Privées par défaut. Le partage client est explicite, photo par photo.</p></div>
      {item.local_client && <PermissionGuard permission="packages.update"><OperationButton disabled={busy||disabled} onClick={()=>input.current?.click()}><Upload size={14}/>Ajouter</OperationButton><input ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp" hidden aria-label="Ajouter des photos" onChange={event=>{const files=Array.from(event.target.files||[]);event.target.value="";void upload(files);}}/></PermissionGuard>}
    </div>
    {notice && <p role="status" className="text-xs text-slate-600">{notice}</p>}
    {result&&result.customer_visible_count>0&&<div className="flex flex-wrap items-center gap-2"><PermissionGuard permission="packages.update"><OperationButton disabled={busy||disabled||!item.public_tracking_enabled||!item.reference} onClick={()=>void sendTrackingLink()}>Envoyer le lien au client sur WhatsApp</OperationButton></PermissionGuard>{!item.public_tracking_enabled&&<span className="text-xs text-amber-700">Le suivi public est désactivé pour ce colis.</span>}</div>}
    {error && <div role="alert" className="text-sm text-red-700">{error} <OperationButton aria-label="Actualiser les photos" disabled={busy||disabled} onClick={()=>setRevision(value=>value+1)}><RefreshCw size={14}/></OperationButton></div>}
    {!result&&!error?<p className="text-sm text-slate-500">Chargement des photos…</p>:result?.items.length?<ul className="grid gap-2 sm:grid-cols-2">{result.items.map(photo=><li key={photo.id} className="rounded-xl border border-slate-200 p-3"><button type="button" disabled={busy||disabled} onClick={()=>void view(photo.id,photo.caption||photo.file_name)} className="flex w-full items-center gap-3 text-left disabled:opacity-50"><ImageIcon size={20} className="shrink-0 text-slate-400"/><span className="truncate text-xs">{photo.caption||photo.file_name}</span></button><PermissionGuard permission="packages.update"><button type="button" disabled={busy||disabled} aria-pressed={photo.customer_visible} onClick={()=>void toggleCustomerVisibility(photo)} className="mt-2 text-xs font-medium text-slate-600 underline underline-offset-2 disabled:opacity-50">{photo.customer_visible?"Retirer du suivi client":"Partager dans le suivi client"}</button></PermissionGuard></li>)}</ul>:result&&<p className="text-sm text-slate-500">Aucune photo ajoutée.</p>}
    {result&&result.total_pages>1&&<div className="flex justify-end gap-2"><OperationButton disabled={busy||disabled||page===1} onClick={()=>setPage(value=>value-1)}>Précédent</OperationButton><OperationButton disabled={busy||disabled||page>=result.total_pages} onClick={()=>setPage(value=>value+1)}>Suivant</OperationButton></div>}
    {preview&&<figure className="rounded-xl border border-slate-200 p-3">
      {/* Signed private URLs must not be forwarded to an image optimization proxy. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={preview.url} alt={preview.name} className="max-h-80 w-full rounded-lg object-contain" referrerPolicy="no-referrer" onError={()=>{setPreview(null);setError("L’aperçu a expiré ou est indisponible. Ouvrez à nouveau la photo.");}}/>
      <figcaption className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-500"><span className="truncate">{preview.name}</span><OperationButton onClick={()=>setPreview(null)}>Fermer l’aperçu</OperationButton></figcaption>
    </figure>}
  </section>;
}
