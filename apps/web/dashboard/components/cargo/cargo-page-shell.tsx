"use client";

import { ReactNode } from "react";
import { ArrowUpRight, RefreshCw } from "lucide-react";

import { DashboardLayout } from "@/components/layout/dashboard-layout";

export function CargoPageShell({
  title,
  description,
  eyebrow = "Cargo Operations",
  action,
  children,
}: {
  title: string;
  description: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <DashboardLayout>
      <main className="mx-auto w-full max-w-[1440px] p-4 md:p-8">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                {eyebrow}
              </div>

              <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
                {title}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 md:text-base">
                {description}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {action}
              <div className="hidden rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600 md:block">
                Live workspace
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6">{children}</div>
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
    <section className="slaivo-card rounded-[1.75rem] p-5 md:p-6">
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
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
      {label}
    </div>
  );
}

export function RefreshButton({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <RefreshCw size={15} />
      Rafraîchir
    </button>
  );
}

export function StatusPill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  const classes = {
    neutral: "border-slate-200 bg-slate-50 text-slate-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warning: "border-amber-200 bg-amber-50 text-amber-700",
    danger: "border-red-200 bg-red-50 text-red-700",
    info: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold ${classes[tone]}`}
    >
      {label}
    </span>
  );
}

export function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="slaivo-card rounded-3xl p-5">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-slate-500">{label}</div>
        <ArrowUpRight size={17} className="text-slate-400" />
      </div>
      <div className="mt-4 text-3xl font-black tracking-tight text-slate-950">
        {value}
      </div>
      <div className="mt-2 text-xs leading-5 text-slate-500">{hint}</div>
    </div>
  );
}
