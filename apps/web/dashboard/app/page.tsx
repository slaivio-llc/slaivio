import { DashboardLayout } from "@/components/layout/dashboard-layout";

export default function HomePage() {
  return (
    <DashboardLayout>
      <div className="p-8">
        <h1 className="text-3xl font-bold">
          SLAIVO Dashboard
        </h1>

        <p className="mt-2 text-muted-foreground">
          Cargo Operations Intelligence Platform
        </p>
      </div>
    </DashboardLayout>
  );
}
