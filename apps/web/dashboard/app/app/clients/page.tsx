import { ClientsPage } from "@/components/clients/clients-page";
import { DashboardFrame } from "@/components/dashboard/dashboard-overview";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <DashboardFrame>
      <ClientsPage />
    </DashboardFrame>
  );
}
