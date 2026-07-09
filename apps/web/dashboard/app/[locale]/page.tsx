import { setRequestLocale } from "next-intl/server";

import { LandingPageClient } from "@/components/landing/landing-page-client";
import { type Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

export default async function LocalePage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;

  setRequestLocale(locale);

  return <LandingPageClient />;
}
