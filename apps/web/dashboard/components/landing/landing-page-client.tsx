"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { FormEvent, useEffect, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Bot,
  Boxes,
  BriefcaseBusiness,
  Building2,
  Check,
  ChevronDown,
  CircleDollarSign,
  BookOpen,
  Facebook,
  Globe2,
  Linkedin,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  Music2,
  Package,
  Radio,
  Send,
  Settings,
  Truck,
  Users,
  X,
  Youtube,
  type LucideIcon,
} from "lucide-react";

import { createDemoRequest } from "@/services/landing";

const countries = [
  ["🇨🇩", "RDC"],
  ["🇨🇲", "Cameroun"],
  ["🇨🇮", "Côte d'Ivoire"],
  ["🇬🇭", "Ghana"],
  ["🇰🇪", "Kenya"],
  ["🇿🇼", "Zimbabwe"],
  ["🇸🇳", "Sénégal"],
];

const productSidebar = [
  "Dashboard",
  "Clients",
  "Dossiers",
  "Colis",
  "Expéditions",
  "Tracking",
  "WhatsApp Inbox",
  "Broadcasts",
  "Relances",
  "Base de connaissances",
  "Tarification",
  "Services",
  "Paiements",
  "Factures",
  "Organisation",
  "Paramètres",
];

type Feature = {
  title: string;
  description: string;
  benefits: string[];
  image: string;
  icon: LucideIcon;
};

const features: Feature[] = [
  { title: "Gestion clients", description: "Centralisez vos clients, leurs coordonnées, leurs dossiers et leurs interactions dans un seul système.", benefits: ["Coordonnées complètes", "Historique expéditions", "Historique paiements", "WhatsApp relié", "Recherche instantanée"], image: "/landing/dashboard.png", icon: Users },
  { title: "Dossiers centralisés", description: "Chaque opération est organisée autour d'un dossier unique.", benefits: ["Source de vérité", "Clients reliés", "Colis reliés", "Paiements reliés", "Historique complet"], image: "/landing/dossiers.png", icon: BriefcaseBusiness },
  { title: "Gestion des colis", description: "Enregistrez et suivez chaque colis reçu dans vos entrepôts.", benefits: ["Poids et dimensions", "Photos", "Fournisseurs", "Tracking", "Validation"], image: "/landing/dashboard.png", icon: Package },
  { title: "Gestion des expéditions", description: "Planifiez et pilotez toutes vos expéditions cargo.", benefits: ["Lots et manifests", "Routes internationales", "Étapes opérationnelles", "ETA", "Historique"], image: "/landing/dashboard.png", icon: Truck },
  { title: "Tracking temps réel", description: "Suivez chaque colis du départ jusqu'à la livraison.", benefits: ["Timeline complète", "Statuts automatiques", "ETA", "Preuve de livraison", "Notifications"], image: "/landing/dashboard.png", icon: MapPin },
  { title: "WhatsApp IA", description: "Automatisez vos réponses clients directement sur WhatsApp Business.", benefits: ["Inbox centralisée", "Qualification", "Réponses assistées", "Transfert humain", "Historique"], image: "/landing/inbox.png", icon: MessageCircle },
  { title: "Gestion des paiements", description: "Suivez les encaissements, soldes et paiements liés aux dossiers.", benefits: ["Paiements reliés", "Soldes clients", "Historique", "Alertes", "Rapprochement"], image: "/landing/dashboard.png", icon: CircleDollarSign },
  { title: "Relances automatiques", description: "Relancez les clients, paiements et opérations sans tâches manuelles répétitives.", benefits: ["Scénarios ciblés", "Délais configurables", "WhatsApp", "Escalade humaine", "Suivi"], image: "/landing/inbox.png", icon: Radio },
  { title: "Broadcast WhatsApp", description: "Diffusez vos communications opérationnelles à des audiences contrôlées.", benefits: ["Segmentation", "Templates", "Programmation", "Statuts", "Conformité"], image: "/landing/inbox.png", icon: Send },
  { title: "Base de connaissances IA", description: "Donnez à votre équipe une source fiable pour répondre aux questions récurrentes.", benefits: ["Contenu agence", "Recherche", "Réponses cohérentes", "Mises à jour", "Accès équipe"], image: "/landing/settings.png", icon: BookOpen },
  { title: "Organisation multi-pays", description: "Gérez vos bureaux, entrepôts, routes et équipes depuis une seule organisation.", benefits: ["Bureaux", "Entrepôts", "Équipes", "Rôles", "Rapports"], image: "/landing/settings.png", icon: Building2 },
  { title: "Rapports et analytics", description: "Pilotez les volumes, revenus, routes et performances avec des données fiables.", benefits: ["KPIs", "Volumes", "Revenus", "Performance routes", "Exports"], image: "/landing/dashboard.png", icon: BarChart3 },
];

const howSteps: Array<{ title: string; description: string; icon: LucideIcon; kind: string }> = [
  { title: "Connectez vos canaux", description: "Connectez WhatsApp Business via Meta Embedded Signup puis ajoutez Gmail et TikTok.", icon: MessageCircle, kind: "integrations" },
  { title: "Configurez votre agence", description: "Ajoutez vos bureaux, entrepôts, services et tarifs afin de refléter votre activité réelle.", icon: Settings, kind: "setup" },
  { title: "Centralisez vos opérations", description: "Toutes les informations sont organisées autour d'un dossier unique.", icon: Boxes, kind: "flow" },
  { title: "Automatisez WhatsApp", description: "Répondez plus vite, automatisez les relances et assistez vos équipes.", icon: Bot, kind: "chat" },
  { title: "Suivez vos expéditions", description: "Offrez à vos clients une visibilité complète grâce au suivi en temps réel.", icon: MapPin, kind: "tracking" },
  { title: "Développez votre agence", description: "Prenez des décisions fiables et grandissez sans augmenter la charge opérationnelle.", icon: BarChart3, kind: "growth" },
];

const pricingPlans = [
  { name: "Starter", monthly: 119, description: "Idéal pour une petite agence cargo.", features: ["WhatsApp Business", "Clients, dossiers et colis", "Expéditions et tracking", "Agence unique", "Jusqu'à 500 colis/mois", "2 bureaux ou entrepôts", "Support standard"] },
  { name: "Growth", monthly: 299, popular: true, description: "Pour les agences en croissance.", features: ["Tout Starter", "WhatsApp, Gmail et TikTok", "Inbox centralisée", "Relances et broadcasts", "Base de connaissances IA", "Jusqu'à 5 000 colis/mois", "15 bureaux ou entrepôts", "Rapports avancés", "Support prioritaire"] },
  { name: "Enterprise", monthly: 799, description: "Pour les agences à fort volume.", features: ["Tout Growth", "Intégrations et colis illimités", "Bureaux et entrepôts illimités", "IA avancée SLAIVIO", "Import des données", "Formation de l'équipe", "Onboarding personnalisé", "Support dédié"] },
];

const faqItems = [
  ["SLAIVIO est-il compatible avec WhatsApp Business ?", "Oui. SLAIVIO se connecte à WhatsApp Business via Meta Embedded Signup, la méthode officielle de Meta."],
  ["Puis-je continuer à utiliser mon numéro WhatsApp actuel ?", "Oui. Vous pouvez connecter votre numéro professionnel existant et continuer à échanger avec vos clients."],
  ["Mes clients doivent-ils installer une application ?", "Non. Vos clients continuent simplement à utiliser WhatsApp. SLAIVIO travaille en arrière-plan."],
  ["Puis-je gérer plusieurs bureaux ou entrepôts ?", "Oui. SLAIVIO centralise vos bureaux, entrepôts, routes, équipes et rapports."],
  ["SLAIVIO fonctionne-t-il sur plusieurs routes internationales ?", "Oui. La plateforme est conçue pour les routes Chine, Dubaï, Turquie ou Inde vers l'Afrique."],
  ["Puis-je configurer mes propres tarifs et services ?", "Oui. Vous pouvez gérer vos services, routes, prix au kilo, prix CBM et tarifs spéciaux."],
  ["Puis-je importer mes données existantes ?", "Oui. Notre équipe peut vous accompagner pour importer vos clients, tarifs, colis et historiques."],
  ["Comment fonctionne le tracking des colis ?", "Chaque colis ou expédition reçoit un identifiant unique et une timeline de suivi jusqu'à la livraison."],
  ["L'IA répond-elle automatiquement aux clients ?", "Oui. SLAIVIO peut répondre, notifier, relancer et transférer les cas complexes à un agent humain."],
  ["Est-ce que SLAIVIO remplace mon équipe ?", "Non. SLAIVIO assiste l'équipe et réduit les tâches répétitives afin qu'elle travaille plus vite."],
  ["Mes données sont-elles sécurisées ?", "Oui. SLAIVIO utilise l'authentification sécurisée, le contrôle d'accès et la séparation des données par agence."],
  ["Combien de temps faut-il pour démarrer ?", "La configuration est rapide lorsque les tarifs, routes et informations principales sont disponibles."],
];

const reveal = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0 },
};

export function LandingPageClient() {
  const [locale, setLocale] = useState<"fr" | "en">("fr");
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.style.scrollBehavior = "smooth";
    return () => {
      document.documentElement.style.scrollBehavior = "";
    };
  }, [locale]);

  return (
    <main className="min-h-screen overflow-x-clip bg-[#f5f6f7] text-[#111318]">
      <Header locale={locale} setLocale={setLocale} mobileMenu={mobileMenu} setMobileMenu={setMobileMenu} />
      <Hero />
      <PresenceStrip />
      <ProblemSection />
      <SolutionsSection />
      <IntegrationsSection />
      <FeaturesExperience />
      <HowItWorks />
      <PricingSection />
      <FaqSection />
      <DemoSection />
      <Footer />
    </main>
  );
}

function Header({ locale, setLocale, mobileMenu, setMobileMenu }: { locale: "fr" | "en"; setLocale: (value: "fr" | "en") => void; mobileMenu: boolean; setMobileMenu: (value: boolean) => void }) {
  const links = [["Fonctionnalités", "#features"], ["Solutions", "#solutions"], ["Tarifs", "#pricing"], ["Ressources", "#faq"]];
  return (
    <header className="sticky top-0 z-50 border-b border-black/[0.05] bg-white/88 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-[1280px] items-center justify-between px-5 md:px-6">
        <Link href="/" aria-label="Accueil SLAIVIO" className="flex items-center gap-3">
          <Image src="/slaivio-mark.png" alt="" width={34} height={34} className="rounded-[10px]" priority />
          <span className="text-lg font-semibold tracking-[-0.02em]">SLAIVIO</span>
        </Link>
        <nav aria-label="Navigation principale" className="hidden items-center gap-8 text-sm font-medium text-slate-600 lg:flex">
          {links.map(([label, href]) => <a key={href} href={href} className="transition hover:text-black">{label}</a>)}
        </nav>
        <div className="hidden items-center gap-4 sm:flex">
          <div role="group" aria-label="Langue" className="flex items-center text-xs font-semibold text-slate-400">
            <button type="button" aria-pressed={locale === "fr"} onClick={() => setLocale("fr")} className={locale === "fr" ? "text-black" : ""}>FR</button>
            <span className="px-1.5">|</span>
            <button type="button" aria-pressed={locale === "en"} onClick={() => setLocale("en")} className={locale === "en" ? "text-black" : ""}>EN</button>
          </div>
          <Link href="/sign-in" className="text-sm font-medium">Connexion</Link>
          <a href="#demo" className="chrono-button border border-slate-200 bg-white">Demander une démo</a>
        </div>
        <button type="button" aria-label={mobileMenu ? "Fermer le menu" : "Ouvrir le menu"} aria-expanded={mobileMenu} onClick={() => setMobileMenu(!mobileMenu)} className="rounded-xl border border-slate-200 p-2 sm:hidden">
          {mobileMenu ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      <AnimatePresence>
        {mobileMenu && (
          <motion.nav initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden border-t border-slate-100 bg-white px-5 sm:hidden">
            <div className="space-y-1 py-4">
              {links.map(([label, href]) => <a key={href} href={href} onClick={() => setMobileMenu(false)} className="block rounded-xl px-3 py-3 text-sm font-medium hover:bg-slate-50">{label}</a>)}
              <Link href="/sign-in" className="block rounded-xl px-3 py-3 text-sm font-medium">Connexion</Link>
              <a href="#demo" onClick={() => setMobileMenu(false)} className="mt-2 flex h-12 items-center justify-center rounded-xl bg-[#12C76F] text-sm font-bold text-white">Demander une démo</a>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}

function Hero() {
  return (
    <section className="px-3 pb-10 pt-3 md:px-6 md:pb-16">
      <div className="chrono-surface relative mx-auto min-h-[680px] max-w-[1280px] overflow-hidden px-5 py-14 text-center sm:px-8 md:min-h-[790px] md:py-20">
        <div className="chrono-dots absolute inset-0 opacity-60" />
        <motion.div variants={reveal} initial="hidden" animate="visible" transition={{ duration: 0.7 }} className="relative z-10 mx-auto max-w-4xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white bg-white shadow-[0_14px_35px_rgba(15,23,42,.12)]">
            <Image src="/slaivio-mark.png" alt="" width={38} height={38} className="rounded-xl" priority />
          </div>
          <h1 className="mt-10 text-[clamp(2.5rem,6vw,5.25rem)] font-bold leading-[1.02] tracking-[-0.055em]">
            Développez votre agence cargo
            <span className="block text-[#12C76F]">sans développer votre chaos.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-slate-500 md:text-lg">
            Centralisez WhatsApp, les expéditions, les paiements, les bureaux et vos équipes dans une seule plateforme conçue pour les agences cargo modernes.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <a href="#demo" className="chrono-button bg-[#12C76F] text-white shadow-[0_16px_35px_rgba(18,199,111,.22)]">Demander une démo <ArrowRight size={16} /></a>
            <a href="#contact" className="chrono-button border border-slate-200 bg-white">Parler à un conseiller</a>
          </div>
        </motion.div>
        <LogisticsGlobe />
        <HeroWidget className="left-[3%] top-[10%] rotate-[-3deg]" icon={Package} title="Nouveau colis reçu" lines={["SLA-CH-84729", "Jean Mukendi · 12.4 kg"]} />
        <HeroWidget className="right-[3%] top-[13%] rotate-[3deg]" icon={Truck} title="Expédition en cours" lines={["CN-KIN-204", "Guangzhou → Kinshasa"]} delay={1.2} />
        <HeroWidget className="bottom-[5%] left-[5%] rotate-[2deg]" icon={MessageCircle} title="WhatsApp" lines={["Mon colis est-il arrivé ?", "Réponse envoyée"]} delay={0.7} />
        <HeroWidget className="bottom-[5%] right-[5%] rotate-[-2deg]" icon={Globe2} title="Réseau opérationnel" lines={["Chine · Dubaï · Turquie · RDC", "4 pays actifs"]} delay={1.6} />
      </div>
    </section>
  );
}

function LogisticsGlobe() {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.35, duration: 0.8 }} className="absolute bottom-[7%] left-1/2 h-[180px] w-[180px] -translate-x-1/2 sm:h-[210px] sm:w-[210px] md:bottom-[16%] md:h-[270px] md:w-[270px]">
      <div className="absolute inset-0 rounded-full border border-emerald-200/80 bg-[radial-gradient(circle_at_35%_30%,white,#e8fff3_45%,#d8f7e6)] shadow-[0_30px_80px_rgba(18,199,111,.18)]" />
      <div className="absolute inset-7 rounded-full border border-dashed border-emerald-300" />
      <div className="absolute inset-0 flex items-center justify-center"><Globe2 size={92} strokeWidth={1.2} className="text-[#12C76F]" /></div>
      {[["🇨🇳", "-left-5 top-5 md:-left-12 md:top-8"], ["🇦🇪", "-right-5 top-10 md:-right-10 md:top-14"], ["🇹🇷", "-left-4 bottom-6 md:-left-8 md:bottom-10"], ["🇨🇩", "-right-4 bottom-5 md:-right-8 md:bottom-8"]].map(([flag, position]) => <span key={flag} className={`absolute flex h-10 w-10 items-center justify-center rounded-xl border border-white bg-white text-lg shadow-lg md:h-12 md:w-12 md:rounded-2xl md:text-xl ${position}`}>{flag}</span>)}
    </motion.div>
  );
}

function HeroWidget({ className, icon: Icon, title, lines, delay = 0 }: { className: string; icon: LucideIcon; title: string; lines: string[]; delay?: number }) {
  return (
    <motion.div animate={{ y: [-5, 5, -5] }} transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay }} whileHover={{ y: -8, scale: 1.02 }} className={`absolute hidden w-[230px] rounded-[22px] border border-white bg-white/95 p-5 text-left shadow-[0_18px_50px_rgba(15,23,42,.1)] backdrop-blur-md lg:block ${className}`}>
      <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-[#12C76F]"><Icon size={19} /></span><strong className="text-sm">{title}</strong></div>
      <p className="mt-4 text-xs leading-6 text-slate-500">{lines[0]}<br /><span className="font-semibold text-slate-800">{lines[1]}</span></p>
    </motion.div>
  );
}

function PresenceStrip() {
  return (
    <section aria-label="Présence internationale" className="border-y border-slate-200 bg-white py-7">
      <div className="mx-auto flex max-w-[1180px] flex-col items-center gap-5 px-5 md:flex-row md:justify-between">
        <p className="text-sm font-semibold text-slate-500">Présent dans plusieurs pays africains</p>
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-3">
          {countries.map(([flag, country]) => <span key={country} className="text-sm font-medium text-slate-600"><span aria-hidden="true">{flag}</span> {country}</span>)}
        </div>
      </div>
    </section>
  );
}

function ProblemSection() {
  const problems = [["WhatsApp dispersé", "Les conversations sont partout."], ["Excel partout", "Plusieurs fichiers, plusieurs versions."], ["Relances oubliées", "Paiements et clients non suivis."], ["Colis difficiles à suivre", "Manque de visibilité sur les expéditions."], ["Multi-pays complexe", "Chine, Dubaï, Turquie, RDC."], ["Données perdues", "Aucune source unique de vérité."], ["Trop de tâches manuelles", "L'équipe passe son temps à copier-coller."]];
  return (
    <section id="problem" className="bg-[#fafbfc] py-24 md:py-[120px]">
      <div className="mx-auto max-w-[1280px] px-5 md:px-6">
        <SectionTitle badge="Le problème" title={<>Votre agence grandit, mais vos opérations deviennent <span className="text-[#12C76F]">plus difficiles à gérer.</span></>} subtitle="Entre WhatsApp, Excel et les suivis manuels, vous perdez du temps, des clients et des opportunités chaque jour." />
        <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.15 }} transition={{ duration: 0.65 }} className="mt-14 grid gap-10 rounded-[32px] border border-slate-100 bg-white p-6 shadow-[0_20px_80px_rgba(15,23,42,.06)] md:p-10 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:p-[60px]">
          <div className="space-y-3">
            {problems.map(([title, description], index) => <motion.div key={title} initial={{ opacity: 0, x: -14 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.06 }} className="flex gap-4 rounded-2xl border border-slate-100 p-4 transition hover:-translate-y-1 hover:shadow-md"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 font-bold text-red-500">×</span><span><strong className="block text-sm">{title}</strong><span className="mt-1 block text-sm text-slate-500">{description}</span></span></motion.div>)}
          </div>
          <motion.figure whileHover={{ scale: 1.03 }} className="relative min-h-[480px] overflow-hidden rounded-[26px] bg-slate-100 md:min-h-[620px]">
            <Image src="/landing/real-cargo-team.jpg" alt="Équipe professionnelle travaillant dans un bureau" fill sizes="(max-width:1024px) 100vw, 50vw" className="object-cover" />
            <ProblemFloat className="left-4 top-5" title="WhatsApp" value="87 messages non lus" danger />
            <ProblemFloat className="right-4 top-28" title="Paiement client" value="En retard" danger />
            <ProblemFloat className="bottom-24 left-4" title="Excel" value="Excel_v17_FINAL.xlsx" />
            <ProblemFloat className="bottom-5 right-4" title="Tracking" value="Statut inconnu" />
          </motion.figure>
        </motion.div>
      </div>
    </section>
  );
}

function ProblemFloat({ className, title, value, danger = false }: { className: string; title: string; value: string; danger?: boolean }) {
  return <motion.div animate={{ y: [-5, 5, -5] }} transition={{ duration: 7, repeat: Infinity }} className={`absolute rounded-2xl border border-white/70 bg-white/95 px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,.1)] backdrop-blur ${className}`}><strong className="block text-xs">{title}</strong><span className={`mt-1 block text-xs ${danger ? "text-red-500" : "text-slate-500"}`}>{value}</span></motion.div>;
}

function SolutionsSection() {
  const benefits = [[MessageCircle, "WhatsApp centralisé", "Toutes les conversations réunies dans une seule inbox."], [Bot, "Opérations automatisées", "Relances, notifications et tâches exécutées automatiquement."], [Globe2, "Contrôle multi-pays", "Pilotez bureaux et entrepôts depuis un seul tableau de bord."]];
  return (
    <section id="solutions" className="bg-white py-24 md:py-[120px]">
      <div className="mx-auto max-w-[1280px] px-5 md:px-6">
        <SectionTitle badge="Solutions" title={<>Centralisez toute votre activité cargo dans <span className="text-[#12C76F]">une seule plateforme.</span></>} subtitle="Clients, colis, expéditions, WhatsApp, paiements, bureaux et reporting réunis dans un système conçu pour les agences cargo modernes." />
        <div className="mt-12 grid gap-4 md:grid-cols-3">{benefits.map(([Icon, title, text]) => { const FeatureIcon = Icon as LucideIcon; return <motion.div key={String(title)} whileHover={{ y: -5 }} className="rounded-[22px] border border-slate-200 bg-white p-6 shadow-[0_12px_35px_rgba(15,23,42,.04)]"><FeatureIcon className="text-[#12C76F]" /><h3 className="mt-4 font-semibold">{String(title)}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{String(text)}</p></motion.div>; })}</div>
        <ProductDashboard />
        <div className="mt-8 flex flex-wrap justify-center gap-2">{["Dashboard", "Tracking", "Inbox WhatsApp", "Expéditions", "Analytics", "Paiements", "Multi-pays"].map(item => <span key={item} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600"><Check className="mr-1.5 inline text-[#12C76F]" size={14} />{item}</span>)}</div>
      </div>
    </section>
  );
}

function ProductDashboard() {
  return (
    <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.12 }} transition={{ duration: 0.7 }} className="relative mt-8 rounded-[34px] border border-slate-200 bg-[#f8faf9] p-3 shadow-[0_28px_90px_rgba(15,23,42,.1)] md:p-5">
      <div className="grid overflow-hidden rounded-[26px] border border-slate-200 bg-white lg:grid-cols-[220px_1fr]">
        <aside className="hidden border-r border-slate-200 p-5 lg:block"><div className="mb-5 flex items-center gap-2"><Image src="/slaivio-mark.png" alt="" width={30} height={30} className="rounded-lg" /><strong>SLAIVIO</strong></div><div className="space-y-1">{productSidebar.map((item, index) => <div key={item} className={`rounded-lg px-3 py-2 text-[11px] ${index === 0 ? "bg-emerald-50 font-semibold text-[#0b9d53]" : "text-slate-500"}`}>{item}</div>)}</div></aside>
        <Image src="/landing/dashboard.png" alt="Dashboard SLAIVIO pour les opérations cargo" width={1600} height={900} sizes="(max-width:1024px) 100vw, 75vw" className="h-full min-h-[430px] w-full object-cover object-left-top" />
      </div>
      <HeroWidget className="-left-8 top-14" icon={Package} title="Nouveau colis" lines={["SLA-CH-84729", "Jean Mukendi · Reçu"]} />
      <HeroWidget className="-right-8 top-20" icon={CircleDollarSign} title="Paiement confirmé" lines={["1 250 USD", "Sarah Cargo"]} delay={1} />
    </motion.div>
  );
}

function IntegrationsSection() {
  return (
    <section id="integrations" className="chrono-grid relative overflow-hidden bg-white py-24 md:py-[120px]">
      <div className="mx-auto max-w-[1180px] px-5 text-center md:px-6">
        <SectionTitle badge="Intégrations" title="Connectez les outils que votre agence utilise déjà." subtitle="SLAIVIO connecte WhatsApp Business, Gmail et TikTok pour centraliser vos conversations et opportunités." />
        <motion.div initial={{ opacity: 0, scale: 0.96 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.7 }} className="relative mx-auto mt-16 h-[520px] max-w-[760px] md:h-[620px]">
          <div className="absolute left-1/2 top-1/2 h-[340px] w-[340px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-slate-100 md:h-[500px] md:w-[500px]" />
          <div className="landing-orbit absolute left-1/2 top-1/2 hidden h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 md:block">
            <OrbitCard orbit className="left-[calc(50%-60px)] top-0" label="WhatsApp Business Integration" icon={MessageCircle} color="text-emerald-500" />
            <OrbitCard orbit className="bottom-8 left-0" label="Gmail Integration" icon={Mail} color="text-red-500" />
            <OrbitCard orbit className="bottom-8 right-0" label="TikTok Integration" icon={Music2} color="text-black" />
          </div>
          <div className="absolute left-1/2 top-1/2 z-10 flex h-[130px] w-[130px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[32px] border border-slate-100 bg-white shadow-[0_20px_50px_rgba(0,0,0,.08)]"><Image src="/slaivio-mark.png" alt="SLAIVIO centralise les intégrations" width={82} height={82} className="rounded-[22px]" /></div>
          <div className="absolute inset-x-0 bottom-5 grid grid-cols-3 gap-3 md:hidden"><OrbitCard label="WhatsApp Business Integration" icon={MessageCircle} color="text-emerald-500" /><OrbitCard label="Gmail Integration" icon={Mail} color="text-red-500" /><OrbitCard label="TikTok Integration" icon={Music2} color="text-black" /></div>
        </motion.div>
      </div>
    </section>
  );
}

function OrbitCard({ className = "", label, icon: Icon, color, orbit = false }: { className?: string; label: string; icon: LucideIcon; color: string; orbit?: boolean }) {
  return <motion.div whileHover={{ y: -8, boxShadow: "0 30px 70px rgba(0,0,0,.12)" }} aria-label={label} className={`${orbit ? "landing-counter-orbit absolute" : "relative"} flex h-[112px] w-full items-center justify-center rounded-[28px] border border-slate-100 bg-white shadow-[0_15px_40px_rgba(0,0,0,.08)] md:h-[120px] md:w-[120px] ${className}`}><Icon size={42} className={color} /></motion.div>;
}

function FeaturesExperience() {
  const [active, setActive] = useState(0);
  const feature = features[active];
  const Icon = feature.icon;
  return (
    <section id="features" className="bg-[#f8fafc] py-24 md:py-[120px]">
      <div className="mx-auto max-w-[1280px] px-5 md:px-6">
        <SectionTitle badge="Fonctionnalités" title={<>Tout votre business cargo dans <span className="text-[#12C76F]">une seule plateforme.</span></>} subtitle="Gérez clients, dossiers, colis, expéditions, paiements et conversations WhatsApp depuis un seul espace de travail." />
        <div className="mt-14 overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_20px_80px_rgba(0,0,0,.06)] md:rounded-[40px]">
          <AnimatePresence mode="wait">
            <motion.div key={active} initial={{ opacity: 0, x: 22 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -22 }} transition={{ duration: 0.32 }} className="grid min-h-[620px] lg:grid-cols-[40%_60%]">
              <div className="flex flex-col justify-center p-7 md:p-12 lg:p-14"><span className="w-fit rounded-full border border-emerald-200 px-4 py-2 text-xs font-bold text-[#0b9d53]">{String(active + 1).padStart(2, "0")}</span><Icon className="mt-8 text-[#12C76F]" size={34} /><h3 className="mt-5 text-3xl font-bold tracking-[-0.04em] md:text-4xl">{feature.title}</h3><p className="mt-5 text-base leading-8 text-slate-500">{feature.description}</p><ul className="mt-7 space-y-3">{feature.benefits.map(item => <li key={item} className="flex items-center gap-3 text-sm text-slate-700"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50 text-[#12C76F]"><Check size={14} /></span>{item}</li>)}</ul></div>
              <div className="flex items-center bg-[#f5f7f6] p-4 md:p-8"><Image src={feature.image} alt={`Aperçu SLAIVIO : ${feature.title}`} width={1600} height={900} sizes="(max-width:1024px) 100vw, 60vw" className="h-auto w-full rounded-[24px] border border-slate-200 bg-white shadow-xl" /></div>
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="mt-7 flex gap-2 overflow-x-auto pb-3" role="tablist" aria-label="Fonctionnalités SLAIVIO">{features.map((item, index) => <button key={item.title} type="button" role="tab" aria-selected={active === index} onClick={() => setActive(index)} className={`shrink-0 rounded-full border px-4 py-2.5 text-xs font-semibold transition ${active === index ? "border-[#12C76F] bg-[#12C76F] text-white" : "border-slate-200 bg-white text-slate-500 hover:border-emerald-300"}`}>{item.title}</button>)}</div>
        <p className="mt-5 text-center text-sm text-slate-500">Et bien plus encore : notifications, routes, équipes, services, IA Cargo et gestion documentaire.</p>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how" className="bg-white py-24 md:py-[120px]">
      <div className="mx-auto max-w-[1280px] px-5 md:px-6"><SectionTitle badge="Comment ça marche" title="Gérez votre agence cargo en quelques étapes simples" subtitle="Connectez vos canaux, configurez votre agence et automatisez vos opérations cargo dans une plateforme unique." /><div className="mt-14 grid gap-5 md:grid-cols-2">{howSteps.map((step, index) => <motion.article key={step.title} variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} transition={{ delay: index * 0.08 }} whileHover={{ scale: 1.02 }} className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_16px_50px_rgba(15,23,42,.05)]"><StepVisual kind={step.kind} icon={step.icon} /><div className="p-7"><span className="text-xs font-bold text-[#12C76F]">ÉTAPE {index + 1}</span><h3 className="mt-3 text-2xl font-bold">{step.title}</h3><p className="mt-3 text-sm leading-7 text-slate-500">{step.description}</p></div></motion.article>)}</div></div>
    </section>
  );
}

function StepVisual({ kind, icon: Icon }: { kind: string; icon: LucideIcon }) {
  return <div className="chrono-dots relative flex h-[260px] items-center justify-center overflow-hidden border-b border-slate-100 bg-[#fafbfc]"><div className="flex h-20 w-20 items-center justify-center rounded-[24px] border border-white bg-white text-[#12C76F] shadow-xl"><Icon size={34} /></div>{kind === "flow" && <div className="absolute bottom-6 flex gap-2 text-[10px]">{["Client", "Dossier", "Colis", "Expédition"].map((item, index) => <span key={item} className="rounded-lg border bg-white px-3 py-2 shadow-sm">{item}{index < 3 && " →"}</span>)}</div>}{kind === "tracking" && <div className="absolute bottom-6 flex gap-2 text-[10px]">{["Reçu", "Transit", "Arrivé", "Livré"].map(item => <span key={item} className="rounded-full bg-emerald-50 px-3 py-2 text-emerald-700">✓ {item}</span>)}</div>}{kind === "chat" && <div className="absolute bottom-5 left-5 right-5 space-y-2 text-[10px]"><div className="mr-12 rounded-xl bg-white p-3 shadow-sm">Client : Mon colis est-il arrivé ?</div><div className="ml-12 rounded-xl bg-emerald-100 p-3">OTI Cargo : Oui, il est arrivé à Kinshasa.</div></div>}</div>;
}

function PricingSection() {
  const [cycle, setCycle] = useState<"monthly" | "quarterly" | "semiannual" | "annual">("monthly");
  const discount = { monthly: 0, quarterly: 0.1, semiannual: 0.15, annual: 0.2 }[cycle];
  return (
    <section id="pricing" className="bg-[#fafbfc] py-24 md:py-[120px]"><div className="mx-auto max-w-[1180px] px-5 md:px-6"><SectionTitle badge="Tarification" title="Choisissez le plan adapté à votre agence" subtitle="Commencez avec SLAIVIO et développez votre agence cargo sans augmenter votre charge opérationnelle." /><div className="mx-auto mt-9 flex w-fit max-w-full gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5">{[["monthly", "Mensuel"], ["quarterly", "Trimestriel -10%"], ["semiannual", "Semestriel -15%"], ["annual", "Annuel -20%"]].map(([value, label]) => <button key={value} type="button" onClick={() => setCycle(value as typeof cycle)} className={`shrink-0 rounded-xl px-4 py-2.5 text-xs font-semibold transition ${cycle === value ? "bg-[#111318] text-white" : "text-slate-500"}`}>{label}</button>)}</div><div className="mt-12 grid items-center gap-5 lg:grid-cols-3">{pricingPlans.map((plan, index) => <motion.article key={plan.name} variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} transition={{ delay: index * 0.15 }} whileHover={{ y: -8 }} className={`relative rounded-[28px] border p-7 shadow-[0_20px_60px_rgba(0,0,0,.06)] md:p-9 ${plan.popular ? "z-10 border-[#12C76F] bg-[#12C76F] text-white lg:scale-[1.06]" : "border-slate-200 bg-white"}`}>{plan.popular && <span className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-[#111318] px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-white">Le plus populaire</span>}<h3 className="text-2xl font-bold">{plan.name}</h3><p className={`mt-2 min-h-12 text-sm ${plan.popular ? "text-white/75" : "text-slate-500"}`}>{plan.description}</p><div className="mt-7 flex items-end gap-1"><AnimatePresence mode="popLayout"><motion.strong key={`${cycle}-${plan.name}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-5xl tracking-[-0.05em]">{Math.round(plan.monthly * (1 - discount))}$</motion.strong></AnimatePresence><span className={plan.popular ? "text-white/70" : "text-slate-500"}>/mois</span></div><a href="#demo" className={`mt-7 flex h-13 items-center justify-center rounded-xl text-sm font-bold ${plan.popular ? "bg-white text-[#111318]" : "bg-[#12C76F] text-white"}`}>{plan.name === "Enterprise" ? "Demander une démo" : "Commencer"}</a><ul className={`mt-7 space-y-3 border-t pt-6 text-sm ${plan.popular ? "border-white/20" : "border-slate-200"}`}>{plan.features.map(item => <li key={item} className="flex gap-3"><Check size={16} className="mt-0.5 shrink-0" />{item}</li>)}</ul></motion.article>)}</div></div></section>
  );
}

function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="bg-white py-24 md:py-[120px]"><div className="mx-auto max-w-[920px] px-5"><SectionTitle badge="FAQ" title="Questions fréquentes" subtitle="Tout ce que vous devez savoir avant de moderniser votre agence cargo avec SLAIVIO." /><div className="mt-12 space-y-3">{faqItems.map(([question, answer], index) => <div key={question} className="overflow-hidden rounded-[18px] border border-slate-200 bg-white"><button type="button" onClick={() => setOpen(open === index ? null : index)} aria-expanded={open === index} className="flex min-h-[72px] w-full items-center justify-between gap-4 px-6 text-left text-sm font-semibold md:text-base"><span>{question}</span><ChevronDown size={19} className={`shrink-0 transition ${open === index ? "rotate-180" : ""}`} /></button><AnimatePresence initial={false}>{open === index && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }}><p className="px-6 pb-6 text-sm leading-7 text-slate-500">{answer}</p></motion.div>}</AnimatePresence></div>)}</div><div className="mt-10 flex flex-col items-center justify-between gap-5 rounded-[28px] border border-slate-200 p-7 shadow-[0_20px_60px_rgba(0,0,0,.04)] md:flex-row"><div><h3 className="text-xl font-bold">Vous avez encore une question ?</h3><p className="mt-2 text-sm text-slate-500">Parlez avec notre équipe et découvrez comment SLAIVIO s'adapte à votre agence.</p></div><div className="flex shrink-0 flex-col gap-2 sm:flex-row"><a href="#demo" className="chrono-button bg-[#12C76F] text-white">Demander une démo</a><a href="#contact" className="chrono-button border border-slate-200 bg-white">Parler à un conseiller</a></div></div></div></section>
  );
}

type FormErrors = Record<string, string>;

function DemoSection() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errors, setErrors] = useState<FormErrors>({});

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const required = ["full_name", "agency_name", "country", "email", "phone", "agency_size"];
    const nextErrors: FormErrors = {};
    required.forEach(key => { if (!String(data.get(key) || "").trim()) nextErrors[key] = "Ce champ est requis."; });
    const email = String(data.get("email") || "");
    if (email && !/^\S+@\S+\.\S+$/.test(email)) nextErrors.email = "Saisissez un email valide.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setStatus("loading");
    try {
      await createDemoRequest({
        full_name: String(data.get("full_name")),
        agency_name: String(data.get("agency_name")),
        country: String(data.get("country")),
        email,
        phone: String(data.get("phone")),
        monthly_shipments: `${String(data.get("agency_size"))} | ${String(data.get("monthly_volume") || "Volume non précisé")}`,
        message: String(data.get("message") || ""),
      });
      form.reset();
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  return (
    <section id="demo" className="bg-[#f8fafc] py-24"><motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.1 }} className="mx-auto grid max-w-[1180px] gap-10 rounded-[28px] border border-slate-200 bg-white p-7 shadow-[0_24px_80px_rgba(15,23,42,.06)] md:p-12 lg:grid-cols-[.9fr_1.1fr] lg:gap-14 lg:rounded-[40px]"><div className="self-center"><Pill>Demande de démo</Pill><h2 className="mt-6 text-4xl font-bold leading-tight tracking-[-0.045em] md:text-5xl">Prêt à moderniser votre agence cargo ?</h2><p className="mt-5 leading-8 text-slate-500">Notre équipe vous montrera comment centraliser vos clients, colis, expéditions, WhatsApp, paiements et rapports.</p><ul className="mt-7 space-y-3">{["Démonstration personnalisée", "Analyse de vos opérations", "Recommandations adaptées", "Aucun engagement"].map(item => <li key={item} className="flex items-center gap-3 text-sm"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50 text-[#12C76F]"><Check size={14} /></span>{item}</li>)}</ul><div className="mt-8 rounded-2xl bg-[#f8fafc] p-5 text-sm leading-7 text-slate-500"><strong className="text-slate-900">Temps de réponse :</strong> moins de 24h<br /><strong className="text-slate-900">Canaux :</strong> WhatsApp · Email · Appel</div></div><div>{status === "success" ? <SuccessState onReset={() => setStatus("idle")} /> : <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><h3 className="text-2xl font-bold">Demander une démo</h3><p className="mt-2 text-sm text-slate-500">Un conseiller SLAIVIO vous contactera pour la planifier.</p></div><FormField name="full_name" label="Nom complet" placeholder="Jean Mukendi" error={errors.full_name} /><FormField name="agency_name" label="Nom de l'agence" placeholder="OTI Cargo Express" error={errors.agency_name} /><SelectField name="country" label="Pays" options={countries.map(([, name]) => name).concat("Autre")} error={errors.country} /><FormField name="email" label="Email professionnel" placeholder="contact@agence.com" type="email" error={errors.email} /><FormField name="phone" label="Numéro WhatsApp" placeholder="+243 81 234 5678" type="tel" error={errors.phone} /><SelectField name="agency_size" label="Taille de l'agence" options={["Petite agence", "Agence en croissance", "Agence multi-bureaux", "Groupe cargo / réseau international"]} error={errors.agency_size} /><SelectField name="monthly_volume" label="Volume mensuel estimé" options={["Moins de 500 colis/mois", "500 à 5 000 colis/mois", "5 000 à 20 000 colis/mois", "Plus de 20 000 colis/mois"]} optional /><label className="sm:col-span-2"><span className="mb-2 block text-xs font-semibold">Besoin principal <span className="text-slate-400">(facultatif)</span></span><textarea name="message" rows={4} placeholder="Nous voulons centraliser WhatsApp, suivre les colis et automatiser les relances..." className="chrono-input resize-none" /></label><button type="submit" disabled={status === "loading"} className="sm:col-span-2 flex h-14 items-center justify-center rounded-2xl bg-[#12C76F] font-bold text-white transition hover:-translate-y-0.5 hover:shadow-[0_18px_45px_rgba(18,199,111,.25)] disabled:opacity-60">{status === "loading" ? "Envoi en cours..." : "Demander une démo"}</button><p className="text-center text-xs text-slate-400 sm:col-span-2">Ou parlez directement à un conseiller</p><a href="#contact" className="sm:col-span-2 flex h-13 items-center justify-center rounded-2xl border border-[#12C76F] font-semibold text-[#0b9d53]">Parler sur WhatsApp</a>{status === "error" && <p role="alert" className="text-center text-sm text-red-600 sm:col-span-2">Impossible d'envoyer la demande. Réessayez dans un instant.</p>}<p className="text-center text-[11px] leading-5 text-slate-400 sm:col-span-2">En envoyant ce formulaire, vous acceptez d'être contacté par l'équipe SLAIVIO au sujet de votre demande.</p></form>}</div></motion.div></section>
  );
}

function FormField({ name, label, placeholder, type = "text", error }: { name: string; label: string; placeholder: string; type?: string; error?: string }) {
  return <label><span className="mb-2 block text-xs font-semibold">{label}</span><input name={name} type={type} placeholder={placeholder} aria-invalid={Boolean(error)} aria-describedby={error ? `${name}-error` : undefined} className="chrono-input" />{error && <span id={`${name}-error`} className="mt-1.5 block text-xs text-red-600">{error}</span>}</label>;
}

function SelectField({ name, label, options, error, optional = false }: { name: string; label: string; options: string[]; error?: string; optional?: boolean }) {
  return <label><span className="mb-2 block text-xs font-semibold">{label}{optional && <span className="text-slate-400"> (facultatif)</span>}</span><select name={name} defaultValue="" aria-invalid={Boolean(error)} aria-describedby={error ? `${name}-error` : undefined} className="chrono-input"><option value="" disabled>Sélectionnez</option>{options.map(option => <option key={option} value={option}>{option}</option>)}</select>{error && <span id={`${name}-error`} className="mt-1.5 block text-xs text-red-600">{error}</span>}</label>;
}

function SuccessState({ onReset }: { onReset: () => void }) {
  return <div className="flex min-h-[520px] flex-col items-center justify-center rounded-[28px] bg-emerald-50 p-8 text-center"><span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#12C76F] text-white"><Check size={30} /></span><h3 className="mt-6 text-2xl font-bold">Demande envoyée avec succès</h3><p className="mt-4 max-w-sm leading-7 text-slate-500">Merci. Notre équipe vous contactera rapidement pour organiser votre démonstration SLAIVIO.</p><button type="button" onClick={onReset} className="chrono-button mt-7 bg-white">Retour au site</button></div>;
}

function SectionTitle({ badge, title, subtitle }: { badge: string; title: React.ReactNode; subtitle: string }) {
  return <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.35 }} transition={{ duration: 0.6 }} className="mx-auto max-w-[900px] text-center"><Pill>{badge}</Pill><h2 className="mt-6 text-[clamp(2.25rem,5vw,4rem)] font-bold leading-[1.05] tracking-[-0.045em]">{title}</h2><p className="mx-auto mt-5 max-w-[720px] text-base leading-8 text-slate-500 md:text-lg">{subtitle}</p></motion.div>;
}

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex min-h-10 items-center rounded-full border border-slate-200 bg-white px-5 text-xs font-semibold uppercase tracking-[.08em] text-slate-600 shadow-[0_8px_30px_rgba(0,0,0,.04)]">{children}</span>;
}

function Footer() {
  const socials = [[MessageCircle, "WhatsApp"], [Linkedin, "LinkedIn"], [Facebook, "Facebook"], [Youtube, "YouTube"]] as const;
  return <footer id="contact" className="border-t border-slate-200 bg-white py-10"><div className="mx-auto max-w-[1180px] px-5 md:px-6"><div className="grid gap-8 md:grid-cols-[1.3fr_repeat(4,.7fr)]"><div><div className="flex items-center gap-3"><Image src="/slaivio-mark.png" alt="" width={34} height={34} className="rounded-[10px]" /><strong>SLAIVIO</strong></div><p className="mt-4 max-w-xs text-sm leading-6 text-slate-500">L'Operating System des agences cargo modernes.</p></div><FooterLinks title="Produit" links={[["Fonctionnalités", "#features"], ["Intégrations", "#integrations"], ["Tarification", "#pricing"], ["Sécurité", "#faq"]]} /><FooterLinks title="Ressources" links={[["Documentation", "#features"], ["FAQ", "#faq"], ["Comment ça marche", "#how"]]} /><FooterLinks title="Entreprise" links={[["À propos", "#solutions"], ["Contact", "#demo"], ["Partenaires", "#integrations"]]} /><FooterLinks title="Légal" links={[["Politique de confidentialité", "/privacy"], ["Conditions d'utilisation", "/terms"]]} /></div><div className="mt-9 flex flex-col items-center justify-between gap-5 border-t border-slate-200 pt-7 text-xs text-slate-500 md:flex-row"><span>© 2026 SLAIVIO. Tous droits réservés.</span><div className="flex items-center gap-2">{socials.map(([Icon, label]) => <span key={label} aria-label={`${label} - bientôt disponible`} title={`${label} - bientôt disponible`} className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-400"><Icon size={16} /></span>)}<a href="mailto:contact@slaivio.com" aria-label="Email" className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:text-[#12C76F]"><Mail size={16} /></a></div><span>FR | EN</span></div></div></footer>;
}

function FooterLinks({ title, links }: { title: string; links: Array<[string, string]> }) {
  return <div><h3 className="text-xs font-bold uppercase tracking-wider">{title}</h3><div className="mt-4 space-y-3">{links.map(([label, href]) => <a key={label} href={href} className="landing-footer-link block text-sm text-slate-500 hover:text-black">{label}</a>)}</div></div>;
}
