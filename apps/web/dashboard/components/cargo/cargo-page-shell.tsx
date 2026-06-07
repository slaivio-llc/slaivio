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
      <main className="p-4 md:p-8">
        <div className="slaivo-gradient-card overflow-hidden rounded-[2rem] p-6 text-white md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-sky-100">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                {eyebrow}
              </div>

              <h1 className="mt-5 text-3xl font-black tracking-tight md:text-5xl">
                {title}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 md:text-base">
                {description}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {action}
              <div className="hidden rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-slate-200 md:block">
                Live cargo workspace
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8">{children}</div>
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
    <section className="slaivo-card mt-6 rounded-[1.75rem] p-5 md:p-6">
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
    info: "border-sky-200 bg-sky-50 text-sky-700",
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
