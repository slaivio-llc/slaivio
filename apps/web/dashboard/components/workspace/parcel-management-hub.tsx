"use client";

import { ArrowRight, BadgeDollarSign, Boxes, Building2, Route } from "lucide-react";
import Link from "next/link";
import { PermissionGuard } from "@/components/permissions/permission-guard";
import { OperationContent } from "@/components/ui/operation-primitives";
import { OperationPageHeader } from "@/components/ui/operation-page-header";

const cards = [
  { title: "Organisation et équipe", description: "Coordonnées, bureaux, membres et accès.", href: "/app/settings", permission: "organization.read", icon: Building2 },
  { title: "Routes", description: "Origines, destinations et trajets desservis.", href: "/app/routes", permission: "routes.read", icon: Route },
  { title: "Services", description: "Services de transport proposés par l’agence.", href: "/app/services", permission: "services.read", icon: Boxes },
  { title: "Tarification", description: "Grilles et règles de prix appliquées aux colis.", href: "/app/pricing", permission: "pricing.read", icon: BadgeDollarSign },
];

export function ParcelManagementHub() {
  return <div className="min-h-full bg-white"><OperationPageHeader title="Gestion" description="Retrouvez au même endroit l’administration de l’agence, ses services, ses routes et sa tarification."/><OperationContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{cards.map(({title,description,href,permission,icon:Icon})=><PermissionGuard key={href} permission={permission}><Link href={href} className="group min-h-[138px] rounded-[9px] border border-[#dfe3e7] p-5 transition-colors hover:border-[#b9c6c0] hover:bg-[#fbfcfb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9ccdb8]"><div className="flex items-center justify-between"><span className="grid h-9 w-9 place-items-center rounded-[8px] bg-[#eef6f2] text-[#16704b]"><Icon size={18}/></span><ArrowRight size={16} className="text-[#9aa2a9] group-hover:text-[#16704b]"/></div><h2 className="mt-4 text-[14px] font-semibold text-[#30373d]">{title}</h2><p className="mt-1 text-[12px] leading-5 text-[#747e86]">{description}</p></Link></PermissionGuard>)}</OperationContent></div>;
}
