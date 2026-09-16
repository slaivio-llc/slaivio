"use client";

import { ListFilter } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

export function OperationPageHeader({
  title,
  description,
  actions,
  tabs,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
  tabs?: ReactNode;
}) {
  return (
    <header data-ui="operation-page-header" className="operation-page-header bg-white">
      <div className="mx-auto w-full max-w-[1200px] px-6 pt-6 sm:px-8 sm:pt-10 lg:pt-12">
        <div className="flex flex-col gap-3 border-b border-[#dfe1e3] pb-6 sm:pb-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-[22px] font-semibold text-[#25292e]">{title}</h1>
            <p className="mt-1.5 max-w-4xl text-[13px] leading-5 text-[#69717a]">
              {description}
            </p>
          </div>
          {actions && (
            <div className="operation-actions flex shrink-0 flex-wrap items-center gap-2 [&>details]:order-first">
              {actions}
            </div>
          )}
        </div>
      </div>
      {tabs && <OperationTabs>{tabs}</OperationTabs>}
    </header>
  );
}

export function OperationTabs({ children, className = "" }: { children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!root.current?.contains(target) && !target.closest('[data-ui="operation-tab-menu"]')) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div
      ref={root}
      data-ui="operation-tabs"
      className={`operation-view-filter mx-auto flex w-full max-w-[1200px] justify-end bg-white px-6 py-2 sm:px-8 ${className}`}
    >
      <div className="relative">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className={`inline-flex h-9 items-center gap-2 rounded-[6px] border px-3 text-[13px] font-medium shadow-[0_1px_1px_rgba(15,23,42,.03)] ${open ? "border-[#9ed8bc] bg-[#edf8f2] text-[#087a46]" : "border-[#d8dadd] bg-white text-[#3f4851] hover:bg-[#f7f7f6]"}`}
        >
          <ListFilter size={15} aria-hidden="true" />
          Vue
        </button>
        {open && (
          <nav
            aria-label="Vues du module"
            role="menu"
            onClick={(event) => { if ((event.target as HTMLElement).closest('[data-ui="operation-tab"]')) setOpen(false); }}
            className="operation-view-options absolute right-0 top-11 z-40 grid min-w-[240px] gap-1 rounded-[8px] border border-[#d9dde1] bg-white p-1.5 shadow-[0_12px_32px_rgba(15,23,42,.14)]"
          >
            {children}
          </nav>
        )}
      </div>
    </div>
  );
}
