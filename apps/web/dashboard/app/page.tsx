import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  Globe2,
  MessageSquare,
  PackageCheck,
  ShieldCheck,
  Truck,
  Zap,
} from "lucide-react";

import { DashboardLayout } from "@/components/layout/dashboard-layout";

const quickLinks = [
  {
    label: "Enterprise Inbox",
    href: "/inbox",
    icon: MessageSquare,
    description: "WhatsApp, AI drafts, assignments.",
  },
  {
    label: "Shipments",
    href: "/shipments",
    icon: Truck,
    description: "Lifecycle, ETA, delivery status.",
  },
  {
    label: "Batches",
    href: "/shipment-batches",
    icon: Boxes,
    description: "Air, sea, groupage, containers.",
  },
  {
    label: "Customs",
    href: "/customs/cases",
    icon: ShieldCheck,
    description: "Compliance and blocked cargo.",
  },
];

const operations = [
  "Multi-agency tenant ready",
  "WhatsApp enterprise onboarding",
  "Warehouse receiving workflow",
  "Shipment lifecycle state machine",
  "Delivery proof and payment gate",
];

export default function HomePage() {
  return (
    <DashboardLayout>
      <main className="p-4 md:p-8">
        <section className="slaivo-gradient-card overflow-hidden rounded-[2rem] p-7 text-white md:p-10">
          <div className="grid gap-10 lg:grid-cols-[1.4fr_0.8fr] lg:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-sky-100">
                <Globe2 size={14} />
                International Cargo Command Center
              </div>

              <h1 className="mt-6 max-w-4xl text-4xl font-black tracking-tight md:text-6xl">
                Pilotez vos opérations cargo de WhatsApp jusqu’à la livraison.
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-8 text-slate-300">
                SLAIVO centralise conversations, dossiers, expéditions, warehouse,
                douane, paiements, batches et delivery dans une interface pensée
                pour les agences cargo internationales.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/shipments"
                  className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-slate-950 shadow-xl transition hover:-translate-y-0.5"
                >
                  Ouvrir les shipments
                  <ArrowRight size={16} />
                </Link>
                <Link
                  href="/inbox"
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/15"
                >
                  Voir l’inbox
                </Link>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-white/10 bg-white/10 p-5 backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/20 text-emerald-200">
                  <Zap size={22} />
                </div>
                <div>
                  <div className="font-bold">Operations Health</div>
                  <div className="text-sm text-slate-300">
                    Infrastructure ready for rollout
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {operations.map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-3 rounded-2xl bg-slate-950/30 px-3 py-2 text-sm text-slate-200"
                  >
                    <PackageCheck size={16} className="text-emerald-300" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-4">
          <Kpi label="Active Modules" value="12" hint="Cargo OS layers" />
          <Kpi label="Markets" value="Global" hint="FR/EN ready foundation" />
          <Kpi label="Channels" value="WhatsApp" hint="Enterprise workflow" />
          <Kpi label="Ops Mode" value="Live" hint="Warehouse to delivery" />
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[1fr_0.85fr]">
          <div className="slaivo-card rounded-[2rem] p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-950">
                  Modules Opérationnels
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Accès rapide aux flux essentiels de l’agence.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {quickLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group rounded-3xl border border-slate-200 bg-white p-5 transition hover:-translate-y-1 hover:border-sky-200 hover:shadow-xl"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
                      <item.icon size={20} />
                    </div>
                    <ArrowRight
                      size={18}
                      className="text-slate-300 transition group-hover:translate-x-1 group-hover:text-sky-600"
                    />
                  </div>
                  <div className="mt-5 font-bold text-slate-950">
                    {item.label}
                  </div>
                  <div className="mt-2 text-sm leading-6 text-slate-500">
                    {item.description}
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="slaivo-card rounded-[2rem] p-6">
            <h2 className="text-xl font-black text-slate-950">
              Standards Plateforme
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Les repères qui rendent SLAIVO prêt pour des agences exigeantes.
            </p>

            <div className="mt-6 space-y-4">
              {[
                ["Tenant isolation", "Chaque agence travaille dans son périmètre."],
                ["Operational audit", "Les transitions shipment deviennent traçables."],
                ["AI assisted workflow", "L’IA soutient les agents sans masquer le contrôle."],
                ["International UX", "Interface dense, claire, responsive et professionnelle."],
              ].map(([title, description]) => (
                <div
                  key={title}
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="font-bold text-slate-950">{title}</div>
                  <div className="mt-1 text-sm leading-6 text-slate-500">
                    {description}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </DashboardLayout>
  );
}

function Kpi({
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
      <div className="text-sm font-semibold text-slate-500">{label}</div>
      <div className="mt-3 text-3xl font-black tracking-tight text-slate-950">
        {value}
      </div>
      <div className="mt-2 text-xs text-slate-500">{hint}</div>
    </div>
  );
}

