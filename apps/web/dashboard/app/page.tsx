import type { Metadata } from "next";

import { LandingPageClient } from "@/components/landing/landing-page-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "SLAIVIO - Operating System des Agences Cargo",
  description:
    "Centralisez WhatsApp, clients, dossiers, colis, expeditions, paiements et operations multi-pays dans une seule plateforme cargo.",
  alternates: {
    canonical: "https://slaivio.com",
  },
  openGraph: {
    title: "SLAIVIO - Operating System des Agences Cargo",
    description:
      "La plateforme qui centralise et automatise les operations des agences cargo modernes.",
    url: "https://slaivio.com",
    siteName: "SLAIVIO",
    type: "website",
    images: [
      {
        url: "/slaivio-logo-official-dark.png",
        alt: "SLAIVIO",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SLAIVIO - Operating System des Agences Cargo",
    description:
      "Centralisez et automatisez les operations de votre agence cargo.",
    images: ["/slaivio-logo-official-dark.png"],
  },
};

export default function Page() {
  return <LandingPageClient />;
}
