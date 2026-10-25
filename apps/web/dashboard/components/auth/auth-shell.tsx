import { ReactNode } from "react";

import { SlaivioBrand } from "@/components/ui/slaivio-brand";

export function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-col bg-white text-[#25292e]">
      <header className="px-6 py-6 sm:px-10"><SlaivioBrand compact /></header>
      <section className="flex flex-1 items-center justify-center px-6 pb-16 pt-8">
        <div className="w-full max-w-[380px]">

          <div className="mb-6">
            <h1 className="text-[25px] font-semibold leading-tight tracking-tight text-[#25292e]">
              {title}
            </h1>
            <p className="mt-2 max-w-[380px] text-[14px] leading-6 text-[#69717a]">
              {description}
            </p>
          </div>

          <div className="slaivo-auth-panel">{children}</div>
        </div>
      </section>

      <footer className="px-6 pb-6 text-center text-[12px] text-[#858b90]">Slaivio · Gestion de colis et de fret</footer>
    </main>
  );
}
