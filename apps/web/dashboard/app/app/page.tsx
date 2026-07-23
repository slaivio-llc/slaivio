import { DashboardLayout } from "@/components/layout/dashboard-layout";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

export default function EmptyDashboardPage() {
  return (
    <DashboardLayout>
      <div aria-label="Dashboard vide" className="min-h-[calc(100vh-73px)]" />
    </DashboardLayout>
  );
}
