import { LandingPageClient } from "@/components/landing/landing-page-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function Page() {
  return <LandingPageClient />;
}
