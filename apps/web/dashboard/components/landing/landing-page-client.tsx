"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { type FormEvent, type ReactNode, useState } from "react";
import {
  ArrowRight,
  Bot,
  Building2,
  Check,
  ChevronDown,
  CircleDollarSign,
  Globe2,
  LockKeyhole,
  Menu,
  MessageCircle,
  Package,
  Route,
  ShieldCheck,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";

import { createDemoRequest } from "@/services/landing";

const navItems = [
  { label: "Plateforme", href: "#plateforme" },
  { label: "Solutions", href: "#solutions" },
  { label: "Workflow", href: "#workflow" },
  { label: "Sécurité", href: "#securite" },
];

const operatingCards: Array<{
  title: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    title: "WhatsApp centralisé",
    description:
      "Une inbox opérationnelle pour suivre demandes, relances et décisions sans perdre l'historique client.",
    icon: MessageCircle,
  },
  {
    title: "Dossiers cargo",
    description:
      "Chaque client, colis, paiement et étape logistique est relié à un dossier clair.",
    icon: Package,
  },
  {
    title: "Tracking vivant",
    description:
      "Vos équipes savent où se trouve chaque marchandise et quoi communiquer au client.",
    icon: Route,
  },
  {
    title: "Paiements reliés",
    description:
      "Les encaissements et soldes clients restent attachés aux opérations qui les concernent.",
    icon: CircleDollarSign,
  },
  {
    title: "Multi-bureaux",
    description:
      "Pilotez Kinshasa, Guangzhou, Dubaï ou Paris avec une organisation unique.",
    icon: Building2,
  },
  {
    title: "IA supervisée",
    description:
      "SLAIVIO assiste l'équipe, prépare les réponses et automatise les relances répétitives.",
    icon: Bot,
  },
];

const workflowSteps = [
  {
    title: "Connecter WhatsApp",
    text: "L'agence relie son WhatsApp Business officiel et récupère ses conversations au même endroit.",
  },
  {
    title: "Configurer l'agence",
    text: "Bureaux, routes, entrepôts, équipes, tarifs et rôles sont modélisés selon votre réalité.",
  },
  {
    title: "Créer les opérations",
    text: "Chaque demande devient un dossier avec colis, paiements, statuts et historique complet.",
  },
  {
    title: "Piloter la croissance",
    text: "Les managers suivent les blocages, les relances et les priorités sans dépendre d'Excel.",
  },
];

const securityItems = [
  "Authentification moderne avec Clerk",
  "Connexion WhatsApp officielle via Meta",
  "Données séparées par organisation",
  "Backend prêt pour production et logs",
  "Architecture pensée multi-bureaux",
];

const faqItems = [
  [
    "SLAIVIO remplace-t-il WhatsApp ?",
    "Non. Vos clients continuent à parler sur WhatsApp. SLAIVIO devient la couche de pilotage pour votre équipe.",
  ],
  [
    "Une agence doit-elle connaître Meta Developer ?",
    "Non. L'agence clique sur Connecter WhatsApp. La complexité Meta reste côté plateforme.",
  ],
  [
    "Puis-je commencer sans automatisation complète ?",
    "Oui. Vous pouvez d'abord centraliser l'inbox et les dossiers, puis activer progressivement les workflows.",
  ],
  [
    "Est-ce adapté aux agences multi-pays ?",
    "Oui. SLAIVIO est pensé pour gérer plusieurs bureaux, routes, WABA, numéros et équipes.",
  ],
];

const formFields = [
  { name: "full_name", label: "Nom complet", placeholder: "Jeremy Akiemane" },
  { name: "agency_name", label: "Agence", placeholder: "SLAIVIO Demo Agency" },
  { name: "country", label: "Pays", placeholder: "RDC" },
  { name: "email", label: "Email", placeholder: "vous@agence.com" },
  { name: "phone", label: "WhatsApp", placeholder: "+243 ..." },
  { name: "monthly_shipments", label: "Volume mensuel", placeholder: "Ex: 200 colis/mois" },
];

const fadeUp = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.65, ease: "easeOut" as const },
};

export function LandingPageClient() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);
  const [formStatus, setFormStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function submitDemoRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormStatus("loading");

    const formData = new FormData(event.currentTarget);

    try {
      await createDemoRequest({
        full_name: String(formData.get("full_name") || ""),
        agency_name: String(formData.get("agency_name") || ""),
        country: String(formData.get("country") || ""),
        email: String(formData.get("email") || ""),
        phone: String(formData.get("phone") || ""),
        monthly_shipments: String(formData.get("monthly_shipments") || ""),
        message: String(formData.get("message") || ""),
      });

      event.currentTarget.reset();
      setFormStatus("success");
    } catch {
      setFormStatus("error");
    }
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#020807] text-white">
      <LandingHeader menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
      <HeroSection />
      <ProblemSection />
      <PlatformSection />
      <WorkflowSection />
      <SecuritySection />
      <DemoSection formStatus={formStatus} onSubmit={submitDemoRequest} />
      <FaqSection openFaq={openFaq} setOpenFaq={setOpenFaq} />
      <LandingFooter />
    </main>
  );
}

function LandingHeader({
  menuOpen,
  setMenuOpen,
}: {
  menuOpen: boolean;
  setMenuOpen: (value: boolean) => void;
}) {
  return (
    <header className="fixed left-0 right-0 top-0 z-50 border-b border-white/[0.08] bg-[#020807]/75 backdrop-blur-2xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 lg:px-8">
        <Link href="/landing" className="flex items-center gap-3" aria-label="SLAIVIO landing">
          <Image
            src="/slaivio-mark.png"
            alt=""
            width={42}
            height={42}
            className="h-10 w-10 object-contain"
            priority
          />
          <span className="text-xl font-bold tracking-tight">SLAIVIO</span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium text-white/72 lg:flex">
          {navItems.map((item) => (
            <a key={item.href} href={item.href} className="transition hover:text-white">
              {item.label}
            </a>
          ))}
          <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/55">
            FR | EN
          </span>
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <Link href="/sign-in" className="rounded-full px-4 py-2 text-sm font-semibold text-white/80 hover:text-white">
            Connexion
          </Link>
          <a
            href="#demo"
            className="inline-flex items-center gap-2 rounded-full bg-[#12C76F] px-5 py-3 text-sm font-bold text-[#02130b] shadow-[0_0_32px_rgba(18,199,111,0.25)] transition hover:-translate-y-0.5 hover:bg-[#36e68e]"
          >
            Demander une démo <ArrowRight className="h-4 w-4" />
          </a>
        </div>

        <button
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] lg:hidden"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Ouvrir le menu"
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="border-t border-white/10 bg-[#020807]/95 px-5 py-5 lg:hidden"
          >
            <div className="flex flex-col gap-4">
              {navItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="text-sm font-semibold text-white/75"
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </a>
              ))}
              <Link href="/sign-in" className="text-sm font-semibold text-white/75">
                Connexion
              </Link>
              <a
                href="#demo"
                onClick={() => setMenuOpen(false)}
                className="rounded-full bg-[#12C76F] px-5 py-3 text-center text-sm font-bold text-[#02130b]"
              >
                Demander une démo
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

function HeroSection() {
  return (
    <section className="relative overflow-hidden px-5 pb-20 pt-32 sm:pb-28 lg:px-8">
      <div className="absolute inset-0 opacity-60">
        <div className="absolute left-1/2 top-0 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-[#12C76F]/10 blur-[120px]" />
        <div className="absolute bottom-10 left-0 h-[420px] w-[420px] rounded-full bg-[#0b7cff]/10 blur-[110px]" />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
            maskImage: "radial-gradient(circle at center, black 0%, transparent 72%)",
          }}
        />
      </div>

      <div className="relative mx-auto max-w-7xl">
        <motion.div {...fadeUp} className="mx-auto max-w-4xl text-center">
          <div className="mx-auto mb-8 inline-flex items-center gap-2 rounded-full border border-[#12C76F]/25 bg-[#12C76F]/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.28em] text-[#74f0af]">
            <Sparkles className="h-4 w-4" />
            Cargo operations platform
          </div>

          <h1 className="text-balance text-5xl font-bold leading-[0.95] tracking-[-0.055em] sm:text-6xl lg:text-7xl xl:text-[88px]">
            L&apos;Operating System
            <span className="block text-[#12C76F]">des Agences Cargo</span>
          </h1>

          <p className="mx-auto mt-7 max-w-2xl text-balance text-lg leading-8 text-white/70 sm:text-xl">
            Centralisez WhatsApp, les expéditions, les paiements, les bureaux et vos équipes
            dans une seule plateforme conçue pour les agences cargo modernes.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="#demo"
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#12C76F] px-7 py-4 text-sm font-bold text-[#02130b] shadow-[0_0_38px_rgba(18,199,111,0.28)] transition hover:-translate-y-1 hover:bg-[#36e68e] sm:w-auto"
            >
              Demander une démo <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="https://wa.me/"
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/14 bg-white/[0.04] px-7 py-4 text-sm font-bold text-white backdrop-blur transition hover:-translate-y-1 hover:bg-white/[0.08] sm:w-auto"
            >
              <MessageCircle className="h-4 w-4 text-[#12C76F]" />
              Parler à un conseiller
            </a>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 36, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.85, delay: 0.2, ease: "easeOut" as const }}
          className="relative mx-auto mt-16 max-w-6xl"
        >
          <div className="absolute inset-x-16 -top-8 h-24 rounded-full bg-[#12C76F]/35 blur-[70px]" />
          <div className="relative rounded-[2rem] border border-white/12 bg-white/[0.045] p-3 shadow-[0_30px_120px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
            <DashboardPreview />
          </div>

          <FloatingCard
            className="-left-3 bottom-10 hidden rotate-[-3deg] lg:block"
            icon={Package}
            title="Nouveau colis arrivé"
            text="Dossier créé automatiquement"
            badge="À valider"
          />
          <FloatingCard
            className="bottom-[-42px] left-1/2 hidden -translate-x-1/2 rotate-[1deg] md:block"
            icon={MessageCircle}
            title="Message WhatsApp traité"
            text="Réponse préparée par SLAIVIO"
            badge="IA"
          />
          <FloatingCard
            className="-right-3 bottom-14 hidden rotate-[3deg] lg:block"
            icon={CircleDollarSign}
            title="Paiement reçu"
            text="À rapprocher au dossier"
            badge="Finance"
          />
        </motion.div>
      </div>
    </section>
  );
}

function DashboardPreview() {
  const menu = ["Dashboard", "Clients", "Dossiers", "Expéditions", "Tracking", "WhatsApp Inbox", "Paiements"];
  const kpis = [
    ["Inbox à traiter", "Priorités"],
    ["Dossiers actifs", "Suivi"],
    ["Paiements", "Validation"],
    ["Expéditions", "Tracking"],
  ];

  return (
    <div className="overflow-hidden rounded-[1.55rem] border border-white/10 bg-[#06100d]">
      <div className="grid min-h-[620px] grid-cols-1 lg:grid-cols-[230px_1fr]">
        <aside className="hidden border-r border-white/10 bg-black/20 p-6 lg:block">
          <div className="mb-8 flex items-center gap-3">
            <Image src="/slaivio-mark.png" alt="" width={38} height={38} className="h-9 w-9 object-contain" />
            <span className="text-lg font-bold">SLAIVIO</span>
          </div>
          <div className="space-y-2">
            {menu.map((item, index) => (
              <div
                key={item}
                className={`rounded-xl px-3 py-3 text-sm font-semibold ${
                  index === 0 ? "bg-[#12C76F] text-[#02130b]" : "text-white/62"
                }`}
              >
                {item}
              </div>
            ))}
          </div>
        </aside>

        <div className="p-5 sm:p-7 lg:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-[#12C76F]">Exemple de cockpit opérationnel</p>
              <h2 className="mt-1 text-2xl font-bold">Bonjour, Admin</h2>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs text-white/65">
                Aujourd&apos;hui
              </span>
              <span className="rounded-full border border-[#12C76F]/30 bg-[#12C76F]/10 px-4 py-2 text-xs font-bold text-[#74f0af]">
                Production ready
              </span>
            </div>
          </div>

          <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {kpis.map(([title, status]) => (
              <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.045] p-5">
                <p className="text-sm text-white/58">{title}</p>
                <div className="mt-5 h-9 rounded-full bg-gradient-to-r from-[#12C76F]/75 via-[#0b7cff]/50 to-transparent" />
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#74f0af]">
                  {status}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_0.85fr]">
            <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-5">
              <div className="flex items-center justify-between">
                <h3 className="font-bold">Flux des opérations</h3>
                <span className="text-xs text-white/45">WhatsApp → Dossier → Expédition</span>
              </div>
              <svg viewBox="0 0 520 220" className="mt-6 h-[220px] w-full">
                <defs>
                  <linearGradient id="slaivio-green-line" x1="0" x2="1">
                    <stop offset="0%" stopColor="#12C76F" />
                    <stop offset="100%" stopColor="#0B7CFF" />
                  </linearGradient>
                </defs>
                {[40, 80, 120, 160, 200].map((y) => (
                  <line key={y} x1="0" x2="520" y1={y} y2={y} stroke="rgba(255,255,255,.08)" />
                ))}
                <path
                  d="M8 174 C65 140 98 154 142 118 C191 78 239 96 281 72 C338 38 392 56 512 24"
                  fill="none"
                  stroke="url(#slaivio-green-line)"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
                <path
                  d="M8 192 C58 166 118 180 160 142 C210 96 260 124 315 88 C371 52 414 80 512 46"
                  fill="none"
                  stroke="#2E6BFF"
                  strokeWidth="4"
                  strokeLinecap="round"
                  opacity="0.75"
                />
              </svg>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-5">
              <h3 className="font-bold">Activité récente</h3>
              <div className="mt-5 space-y-3">
                {[
                  ["WhatsApp", "Réponse prête pour un client"],
                  ["Dossier", "Pièce manquante détectée"],
                  ["Tracking", "Statut expédition mis à jour"],
                  ["Finance", "Paiement à rapprocher"],
                ].map(([label, text]) => (
                  <div key={label} className="rounded-2xl border border-white/8 bg-black/15 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#12C76F]">{label}</p>
                    <p className="mt-1 text-sm text-white/72">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FloatingCard({
  className,
  icon: Icon,
  title,
  text,
  badge,
}: {
  className: string;
  icon: LucideIcon;
  title: string;
  text: string;
  badge: string;
}) {
  return (
    <motion.div
      animate={{ y: [0, -12, 0] }}
      transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" as const }}
      className={`absolute w-[270px] rounded-3xl border border-white/12 bg-[#06100d]/88 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.5)] backdrop-blur-2xl ${className}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#12C76F]/15 text-[#12C76F]">
          <Icon className="h-6 w-6" />
        </div>
        <span className="rounded-full bg-[#12C76F]/12 px-3 py-1 text-xs font-bold text-[#74f0af]">
          {badge}
        </span>
      </div>
      <h3 className="mt-4 font-bold">{title}</h3>
      <p className="mt-1 text-sm text-white/60">{text}</p>
    </motion.div>
  );
}

function ProblemSection() {
  return (
    <section id="solutions" className="border-t border-white/[0.08] bg-[#03100d] px-5 py-20 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <motion.div {...fadeUp}>
          <Pill icon={ShieldCheck}>Le vrai problème</Pill>
          <h2 className="mt-5 text-4xl font-bold tracking-[-0.04em] sm:text-5xl">
            Quand l&apos;agence grandit, le chaos grandit aussi.
          </h2>
          <p className="mt-5 text-lg leading-8 text-white/65">
            WhatsApp contient les demandes. Excel contient les suivis. Les paiements sont ailleurs.
            Les managers passent leur journée à recoller les morceaux au lieu de piloter.
          </p>
        </motion.div>

        <div className="grid gap-4 sm:grid-cols-2">
          {[
            ["Messages dispersés", "Les conversations importantes restent bloquées dans les téléphones."],
            ["Dossiers incomplets", "Les pièces, statuts, paiements et notes ne vivent pas ensemble."],
            ["Relances oubliées", "Les clients attendent parce que personne ne voit la prochaine action."],
            ["Croissance difficile", "Plus de clients finit par créer plus de charge manuelle."],
          ].map(([title, text], index) => (
            <motion.div
              key={title}
              {...fadeUp}
              transition={{ duration: 0.55, delay: index * 0.06 }}
              className="rounded-3xl border border-white/10 bg-white/[0.04] p-6"
            >
              <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-full bg-red-500/12 text-red-300">
                <X className="h-5 w-5" />
              </div>
              <h3 className="font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-white/58">{text}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PlatformSection() {
  return (
    <section id="plateforme" className="px-5 py-20 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <motion.div {...fadeUp} className="mx-auto max-w-3xl text-center">
          <Pill icon={Sparkles}>Plateforme unifiée</Pill>
          <h2 className="mt-5 text-4xl font-bold tracking-[-0.04em] sm:text-5xl">
            Tout ce que votre agence doit contrôler, au même endroit.
          </h2>
          <p className="mt-5 text-lg leading-8 text-white/65">
            SLAIVIO ne vend pas une page de plus. C&apos;est une colonne vertébrale opérationnelle
            pour les équipes cargo qui travaillent tous les jours avec WhatsApp.
          </p>
        </motion.div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {operatingCards.map((card, index) => (
            <motion.div
              key={card.title}
              {...fadeUp}
              transition={{ duration: 0.55, delay: index * 0.05 }}
              className="group rounded-[1.7rem] border border-white/10 bg-white/[0.045] p-6 transition hover:-translate-y-1 hover:border-[#12C76F]/35 hover:bg-white/[0.065]"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#12C76F]/12 text-[#12C76F] transition group-hover:scale-105">
                <card.icon className="h-7 w-7" />
              </div>
              <h3 className="mt-6 text-xl font-bold">{card.title}</h3>
              <p className="mt-3 text-sm leading-7 text-white/60">{card.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function WorkflowSection() {
  return (
    <section id="workflow" className="border-y border-white/[0.08] bg-[#06110e] px-5 py-20 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <motion.div {...fadeUp} className="max-w-3xl">
          <Pill icon={Route}>Méthode de déploiement</Pill>
          <h2 className="mt-5 text-4xl font-bold tracking-[-0.04em] sm:text-5xl">
            Une mise en place progressive, sans casser votre activité.
          </h2>
        </motion.div>

        <div className="mt-12 grid gap-5 lg:grid-cols-4">
          {workflowSteps.map((step, index) => (
            <motion.div
              key={step.title}
              {...fadeUp}
              transition={{ duration: 0.55, delay: index * 0.08 }}
              className="relative rounded-[1.7rem] border border-white/10 bg-[#020807] p-6"
            >
              <div className="mb-8 flex h-11 w-11 items-center justify-center rounded-full bg-[#12C76F] text-lg font-black text-[#02130b]">
                {index + 1}
              </div>
              <h3 className="text-lg font-bold">{step.title}</h3>
              <p className="mt-3 text-sm leading-7 text-white/58">{step.text}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SecuritySection() {
  return (
    <section id="securite" className="px-5 py-20 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-10 rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 backdrop-blur lg:grid-cols-[0.9fr_1.1fr] lg:p-10">
        <motion.div {...fadeUp}>
          <Pill icon={LockKeyhole}>Production mindset</Pill>
          <h2 className="mt-5 text-4xl font-bold tracking-[-0.04em] sm:text-5xl">
            Pensé pour devenir une infrastructure, pas juste un dashboard.
          </h2>
          <p className="mt-5 text-lg leading-8 text-white/65">
            Le cap est simple: chaque bloc doit être testé en réel, relié à la production,
            et compréhensible par une agence qui n&apos;a pas d&apos;équipe technique.
          </p>
        </motion.div>

        <div className="grid gap-3">
          {securityItems.map((item) => (
            <div key={item} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/18 p-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#12C76F]/15 text-[#12C76F]">
                <Check className="h-5 w-5" />
              </span>
              <span className="font-semibold text-white/82">{item}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function DemoSection({
  formStatus,
  onSubmit,
}: {
  formStatus: "idle" | "loading" | "success" | "error";
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section id="demo" className="border-y border-white/[0.08] bg-[#03100d] px-5 py-20 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.82fr_1fr] lg:items-start">
        <motion.div {...fadeUp}>
          <Pill icon={MessageCircle}>Passer à la démo</Pill>
          <h2 className="mt-5 text-4xl font-bold tracking-[-0.04em] sm:text-5xl">
            Montrez-nous votre flux actuel. On vous montre où SLAIVIO enlève le chaos.
          </h2>
          <p className="mt-5 text-lg leading-8 text-white/65">
            Pas besoin d&apos;avoir tout prêt. Une agence peut commencer par l&apos;inbox, les dossiers
            et le tracking, puis activer les automatisations par étapes.
          </p>
        </motion.div>

        <motion.form
          {...fadeUp}
          onSubmit={onSubmit}
          className="rounded-[2rem] border border-white/10 bg-[#020807] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.35)] sm:p-7"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {formFields.map((field) => (
              <label key={field.name} className="block">
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-white/45">
                  {field.label}
                </span>
                <input
                  name={field.name}
                  required={field.name === "full_name" || field.name === "email"}
                  type={field.name === "email" ? "email" : "text"}
                  placeholder={field.placeholder}
                  className="mt-2 h-[52px] w-full rounded-2xl border border-white/10 bg-white/[0.045] px-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#12C76F]/60"
                />
              </label>
            ))}
          </div>

          <label className="mt-4 block">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-white/45">
              Message
            </span>
            <textarea
              name="message"
              rows={5}
              placeholder="Dites-nous comment votre agence travaille aujourd'hui..."
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#12C76F]/60"
            />
          </label>

          <button
            type="submit"
            disabled={formStatus === "loading"}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#12C76F] px-6 py-4 text-sm font-black text-[#02130b] transition hover:-translate-y-0.5 hover:bg-[#36e68e] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {formStatus === "loading" ? "Envoi..." : "Demander une démo"}
            <ArrowRight className="h-4 w-4" />
          </button>

          {formStatus === "success" && (
            <p className="mt-4 rounded-2xl border border-[#12C76F]/20 bg-[#12C76F]/10 p-4 text-sm text-[#74f0af]">
              Demande reçue. On vous contactera avec les prochaines étapes.
            </p>
          )}
          {formStatus === "error" && (
            <p className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200">
              Impossible d&apos;envoyer la demande pour le moment. Réessayez dans quelques instants.
            </p>
          )}
        </motion.form>
      </div>
    </section>
  );
}

function FaqSection({
  openFaq,
  setOpenFaq,
}: {
  openFaq: number;
  setOpenFaq: (index: number) => void;
}) {
  return (
    <section className="px-5 py-20 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <motion.div {...fadeUp} className="text-center">
          <Pill icon={Globe2}>FAQ</Pill>
          <h2 className="mt-5 text-4xl font-bold tracking-[-0.04em] sm:text-5xl">
            Les questions avant une vraie mise en production.
          </h2>
        </motion.div>

        <div className="mt-10 space-y-3">
          {faqItems.map(([question, answer], index) => (
            <motion.div
              key={question}
              {...fadeUp}
              transition={{ duration: 0.45, delay: index * 0.04 }}
              className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.045]"
            >
              <button
                className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left font-bold"
                onClick={() => setOpenFaq(openFaq === index ? -1 : index)}
                aria-expanded={openFaq === index}
              >
                {question}
                <ChevronDown className={`h-5 w-5 transition ${openFaq === index ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence initial={false}>
                {openFaq === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <p className="px-5 pb-5 text-sm leading-7 text-white/62">{answer}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function LandingFooter() {
  return (
    <footer className="border-t border-white/[0.08] px-5 py-10 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Image src="/slaivio-mark.png" alt="" width={38} height={38} className="h-9 w-9 object-contain" />
          <div>
            <p className="font-bold">SLAIVIO</p>
            <p className="text-sm text-white/45">Cargo operations platform</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-5 text-sm text-white/55">
          <a href="#plateforme" className="hover:text-white">Plateforme</a>
          <a href="#solutions" className="hover:text-white">Solutions</a>
          <a href="#demo" className="hover:text-white">Démo</a>
          <Link href="/sign-in" className="hover:text-white">Connexion</Link>
        </div>
      </div>
    </footer>
  );
}

function Pill({ children, icon: Icon }: { children: ReactNode; icon: LucideIcon }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[#12C76F]/25 bg-[#12C76F]/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[#74f0af]">
      <Icon className="h-4 w-4" />
      {children}
    </span>
  );
}
