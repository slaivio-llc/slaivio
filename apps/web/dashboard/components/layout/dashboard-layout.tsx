"use client";

import { ReactNode } from "react";

import { Sidebar } from "@/components/sidebar/sidebar";

export function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex h-screen bg-background">
      <aside className="w-72 border-r bg-card">
        <div className="p-6 text-2xl font-bold">
          SLAIVO
        </div>

        <Sidebar />
      </aside>

      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
