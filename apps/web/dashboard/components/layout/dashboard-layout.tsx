"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Sidebar } from "@/components/sidebar/sidebar";
import { getCurrentManager } from "@/services/auth";
import type { Manager } from "@/types/auth";

export function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();

  const [manager, setManager] = useState<Manager | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentManager()
      .then((managerData) => {
        setManager(managerData);
      })
      .catch(() => {
        router.push("/login");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        Chargement SLAIVO...
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <aside className="w-72 border-r bg-card">
        <div className="p-6">
          <div className="text-2xl font-bold">
            SLAIVO
          </div>

          <div className="mt-1 text-xs text-muted-foreground">
            {manager?.full_name}
          </div>

          <div className="text-xs text-muted-foreground">
            {manager?.org_id}
          </div>
        </div>

        <Sidebar />
      </aside>

      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}

