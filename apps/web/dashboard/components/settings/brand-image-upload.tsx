"use client";
import {dashboardText,useDashboardMessages} from '@/components/i18n/dashboard-messages';


import { useEffect, useId, useState } from "react";
import { ImagePlus, Upload } from "lucide-react";

const allowedTypes = ["image/png", "image/jpeg", "image/webp"];
export const MAX_BRAND_IMAGE_SIZE = 5 * 1024 * 1024;

export function BrandImageUpload({ label, currentUrl, file, onChange }: {
  label: string;
  currentUrl: string;
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  useDashboardMessages();
  const id = useId();
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!file) { setPreview(""); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return <div className="grid gap-2">
    <label htmlFor={id} className="text-[13px] font-medium text-[#59636e]">{dashboardText(label)}</label>
    <label htmlFor={id} className="flex min-h-32 cursor-pointer flex-wrap items-center gap-4 rounded-lg border border-dashed border-[#cfd4d6] bg-[#fafbfb] p-4 transition-colors hover:border-[#929ba2] hover:bg-[#f5f6f6] focus-within:ring-2 focus-within:ring-[#aeb8be]">
      <input id={id} aria-label={dashboardText(label)} type="file" accept={allowedTypes.join(",")} className="sr-only" aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`} onChange={(event) => {
        const selected = event.target.files?.[0];
        if (!selected) return;
        if (!allowedTypes.includes(selected.type)) { setError("Choisissez une image PNG, JPG ou WebP."); event.target.value = ""; return; }
        if (selected.size === 0 || selected.size > MAX_BRAND_IMAGE_SIZE) { setError("L’image doit peser entre 1 octet et 5 Mo."); event.target.value = ""; return; }
        setError(""); onChange(selected); event.target.value = "";
      }}/>
      <span className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-lg border border-[#e0e4e6] bg-white">
        {preview || currentUrl
          // Uploaded brand assets and temporary local previews are user-selected images.
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={preview || currentUrl} alt={dashboardText("Aperçu — {0}", label)} className="h-full w-full object-contain p-1"/>
          : <ImagePlus size={28} className="text-[#7c858c]"/>}
      </span>
      <span className="min-w-0 flex-1"><span className="flex items-center gap-2 text-[14px] font-medium text-[#30363a]"><Upload size={16}/>{file || currentUrl ? dashboardText("Changer l’image") : dashboardText("Cliquez pour importer une image")}</span><span id={`${id}-hint`} className="mt-1 block text-[12px] text-[#697178]">{dashboardText("PNG, JPG ou WebP · 5 Mo maximum · 4 096 × 4 096 px maximum")}</span>{file && <span className="mt-2 block break-all text-[12px] text-[#59636e]">{file.name} {dashboardText(" · sera enregistrée avec le formulaire")}</span>}</span>
    </label>
    {file && <button type="button" onClick={() => { onChange(null); setError(""); }} className="justify-self-start text-[12px] text-[#59636e] underline">{dashboardText("Annuler le changement d’image")}</button>}
    {error && <p id={`${id}-error`} role="alert" className="text-[13px] text-red-700">{dashboardText(error)}</p>}
  </div>;
}
