"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Building2, Warehouse } from "lucide-react";
import Link from "next/link";
import { OperationTab } from "@/components/ui/operation-controls";
import { OperationPageHeader } from "@/components/ui/operation-page-header";
import { ErrorState, LoadingState } from "@/components/ui/page-state";
import { getAdmin, type AdminData } from "@/services/organization-admin";
import { OrganizationTransportSettings } from "@/components/settings/organization-transport-settings";
import { PricingManagementSection } from "@/components/pricing/pricing-engine-page";

type Section = "organization" | "services" | "pricing";
const tabs: Array<[Section, string]> = [["organization", "Organisation"], ["services", "Services & Routes"], ["pricing", "Tarification"]];

export function ParcelManagementHub() {
  const [data, setData] = useState<AdminData | null>(null);
  const [headerActionsTarget, setHeaderActionsTarget] = useState<HTMLDivElement | null>(null);
  const [section, setSection] = useState<Section>("organization");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      setData(await getAdmin());
    } catch { setError("Les informations de gestion de l’agence sont indisponibles."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const locations = data?.locations || [];
  const offices = locations.filter((item) => item.location_type === "OFFICE");
  const warehouses = locations.filter((item) => item.location_type === "WAREHOUSE");
  const activeMembers = data?.members.filter((member) => member.status === "ACTIVE") || [];
  if (loading) return <LoadingState label="Chargement de la gestion…" />;
  if (error || !data) return <ErrorState title="Gestion indisponible" description={error || "Les informations de l’agence ne sont pas disponibles."} retry={load} />;
  return <div className="min-h-full min-w-0 bg-white">
    <OperationPageHeader title="Gestion" description="Structure, services, tarifs et collaborateurs de votre agence."
      actions={section !== "organization" ? <div ref={setHeaderActionsTarget} className="flex flex-wrap items-center gap-2" /> : undefined}
      />
    <main className="mx-auto w-full min-w-0 max-w-[1200px] px-6 pb-10 sm:px-8">
      <nav aria-label="Sections Gestion" className="operation-tabs mb-4 flex flex-nowrap items-center gap-0 overflow-x-auto pb-2">
        {tabs.map(([key, label]) => <OperationTab key={key} active={section === key} onClick={() => setSection(key)}>{label}</OperationTab>)}
      </nav>
      <div className="w-full min-w-0 bg-white">
        <div className="min-w-0 space-y-4 pt-0">
          {section === "organization" && <><Heading title="Organisation" subtitle="Gérez vos implantations et vos entrepôts." />
            <div className="grid gap-2 sm:grid-cols-3"><Metric label="Bureaux" value={offices.length}/><Metric label="Entrepôts" value={warehouses.length}/><Metric label="Membres" value={activeMembers.length}/></div>
            <LocationGroup title="Bureaux">{offices.map((item) => <LocationRow key={String(item.id)} name={String(item.name || item.city || "Bureau")} detail={[item.city, item.address].filter(Boolean).join(" · ")} icon="office" badge={activeMembers.filter((member) => member.office_access_scope === "ALL_OFFICES" || member.office_ids.includes(String(item.id))).length + " membres"}/>)}</LocationGroup>
            {!offices.length && <Empty label="Aucun bureau n’est configuré."/>}
            <LocationGroup title="Entrepôts">{warehouses.map((item) => <LocationRow key={String(item.id)} name={String(item.name || "Entrepôt")} detail={[item.city, item.country].filter(Boolean).join(" · ")} icon="warehouse"/>)}</LocationGroup>
            {!warehouses.length && <Empty label="Aucun entrepôt n’est configuré."/>}</>}
          {section === "services" && <OrganizationTransportSettings section="management" headerActionsTarget={headerActionsTarget} />}
          {section === "pricing" && <PricingManagementSection headerActionsTarget={headerActionsTarget} />}
          <p className="text-[10px] text-[#8a9297]">Les éléments affichés proviennent des paramètres et des données de votre agence.</p>
        </div>
      </div>
    </main>
  </div>;
}

function Heading({title,subtitle}:{title:string;subtitle:string}) { return <div><h2 className="text-[14px] font-semibold text-[#25292e]">{title}</h2><p className="mt-1 text-[11px] text-[#697178]">{subtitle}</p></div>; }
function Metric({label,value}:{label:string;value:string|number}) { return <div className="border border-[#dfe3e4] px-3 py-3"><p className="text-[10px] text-[#697178]">{label}</p><p className="mt-1 text-[16px] font-semibold text-[#25292e]">{value}</p></div>; }
function LocationGroup({title,children}:{title:string;children:React.ReactNode}) { return <section><div className="mb-2 flex items-center justify-between gap-3"><h3 className="text-[12px] font-semibold text-[#25292e]">{title}</h3></div><div className="space-y-2">{children}</div></section>; }
function LocationRow({name,detail,icon,badge}:{name:string;detail:string;icon:"office"|"warehouse";badge?:string}) { const Icon = icon === "office" ? Building2 : Warehouse; return <Link href="/app/settings?section=locations" className="flex min-w-0 items-center justify-between gap-3 border border-[#dfe3e4] px-3 py-3 hover:bg-[#fafbfb]"><span className="flex min-w-0 items-center gap-3"><Icon size={15} className="shrink-0 text-[#697178]"/><span className="min-w-0"><b className="block truncate text-[12px] font-medium text-[#25292e]">{name}</b><span className="mt-1 block truncate text-[11px] text-[#697178]">{detail || "Implantation"}</span></span></span><span className="flex shrink-0 items-center gap-2">{badge && <span className="bg-[#f1f2f1] px-2 py-1 text-[10px] text-[#59636b]">{badge}</span>}<ArrowRight size={14} className="text-[#697178]"/></span></Link>; }
function Empty({label}:{label:string}) { return <p className="border border-dashed border-[#dfe3e4] px-3 py-5 text-center text-[11px] text-[#697178]">{label}</p>; }
