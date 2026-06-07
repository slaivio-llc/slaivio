import { ReactNode } from "react";
import Image from "next/image";
import { Boxes, CheckCircle2, Globe2, ShieldCheck } from "lucide-react";

const proofPoints = [
  "Multi-agency cargo operations",
  "WhatsApp enterprise workflows",
  "Warehouse, customs and delivery lifecycle",
  "Finance, AI and team command center",
];

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
    <main className="slaivo-auth-bg relative min-h-screen overflow-hidden text-white">
      <div className="slaivo-grid-bg absolute inset-0 opacity-20" />
      <div className="absolute left-1/2 top-0 h-px w-[80vw] -translate-x-1/2 bg-gradient-to-r from-transparent via-emerald-300/50 to-transparent" />

      <div className="relative mx-auto grid min-h-screen max-w-7xl gap-10 px-5 py-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-10">
        <section className="hidden lg:block">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-emerald-200">
            <Globe2 size={14} />
            SLAIVIO Cargo OS
          </div>

          <h1 className="mt-7 max-w-2xl text-5xl font-black tracking-tight text-white xl:text-6xl">
            Une plateforme cargo internationale, prête pour vos équipes.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300">
            Connectez WhatsApp, créez des dossiers, suivez les shipments,
            organisez le warehouse, la douane, les paiements et les livraisons
            dans une interface claire et robuste.
          </p>

          <div className="mt-8 grid max-w-2xl gap-3">
            {proofPoints.map((point) => (
              <div
                key={point}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-200"
              >
                <CheckCircle2 size={17} className="text-emerald-300" />
                {point}
              </div>
            ))}
          </div>

          <div className="mt-8 grid max-w-2xl grid-cols-3 gap-3">
            <MiniStat icon={<ShieldCheck size={18} />} label="Security" value="Tenant" />
            <MiniStat icon={<Boxes size={18} />} label="Cargo" value="Lifecycle" />
            <MiniStat icon={<Globe2 size={18} />} label="Markets" value="Global" />
          </div>
        </section>

        <section className="flex items-center justify-center">
          <div className="w-full max-w-[440px]">
            <div className="mb-6 flex items-center justify-center gap-3 lg:justify-start">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/10 shadow-2xl">
                <Image
                  src="/slaivio-icon.png"
                  alt="SLAIVIO"
                  width={48}
                  height={48}
                  className="h-full w-full object-cover"
                />
              </div>
              <div>
                <div className="text-2xl font-black tracking-tight">SLAIVIO</div>
                <div className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-300">
                  Cargo OS
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-3 shadow-2xl shadow-black/30 backdrop-blur-xl">
              <div className="slaivo-auth-panel rounded-[1.6rem] border border-white/10 bg-white p-6 text-slate-950 shadow-2xl">
                <div className="mb-5">
                  <h2 className="text-2xl font-black tracking-tight">{title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {description}
                  </p>
                </div>
                {children}
              </div>
            </div>

            <p className="mt-5 text-center text-xs leading-5 text-slate-400 lg:text-left">
              SLAIVIO sécurise les opérations cargo multi-agences avec une base
              pensée pour le marché international.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

function MiniStat({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="text-emerald-300">{icon}</div>
      <div className="mt-3 text-xs text-slate-400">{label}</div>
      <div className="mt-1 text-sm font-black text-white">{value}</div>
    </div>
  );
}
