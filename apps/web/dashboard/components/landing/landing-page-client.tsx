"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import {
  ArrowRight,
  AlarmClock,
  AlertTriangle,
  BarChart3,
  Bell,
  Bot,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock,
  CreditCard,
  FileText,
  FileSpreadsheet,
  Globe2,
  Inbox,
  LockKeyhole,
  Megaphone,
  Menu,
  MessageCircle,
  Package,
  PlayCircle,
  Receipt,
  Rocket,
  Route,
  Search,
  Send,
  Settings,
  Sparkles,
  Target,
  Truck,
  UserCircle,
  Users,
  Warehouse,
  X,
  type LucideIcon,
} from "lucide-react";

import { createDemoRequest } from "@/services/landing";

const navItems = [
  { label: "Fonctionnalités", href: "#plateforme", hasChevron: true },
  { label: "Comment ça marche", href: "#workflow" },
  { label: "Tarifs", href: "#demo" },
  { label: "Ressources", href: "#securite", hasChevron: true },
  { label: "Contact", href: "#demo" },
];

const heroTitlePhrases = [
  "sans limites.",
  "plus vite.",
  "sans chaos.",
  "avec précision.",
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
  const [heroPhraseIndex, setHeroPhraseIndex] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setHeroPhraseIndex((index) => (index + 1) % heroTitlePhrases.length);
    }, 2600);

    return () => window.clearInterval(interval);
  }, []);

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
      <HeroSection phrase={heroTitlePhrases[heroPhraseIndex]} />
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
    <header className="absolute left-0 right-0 top-0 z-50">
      <div className="mx-auto grid h-[88px] max-w-[1600px] grid-cols-[1fr_auto] items-center px-4 sm:px-6 lg:grid-cols-[230px_minmax(0,1fr)_auto] lg:px-8 2xl:px-10">
        <Link href="/" className="flex items-center gap-3" aria-label="SLAIVIO">
          <Image
            src="/slaivio-logo-official-dark.png"
            alt="SLAIVIO"
            width={156}
            height={60}
            className="h-auto w-[142px] object-contain sm:w-[154px]"
            priority
          />
        </Link>

        <nav className="hidden items-center justify-center gap-9 text-[15px] font-semibold text-white xl:flex 2xl:gap-11">
          {navItems.map((item) => (
            <a key={item.label} href={item.href} className="inline-flex items-center gap-1.5 transition hover:text-[#12C76F]">
              {item.label}
              {item.hasChevron && <ChevronDown className="h-3.5 w-3.5" />}
            </a>
          ))}
        </nav>

        <div className="hidden items-center justify-end gap-6 lg:flex">
          <button className="inline-flex items-center gap-2 text-sm font-semibold text-white" type="button">
            <Globe2 className="h-5 w-5" />
            FR
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <Link href="/sign-in" className="text-sm font-semibold text-white transition hover:text-[#12C76F]">
            Se connecter
          </Link>
          <a
            href="#demo"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-[#12C76F] px-[22px] text-sm font-bold text-white shadow-[0_0_28px_rgba(18,199,111,0.26)] transition hover:-translate-y-0.5 hover:bg-[#18d87b]"
          >
            Demander une démo
          </a>
        </div>

        <button
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white lg:hidden"
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
                  key={item.label}
                  href={item.href}
                  className="text-sm font-semibold text-white/75"
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </a>
              ))}
              <Link href="/sign-in" className="text-sm font-semibold text-white/75">
                Se connecter
              </Link>
              <a
                href="#demo"
                onClick={() => setMenuOpen(false)}
                className="rounded-xl bg-[#12C76F] px-5 py-3 text-center text-sm font-bold text-white"
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

function HeroSection({ phrase }: { phrase: string }) {
  return (
    <section className="relative min-h-screen overflow-hidden bg-[#030706] px-5 pb-16 pt-[120px] text-white sm:px-8 lg:px-12">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_55%,rgba(18,199,111,0.25),transparent_35%),radial-gradient(circle_at_30%_80%,rgba(18,199,111,0.10),transparent_30%),linear-gradient(180deg,#030706_0%,#050A09_48%,#07110D_100%)]" />
        <div className="absolute left-0 top-0 h-full w-full bg-[linear-gradient(180deg,rgba(0,0,0,0)_0%,rgba(0,0,0,.32)_100%)]" />
        <div
          className="absolute bottom-0 left-0 h-[360px] w-[760px] opacity-[0.18]"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,.72) 1.15px, transparent 1.25px)",
            backgroundSize: "12px 12px",
            clipPath:
              "polygon(2% 36%, 15% 28%, 30% 35%, 40% 20%, 55% 33%, 70% 23%, 92% 42%, 87% 78%, 67% 68%, 56% 92%, 42% 69%, 29% 88%, 18% 66%, 5% 73%)",
          }}
        />
      </div>

      <div className="relative mx-auto grid min-h-[calc(100vh-120px)] max-w-[1500px] items-center gap-16 lg:grid-cols-[0.38fr_0.62fr] xl:gap-20">
        <div className="relative z-10 max-w-[590px]">
          <motion.h1
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" as const }}
            className="text-[42px] font-bold leading-[1.04] tracking-[-0.025em] text-white sm:text-[56px] xl:text-[68px]"
          >
            Centralisez. Automatisez.
            <br />
            Développez votre agence
            <br />
            <span className="relative inline-grid min-h-[1.12em] min-w-[8.5em] overflow-hidden align-top text-[#12C76F]">
              <AnimatePresence mode="wait">
                <motion.span
                  key={phrase}
                  initial={{ y: "82%", opacity: 0, filter: "blur(8px)" }}
                  animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
                  exit={{ y: "-82%", opacity: 0, filter: "blur(8px)" }}
                  transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
                  className="col-start-1 row-start-1 whitespace-nowrap"
                >
                  {phrase}
                </motion.span>
              </AnimatePresence>
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" as const }}
            className="mt-8 max-w-[560px] text-[17px] leading-[1.78] text-white/70 sm:text-lg"
          >
            SLAIVIO centralise vos clients, colis, expéditions, paiements et WhatsApp dans
            une seule plateforme. Gagnez du temps, réduisez les erreurs et offrez une
            meilleure expérience à vos clients.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" as const }}
            className="mt-12 flex flex-col gap-4 sm:flex-row"
          >
            <a
              href="#demo"
              className="inline-flex h-14 w-full items-center justify-center gap-3 rounded-[14px] bg-[#12C76F] px-6 text-base font-bold text-white shadow-[0_0_35px_rgba(18,199,111,0.32)] transition hover:-translate-y-0.5 hover:bg-[#18d87b] sm:w-auto"
            >
              <Send className="h-5 w-5" />
              Demander une démo
            </a>
            <a
              href="#plateforme"
              className="inline-flex h-14 w-full items-center justify-center gap-3 rounded-[14px] border border-white/[0.18] bg-white/[0.03] px-6 text-base font-bold text-white backdrop-blur transition hover:border-[#12C76F]/70 hover:shadow-[0_0_28px_rgba(18,199,111,0.16)] sm:w-auto"
            >
              <PlayCircle className="h-6 w-6 text-[#3B82F6]" />
              Watch a video
            </a>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.85, delay: 0.4, ease: "easeOut" as const }}
          className="relative z-10 ml-auto w-full max-w-[860px]"
        >
          <motion.div
            aria-hidden="true"
            animate={{ rotate: 360 }}
            transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
            className="absolute -left-20 top-[46%] hidden h-[260px] w-[260px] rounded-full border border-dashed border-[#12C76F]/70 lg:block"
          />
          <motion.div
            aria-hidden="true"
            animate={{ rotate: -360 }}
            transition={{ duration: 38, repeat: Infinity, ease: "linear" }}
            className="absolute -right-10 bottom-10 hidden h-[300px] w-[300px] rounded-full border border-dashed border-[#12C76F]/60 lg:block"
          />
          <div className="absolute -inset-12 rounded-full bg-[#12C76F]/20 blur-[90px]" />
          <DashboardPreview />

          <FloatingCard
            className="right-3 top-5 hidden rotate-[3deg] xl:block"
            delay={0}
            icon={MessageCircle}
            title="Nouveau message WhatsApp"
            lines={["De : +243 81 234 5678"]}
            badge="maintenant"
            variant="whatsapp"
          />
          <FloatingCard
            className="-left-16 bottom-[-22px] hidden rotate-[-2deg] lg:block"
            delay={0.7}
            icon={Package}
            title="Colis reçu en entrepôt Chine"
            lines={["CBJ-987654", "Poids : 12.5 kg"]}
            badge="Il y a 2 min"
            variant="package"
          />
          <FloatingCard
            className="right-2 bottom-[-46px] hidden rotate-[4deg] lg:block"
            delay={1.2}
            icon={CheckCircle2}
            title="Expédition livrée"
            lines={["EXP-2024-1240", "Kinshasa, RDC"]}
            badge="Il y a 15 min"
            variant="success"
          />
        </motion.div>
      </div>
    </section>
  );
}

function DashboardPreview() {
  const menu: Array<[string, LucideIcon, string?]> = [
    ["Dashboard", Route],
    ["Clients", Users],
    ["Dossiers", FileText],
    ["Colis", Package],
    ["Expéditions", Truck],
    ["Tracking", Search],
    ["WhatsApp Inbox", MessageCircle, "12"],
    ["Broadcasts", Megaphone],
    ["Relances", Bell],
    ["Base de connaissances", Inbox],
    ["Tarification", CircleDollarSign],
    ["Services", Warehouse],
    ["Paiements", CreditCard],
    ["Factures", Receipt],
    ["Organisation", Building2],
    ["Paramètres", Settings],
  ];
  const kpis = [
    ["Clients", "1,248", "+14.5%"],
    ["Dossiers", "842", "+12.3%"],
    ["Colis", "2,453", "+18.7%"],
    ["Expéditions", "320", "+9.1%"],
  ];
  const shipments = [
    ["EXP-2024-1250", "Chine → Kinshasa", "En transit", "12 Juin 2024", "green"],
    ["EXP-2024-1249", "Dubaï → Douala", "Arrivé", "08 Juin 2024", "green"],
    ["EXP-2024-1248", "Turquie → Abidjan", "En préparation", "15 Juin 2024", "amber"],
    ["EXP-2024-1247", "Chine → Yaoundé", "En transit", "10 Juin 2024", "purple"],
    ["EXP-2024-1246", "Inde → Lubumbashi", "Validé", "—", "green"],
  ];

  return (
    <div className="relative overflow-hidden rounded-[24px] border border-white/[0.12] bg-[#070E0D]/85 shadow-[0_40px_120px_rgba(0,0,0,0.45)] backdrop-blur-[20px]">
      <div className="grid min-h-[620px] grid-cols-1 lg:grid-cols-[176px_1fr] xl:grid-cols-[190px_1fr]">
        <aside className="hidden border-r border-white/[0.08] bg-black/10 px-3 py-5 lg:block">
          <div className="mb-5 flex items-center gap-2 px-2">
            <Image
              src="/slaivio-logo-official-dark.png"
              alt="SLAIVIO"
              width={112}
              height={43}
              className="h-auto w-[104px] object-contain"
            />
          </div>
          <div className="space-y-1.5">
            {menu.map(([item, Icon, badge], index) => (
              <div
                key={item}
                className={`flex h-8 items-center gap-2 rounded-lg px-2 text-[11px] font-semibold ${
                  index === 0 ? "bg-[#12C76F]/22 text-[#12C76F]" : "text-white/78"
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{item}</span>
                {badge && <span className="rounded-full bg-[#12C76F] px-1.5 py-0.5 text-[9px] font-black text-[#03100d]">{badge}</span>}
              </div>
            ))}
          </div>
        </aside>

        <div className="min-w-0 p-4 sm:p-5">
          <div className="flex flex-col gap-4 border-b border-white/[0.06] pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex h-9 min-w-0 items-center gap-2 rounded-2xl border border-white/[0.08] bg-black/20 px-4 text-[11px] text-white/68 sm:w-[260px]">
              <Search className="h-4 w-4 shrink-0" />
              <span className="truncate">Rechercher un client, dossier, colis...</span>
            </div>
            <div className="flex items-center gap-3">
              <Bell className="h-4 w-4 text-white/80" />
              <MessageCircle className="h-4 w-4 text-white/70" />
              <UserCircle className="h-5 w-5 text-white/72" />
              <div className="hidden sm:block">
                <p className="text-[11px] font-bold">OTI Cargo Express</p>
                <p className="text-[10px] text-white/55">Kinshasa, RDC</p>
              </div>
              <ChevronDown className="hidden h-3.5 w-3.5 text-white/60 sm:block" />
            </div>
          </div>

          <h2 className="mt-5 text-lg font-bold">Tableau de bord</h2>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {kpis.map(([title, value, delta]) => (
              <div key={title} className="rounded-lg border border-white/[0.08] bg-white/[0.035] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                <p className="text-[11px] font-semibold text-white">{title}</p>
                <div className="mt-3 flex items-end justify-between gap-2">
                  <p className="text-2xl font-extrabold tracking-[-0.04em]">{value}</p>
                  <p className="text-[11px] font-black text-[#12C76F]">{delta}</p>
                </div>
                <p className="mt-2 text-[10px] text-white/55">vs mois dernier</p>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-lg border border-white/[0.08] bg-white/[0.035] p-4">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-bold">Expéditions en cours</h3>
              <ChevronDown className="-rotate-90 h-4 w-4 text-white" />
            </div>
            <div className="grid grid-cols-[1.1fr_1.1fr_0.9fr_1fr] border-y border-white/[0.06] py-2 text-[10px] text-white/62">
              <span>Expédition</span>
              <span>Route</span>
              <span>Statut</span>
              <span>ETA</span>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {shipments.map(([id, route, status, eta, tone]) => (
                <div key={id} className="grid grid-cols-[1.1fr_1.1fr_0.9fr_1fr] items-center py-2 text-[10px]">
                  <span className="truncate font-bold">{id}</span>
                  <span className="truncate text-white/86">{route}</span>
                  <span>
                    <span
                      className={`rounded-full px-2 py-1 font-bold ${
                        tone === "amber"
                          ? "bg-amber-500/18 text-amber-300"
                          : tone === "purple"
                            ? "bg-violet-500/18 text-violet-300"
                            : "bg-[#12C76F]/18 text-[#12C76F]"
                      }`}
                    >
                      {status}
                    </span>
                  </span>
                  <span className="truncate text-white/86">{eta}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 grid gap-3 xl:grid-cols-[0.78fr_1.2fr_0.86fr]">
            <div className="rounded-lg border border-white/[0.08] bg-white/[0.035] p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-bold">Revenus ce mois</h3>
                <ChevronDown className="-rotate-90 h-4 w-4" />
              </div>
              <p className="mt-5 text-2xl font-extrabold tracking-[-0.04em]">$24,850 <span className="text-[11px] text-[#12C76F]">+16.3%</span></p>
              <svg viewBox="0 0 180 120" className="mt-3 h-[116px] w-full">
                <defs>
                  <linearGradient id="hero-revenue-fill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="rgba(18,199,111,.46)" />
                    <stop offset="100%" stopColor="rgba(18,199,111,0)" />
                  </linearGradient>
                  <linearGradient id="hero-revenue-line" x1="0" x2="1">
                    <stop offset="0%" stopColor="#12C76F" />
                    <stop offset="100%" stopColor="#1FE58A" />
                  </linearGradient>
                </defs>
                {[22, 48, 74, 100].map((y) => (
                  <line key={y} x1="0" x2="180" y1={y} y2={y} stroke="rgba(255,255,255,.07)" />
                ))}
                <path d="M0 106 C18 78 28 100 45 72 C62 42 74 54 92 34 C114 8 130 58 148 32 C160 14 168 32 180 0 L180 120 L0 120 Z" fill="url(#hero-revenue-fill)" />
                <path d="M0 106 C18 78 28 100 45 72 C62 42 74 54 92 34 C114 8 130 58 148 32 C160 14 168 32 180 0" fill="none" stroke="url(#hero-revenue-line)" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </div>

            <div className="rounded-lg border border-white/[0.08] bg-white/[0.035] p-4">
              <h3 className="text-[11px] font-bold">Répartition par service</h3>
              <div className="mt-5 flex items-center gap-6">
                <div className="relative h-[118px] w-[118px] shrink-0 rounded-full bg-[conic-gradient(#38BDF8_0_45%,#12C76F_45%_80%,#F59E0B_80%_95%,#8B5CF6_95%_100%)] p-[14px]">
                  <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-[#07110D] text-center">
                    <span className="text-xl font-extrabold">2,458</span>
                    <span className="text-[10px] text-white/60">Colis</span>
                  </div>
                </div>
                <div className="min-w-0 flex-1 space-y-3 text-[11px]">
                  {[
                    ["Air Cargo", "45%", "#38BDF8"],
                    ["Sea Cargo", "35%", "#12C76F"],
                    ["Express", "15%", "#F59E0B"],
                    ["Groupage", "5%", "#8B5CF6"],
                  ].map(([label, value, color]) => (
                    <div key={label} className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                      <span className="flex-1 truncate">{label}</span>
                      <span className="text-white/72">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-white/[0.08] bg-white/[0.035] p-4">
              <h3 className="text-[11px] font-bold">Messages WhatsApp</h3>
              <p className="mt-4 text-2xl font-extrabold">128</p>
              <p className="text-[10px] text-white/55">Non lus</p>
              <div className="mt-4 space-y-3">
                {["+243 81 234 5678", "+237 6 00 76 54 32", "+225 07 89 45 67 78"].map((phone, index) => (
                  <div key={phone} className="flex items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-black text-[#07110D]">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[10px] font-bold">{phone}</p>
                      <p className="truncate text-[9px] text-white/50">Bonjour, j&apos;aimerais connaître le pr...</p>
                    </div>
                    <span className="text-[9px] text-white/45">{index === 0 ? "10:24" : index === 1 ? "09:15" : "Hier"}</span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-center text-[10px] font-bold">Voir toutes les conversations</p>
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
  lines,
  badge,
  delay,
  variant,
}: {
  className: string;
  icon: LucideIcon;
  title: string;
  lines: string[];
  badge: string;
  delay: number;
  variant: "whatsapp" | "package" | "success";
}) {
  return (
    <motion.div
      animate={{ y: [0, -8, 0] }}
      transition={{
        duration: variant === "success" ? 8.5 : variant === "package" ? 7.5 : 6.5,
        delay,
        repeat: Infinity,
        repeatType: "mirror",
        ease: "easeInOut" as const,
      }}
      className={`absolute w-[282px] rounded-[18px] border border-white/[0.14] bg-[rgba(5,10,9,0.82)] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-[20px] ${className}`}
    >
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${variant === "success" ? "bg-[#12C76F] text-white" : "border border-[#12C76F] bg-[#12C76F]/10 text-[#12C76F]"}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-sm font-bold">{title}</h3>
            <span className="shrink-0 text-[10px] text-white/45">{badge}</span>
          </div>
          {lines.map((line) => (
            <p key={line} className="mt-1 truncate text-sm text-white/85">{line}</p>
          ))}
        </div>
        <span className="h-2 w-2 shrink-0 rounded-full bg-[#12C76F]" />
      </div>
    </motion.div>
  );
}

function ProblemSection() {
  const problemCards: Array<{
    icon: LucideIcon;
    title: string;
    text: string;
  }> = [
    {
      icon: MessageCircle,
      title: "WhatsApp dispersé",
      text: "Les conversations clients sont partout et difficiles à suivre.",
    },
    {
      icon: FileSpreadsheet,
      title: "Excel et papiers partout",
      text: "Données éparpillées, risques d’erreurs et pertes d’informations.",
    },
    {
      icon: Clock,
      title: "Relances oubliées",
      text: "Des opportunités perdues et des clients qui partent.",
    },
    {
      icon: Package,
      title: "Suivi des colis manuel",
      text: "Vos colis sont difficiles à retrouver et à tracer.",
    },
    {
      icon: BarChart3,
      title: "Pas de visibilité",
      text: "Aucune donnée claire pour prendre les bonnes décisions.",
    },
    {
      icon: Users,
      title: "Croissance freinée",
      text: "Votre agence grandit, mais vos opérations ne suivent pas.",
    },
  ];

  const alerts: Array<{
    icon: LucideIcon;
    title: string;
    text: string;
    badge?: string;
    tone: "green" | "red" | "orange";
    className: string;
  }> = [
    {
      icon: MessageCircle,
      title: "+235 messages non lus",
      text: "3 groupes • 8 clients",
      badge: "235",
      tone: "green",
      className: "left-2 top-8 sm:-left-10 xl:-left-12",
    },
    {
      icon: AlarmClock,
      title: "Relance client",
      text: "En retard depuis 2 jours",
      badge: "3",
      tone: "red",
      className: "right-2 top-12 hidden sm:flex xl:-right-8",
    },
    {
      icon: FileSpreadsheet,
      title: "Tarifs.xlsx",
      text: "Dernière modif : il y a 5 jours",
      tone: "orange",
      className: "left-0 top-[31%] hidden md:flex xl:-left-16",
    },
    {
      icon: Package,
      title: "Colis sans suivi",
      text: "47 colis non tracés",
      badge: "47",
      tone: "orange",
      className: "right-0 top-[43%] hidden md:flex xl:-right-10",
    },
    {
      icon: BarChart3,
      title: "Chiffre d’affaires",
      text: "Pas de rapport cette semaine",
      tone: "red",
      className: "right-3 bottom-[24%] hidden lg:flex xl:-right-4",
    },
  ];

  const benefits: Array<{
    icon: LucideIcon;
    title: string;
    text: string;
  }> = [
    { icon: Clock, title: "Gagnez du temps", text: "sur les tâches répétitives" },
    { icon: Target, title: "Réduisez les erreurs", text: "et les oublis" },
    { icon: BarChart3, title: "Améliorez la satisfaction", text: "de vos clients" },
    { icon: Rocket, title: "Développez votre agence", text: "sans limites" },
  ];

  return (
    <section id="solutions" className="relative overflow-hidden bg-[#FAFCFB] px-5 py-20 text-[#07111F] sm:px-8 lg:px-12 lg:pb-20 lg:pt-[120px]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 bottom-0 h-[360px] bg-[radial-gradient(circle_at_50%_100%,rgba(18,199,111,0.13),transparent_58%)]" />
        <div
          className="absolute bottom-14 left-0 h-[260px] w-[420px] opacity-[0.22]"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(18,199,111,.55) 1px, transparent 1.2px)",
            backgroundSize: "13px 13px",
          }}
        />
      </div>

      <div className="relative mx-auto max-w-[1440px]">
        <div className="grid gap-12 xl:grid-cols-[0.95fr_0.85fr] xl:items-start">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.62, ease: "easeOut" as const }}
              className="mb-9 h-1.5 w-16 rounded-full bg-[#12C76F]"
            />
            <motion.h2
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.68, ease: "easeOut" as const }}
              className="max-w-[680px] text-[38px] font-extrabold leading-[1.08] tracking-[-0.04em] text-[#07111F] sm:text-[48px] xl:text-[56px]"
            >
              Votre agence travaille dur.
              <br />
              Mais vos outils <span className="text-[#12C76F]">vous ralentissent.</span>
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.68, delay: 0.08, ease: "easeOut" as const }}
              className="mt-7 max-w-[620px] text-[18px] leading-[1.75] text-[#475569] sm:text-[19px]"
            >
              Entre WhatsApp, Excel, appels manqués et paperasse, vos équipes perdent du temps
              sur des tâches répétitives au lieu de se concentrer sur vos clients.
            </motion.p>

            <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {problemCards.map((card, index) => (
                <motion.div
                  key={card.title}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 0.56, delay: index * 0.08, ease: "easeOut" as const }}
                  className="min-h-[170px] rounded-[18px] border border-slate-900/[0.08] bg-white/[0.92] p-6 shadow-[0_18px_45px_rgba(15,23,42,0.07)]"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EAFBF2] text-[#12A85E]">
                    <card.icon className="h-7 w-7" />
                  </div>
                  <h3 className="mt-5 text-[17px] font-extrabold tracking-[-0.02em] text-[#07111F]">
                    {card.title}
                  </h3>
                  <p className="mt-3 text-[15px] leading-7 text-[#334155]">{card.text}</p>
                </motion.div>
              ))}
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.75, delay: 0.12, ease: "easeOut" as const }}
            className="relative mx-auto w-full max-w-[640px] xl:mx-0 xl:ml-auto"
          >
            <div className="absolute -right-8 -top-10 hidden h-[220px] w-[220px] rounded-full border border-dashed border-[#12C76F]/30 lg:block" />
            <div className="absolute -bottom-8 right-0 hidden h-[260px] w-[260px] rounded-full border border-dashed border-[#12C76F]/25 lg:block" />
            <div className="relative h-[520px] overflow-hidden rounded-[28px] shadow-[0_30px_80px_rgba(15,23,42,0.16)] sm:h-[660px]">
              <Image
                src="/landing/problem-manager-photo.png"
                alt="Manager cargo concentré devant son téléphone et son ordinateur"
                fill
                sizes="(min-width: 1280px) 640px, 100vw"
                className="object-cover"
              />
            </div>

            {alerts.map((alert, index) => (
              <motion.div
                key={alert.title}
                animate={{ y: [0, index % 2 === 0 ? -6 : 6, 0] }}
                transition={{
                  duration: 5.4 + index * 0.55,
                  repeat: Infinity,
                  repeatType: "mirror",
                  ease: "easeInOut" as const,
                }}
                className={`absolute z-10 flex min-w-[210px] items-center gap-3 rounded-[18px] border border-slate-900/[0.08] bg-white/[0.96] px-[18px] py-4 shadow-[0_20px_50px_rgba(15,23,42,0.12)] backdrop-blur ${alert.className}`}
              >
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                    alert.tone === "green"
                      ? "bg-[#EAFBF2] text-[#12C76F]"
                      : alert.tone === "orange"
                        ? "bg-orange-50 text-orange-500"
                        : "bg-red-50 text-red-500"
                  }`}
                >
                  <alert.icon className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-extrabold text-[#07111F]">{alert.title}</p>
                  <p className="mt-1 truncate text-[13px] text-[#475569]">{alert.text}</p>
                </div>
                {alert.badge ? (
                  <span className={`absolute -right-2 -top-2 rounded-full px-2 py-1 text-xs font-black text-white ${alert.tone === "orange" ? "bg-orange-500" : "bg-red-500"}`}>
                    {alert.badge}
                  </span>
                ) : (
                  <AlertTriangle className={`h-5 w-5 ${alert.tone === "orange" ? "text-orange-400" : "text-red-500"}`} />
                )}
              </motion.div>
            ))}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 26 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.68, ease: "easeOut" as const }}
          className="mt-10 grid gap-6 rounded-[24px] border border-[#12C76F]/[0.14] bg-[linear-gradient(90deg,#F7FFFA,#FFFFFF)] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)] lg:mt-12 lg:grid-cols-[1.4fr_repeat(4,1fr)] lg:p-8"
        >
          <div className="flex flex-col gap-5 md:flex-row md:items-center lg:border-r lg:border-slate-900/[0.08] lg:pr-7">
            <Image
              src="/slaivio-logo-official-dark.png"
              alt="SLAIVIO"
              width={150}
              height={58}
              className="h-auto w-[150px] shrink-0"
            />
            <div>
              <h3 className="text-xl font-black tracking-[-0.03em]">
                SLAIVIO <span className="text-[#12C76F]">change tout.</span>
              </h3>
              <p className="mt-2 max-w-[420px] text-[15px] leading-7 text-[#334155]">
                Centralisez, automatisez et pilotez votre activité cargo depuis une seule plateforme conçue pour votre métier.
              </p>
            </div>
          </div>
          {benefits.map((benefit) => (
            <div key={benefit.title} className="flex items-start gap-4 lg:border-r lg:border-slate-900/[0.08] lg:px-7 last:lg:border-r-0">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#EAFBF2] text-[#12A85E]">
                <benefit.icon className="h-7 w-7" />
              </div>
              <div>
                <h4 className="font-extrabold text-[#07111F]">{benefit.title}</h4>
                <p className="mt-1 text-[15px] leading-6 text-[#334155]">{benefit.text}</p>
              </div>
            </div>
          ))}
        </motion.div>
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
          <Image
            src="/slaivio-logo-official-dark.png"
            alt="SLAIVIO"
            width={132}
            height={51}
            className="h-auto w-[126px] object-contain"
          />
          <div>
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
