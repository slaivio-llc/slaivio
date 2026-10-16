import {
  BadgeDollarSign,
  BarChart3,
  BellRing,
  BookOpen,
  Boxes,
  Building2,
  BriefcaseBusiness,
  Folder,
  HandCoins,
  Megaphone,
  MessageCircle,
  Package,
  Radar,
  ReceiptText,
  Route,
  Settings,
  Truck,
  Users,
  Warehouse,
  type LucideIcon,
} from "lucide-react";

import { getProductProfile, PRODUCT_PROFILES, type ProductProfile } from "@/config/product-profile";

export type AppRoute = {
  label: string;
  href: string;
  icon: LucideIcon;
  permission?: string;
  keywords: readonly string[];
};

export type AppNavigationGroup = {
  label: string;
  icon: LucideIcon;
  routes: readonly AppRoute[];
  collapsible?: boolean;
};

export const pilotV1Navigation: readonly AppNavigationGroup[] = [
  {
    label: "Dossiers",
    icon: Folder,
    collapsible: false,
    routes: [
      { label: "Dossiers", href: "/app/dossiers", icon: Folder, permission: "dossiers.read", keywords: ["dossier", "client", "attention", "archive"] },
    ],
  },
  {
    label: "Communication",
    icon: MessageCircle,
    collapsible: true,
    routes: [
      { label: "Boîte de réception", href: "/app/inbox", icon: MessageCircle, permission: "inbox.read", keywords: ["whatsapp", "message", "conversation", "réponse"] },
      { label: "Relances", href: "/app/followups", icon: BellRing, permission: "followups.read", keywords: ["relance", "rappel", "client", "dossier"] },
    ],
  },
  {
    label: "Connaissances",
    icon: BookOpen,
    collapsible: false,
    routes: [
      { label: "Connaissances", href: "/app/knowledge", icon: BookOpen, permission: "pilot.knowledge.read", keywords: ["connaissance", "question", "réponse", "information"] },
    ],
  },
  {
    label: "Paramètres",
    icon: Settings,
    collapsible: false,
    routes: [
      { label: "Paramètres", href: "/app/settings", icon: Settings, permission: "pilot.settings.read", keywords: ["entreprise", "responsable", "whatsapp", "accès", "identifiant"] },
    ],
  },
];

// Exact operational scope requested for parcel and freight agencies. The
// underlying Cargo OS modules remain reusable, but unrelated modules are not
// exposed in this agency navigation.
export const parcelFreightNavigation: readonly AppNavigationGroup[] = [
  {
    label: "Clients",
    icon: Users,
    collapsible: false,
    routes: [
      { label: "Clients", href: "/app/clients", icon: Users, permission: "clients.read", keywords: ["client", "historique", "contact"] },
    ],
  },
  {
    label: "Opérations",
    icon: BriefcaseBusiness,
    collapsible: true,
    routes: [
      { label: "Opérations", href: "/app/operations", icon: BriefcaseBusiness, keywords: ["opérations", "colis", "départ", "expédition", "entrepôt"] },
      { label: "Colis", href: "/app/packages", icon: Package, keywords: ["colis", "poids", "destination", "statut", "suivi"] },
      { label: "Expéditions", href: "/app/shipments", icon: Truck, permission: "shipments.read", keywords: ["expédition", "départ", "manifeste", "chargement", "groupage", "transport"] },
      { label: "Entrepôts", href: "/app/warehouses", icon: Warehouse, permission: "warehouses.read", keywords: ["entrepôt", "stock", "bureau", "réception"] },
    ],
  },
  {
    label: "Communication",
    icon: Megaphone,
    collapsible: true,
    routes: [
      { label: "Communication", href: "/app/communication", icon: Megaphone, keywords: ["communication", "whatsapp", "annonce", "relance", "connaissance"] },
      { label: "Messagerie", href: "/app/inbox", icon: MessageCircle, permission: "inbox.read", keywords: ["whatsapp", "message", "conversation"] },
      { label: "Annonces et relances", href: "/app/followups", icon: BellRing, permission: "followups.read", keywords: ["annonce", "relance", "rappel", "client", "dossier", "whatsapp"] },
      { label: "Connaissances", href: "/app/knowledge", icon: BookOpen, permission: "pilot.knowledge.read", keywords: ["connaissance", "fichier", "image", "ia", "réponse"] },
    ],
  },
  {
    label: "Finance",
    icon: ReceiptText,
    collapsible: false,
    routes: [
      { label: "Finance", href: "/app/finance", icon: ReceiptText, permission: "finance.read", keywords: ["paiement", "solde", "facture", "reçu"] },
    ],
  },
  {
    label: "Offre commerciale",
    icon: Route,
    collapsible: true,
    routes: [
      { label: "Tarification", href: "/app/pricing", icon: BadgeDollarSign, permission: "pricing.read", keywords: ["tarif", "pricing", "grille", "prix", "marge", "simulateur"] },
    ],
  },
];

// Cargo workspace navigation: modules are grouped by the daily agency workflow.
export const cargoAgencyNavigation: readonly AppNavigationGroup[] = [
  { label: "Opérations", icon: Package, collapsible: true, routes: [
    { label: "Colis", href: "/app/packages", icon: Package, keywords: ["colis", "poids", "destination", "statut"] },
    { label: "Expéditions", href: "/app/shipments", icon: Truck, permission: "shipments.read", keywords: ["expédition", "départ", "manifeste", "transport"] },
    { label: "Tracking", href: "/app/tracking", icon: Radar, permission: "tracking.read", keywords: ["tracking", "suivi", "statut"] },
    { label: "Départs", href: "/app/departures", icon: Truck, permission: "departures.read", keywords: ["départ", "calendrier"] },
    { label: "Entrepôts", href: "/app/warehouses", icon: Warehouse, permission: "warehouses.read", keywords: ["entrepôt", "stock", "bureau"] },
  ] },
  { label: "Clients", icon: Users, collapsible: false, routes: [
    { label: "Clients", href: "/app/clients", icon: Users, permission: "clients.read", keywords: ["client", "historique", "contact"] },
  ] },
  { label: "Communication", icon: MessageCircle, collapsible: true, routes: [
    { label: "Boîte de réception", href: "/app/inbox", icon: MessageCircle, permission: "inbox.read", keywords: ["whatsapp", "message", "conversation"] },
    { label: "Notifications", href: "/app/notifications", icon: BellRing, permission: "notifications.read", keywords: ["notification", "alerte"] },
    { label: "Annonces & Relances", href: "/app/communication/annonces-relances", icon: Megaphone, keywords: ["annonce", "campagne", "relance", "whatsapp"] },
    { label: "Connaissances", href: "/app/knowledge", icon: BookOpen, permission: "pilot.knowledge.read", keywords: ["connaissance", "fichier", "image", "ia"] },
    { label: "Paramètres", href: "/app/settings?section=integrations", icon: Settings, permission: "organization.read", keywords: ["communication", "whatsapp", "canal"] },
  ] },
  { label: "Finance", icon: ReceiptText, collapsible: true, routes: [
    { label: "Vue d’ensemble", href: "/app/finance?section=overview", icon: BarChart3, permission: "finance.read", keywords: ["indicateurs", "aperçu"] },
    { label: "Factures", href: "/app/finance?section=invoices", icon: ReceiptText, permission: "finance.read", keywords: ["facture", "devis"] },
    { label: "Paiements", href: "/app/finance?section=payments", icon: HandCoins, permission: "finance.read", keywords: ["paiement", "reçu", "encaissement"] },
    { label: "Soldes clients", href: "/app/finance?section=balances", icon: BadgeDollarSign, permission: "finance.read", keywords: ["solde", "créance", "client"] },
    { label: "Paramètres", href: "/app/finance?section=settings", icon: Settings, permission: "finance.settings", keywords: ["condition", "exigibilité", "paiement"] },
  ] },
  { label: "Rapports", icon: BarChart3, collapsible: true, routes: [
    { label: "Rapports", href: "/app/reports", icon: BarChart3, permission: "analytics.read", keywords: ["rapport", "analytics", "performance", "export"] },
  ] },
  { label: "Gestion", icon: Settings, collapsible: true, routes: [
    { label: "Organisation et équipe", href: "/app/settings", icon: Building2, permission: "organization.read", keywords: ["organisation", "agence", "bureau", "équipe", "accès"] },
    { label: "Routes", href: "/app/routes", icon: Route, permission: "routes.read", keywords: ["route", "trajet", "origine", "destination"] },
    { label: "Services", href: "/app/services", icon: Boxes, permission: "services.read", keywords: ["service", "transport", "offre"] },
    { label: "Tarification", href: "/app/pricing", icon: BadgeDollarSign, permission: "pricing.read", keywords: ["tarif", "grille", "prix", "simulateur"] },
    { label: "Dossiers", href: "/app/dossiers", icon: Folder, permission: "dossiers.read", keywords: ["dossier", "documents", "client"] },
  ] },
];

// The former operational surface stays available behind CARGO_OS. Nothing is deleted.
export const cargoOsNavigation: readonly AppNavigationGroup[] = [
  {
    label: "Clients",
    icon: Users,
    routes: [
      { label: "Clients", href: "/app/clients", icon: Users, permission: "clients.read", keywords: ["client", "contact", "destinataire"] },
      { label: "Dossiers", href: "/app/dossiers", icon: Folder, permission: "dossiers.read", keywords: ["dossier", "demande", "devis"] },
    ],
  },
  {
    label: "Organisation",
    icon: Building2,
    routes: [
      { label: "Paramètres de l’agence", href: "/app/settings", icon: Settings, permission: "organization.read", keywords: ["organisation", "agence", "bureau", "implantation", "pays", "service", "route", "trajet"] },
    ],
  },
  {
    label: "Opérations",
    icon: BriefcaseBusiness,
    routes: [
      { label: "Colis", href: "/app/packages", icon: Package, keywords: ["colis", "package", "tracking"] },
      { label: "Entrepôts", href: "/app/warehouses", icon: Warehouse, permission: "warehouses.read", keywords: ["entrepôt", "warehouse", "stock", "emplacement"] },
      { label: "Batchs & groupages", href: "/app/batches", icon: Boxes, permission: "batches.read", keywords: ["batch", "groupage", "consolidation", "chargement"] },
      { label: "Départs", href: "/app/departures", icon: Truck, permission: "departures.read", keywords: ["départ", "calendrier", "cutoff", "capacité"] },
      { label: "Expéditions", href: "/app/shipments", icon: Truck, permission: "shipments.read", keywords: ["expédition", "shipment", "transport"] },
      { label: "Tracking", href: "/app/tracking", icon: Radar, permission: "tracking.read", keywords: ["tracking", "suivi", "retard"] },
      { label: "Retraits & livraisons", href: "/app/pickups", icon: HandCoins, permission: "pickups.read", keywords: ["retrait", "livraison", "remise", "pickup"] },
      { label: "Documents", href: "/app/documents", icon: Folder, permission: "documents.read", keywords: ["document", "douane", "conformité", "expiration"] },
    ],
  },
  {
    label: "Offre commerciale",
    icon: Route,
    routes: [
      { label: "Tarification", href: "/app/pricing", icon: BadgeDollarSign, permission: "pricing.read", keywords: ["tarif", "pricing", "grille", "prix", "marge", "simulateur"] },
      { label: "Facturation", href: "/app/finance", icon: ReceiptText, permission: "finance.read", keywords: ["facture", "devis", "avoir", "paiement", "finance"] },
    ],
  },
  {
    label: "Communication",
    icon: Megaphone,
    routes: [
      { label: "Relances", href: "/app/followups", icon: BellRing, permission: "followups.read", keywords: ["relance", "rappel", "paiement", "recovery"] },
      { label: "Broadcasts", href: "/app/broadcasts", icon: Megaphone, permission: "broadcasts.read", keywords: ["campagne", "broadcast", "audience", "whatsapp", "email"] },
    ],
  },
  {
    label: "Pilotage",
    icon: BarChart3,
    routes: [
      { label: "Base de connaissances", href: "/app/knowledge", icon: BookOpen, permission: "knowledge.read", keywords: ["connaissance", "faq", "procédure", "politique", "knowledge"] },
      { label: "Rapports & analytics", href: "/app/reports", icon: BarChart3, permission: "analytics.read", keywords: ["rapport", "analytics", "kpi", "performance", "export"] },
    ],
  },
];

export function getAppNavigation(profile: ProductProfile = getProductProfile(), workspaceKind: string = "OFFICE") {
  if (profile === PRODUCT_PROFILES.PILOT_V1) return pilotV1Navigation;
  if (profile === PRODUCT_PROFILES.PARCEL_FREIGHT) {
    if (workspaceKind === "WAREHOUSE") return cargoAgencyNavigation
      .filter(group => group.label !== "Finance")
      .map(group => ({...group, routes: group.routes.map(route => route.href === "/app/warehouses" ? {...route, label: "Stockage et emplacements"} : route)}));
    return cargoAgencyNavigation.map(group => ({...group, routes: group.routes.filter(route => route.href !== "/app/warehouses")}));
  }
  return cargoOsNavigation;
}

export function getCompactPrimaryRoutes(
  routes: readonly AppRoute[],
  profile: ProductProfile,
): AppRoute[] {
  const visibleHrefs = profile === PRODUCT_PROFILES.PARCEL_FREIGHT
    ? new Set([
        "/app/clients",
        "/app/operations",
        "/app/communication",
        "/app/finance",
        "/app/pricing",
      ])
    : new Set(["/app/dossiers", "/app/inbox", "/app/followups", "/app/knowledge"]);

  return routes
    .filter((route) => visibleHrefs.has(route.href))
    .map((route) =>
      profile === PRODUCT_PROFILES.PARCEL_FREIGHT && route.href === "/app/pricing"
        ? { ...route, label: "Offre commerciale" }
        : route,
    );
}

export const appNavigation = getAppNavigation();
export const searchableAppRoutes = appNavigation.flatMap((group) => group.routes);

export function canAccessRoute(
  route: AppRoute,
  permissions: readonly string[],
  permissionsAvailable: boolean,
) {
  if (!route.permission) return true;
  // The APIs remain authoritative if the permission service is temporarily unavailable.
  return !permissionsAvailable || permissions.includes(route.permission);
}
