"use client";

import { ReactNode } from "react";

import { DashboardLayout } from "@/components/layout/dashboard-layout";

export function CargoPageShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <DashboardLayout>
      <main className="min-h-screen bg-gray-50 p-8">
        <div>
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="mt-2 text-sm text-gray-500">{description}</p>
        </div>

        {children}
      </main>
    </DashboardLayout>
  );
}

export function CargoCard({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
      {children}
    </section>
  );
}

export function EmptyState({
  label,
}: {
  label: string;
}) {
  return (
    <div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">
      {label}
    </div>
  );
}

