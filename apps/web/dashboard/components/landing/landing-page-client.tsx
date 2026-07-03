"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Bell,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  ClipboardCheck,
  ClipboardList,
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
  Route,
  Search,
  Send,
  Settings,
  Truck,
  User,
  UserCircle,
  Users,
  Warehouse,
  X,
  type LucideIcon,
} from "lucide-react";

import { createDemoRequest } from "@/services/landing";

const navItems = [
  { label: "Fonctionnalités", href: "#workflow", hasChevron: true },
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

const processSteps: Array<{
  title: string;
  text: string;
  icon: LucideIcon;
}> = [
  {
    title: "Prise de demande",
    text: "Enregistrez vos clients et leurs demandes depuis WhatsApp, au bureau ou en ligne.",
    icon: User,
  },
  {
    title: "Dossier & devis",
    text: "Créez un dossier, ajoutez les informations, calculez les tarifs et envoyez le devis.",
    icon: ClipboardList,
  },
  {
    title: "Réception des colis",
    text: "Enregistrez les colis reçus en entrepôt, pesez, étiquetez et validez les informations.",
    icon: Package,
  },
  {
    title: "Expédition & transit",
    text: "Regroupez, expédiez et suivez vos envois de l'entrepôt jusqu'à leur arrivée à destination.",
    icon: Truck,
  },
  {
    title: "Dédouanement & livraison",
    text: "Gérez les documents, suivez le dédouanement et organisez la livraison au client.",
    icon: ClipboardCheck,
  },
  {
    title: "Paiements & rapports",
    text: "Suivez les paiements, générez vos rapports et analysez la performance de votre agence.",
    icon: BarChart3,
  },
];

const processCards: Array<{
  title: string;
  text: string;
  icon: LucideIcon;
  side: "left" | "right";
}> = [
  {
    title: "WhatsApp connecté",
    text: "Toutes vos conversations centralisées au même endroit.",
    icon: MessageCircle,
    side: "left",
  },
  {
    title: "Suivi en temps réel",
    text: "Suivez chaque colis et chaque expédition en temps réel.",
    icon: Package,
    side: "left",
  },
  {
    title: "Notifications automatiques",
    text: "Informez vos clients sans effort à chaque étape importante.",
    icon: Bell,
    side: "left",
  },
  {
    title: "Documents centralisés",
    text: "Factures, BL, déclarations... tout est organisé.",
    icon: FileText,
    side: "right",
  },
  {
    title: "Rapports intelligents",
    text: "Analysez votre activité et prenez de meilleures décisions.",
    icon: BarChart3,
    side: "right",
  },
  {
    title: "Données sécurisées",
    text: "Vos données et celles de vos clients sont 100% sécurisées.",
    icon: LockKeyhole,
    side: "right",
  },
];

const demoTimeline: Array<{
  title: string;
  text: string;
  icon: LucideIcon;
}> = [
  {
    title: "Tableau de bord",
    text: "Vue d'ensemble de votre activité en temps réel. Suivez vos indicateurs clés en un coup d'œil.",
    icon: BarChart3,
  },
  {
    title: "Clients & Dossiers",
    text: "Accédez à tous vos clients et dossiers. Historique complet et suivi détaillé.",
    icon: Users,
  },
  {
    title: "Colis",
    text: "Enregistrez, suivez et gérez vos colis de l'entrepôt jusqu'à la livraison.",
    icon: Package,
  },
  {
    title: "Tracking & Expéditions",
    text: "Suivez vos expéditions en temps réel et informez automatiquement vos clients.",
    icon: Truck,
  },
  {
    title: "WhatsApp Inbox",
    text: "Toutes vos conversations WhatsApp centralisées. Répondez plus vite, ne ratez aucun client.",
    icon: MessageCircle,
  },
  {
    title: "Organisation",
    text: "Gérez bureaux, entrepôts, routes, services et tarifs.",
    icon: ClipboardList,
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
  const [headerFixed, setHeaderFixed] = useState(false);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setHeroPhraseIndex((index) => (index + 1) % heroTitlePhrases.length);
    }, 2600);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const updateHeader = () => {
      setHeaderFixed(window.scrollY > 92);
    };

    updateHeader();
    window.addEventListener("scroll", updateHeader, { passive: true });

    return () => window.removeEventListener("scroll", updateHeader);
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
    <main className="min-h-screen overflow-x-hidden bg-[#020807] font-['Neue_Haas_Grotesk_Display_Pro','Neue_Haas_Grotesk_Text',Inter,'Helvetica_Neue',Arial,system-ui,sans-serif] text-white">
      <LandingHeader menuOpen={menuOpen} setMenuOpen={setMenuOpen} isFixed={headerFixed} />
      <HeroSection phrase={heroTitlePhrases[heroPhraseIndex]} />
      <ProblemSection />
      <WorkflowSection />
      <WatchDemoSection />
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
  isFixed,
}: {
  menuOpen: boolean;
  setMenuOpen: (value: boolean) => void;
  isFixed: boolean;
}) {
  return (
    <header
      className={`left-0 right-0 z-50 transition-all duration-500 ${
        isFixed ? "fixed top-3 px-3 sm:px-5" : "absolute top-0 px-0"
      }`}
    >
      <div
        className={`mx-auto grid grid-cols-[1fr_auto] items-center transition-all duration-500 lg:grid-cols-[230px_minmax(0,1fr)_auto] ${
          isFixed
            ? "h-[72px] max-w-[1420px] rounded-2xl border border-slate-900/[0.08] bg-white/92 px-4 text-[#07111F] shadow-[0_18px_55px_rgba(15,23,42,0.12)] backdrop-blur-xl sm:px-6 lg:px-7"
            : "h-[88px] max-w-[1600px] px-4 text-white sm:px-6 lg:px-8 2xl:px-10"
        }`}
      >
        <Link href="/" className="flex items-center gap-3" aria-label="SLAIVIO">
          {isFixed ? (
            <>
              <Image
                src="/slaivio-icon-official.png"
                alt=""
                width={34}
                height={34}
                className="h-8 w-8 object-contain"
                priority
              />
              <span className="text-[24px] font-bold tracking-[-0.045em] text-[#07111F]">Slaivio</span>
            </>
          ) : (
            <Image
              src="/slaivio-logo-official-dark.png"
              alt="SLAIVIO"
              width={156}
              height={60}
              className="h-auto w-[142px] object-contain sm:w-[154px]"
              priority
            />
          )}
        </Link>

        <nav
          className={`hidden items-center justify-center gap-9 text-[15px] font-semibold xl:flex 2xl:gap-11 ${
            isFixed ? "text-[#1F2937]" : "text-white"
          }`}
        >
          {navItems.map((item) => (
            <a key={item.label} href={item.href} className="inline-flex items-center gap-1.5 transition hover:text-[#12C76F]">
              {item.label}
              {item.hasChevron && <ChevronDown className="h-3.5 w-3.5" />}
            </a>
          ))}
        </nav>

        <div className="hidden items-center justify-end gap-6 lg:flex">
          <button
            className={`inline-flex items-center gap-2 text-sm font-semibold ${isFixed ? "text-[#1F2937]" : "text-white"}`}
            type="button"
          >
            <Globe2 className="h-5 w-5" />
            FR
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <Link
            href="/sign-in"
            className={`text-sm font-semibold transition hover:text-[#12C76F] ${isFixed ? "text-[#1F2937]" : "text-white"}`}
          >
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
          className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border lg:hidden ${
            isFixed
              ? "border-slate-900/[0.08] bg-slate-50 text-[#07111F]"
              : "border-white/10 bg-white/[0.04] text-white"
          }`}
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
            className={`mt-2 rounded-2xl border px-5 py-5 shadow-[0_18px_45px_rgba(15,23,42,0.14)] lg:hidden ${
              isFixed
                ? "border-slate-900/[0.08] bg-white text-[#07111F]"
                : "border-white/10 bg-[#020807]/95 text-white"
            }`}
          >
            <div className="flex flex-col gap-4">
              {navItems.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className={`text-sm font-semibold ${isFixed ? "text-[#475569]" : "text-white/75"}`}
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </a>
              ))}
              <Link href="/sign-in" className={`text-sm font-semibold ${isFixed ? "text-[#475569]" : "text-white/75"}`}>
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
    <section className="relative min-h-screen overflow-x-hidden bg-[#030706] px-5 pb-14 pt-[104px] text-white sm:px-8 md:pt-[120px] lg:px-10 xl:pb-0">
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

      <div className="relative mx-auto grid min-h-[calc(100vh-104px)] max-w-[1500px] items-center gap-12 md:min-h-[calc(100vh-120px)] lg:grid-cols-[0.42fr_0.58fr] xl:gap-14">
        <div className="relative z-10 max-w-[610px] lg:pl-2 xl:pl-4">
          <motion.h1
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" as const }}
            className="text-[38px] font-semibold leading-[1.06] tracking-[-0.025em] text-white sm:text-[54px] xl:text-[64px] 2xl:text-[68px]"
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
            className="mt-7 max-w-[560px] text-base leading-[1.75] text-white/70 sm:text-lg"
          >
            SLAIVIO centralise vos clients, colis, expéditions, paiements et WhatsApp dans
            une seule plateforme. Gagnez du temps, réduisez les erreurs et offrez une
            meilleure expérience à vos clients.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" as const }}
            className="mt-9 flex flex-col gap-3 sm:mt-12 sm:flex-row sm:gap-4"
          >
            <a
              href="#demo"
              className="inline-flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-[#12C76F] px-5 text-[15px] font-semibold text-white shadow-[0_0_35px_rgba(18,199,111,0.28)] transition hover:-translate-y-0.5 hover:bg-[#18d87b] sm:h-14 sm:w-auto sm:px-6 sm:text-base"
            >
              <Send className="h-5 w-5" />
              Demander une démo
            </a>
            <a
              href="#watch-demo"
              className="inline-flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-white/[0.18] bg-white/[0.03] px-5 text-[15px] font-semibold text-white backdrop-blur transition hover:border-[#12C76F]/70 hover:shadow-[0_0_28px_rgba(18,199,111,0.16)] sm:h-14 sm:w-auto sm:px-6 sm:text-base"
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
          className="relative z-10 mx-auto hidden w-full max-w-[900px] md:block lg:mx-0 lg:ml-auto lg:-mr-10 xl:-mr-16 2xl:-mr-4"
        >
          <motion.div
            aria-hidden="true"
            animate={{ rotate: 360 }}
            transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
            className="absolute -left-12 top-[44%] hidden h-[260px] w-[260px] rounded-full border border-dashed border-[#12C76F]/55 lg:block"
          />
          <motion.div
            aria-hidden="true"
            animate={{ rotate: -360 }}
            transition={{ duration: 38, repeat: Infinity, ease: "linear" }}
            className="absolute -right-2 bottom-12 hidden h-[300px] w-[300px] rounded-full border border-dashed border-[#12C76F]/45 lg:block"
          />
          <div className="absolute -inset-12 rounded-full bg-[#12C76F]/20 blur-[90px]" />
          <DashboardPreview />

          <FloatingCard
            className="-right-2 top-7 hidden rotate-[3deg] 2xl:block"
            delay={0}
            icon={MessageCircle}
            title="Nouveau message WhatsApp"
            lines={["De : +243 81 234 5678"]}
            badge="maintenant"
            variant="whatsapp"
          />
          <FloatingCard
            className="-left-10 bottom-10 hidden rotate-[-2deg] xl:block"
            delay={0.7}
            icon={Package}
            title="Colis reçu en entrepôt Chine"
            lines={["CBJ-987654", "Poids : 12.5 kg"]}
            badge="Il y a 2 min"
            variant="package"
          />
          <FloatingCard
            className="right-8 bottom-[-28px] hidden rotate-[4deg] xl:block"
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
      <div className="grid min-h-[600px] grid-cols-1 lg:grid-cols-[176px_1fr] xl:grid-cols-[190px_1fr]">
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

        <div className="min-w-0 p-4 sm:p-5 xl:p-5">
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
              <div key={title} className="rounded-lg border border-white/[0.08] bg-white/[0.035] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                <p className="text-[11px] font-semibold text-white">{title}</p>
                <div className="mt-3 flex items-end justify-between gap-2">
                  <p className="text-[22px] font-extrabold tracking-[-0.04em]">{value}</p>
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

          <div className="mt-4 grid gap-3 xl:grid-cols-[0.82fr_1.15fr_0.9fr]">
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
  const [activeProblem, setActiveProblem] = useState(0);

  const problemCards: Array<{
    icon: LucideIcon;
    title: string;
    text: string;
    impact: string;
  }> = [
    {
      icon: MessageCircle,
      title: "WhatsApp dispersé",
      text: "Les demandes arrivent dans plusieurs téléphones, groupes et conversations privées. Une information importante peut rester chez un agent, une relance peut être oubliée, et personne ne sait vraiment quel client attend quoi.",
      impact: "Votre équipe répond plus lentement et perd l’historique client.",
    },
    {
      icon: FileSpreadsheet,
      title: "Excel et papiers partout",
      text: "Les tarifs, les colis, les paiements et les routes vivent dans des fichiers séparés. Quand une ligne change ou qu’un document manque, toute l’agence dépend de vérifications manuelles.",
      impact: "Les erreurs augmentent dès que le volume d’opérations monte.",
    },
    {
      icon: Clock,
      title: "Relances oubliées",
      text: "Les prospects chauds, les clients qui doivent payer, les colis à confirmer et les dossiers bloqués ne remontent pas automatiquement. Les agents doivent se souvenir de tout.",
      impact: "Des revenus restent en attente et des clients partent ailleurs.",
    },
    {
      icon: Package,
      title: "Suivi des colis manuel",
      text: "Un client demande où se trouve son colis, puis l’équipe fouille dans WhatsApp, Excel, des photos de reçus ou des messages d’entrepôt. La réponse prend du temps et varie selon l’agent.",
      impact: "La confiance baisse parce que le tracking n’est pas instantané.",
    },
    {
      icon: BarChart3,
      title: "Pas de visibilité",
      text: "Le manager ne voit pas clairement les dossiers en retard, les revenus du mois, les colis non tracés ou les agents débordés. Les décisions se prennent avec des impressions, pas avec des données fiables.",
      impact: "Vous pilotez l’agence sans tableau de bord opérationnel.",
    },
    {
      icon: Users,
      title: "Croissance freinée",
      text: "Plus l’agence reçoit de clients, plus les mêmes méthodes manuelles créent des blocages. Ajouter des agents ne suffit plus si l’organisation reste dispersée.",
      impact: "La croissance devient lourde au lieu de devenir scalable.",
    },
  ];

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveProblem((index) => (index + 1) % problemCards.length);
    }, 3200);

    return () => window.clearInterval(interval);
  }, [problemCards.length]);

  const ActiveIcon = problemCards[activeProblem].icon;

  return (
    <section id="solutions" className="relative overflow-hidden bg-[#FBFCFB] px-5 py-20 text-[#07111F] sm:px-8 lg:px-12 lg:pb-24 lg:pt-[112px]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#FFFFFF_0%,#FBFCFB_48%,#F4F8F6_100%)]" />
        <div className="absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_50%_0%,rgba(18,199,111,0.08),transparent_60%)]" />
        <div className="absolute -left-24 top-32 h-[420px] w-[420px] rounded-full bg-[#12C76F]/[0.045] blur-[90px]" />
        <div
          className="absolute bottom-14 left-0 h-[260px] w-[420px] opacity-[0.10]"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(18,199,111,.5) 1px, transparent 1.2px)",
            backgroundSize: "13px 13px",
          }}
        />
        <div className="absolute right-0 top-24 hidden h-[760px] w-[56vw] lg:block">
          <Image
            src="/landing/problem-manager-photo.png"
            alt=""
            fill
            sizes="56vw"
            className="object-cover object-center opacity-[0.18]"
            style={{
              maskImage:
                "linear-gradient(90deg, transparent 0%, rgba(0,0,0,.12) 16%, rgba(0,0,0,.55) 42%, rgba(0,0,0,.45) 100%)",
              WebkitMaskImage:
                "linear-gradient(90deg, transparent 0%, rgba(0,0,0,.12) 16%, rgba(0,0,0,.55) 42%, rgba(0,0,0,.45) 100%)",
            }}
          />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_42%,rgba(18,199,111,0.10),transparent_38%),linear-gradient(180deg,rgba(251,252,251,0)_0%,rgba(251,252,251,0.92)_100%)]" />
        </div>
      </div>

      <div className="relative mx-auto max-w-[1440px]">
        <div className="max-w-[860px]">
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
            className="max-w-[700px] text-[36px] font-normal leading-[1.08] tracking-[-0.035em] text-[#07111F] sm:text-[48px] xl:text-[56px]"
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
            className="mt-7 max-w-[620px] text-[17px] font-normal leading-[1.75] tracking-[-0.01em] text-[#475569] sm:text-[19px]"
          >
            Entre WhatsApp, Excel, appels manqués et paperasse, vos équipes perdent du temps
            sur des tâches répétitives au lieu de se concentrer sur vos clients.
          </motion.p>

          <div className="mt-10 max-w-[820px]">
            <div className="relative h-[690px] overflow-hidden rounded-[30px] border border-slate-900/[0.07] bg-white/90 p-5 shadow-[0_30px_90px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:h-[550px] sm:p-8 lg:h-[540px]">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_14%,rgba(18,199,111,0.10),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.92),rgba(255,255,255,0.62))]" />
              <AnimatePresence mode="wait">
                <motion.div
                  key={problemCards[activeProblem].title}
                  initial={{ opacity: 0, x: 28, filter: "blur(8px)" }}
                  animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, x: -28, filter: "blur(8px)" }}
                  transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
                  className="relative grid h-[600px] gap-6 sm:h-[430px] sm:grid-cols-[92px_1fr] sm:items-center lg:h-[420px]"
                >
                  <div className="flex h-20 w-20 items-center justify-center rounded-[22px] bg-[#12C76F]/14 text-[#12C76F] ring-1 ring-[#12C76F]/20 sm:mt-1">
                    <ActiveIcon className="h-9 w-9" />
                  </div>
                  <div className="flex h-full flex-col justify-center">
                    <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-[#12C76F]">
                      Problème {String(activeProblem + 1).padStart(2, "0")}
                    </p>
                    <h3 className="mt-3 text-[30px] font-normal leading-tight tracking-[-0.035em] text-[#07111F] sm:text-[40px]">
                      {problemCards[activeProblem].title}
                    </h3>
                    <p className="mt-5 max-w-[640px] text-[17px] font-normal leading-8 tracking-[-0.01em] text-[#475569]">
                      {problemCards[activeProblem].text}
                    </p>
                    <div className="mt-7 rounded-2xl border border-[#12C76F]/16 bg-[#EAFBF2] p-4">
                      <p className="text-sm font-medium text-[#12C76F]">Impact direct</p>
                      <p className="mt-1 text-[15px] font-normal leading-7 tracking-[-0.01em] text-[#334155]">
                        {problemCards[activeProblem].impact}
                      </p>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>

              <div className="absolute bottom-5 left-5 right-5 flex items-center gap-2 sm:bottom-8 sm:left-8 sm:right-8">
                {problemCards.map((card, index) => (
                  <button
                    key={card.title}
                    type="button"
                    onClick={() => setActiveProblem(index)}
                    className={`h-2.5 rounded-full transition-all ${
                      index === activeProblem
                        ? "w-10 bg-[#12C76F]"
                        : "w-2.5 bg-slate-900/14 hover:bg-slate-900/28"
                    }`}
                    aria-label={`Afficher ${card.title}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function WorkflowSection() {
  const leftCards = processCards.filter((card) => card.side === "left");
  const rightCards = processCards.filter((card) => card.side === "right");

  return (
    <section id="workflow" className="relative overflow-hidden bg-[#F6F7F4] px-5 py-20 text-[#07111F] sm:px-8 lg:px-10 lg:py-24">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#FBFCFB_0%,#F6F7F4_52%,#FFFFFF_100%)]" />
        <div className="absolute inset-x-0 top-0 h-40 bg-[linear-gradient(180deg,rgba(7,17,13,0.055),rgba(246,247,244,0))]" />
        <div className="absolute left-1/2 top-20 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-[#12C76F]/[0.045] blur-[90px]" />
        <div className="absolute bottom-20 left-1/2 h-[420px] w-[760px] -translate-x-1/2 rounded-full bg-[#07111F]/[0.035] blur-[100px]" />
        <div
          className="absolute bottom-0 right-0 h-[320px] w-[520px] opacity-[0.10]"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(18,199,111,.5) 1px, transparent 1.2px)",
            backgroundSize: "14px 14px",
          }}
        />
      </div>

      <div className="relative mx-auto max-w-[1500px]">
        <motion.div {...fadeUp} className="mx-auto max-w-[900px] text-center">
          <div className="mx-auto mb-8 h-1.5 w-[72px] rounded-full bg-[#12C76F]" />
          <h2 className="text-[38px] font-normal leading-[1.08] tracking-[-0.04em] text-[#07111F] sm:text-[54px] xl:text-[64px]">
            Tout votre processus cargo,
            <br />
            centralisé en <span className="text-[#12C76F]">6 étapes simples.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-[820px] text-[17px] font-normal leading-[1.7] tracking-[-0.01em] text-[#475569] sm:text-[20px]">
            SLAIVIO vous accompagne à chaque étape, de la prise de demande jusqu&apos;à la livraison finale.
            <br className="hidden md:block" />
            Tout est connecté, automatisé et suivi en temps réel.
          </p>
        </motion.div>

        <div className="mt-14 grid gap-6 md:grid-cols-2 xl:grid-cols-6 xl:gap-5">
          {processSteps.map((step, index) => (
            <motion.div
              key={step.title}
              {...fadeUp}
              transition={{ duration: 0.55, delay: index * 0.08 }}
              className="relative text-center"
            >
              {index < processSteps.length - 1 && (
                <div className="absolute left-[calc(50%+46px)] top-[18px] hidden h-px w-[calc(100%-92px)] border-t border-dashed border-[#12C76F]/35 xl:block" />
              )}
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#EAFBF2] text-[13px] font-semibold text-[#07111F]">
                {String(index + 1).padStart(2, "0")}
              </div>
              <div className="mx-auto mt-5 flex h-[58px] w-[58px] items-center justify-center rounded-[16px] bg-[#EAFBF2] text-[#0BAA5D]">
                <step.icon className="h-7 w-7" />
              </div>
              <h3 className="mt-5 text-[16px] font-semibold tracking-[-0.02em] text-[#07111F]">{step.title}</h3>
              <p className="mx-auto mt-3 max-w-[220px] text-[14px] font-normal leading-[1.75] tracking-[-0.01em] text-[#475569]">
                {step.text}
              </p>
            </motion.div>
          ))}
        </div>

        <div className="relative mt-16 lg:mt-20">
          <div className="relative mx-auto grid max-w-[1460px] gap-6 xl:grid-cols-[250px_minmax(0,980px)_250px] xl:items-center xl:gap-8">
            <div className="hidden space-y-8 xl:block">
              {leftCards.map((card, index) => (
                <ProcessFloatingCard key={card.title} card={card} delay={index * 0.2} align="left" />
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.75, ease: "easeOut" as const }}
              className="relative mx-auto w-full max-w-[980px]"
            >
              <div className="absolute -left-10 top-[18%] hidden h-[250px] w-12 border-y border-l border-dashed border-[#12C76F]/28 rounded-l-[40px] xl:block" />
              <div className="absolute -right-10 top-[18%] hidden h-[250px] w-12 border-y border-r border-dashed border-[#12C76F]/28 rounded-r-[40px] xl:block" />
              <DashboardPreview />
            </motion.div>

            <div className="hidden space-y-8 xl:block">
              {rightCards.map((card, index) => (
                <ProcessFloatingCard key={card.title} card={card} delay={0.3 + index * 0.2} align="right" />
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:hidden">
              {processCards.map((card, index) => (
                <ProcessStaticCard key={card.title} card={card} delay={index * 0.05} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProcessFloatingCard({
  card,
  delay,
  align,
}: {
  card: (typeof processCards)[number];
  delay: number;
  align: "left" | "right";
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, margin: "-80px" }}
      animate={{
        y: [0, align === "left" ? -12 : -9, 0],
        x: [0, align === "left" ? -5 : 5, 0],
        rotate: [0, align === "left" ? -0.7 : 0.7, 0],
      }}
      transition={{
        opacity: { duration: 0.55, delay },
        scale: { duration: 0.55, delay },
        y: {
          duration: align === "left" ? 7.2 : 8,
          delay,
          repeat: Infinity,
          repeatType: "mirror",
          ease: "easeInOut" as const,
        },
        x: {
          duration: align === "left" ? 7.2 : 8,
          delay,
          repeat: Infinity,
          repeatType: "mirror",
          ease: "easeInOut" as const,
        },
        rotate: {
          duration: align === "left" ? 7.2 : 8,
          delay,
          repeat: Infinity,
          repeatType: "mirror",
          ease: "easeInOut" as const,
        },
      }}
      whileHover={{ y: -10, scale: 1.025, rotate: 0 }}
      className={`relative rounded-[18px] border border-slate-900/[0.08] bg-white/95 p-[22px] shadow-[0_24px_60px_rgba(15,23,42,0.10)] backdrop-blur transition ${
        align === "left" ? "text-left" : "text-left"
      }`}
    >
      <div
        className={`absolute top-1/2 hidden h-px w-10 border-t border-dashed border-[#12C76F]/40 xl:block ${
          align === "left" ? "-right-10" : "-left-10"
        }`}
      />
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#EAFBF2] text-[#0BAA5D]">
          <card.icon className="h-7 w-7" />
        </div>
        <div>
          <h3 className="text-[15px] font-semibold tracking-[-0.02em] text-[#07111F]">{card.title}</h3>
          <p className="mt-2 text-[13px] font-normal leading-6 tracking-[-0.01em] text-[#475569]">{card.text}</p>
        </div>
      </div>
    </motion.div>
  );
}

function ProcessStaticCard({ card, delay }: { card: (typeof processCards)[number]; delay: number }) {
  return (
    <motion.div
      {...fadeUp}
      transition={{ duration: 0.5, delay }}
      className="rounded-[18px] border border-slate-900/[0.08] bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.07)]"
    >
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EAFBF2] text-[#0BAA5D]">
          <card.icon className="h-6 w-6" />
        </div>
        <div>
          <h3 className="text-[15px] font-semibold tracking-[-0.02em] text-[#07111F]">{card.title}</h3>
          <p className="mt-1.5 text-sm leading-6 text-[#475569]">{card.text}</p>
        </div>
      </div>
    </motion.div>
  );
}

function LightDashboardPreview() {
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
  ];
  const kpis = [
    ["Clients", "1,248", "+14.5%"],
    ["Dossiers", "842", "+12.3%"],
    ["Colis", "2,453", "+18.7%"],
    ["Expéditions", "320", "+9.1%"],
    ["Revenus (ce mois)", "$24,850", "+16.3%"],
  ];
  const shipments = [
    ["EXP-2024-1250", "Chine → Kinshasa", "En transit", "12 Juin 2024", "green"],
    ["EXP-2024-1249", "Dubai → Douala", "Arrivé", "08 Juin 2024", "green"],
    ["EXP-2024-1248", "Turquie → Abidjan", "En préparation", "15 Juin 2024", "amber"],
    ["EXP-2024-1247", "Chine → Yaoundé", "En transit", "10 Juin 2024", "purple"],
    ["EXP-2024-1246", "Inde → Lubumbashi", "Validé", "—", "green"],
  ];

  return (
    <div className="overflow-hidden rounded-[28px] border border-slate-900/[0.08] bg-white shadow-[0_30px_90px_rgba(15,23,42,0.10)]">
      <div className="grid min-h-[520px] grid-cols-1 lg:grid-cols-[190px_1fr]">
        <aside className="hidden border-r border-slate-900/[0.07] bg-[#FBFDFD] px-4 py-5 lg:block">
          <div className="mb-5 flex items-center gap-2">
            <Image
              src="/slaivio-icon-official.png"
              alt=""
              width={28}
              height={28}
              className="h-7 w-7 object-contain"
            />
            <span className="text-[19px] font-semibold tracking-[-0.04em] text-[#07111F]">Slaivio</span>
          </div>
          <div className="space-y-1.5">
            {menu.map(([item, Icon, badge], index) => (
              <div
                key={item}
                className={`flex h-8 items-center gap-2 rounded-lg px-2 text-[11px] font-medium ${
                  index === 0 ? "bg-[#12C76F]/12 text-[#0BAA5D]" : "text-[#334155]"
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{item}</span>
                {badge && <span className="rounded-full bg-[#12C76F] px-1.5 py-0.5 text-[9px] font-bold text-white">{badge}</span>}
              </div>
            ))}
          </div>
        </aside>

        <div className="min-w-0 p-4 sm:p-5 lg:p-6">
          <div className="flex flex-col gap-3 border-b border-slate-900/[0.06] pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex h-9 min-w-0 items-center gap-2 rounded-2xl border border-slate-900/[0.08] bg-[#FAFCFB] px-4 text-[11px] text-[#64748B] sm:w-[285px]">
              <Search className="h-4 w-4 shrink-0" />
              <span className="truncate">Rechercher un client, dossier, colis...</span>
            </div>
            <div className="flex items-center gap-3 text-[#334155]">
              <Bell className="h-4 w-4" />
              <MessageCircle className="h-4 w-4" />
              <UserCircle className="h-5 w-5" />
              <div className="hidden sm:block">
                <p className="text-[11px] font-semibold text-[#07111F]">OTI Cargo Express</p>
                <p className="text-[10px] text-[#64748B]">Kinshasa, RDC</p>
              </div>
            </div>
          </div>

          <h3 className="mt-5 text-[18px] font-semibold tracking-[-0.02em] text-[#07111F]">Tableau de bord</h3>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {kpis.map(([title, value, delta]) => (
              <div key={title} className="rounded-xl border border-slate-900/[0.07] bg-white p-3.5 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                <p className="truncate text-[11px] font-medium text-[#475569]">{title}</p>
                <div className="mt-3 flex items-end justify-between gap-2">
                  <p className="text-[21px] font-semibold tracking-[-0.04em] text-[#07111F]">{value}</p>
                  <p className="text-[10px] font-semibold text-[#12C76F]">{delta}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-3 xl:grid-cols-[1.45fr_0.9fr]">
            <div className="rounded-xl border border-slate-900/[0.07] bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
              <div className="mb-4 flex items-center justify-between">
                <h4 className="text-[13px] font-semibold text-[#07111F]">Expéditions en cours</h4>
                <ChevronDown className="-rotate-90 h-4 w-4 text-[#475569]" />
              </div>
              <div className="grid grid-cols-[1.15fr_1.1fr_0.9fr_1fr] border-y border-slate-900/[0.06] py-2 text-[10px] text-[#64748B]">
                <span>Expédition</span>
                <span>Route</span>
                <span>Statut</span>
                <span>ETA</span>
              </div>
              <div className="divide-y divide-slate-900/[0.05]">
                {shipments.map(([id, route, status, eta, tone]) => (
                  <div key={id} className="grid grid-cols-[1.15fr_1.1fr_0.9fr_1fr] items-center py-2 text-[10px]">
                    <span className="truncate font-semibold text-[#07111F]">{id}</span>
                    <span className="truncate text-[#334155]">{route}</span>
                    <span>
                      <span
                        className={`rounded-full px-2 py-1 font-semibold ${
                          tone === "amber"
                            ? "bg-amber-100 text-amber-700"
                            : tone === "purple"
                              ? "bg-violet-100 text-violet-700"
                              : "bg-[#12C76F]/12 text-[#0BAA5D]"
                        }`}
                      >
                        {status}
                      </span>
                    </span>
                    <span className="truncate text-[#334155]">{eta}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-900/[0.07] bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
              <h4 className="text-[13px] font-semibold text-[#07111F]">Répartition par service</h4>
              <div className="mt-5 flex items-center gap-5">
                <div className="relative h-[122px] w-[122px] shrink-0 rounded-full bg-[conic-gradient(#38BDF8_0_45%,#12C76F_45%_80%,#F59E0B_80%_95%,#8B5CF6_95%_100%)] p-[14px]">
                  <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-white text-center">
                    <span className="text-xl font-semibold text-[#07111F]">2,453</span>
                    <span className="text-[10px] text-[#64748B]">Colis</span>
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
                      <span className="flex-1 truncate text-[#334155]">{label}</span>
                      <span className="text-[#64748B]">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function WatchDemoSection() {
  return (
    <section id="watch-demo" className="relative overflow-hidden bg-white px-5 py-20 text-[#07111F] sm:px-8 lg:px-10 xl:py-[120px]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-0 top-0 h-[460px] w-[520px] rounded-full bg-[#12C76F]/[0.04] blur-[90px]" />
        <div className="absolute right-0 top-[22%] h-[520px] w-[680px] rounded-full bg-slate-100/80 blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-[1440px]">
        <div className="grid gap-14 xl:grid-cols-[0.45fr_0.55fr] xl:items-center xl:gap-14">
          <motion.div {...fadeUp} className="max-w-[560px]">
            <div className="mb-[34px] h-1.5 w-[70px] rounded-full bg-[#16C35B]" />
            <h2 className="text-[40px] font-extrabold leading-[1.05] tracking-[-0.04em] text-[#07111F] sm:text-[56px] xl:text-[64px]">
              Voyez comment SLAIVIO
              <br />
              <span className="text-[#16C35B]">simplifie votre quotidien.</span>
            </h2>
            <p className="mt-7 max-w-[520px] text-[18px] font-normal leading-[1.7] tracking-[-0.01em] text-[#5B6472] sm:text-[22px]">
              Une plateforme complète pour gérer vos clients, colis, expéditions, WhatsApp
              et paiements depuis un seul endroit.
            </p>

            <div className="mt-10 max-w-[430px] space-y-[26px]">
              {demoTimeline.map((step, index) => (
                <DemoTimelineItem key={step.title} step={step} index={index} />
              ))}
            </div>
          </motion.div>

          <div className="relative">
            <svg
              aria-hidden="true"
              viewBox="0 0 250 230"
              className="absolute -left-[160px] top-[42%] hidden h-[230px] w-[250px] text-[#16C35B] xl:block"
            >
              <motion.path
                d="M10 210 C80 210 20 75 116 72 C158 70 177 40 235 35"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray="7 9"
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                whileInView={{ pathLength: 1, opacity: 0.75 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 1.4, ease: "easeOut" as const }}
              />
              <path d="M231 27 L244 35 L231 43" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>

            <motion.div {...fadeUp} className="mx-auto mb-5 max-w-[760px] text-center">
              <h3 className="text-[30px] font-bold leading-tight tracking-[-0.035em] text-[#07111F] sm:text-[40px]">
                Une plateforme,
                <br className="sm:hidden" /> toutes vos opérations.
              </h3>
              <p className="mt-2 text-[17px] font-normal leading-7 text-[#697386] sm:text-[18px]">
                Cliquez, explorez et voyez la puissance de SLAIVIO.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 24 }}
              whileInView={{ opacity: 1, scale: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.78, ease: "easeOut" as const }}
              className="mx-auto w-full max-w-[760px]"
            >
              <DemoDashboardPreview />
            </motion.div>
          </div>
        </div>

        <motion.div
          {...fadeUp}
          className="mx-auto mt-12 flex min-h-[130px] w-full max-w-[760px] flex-col gap-5 rounded-[26px] border border-slate-900/[0.06] bg-[#FBFCFC] p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] sm:p-6 lg:mt-11 lg:flex-row lg:items-center lg:justify-between xl:max-w-[760px]"
        >
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <motion.div
              animate={{ scale: [1, 1.04, 1] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" as const }}
              className="relative flex h-[68px] w-[68px] shrink-0 items-center justify-center rounded-full bg-white text-[#16C35B] shadow-[0_16px_38px_rgba(15,23,42,0.12)]"
            >
              <PlayCircle className="h-8 w-8 fill-[#16C35B]/10" />
            </motion.div>
            <div>
              <h3 className="text-[24px] font-bold leading-tight tracking-[-0.03em] text-[#07111F] sm:text-[30px]">
                Regardez SLAIVIO en action
              </h3>
              <p className="mt-2 max-w-[520px] text-[15px] leading-7 text-[#5B6472] sm:text-base">
                Découvrez en vidéo comment SLAIVIO simplifie et accélère la gestion de votre agence cargo.
              </p>
            </div>
          </div>
          <a
            href="#watch-demo"
            className="group inline-flex h-12 w-full items-center justify-center gap-3 rounded-2xl px-5 text-[16px] font-bold text-[#0BAA5D] transition duration-300 hover:bg-[#16C35B] hover:text-white lg:w-auto"
          >
            Regarder la vidéo
            <ArrowRight className="h-5 w-5 transition duration-300 group-hover:translate-x-[5px]" />
          </a>
        </motion.div>
      </div>
    </section>
  );
}

function DemoTimelineItem({
  step,
  index,
}: {
  step: (typeof demoTimeline)[number];
  index: number;
}) {
  return (
    <motion.div
      {...fadeUp}
      transition={{ duration: 0.55, delay: index * 0.12 }}
      className="relative flex gap-5"
    >
      <div className="relative shrink-0">
        <div className="flex h-[70px] w-[70px] items-center justify-center rounded-[18px] border border-slate-900/[0.06] bg-white text-[#16C35B] shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
          <step.icon className="h-8 w-8 stroke-[1.7]" />
        </div>
        {index < demoTimeline.length - 1 && (
          <div className="absolute left-1/2 top-[78px] h-[42px] -translate-x-1/2 border-l border-dashed border-[#16C35B]/20" />
        )}
      </div>
      <div className="min-w-0 pt-2">
        <div className="flex items-center gap-4">
          <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-[#16C35B] text-[13px] font-bold text-white">
            {index + 1}
          </span>
          <h3 className="text-[18px] font-bold tracking-[-0.02em] text-[#07111F]">{step.title}</h3>
        </div>
        <p className="mt-3 text-[15px] leading-7 tracking-[-0.01em] text-[#5B6472]">{step.text}</p>
      </div>
    </motion.div>
  );
}

function DemoDashboardPreview() {
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
    ["Factures", Receipt],
    ["Organisation", Building2],
    ["Paramètres", Settings],
  ];
  const kpis = [
    ["Clients", "1,248", "+14.5%"],
    ["Dossiers", "842", "+12.3%"],
    ["Colis", "2,453", "+18.7%"],
    ["Expéditions", "320", "+9.1%"],
    ["Revenus", "24,850$", "+16.3%"],
  ];
  const shipments = [
    ["EXP-2024-1250", "Chine → Kinshasa", "En transit", "12 Juin 2024", "green"],
    ["EXP-2024-1249", "Dubai → Douala", "Arrivé", "08 Juin 2024", "green"],
    ["EXP-2024-1248", "Turquie → Abidjan", "En préparation", "15 Juin 2024", "amber"],
    ["EXP-2024-1247", "Chine → Yaoundé", "En transit", "10 Juin 2024", "purple"],
    ["EXP-2024-1246", "Inde → Lubumbashi", "Validé", "—", "green"],
  ];

  return (
    <div className="overflow-hidden rounded-[28px] border border-slate-900/[0.06] bg-white shadow-[0_45px_120px_rgba(15,23,42,0.10)]">
      <div className="grid min-h-[600px] grid-cols-1 lg:grid-cols-[170px_1fr]">
        <aside className="hidden border-r border-slate-900/[0.06] bg-[#FBFCFC] px-3 py-5 lg:block">
          <div className="mb-5 flex items-center gap-2 px-1">
            <Image src="/slaivio-icon-official.png" alt="" width={28} height={28} className="h-7 w-7 object-contain" />
            <span className="text-[18px] font-bold tracking-[-0.04em] text-[#07111F]">SLAIVIO</span>
          </div>
          <div className="space-y-1.5">
            {menu.map(([item, Icon, badge], index) => (
              <div
                key={item}
                className={`flex h-8 items-center gap-2 rounded-lg px-2 text-[10.5px] font-semibold ${
                  index === 0 ? "bg-[#16C35B]/10 text-[#0BAA5D]" : "text-[#334155]"
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{item}</span>
                {badge && <span className="rounded-full bg-[#16C35B] px-1.5 py-0.5 text-[8px] font-bold text-white">{badge}</span>}
              </div>
            ))}
          </div>
        </aside>

        <div className="min-w-0 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-4 border-b border-slate-900/[0.06] pb-4">
            <div className="flex h-9 min-w-0 items-center gap-2 rounded-2xl border border-slate-900/[0.06] bg-[#FBFCFC] px-4 text-[10px] text-[#697386] sm:w-[255px]">
              <Search className="h-4 w-4 shrink-0" />
              <span className="truncate">Rechercher un client, dossier, colis...</span>
            </div>
            <div className="flex items-center gap-3 text-[#334155]">
              <Bell className="h-4 w-4" />
              <MessageCircle className="h-4 w-4" />
              <UserCircle className="h-5 w-5" />
              <div className="hidden sm:block">
                <p className="text-[10.5px] font-bold text-[#07111F]">OTI Cargo Express</p>
                <p className="text-[9px] text-[#697386]">Kinshasa, RDC</p>
              </div>
              <ChevronDown className="hidden h-3.5 w-3.5 sm:block" />
            </div>
          </div>

          <h3 className="mt-5 text-[18px] font-bold tracking-[-0.02em] text-[#07111F]">Tableau de bord</h3>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {kpis.map(([title, value, delta]) => (
              <div key={title} className="rounded-xl border border-slate-900/[0.06] bg-white p-3.5 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
                <p className="truncate text-[10px] font-medium text-[#5B6472]">{title}</p>
                <div className="mt-3 flex items-end justify-between gap-2">
                  <p className="text-[20px] font-extrabold tracking-[-0.04em] text-[#07111F]">{value}</p>
                  <p className="text-[9.5px] font-bold text-[#16C35B]">{delta}</p>
                </div>
                <p className="mt-2 text-[9px] text-[#697386]">vs mois dernier</p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-3 xl:grid-cols-[1.25fr_0.9fr]">
            <div className="rounded-xl border border-slate-900/[0.06] bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-[12px] font-bold text-[#07111F]">Expéditions en cours</h4>
                <ChevronDown className="-rotate-90 h-4 w-4 text-[#697386]" />
              </div>
              <div className="grid grid-cols-[1.15fr_1fr_0.9fr_1fr] border-y border-slate-900/[0.06] py-2 text-[9.5px] text-[#697386]">
                <span>Expédition</span>
                <span>Route</span>
                <span>Statut</span>
                <span>ETA</span>
              </div>
              <div className="divide-y divide-slate-900/[0.05]">
                {shipments.map(([id, route, status, eta, tone]) => (
                  <div key={id} className="grid grid-cols-[1.15fr_1fr_0.9fr_1fr] items-center py-2 text-[9.5px]">
                    <span className="truncate font-bold text-[#07111F]">{id}</span>
                    <span className="truncate text-[#334155]">{route}</span>
                    <span>
                      <span
                        className={`rounded-full px-2 py-1 font-bold ${
                          tone === "amber"
                            ? "bg-amber-100 text-amber-700"
                            : tone === "purple"
                              ? "bg-violet-100 text-violet-700"
                              : "bg-[#16C35B]/12 text-[#0BAA5D]"
                        }`}
                      >
                        {status}
                      </span>
                    </span>
                    <span className="truncate text-[#334155]">{eta}</span>
                  </div>
                ))}
              </div>
              <a href="#demo" className="mt-4 inline-flex items-center gap-2 text-[11px] font-bold text-[#0BAA5D]">
                Voir toutes les expéditions <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>

            <div className="rounded-xl border border-slate-900/[0.06] bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
              <h4 className="text-[12px] font-bold text-[#07111F]">Répartition par service</h4>
              <div className="mt-5 flex items-center gap-4">
                <div className="relative h-[118px] w-[118px] shrink-0 rounded-full bg-[conic-gradient(#60A5FA_0_45%,#16C35B_45%_80%,#F59E0B_80%_95%,#8B5CF6_95%_100%)] p-[15px]">
                  <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-white text-center">
                    <span className="text-xl font-extrabold text-[#07111F]">2,453</span>
                    <span className="text-[9px] text-[#697386]">Colis</span>
                  </div>
                </div>
                <div className="min-w-0 flex-1 space-y-3 text-[10px]">
                  {[
                    ["Air Cargo", "45%", "#60A5FA"],
                    ["Sea Cargo", "35%", "#16C35B"],
                    ["Express", "15%", "#F59E0B"],
                    ["Groupage", "5%", "#8B5CF6"],
                  ].map(([label, value, color]) => (
                    <div key={label} className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                      <span className="flex-1 truncate text-[#334155]">{label}</span>
                      <span className="text-[#697386]">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {[
              ["Messages WhatsApp", "128", "Non lus"],
              ["Derniers colis reçus", "CBJ-987654", "12.5 kg"],
              ["Paiements récents", "PAY-2024-5421", "850$"],
            ].map(([title, value, detail]) => (
              <div key={title} className="rounded-xl border border-slate-900/[0.06] bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
                <div className="flex items-center justify-between">
                  <h4 className="truncate text-[11px] font-bold text-[#07111F]">{title}</h4>
                  <span className="text-[9px] font-semibold text-[#697386]">Voir tous</span>
                </div>
                <p className="mt-4 text-[17px] font-extrabold tracking-[-0.03em] text-[#07111F]">{value}</p>
                <p className="mt-1 text-[10px] text-[#697386]">{detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SecuritySection() {
  return (
    <section id="securite" className="bg-[#F7FAF9] px-5 py-20 text-[#07111F] lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-10 rounded-[2rem] border border-slate-900/[0.06] bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.06)] lg:grid-cols-[0.9fr_1.1fr] lg:p-10">
        <motion.div {...fadeUp}>
          <Pill icon={LockKeyhole}>Production mindset</Pill>
          <h2 className="mt-5 text-4xl font-bold tracking-[-0.04em] sm:text-5xl">
            Pensé pour devenir une infrastructure, pas juste un dashboard.
          </h2>
          <p className="mt-5 text-lg leading-8 text-[#475569]">
            Le cap est simple: chaque bloc doit être testé en réel, relié à la production,
            et compréhensible par une agence qui n&apos;a pas d&apos;équipe technique.
          </p>
        </motion.div>

        <div className="grid gap-3">
          {securityItems.map((item) => (
            <div key={item} className="flex items-center gap-4 rounded-2xl border border-slate-900/[0.06] bg-[#FBFCFC] p-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#12C76F]/15 text-[#12C76F]">
                <Check className="h-5 w-5" />
              </span>
              <span className="font-semibold text-[#334155]">{item}</span>
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
    <section id="demo" className="border-y border-slate-900/[0.06] bg-white px-5 py-20 text-[#07111F] lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.82fr_1fr] lg:items-start">
        <motion.div {...fadeUp}>
          <Pill icon={MessageCircle}>Passer à la démo</Pill>
          <h2 className="mt-5 text-4xl font-bold tracking-[-0.04em] sm:text-5xl">
            Montrez-nous votre flux actuel. On vous montre où SLAIVIO enlève le chaos.
          </h2>
          <p className="mt-5 text-lg leading-8 text-[#475569]">
            Pas besoin d&apos;avoir tout prêt. Une agence peut commencer par l&apos;inbox, les dossiers
            et le tracking, puis activer les automatisations par étapes.
          </p>
        </motion.div>

        <motion.form
          {...fadeUp}
          onSubmit={onSubmit}
          className="rounded-[2rem] border border-slate-900/[0.07] bg-[#FBFCFC] p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-7"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {formFields.map((field) => (
              <label key={field.name} className="block">
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#64748B]">
                  {field.label}
                </span>
                <input
                  name={field.name}
                  required={field.name === "full_name" || field.name === "email"}
                  type={field.name === "email" ? "email" : "text"}
                  placeholder={field.placeholder}
                  className="mt-2 h-[52px] w-full rounded-2xl border border-slate-900/[0.08] bg-white px-4 text-sm text-[#07111F] outline-none transition placeholder:text-slate-400 focus:border-[#12C76F]/60 focus:shadow-[0_0_0_4px_rgba(18,199,111,0.10)]"
                />
              </label>
            ))}
          </div>

          <label className="mt-4 block">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#64748B]">
              Message
            </span>
            <textarea
              name="message"
              rows={5}
              placeholder="Dites-nous comment votre agence travaille aujourd'hui..."
              className="mt-2 w-full rounded-2xl border border-slate-900/[0.08] bg-white px-4 py-4 text-sm text-[#07111F] outline-none transition placeholder:text-slate-400 focus:border-[#12C76F]/60 focus:shadow-[0_0_0_4px_rgba(18,199,111,0.10)]"
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
            <p className="mt-4 rounded-2xl border border-[#12C76F]/20 bg-[#12C76F]/10 p-4 text-sm text-[#0BAA5D]">
              Demande reçue. On vous contactera avec les prochaines étapes.
            </p>
          )}
          {formStatus === "error" && (
            <p className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-700">
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
    <section className="bg-[#F7FAF9] px-5 py-20 text-[#07111F] lg:px-8">
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
              className="overflow-hidden rounded-3xl border border-slate-900/[0.07] bg-white shadow-[0_16px_45px_rgba(15,23,42,0.05)]"
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
                    <p className="px-5 pb-5 text-sm leading-7 text-[#475569]">{answer}</p>
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
    <footer className="border-t border-slate-900/[0.08] bg-white px-5 py-10 text-[#07111F] lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Image
            src="/slaivio-icon-official.png"
            alt=""
            width={34}
            height={34}
            className="h-8 w-8 object-contain"
          />
          <div>
            <p className="text-lg font-bold tracking-[-0.04em] text-[#07111F]">Slaivio</p>
            <p className="text-sm text-[#64748B]">Cargo operations platform</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-5 text-sm text-[#64748B]">
          <a href="#workflow" className="hover:text-[#0BAA5D]">Plateforme</a>
          <a href="#solutions" className="hover:text-[#0BAA5D]">Solutions</a>
          <a href="#demo" className="hover:text-[#0BAA5D]">Démo</a>
          <Link href="/sign-in" className="hover:text-[#0BAA5D]">Connexion</Link>
        </div>
      </div>
    </footer>
  );
}

function Pill({ children, icon: Icon }: { children: ReactNode; icon: LucideIcon }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[#12C76F]/20 bg-[#12C76F]/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[#0BAA5D]">
      <Icon className="h-4 w-4" />
      {children}
    </span>
  );
}
