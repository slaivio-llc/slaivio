import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  KeyRound,
  LockKeyhole,
  MessageCircle,
  PackageCheck,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { DashboardLayout } from "@/components/layout/dashboard-layout";

const buildBlocks = [
  {
    label: "Bloc actuel",
    title: "Authentification & accès",
    status: "En validation production",
    icon: KeyRound,
    description:
      "Clerk, sessions, rôles, permissions, tenant actif, pages sign-in/sign-up et comportement après refresh.",
    checklist: [
      "Clerk en mode production",
      "Sign-in / sign-up alignés au design SLAIVIO",
      "Redirection dashboard stable après connexion",
      "Permissions et tenant vérifiés côté backend",
    ],
    href: "/settings",
    cta: "Ouvrir Auth & Access",
  },
  {
    label: "Bloc suivant",
    title: "Onboarding agence",
    status: "Après auth validée",
    icon: MessageCircle,
    description:
      "Création de l’espace agence, profil, connexion WhatsApp officielle, numéros, règles initiales et premier setup cargo.",
    checklist: [
      "Profil agence clair",
      "Connexion WhatsApp Meta guidée",
      "Premier service cargo configuré",
      "Test réel de bout en bout",
    ],
    href: "/onboarding",
    cta: "Préparer Onboarding",
  },
  {
    label: "Ensuite",
    title: "Modules dashboard",
    status: "Fonction par fonction",
    icon: PackageCheck,
    description:
      "Inbox, Commercial, Dossiers, Shipments, Warehouse, Finance et Delivery seront exposés seulement quand chaque module sera fini et testé.",
    checklist: [
      "Un module à la fois",
      "Frontend + backend + SQL terminés",
      "Test réel production",
      "Puis seulement on passe au suivant",
    ],
    href: "/settings",
    cta: "Voir le cap produit",
  },
];

const productRules = [
  "Aucun module visible dans le menu tant qu’il n’est pas validé en production.",
  "Le backend existant reste conservé, mais l’interface expose seulement les blocs prêts.",
  "Chaque bloc doit avoir un but clair, un écran propre, un test réel et une validation finale.",
  "Le dossier reste la source de vérité quand on arrive aux opérations cargo.",
];

export default function HomePage() {
  return (
    <DashboardLayout>
      <main className="p-4 md:p-8">
        <section className="slaivo-gradient-card overflow-hidden rounded-[2rem] p-7 text-white md:p-10">
          <div className="grid gap-10 xl:grid-cols-[1.2fr_0.8fr] xl:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[0.2em] text-emerald-100">
                <Sparkles size={14} />
                SLAIVIO Launch Build
              </div>

              <h1 className="mt-6 max-w-4xl text-4xl font-black tracking-tight md:text-6xl">
                On construit SLAIVIO bloc par bloc, jusqu’au niveau production.
              </h1>

              <p className="mt-5 max-w-3xl text-base leading-8 text-slate-300">
                Le dashboard est volontairement nettoyé. Maintenant, chaque
                partie du SaaS est développée, designée, testée en production,
                puis validée avant de passer à la suivante.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/settings"
                  className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 shadow-xl transition hover:-translate-y-0.5"
                >
                  Continuer Auth & Access
                  <ArrowRight size={16} />
                </Link>

                <Link
                  href="/sign-in"
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/15"
                >
                  Tester sign-in
                </Link>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-white/10 bg-white/10 p-5 backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/20 text-emerald-200">
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <div className="font-black">Méthode verrouillée</div>
                  <div className="text-sm text-slate-300">
                    Auth → Onboarding → Modules
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {productRules.map((rule) => (
                  <div
                    key={rule}
                    className="flex items-start gap-3 rounded-2xl bg-slate-950/30 px-3 py-2 text-sm leading-6 text-slate-200"
                  >
                    <CheckCircle2
                      size={16}
                      className="mt-1 shrink-0 text-emerald-300"
                    />
                    {rule}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-5 xl:grid-cols-3">
          {buildBlocks.map((block) => (
            <Link
              key={block.title}
              href={block.href}
              className="slaivo-card group rounded-[2rem] p-6 transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-xl"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
                  <block.icon size={20} />
                </div>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-emerald-700">
                  {block.label}
                </span>
              </div>

              <h2 className="mt-5 text-2xl font-black text-slate-950">
                {block.title}
              </h2>
              <p className="mt-2 text-sm font-bold text-emerald-700">
                {block.status}
              </p>
              <p className="mt-4 min-h-[72px] text-sm leading-6 text-slate-500">
                {block.description}
              </p>

              <div className="mt-5 space-y-3">
                {block.checklist.map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-3 text-sm font-semibold text-slate-700"
                  >
                    <ClipboardCheck size={16} className="text-emerald-600" />
                    {item}
                  </div>
                ))}
              </div>

              <div className="mt-6 inline-flex items-center gap-2 text-sm font-black text-slate-950">
                {block.cta}
                <ArrowRight
                  size={16}
                  className="transition group-hover:translate-x-1"
                />
              </div>
            </Link>
          ))}
        </section>

        <section className="mt-8 grid gap-5 lg:grid-cols-[0.75fr_1.25fr]">
          <div className="slaivo-card rounded-[2rem] p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
              <LockKeyhole size={20} />
            </div>
            <h2 className="mt-5 text-xl font-black text-slate-950">
              Focus immédiat
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-500">
              On finalise d’abord l’authentification comme une vraie plateforme
              internationale: pages propres, Clerk production, redirections,
              sécurité, permissions et expérience utilisateur stable.
            </p>
          </div>

          <div className="slaivo-card rounded-[2rem] p-6">
            <h2 className="text-xl font-black text-slate-950">
              Définition de “terminé”
            </h2>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {[
                "Fonction visible uniquement si elle sert le bloc courant.",
                "Design stable sur desktop et mobile.",
                "Backend protégé et testé avec le tenant réel.",
                "Test production réel avant de passer au bloc suivant.",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-700"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </DashboardLayout>
  );
}
