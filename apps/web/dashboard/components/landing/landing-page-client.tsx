"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  Bot,
  Building2,
  Check,
  ChevronDown,
  Clock,
  CreditCard,
  FileText,
  Globe2,
  Headphones,
  MapPin,
  MessageCircle,
  PackageCheck,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  Truck,
  Users,
  Warehouse,
  type LucideIcon,
} from "lucide-react";

const stats = [
  ["250+", "agences"],
  ["1.2M+", "colis gérés"],
  ["8M+", "conversations"],
  ["95%", "satisfaction"],
];

const socialStats: Array<[number, string, string, LucideIcon]> = [
  [250, "+", "Agences", Users],
  [1200000, "+", "Colis gérés", PackageCheck],
  [8000000, "+", "Conversations automatisées", MessageCircle],
  [95, "%", "Satisfaction client", Star],
];

const trustLogos = [
  "OTI CARGO",
  "JFI EXPRESS",
  "FLASH GROUP",
  "BOOK CARGO",
  "KMS AGENCY",
  "ASIE AFRICA CARGO",
  "AIGLE VISION",
];

const problems = [
  ["WhatsApp dispersé", "Les conversations sont éparpillées et difficiles à retrouver."],
  ["Excel partout", "Vos données sont sur plusieurs fichiers, sources d'erreurs."],
  ["Relances oubliées", "Les relances manuelles entraînent des retards et des pertes."],
  ["Colis difficiles à suivre", "Manque de visibilité sur le statut des colis en temps réel."],
  ["Données perdues", "Les informations importantes se perdent ou ne sont pas sauvegardées."],
  ["Manque de visibilité", "Aucune vue globale sur vos opérations et vos performances."],
  ["Trop de tâches manuelles", "Des tâches répétitives épuisent vos équipes."],
];

const benefits = [
  [
    "Plus de contrôle",
    "Suivez toutes vos opérations depuis un seul tableau de bord.",
  ],
  ["Plus de temps", "Automatisez les tâches répétitives de votre équipe."],
  ["Plus de revenus", "Répondez plus vite et gérez davantage de clients."],
  [
    "Plus de professionnalisme",
    "Offrez une expérience moderne à vos clients et partenaires.",
  ],
  [
    "Plus de croissance",
    "Développez votre activité sans multiplier les outils.",
  ],
];

const features: Array<[string, string, LucideIcon]> = [
  ["WhatsApp Business", "Centralisez toutes vos conversations.", MessageCircle],
  ["IA Cargo", "Qualifiez les demandes et assistez vos clients.", Bot],
  ["Gestion des expéditions", "Créez et suivez vos expéditions de A à Z.", Truck],
  ["Gestion des clients", "Centralisez l'historique de vos interactions.", Building2],
  ["Reporting", "Pilotez avec des données claires.", BarChart3],
  ["Multi-bureaux", "Gérez plusieurs bureaux et équipes.", Globe2],
  ["Tracking", "Suivez les colis en temps réel.", MapPin],
  ["Gestion des paiements", "Suivez encaissements et soldes.", CreditCard],
  ["Relances automatiques", "Relancez clients, colis et paiements.", PackageCheck],
  ["Base de connaissances IA", "Répondez instantanément aux questions.", FileText],
];

const steps = [
  ["Connexion WhatsApp", "Centralisez vos conversations en quelques clics."],
  ["Configuration de l'agence", "Paramétrez services, tarifs, bureaux et processus."],
  ["Formation de l'équipe", "Accompagnement pour une adoption rapide."],
  ["Automatisation des opérations", "Activez l'IA, les relances et notifications."],
  ["Croissance", "Pilotez les performances et développez l'agence."],
];

const pricing = [
  {
    name: "Starter",
    price: "119$",
    founder: "Idéal pour les petites agences qui débutent.",
    value: ["1 utilisateur inclus", "Jusqu'à 500 conversations WhatsApp", "Gestion des expéditions", "Gestion des clients", "Reporting de base", "Support par WhatsApp"],
    highlight: false,
  },
  {
    name: "Growth",
    price: "299$",
    founder: "Parfait pour les agences en pleine croissance.",
    value: ["5 utilisateurs inclus", "Jusqu'à 2 500 conversations WhatsApp", "Toutes les fonctionnalités Starter", "IA Cargo & automatisations", "Relances automatiques", "Support prioritaire"],
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "799$",
    founder: "Pour les agences établies qui veulent aller plus loin.",
    value: ["10 utilisateurs inclus", "Jusqu'à 10 000 conversations WhatsApp", "Toutes les fonctionnalités Growth", "Multi-bureaux & équipes", "Gestion des paiements", "Support prioritaire 24/7"],
    highlight: false,
  },
  {
    name: "Enterprise+",
    price: "Sur devis",
    founder: "Pour les groupes cargo et agences multi-pays.",
    value: ["Utilisateurs illimités", "Conversations WhatsApp illimitées", "Intégrations spécifiques", "Déploiement multi-pays", "SLA premium", "Account Manager dédié"],
    highlight: false,
  },
];

const faqs = [
  [
    "Puis-je utiliser mon WhatsApp actuel ?",
    "Oui. SLAIVIO vous guide vers une connexion WhatsApp Business officielle et exploitable en production.",
  ],
  [
    "Combien de temps dure l'installation ?",
    "L'onboarding est guidé étape par étape pour configurer l'agence, les bureaux, les routes, les prix, WhatsApp et l'équipe.",
  ],
  [
    "Mon équipe sera-t-elle formée ?",
    "Oui. L'offre inclut un accompagnement jusqu'à l'adoption réelle dans les opérations quotidiennes.",
  ],
  [
    "Puis-je gérer plusieurs bureaux ?",
    "Oui. SLAIVIO est pensé pour les agences multi-bureaux, multi-numéros et multi-opérations.",
  ],
  [
    "Les données sont-elles sécurisées ?",
    "Oui. L'accès est protégé par authentification, rôles, organisations et séparation des tenants.",
  ],
  [
    "Puis-je importer mes fichiers Excel ?",
    "Oui. Les imports et workflows de migration seront branchés progressivement dans les blocs d'onboarding et opérations.",
  ],
];

const testimonials = [
  ["Abidjan M. KOFFI", "Directeur Général", "Abidjan Cargo Services", "SLAIVIO a complètement transformé notre façon de travailler. Nous avons gagné en visibilité et en productivité."],
  ["Awa TRAORE", "Responsable des Opérations", "Global Express", "Grâce à l'automatisation WhatsApp et au suivi des expéditions, nous répondons plus vite et ne manquons plus aucune relance."],
  ["Bintou DIALLO", "CEO", "Bintou Cargo", "Le reporting et la centralisation des données nous permettent de prendre de meilleures décisions plus rapidement."],
];

const countries = ["RDC", "Cameroun", "Côte d'Ivoire", "Ghana", "Kenya", "Zimbabwe", "Sénégal"];

export function LandingPageClient() {
  const [testimonialIndex, setTestimonialIndex] = useState(0);

  useEffect(() => {
    const elements = document.querySelectorAll<HTMLElement>("[data-reveal]");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.14 }
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  return (
    <main className="min-h-screen bg-white text-[#111827]">
      <Header />

      <section className="relative overflow-hidden bg-[#02080d] pb-28 pt-20 text-white md:pt-28">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_54%,rgba(0,205,104,0.22),transparent_34rem),linear-gradient(rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:auto,42px_42px,42px_42px]" />
        <div className="relative mx-auto max-w-[1180px] px-6 text-center">
          <h1 data-reveal className="landing-reveal mx-auto max-w-4xl text-5xl font-bold leading-[1.03] tracking-[-0.055em] md:text-7xl">
            L&apos;Operating System
            <span className="block">des <span className="text-[#12C76F]">Agences Cargo</span></span>
          </h1>
          <p data-reveal className="landing-reveal mx-auto mt-7 max-w-2xl text-lg leading-8 text-slate-300">
            Automatisez vos opérations, centralisez vos données et développez
            votre agence sans augmenter votre charge opérationnelle.
          </p>
          <p data-reveal className="landing-reveal mx-auto mt-4 max-w-3xl text-base leading-8 text-slate-400">
            Transformez votre agence cargo fonctionnant sur WhatsApp et Excel
            en une entreprise moderne, automatisée et pilotée par la donnée grâce à SLAIVIO.
          </p>
          <div data-reveal className="landing-reveal mt-9 flex flex-col justify-center gap-4 sm:flex-row">
            <a href="#demo" className="landing-button inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-[#12C76F] px-7 text-sm font-bold text-white shadow-[0_14px_45px_rgba(18,199,111,0.28)]">
              <ArrowUpRight size={17} /> Demander une démo
            </a>
            <a href="https://wa.me/" className="landing-button inline-flex h-14 items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/[0.04] px-7 text-sm font-bold text-white">
              <MessageCircle size={17} /> Parler à un conseiller
            </a>
          </div>

          <div className="relative mx-auto mt-12 max-w-5xl">
            <div data-reveal className="landing-dashboard-reveal overflow-hidden rounded-[24px] border border-emerald-400/30 bg-[#071119] p-3 shadow-[0_0_90px_rgba(18,199,111,0.24)]">
              <Image src="/landing/dashboard.png" alt="Dashboard SLAIVIO" width={1600} height={900} priority className="h-auto w-full rounded-[17px] border border-white/10" />
            </div>
            <FloatingCard className="-left-8 bottom-24" title="Nouveau colis arrivé" icon={<PackageCheck size={18} />} />
            <FloatingCard className="bottom-[-46px] left-[38%]" title="Message WhatsApp traité" icon={<MessageCircle size={18} />} delay />
            <FloatingCard className="-right-7 bottom-16" title="Paiement reçu" icon={<CreditCard size={18} />} />
          </div>
        </div>
      </section>

      <section className="overflow-hidden border-b border-slate-100 bg-white py-12">
        <div className="mx-auto max-w-[1180px] px-6 text-center">
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-slate-400">
            Ils nous font confiance
          </p>
          <div className="landing-logo-track mt-8 flex min-w-max items-center gap-14 text-lg font-black text-slate-400">
            {trustLogos.map((logo) => (
              <span key={logo}>{logo}</span>
            ))}
            {trustLogos.map((logo) => (
              <span key={`${logo}-repeat`} aria-hidden>{logo}</span>
            ))}
          </div>
        </div>
      </section>

      <Section
        id="problem"
        title="Votre agence grandit, mais vos opérations deviennent plus difficiles à gérer."
      >
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div className="space-y-4">
            {problems.map(([problem, description], index) => (
              <div
                key={problem}
                data-reveal
                className="landing-reveal flex gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                style={{ animationDelay: `${index * 80}ms` }}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 font-bold text-red-500">×</div>
                <div>
                  <div className="font-bold text-slate-950">{problem}</div>
                  <div className="mt-1 text-sm text-slate-500">{description}</div>
                </div>
              </div>
            ))}
          </div>
          <div data-reveal className="landing-parallax landing-reveal relative h-[620px] overflow-hidden rounded-[32px] bg-[#F8FAFC]">
            <Image src="/landing/problem-operations.png" alt="Chaos opérationnel d'une agence cargo" fill className="object-cover object-right" />
          </div>
        </div>
      </Section>

      <Section
        id="solutions"
        centered
        title="Imaginez une agence qui fonctionne différemment."
        description="SLAIVIO transforme vos conversations, feuilles Excel et opérations terrain en un flux clair et automatisé."
      >
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1fr_1.15fr] lg:items-center">
          <div data-reveal className="landing-reveal rounded-[28px] border border-red-100 bg-red-50/50 p-7">
            <div className="font-bold text-red-600">Avant SLAIVIO</div>
            <p className="mt-3 text-sm leading-7 text-slate-600">Des outils dispersés, des tâches manuelles et un manque total de visibilité.</p>
          </div>
          <div className="space-y-3">
            {["WhatsApp + Excel + Téléphone", "Chaos", "SLAIVIO", "Contrôle", "Automatisation", "Croissance"].map((step, index) => (
              <div key={step} data-reveal className={`landing-timeline-step landing-reveal relative rounded-2xl border p-4 text-center text-sm font-bold ${index < 2 ? "border-red-100 bg-red-50 text-red-600" : "border-emerald-100 bg-emerald-50/70 text-[#0B7A45]"}`} style={{ transitionDelay: `${index * 90}ms` }}>
                {step}
                {index < 5 && <ArrowRight className="landing-timeline-arrow absolute -bottom-5 left-1/2 z-10 -translate-x-1/2 rotate-90 text-[#12C76F]" size={17} />}
              </div>
            ))}
          </div>
          <div data-reveal className="landing-reveal rounded-[28px] border border-emerald-100 bg-white p-4 shadow-xl">
            <div className="mb-4 flex items-center gap-2 font-bold text-[#0B7A45]"><BadgeCheck size={19} /> Avec SLAIVIO</div>
            <Image src="/landing/dashboard.png" alt="Agence centralisée avec SLAIVIO" width={1600} height={900} className="rounded-2xl border border-slate-100" />
          </div>
        </div>
      </Section>

      <Section
        id="benefits"
        title="Ce que SLAIVIO apporte à votre agence"
      >
        <div className="grid gap-6 lg:grid-cols-[0.52fr_1.1fr]">
          <div className="grid gap-5 sm:grid-cols-2">
            {benefits.map(([title, description], index) => (
              <div key={title} data-reveal className="landing-card landing-reveal rounded-[26px] border border-slate-200 bg-white p-6 text-center shadow-sm" style={{ transitionDelay: `${index * 80}ms` }}>
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E8FFF3] text-[#0B7A45]">
                  {index === 0 ? <ShieldCheck size={25} /> : index === 1 ? <Clock size={25} /> : index === 2 ? <TrendingUp size={25} /> : index === 3 ? <Users size={25} /> : <ArrowUpRight size={25} />}
                </div>
                <h3 className="mt-5 text-xl font-semibold tracking-tight text-slate-950">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-500">{description}</p>
              </div>
            ))}
          </div>
          <div data-reveal className="landing-reveal rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_28px_80px_rgba(15,23,42,0.10)]">
            <Image src="/landing/dashboard.png" alt="Bénéfices SLAIVIO" width={1600} height={900} className="h-full w-full rounded-[20px] border border-slate-100 object-cover" />
          </div>
        </div>
      </Section>

      <Section
        id="showcase"
        title="Un tableau de bord pensé pour votre quotidien."
        description="Visualisez tout, décidez plus vite et pilotez votre croissance."
      >
        <div className="grid gap-4 md:grid-cols-4">
          {[["Vue d'ensemble complète", "Toutes vos opérations en un coup d'œil."], ["Décisions plus rapides", "Des données à jour pour agir."], ["Performance maîtrisée", "Suivez vos KPIs en continu."], ["Croissance accélérée", "Identifiez les opportunités."]].map(([title, text], index) => (
            <div key={title} data-reveal className="landing-reveal flex gap-3 rounded-2xl p-4" style={{ transitionDelay: `${index * 80}ms` }}>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#E8FFF3] text-[#0B7A45]"><BarChart3 size={19} /></div>
              <div><div className="text-sm font-bold">{title}</div><div className="mt-1 text-xs leading-5 text-slate-500">{text}</div></div>
            </div>
          ))}
        </div>
        <div data-reveal className="landing-dashboard-reveal mt-8 rounded-[30px] border border-slate-200 bg-white p-4 shadow-[0_32px_90px_rgba(15,23,42,0.12)]">
            <Image
              src="/landing/dashboard.png"
              alt="Dashboard SLAIVIO"
              width={1600}
              height={900}
              className="h-auto w-full rounded-[24px] border border-slate-100"
            />
        </div>
      </Section>

      <Section id="features" title="Tout ce dont votre agence a besoin.">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-5">
          {features.map(([title, description, Icon], index) => (
            <div
              key={String(title)}
              data-reveal
              className="landing-card landing-reveal rounded-[26px] border border-slate-200 bg-white p-6 text-center shadow-sm"
              style={{ transitionDelay: `${index * 55}ms` }}
            >
              <div className="landing-icon mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E8FFF3] text-[#0B7A45]">
                <Icon size={19} />
              </div>
              <h3 className="mt-5 text-xl font-semibold tracking-tight">
                {title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-slate-500">{description}</p>
              <ArrowRight className="mx-auto mt-5 text-[#12C76F]" size={18} />
            </div>
          ))}
        </div>
      </Section>

      <Section
        id="how-it-works"
        centered
        title="Mise en place simple et rapide."
      >
        <div className="relative mx-auto mt-6 grid max-w-6xl gap-4 md:grid-cols-5">
          <div className="landing-progress-line absolute left-0 right-0 top-8 hidden h-[2px] bg-[#12C76F] md:block" />
          {steps.map(([step, description], index) => (
            <div key={step} data-reveal className="landing-reveal relative rounded-[24px] border border-slate-200 bg-white p-5 text-center shadow-sm" style={{ transitionDelay: `${index * 110}ms` }}>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#12C76F] text-sm font-bold text-white">
                {index + 1}
              </div>
              <div className="mt-4 text-sm font-bold text-slate-700">
                {step}
              </div>
              <p className="mt-3 text-xs leading-6 text-slate-500">{description}</p>
            </div>
          ))}
        </div>
      </Section>

      <section id="social-proof" className="bg-[#F8FAFC] py-24 md:py-32">
        <div className="mx-auto max-w-[1180px] px-6">
          <div className="text-center">
            <Badge>Preuves sociales</Badge>
            <h2 className="mt-6 text-4xl font-bold tracking-[-0.04em] md:text-6xl">Les agences cargo adoptent déjà <span className="text-[#12C76F]">SLAIVIO.</span></h2>
            <p className="mt-4 text-lg text-slate-500">Des résultats concrets. Des agences transformées.</p>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-4">
            {socialStats.map(([value, suffix, label, Icon], index) => (
              <div key={String(label)} data-reveal className="landing-reveal flex gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" style={{ transitionDelay: `${index * 70}ms` }}>
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#E8FFF3] text-[#0B7A45]"><Icon size={25} /></div>
                <div><div className="text-3xl font-bold text-[#0B7A45]"><AnimatedCounter value={value} />{suffix}</div><div className="font-bold">{label}</div></div>
              </div>
            ))}
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
            <div className="rounded-[26px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between"><h3 className="text-xl font-bold">Témoignages</h3><div className="flex gap-2"><SliderButton onClick={() => setTestimonialIndex((testimonialIndex + testimonials.length - 1) % testimonials.length)} label="Précédent">←</SliderButton><SliderButton onClick={() => setTestimonialIndex((testimonialIndex + 1) % testimonials.length)} label="Suivant">→</SliderButton></div></div>
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {testimonials.map(([name, role, agency, quote], index) => (
                  <article key={name} className={`rounded-2xl border border-slate-200 p-5 transition duration-500 ${index === testimonialIndex ? "border-emerald-300 shadow-md" : "opacity-70"}`}>
                    <div className="text-4xl font-black text-[#12C76F]">“</div><p className="min-h-32 text-sm leading-7 text-slate-600">{quote}</p><div className="mt-5 font-bold">{name}</div><div className="text-xs text-slate-500">{role}<br />{agency}</div>
                  </article>
                ))}
              </div>
            </div>
            <div className="rounded-[26px] border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-xl font-bold">Études de cas</h3>
              {["Global Market SARL", "Africa Cargo Express"].map((agency, index) => (
                <div key={agency} className="mt-5 rounded-2xl border border-slate-200 p-5"><div className="font-bold">{agency}</div><div className="mt-1 text-xs text-[#0B7A45]">{index === 0 ? "Dakar, Sénégal" : "Lagos, Nigeria"}</div><div className="mt-4 flex items-center justify-between text-sm"><span>Résultat</span><span className="font-bold text-[#12C76F]">+{index === 0 ? "40" : "35"}%</span></div></div>
              ))}
            </div>
          </div>

          <div className="mt-6 grid gap-3 rounded-[26px] border border-slate-200 bg-white p-5 sm:grid-cols-4 lg:grid-cols-7">
            {countries.map((country, index) => <div key={country} data-reveal className="landing-reveal rounded-xl border border-slate-100 p-4 text-center text-sm font-bold" style={{ transitionDelay: `${index * 55}ms` }}><Globe2 className="mx-auto mb-2 text-[#12C76F]" size={20} />{country}</div>)}
          </div>
        </div>
      </section>

      <section id="pricing" className="relative overflow-hidden bg-[#030a0f] py-24 text-white md:py-32">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(18,199,111,0.18),transparent_28rem),radial-gradient(circle_at_90%_55%,rgba(18,199,111,0.12),transparent_30rem)]" />
        <div className="relative mx-auto max-w-[1180px] px-6">
          <div className="text-center"><Badge dark>Tarification</Badge><h2 className="mx-auto mt-6 max-w-3xl text-4xl font-bold tracking-[-0.04em] md:text-6xl">Choisissez le plan adapté à <span className="text-[#75c557]">votre agence.</span></h2><p className="mt-5 text-lg text-slate-400">Développez votre activité avec le plan correspondant à votre volume d&apos;opérations.</p></div>
          <div className="mt-12 grid gap-4 lg:grid-cols-4">
            {pricing.map((plan, index) => (
              <div key={plan.name} data-reveal className={`landing-pricing-card landing-reveal relative rounded-xl border bg-white/[0.025] p-7 ${plan.highlight ? "border-[#75c557] shadow-[0_0_45px_rgba(117,197,87,0.12)]" : "border-white/20"}`} style={{ transitionDelay: `${index * 80}ms` }}>
                {plan.highlight && <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded bg-[#75c557] px-5 py-2 text-[11px] font-black uppercase text-[#071009]">Le plus populaire</div>}
                <h3 className={`text-2xl font-bold ${plan.highlight ? "text-[#75c557]" : "text-white"}`}>{plan.name}</h3>
                <p className="mt-3 min-h-14 text-sm leading-6 text-slate-400">{plan.founder}</p>
                <div className="mt-7 text-4xl font-bold">{plan.price}<span className="ml-2 text-sm font-medium text-slate-400">/mois</span></div>
                <div className="mt-6 border-t border-white/10 pt-5">
                  {plan.value.map((item) => <div key={item} className="mt-3 flex gap-2 text-xs leading-5 text-slate-200"><Check className="mt-0.5 shrink-0 text-[#75c557]" size={15} />{item}</div>)}
                </div>
                <Link href="/sign-up" className={`landing-button mt-8 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg border text-sm font-bold ${plan.highlight ? "border-[#75c557] bg-[#75c557] text-white" : "border-[#75c557] text-white"}`}>{plan.name === "Enterprise+" ? "Parler à un expert" : "Commencer"}<ArrowRight size={16} /></Link>
              </div>
            ))}
          </div>
          <div className="mt-6 grid gap-5 rounded-xl border border-white/15 bg-white/[0.025] p-6 text-center text-sm text-slate-300 md:grid-cols-3"><div><ShieldCheck className="mx-auto mb-2 text-[#75c557]" />Hébergement sécurisé</div><div><Headphones className="mx-auto mb-2 text-[#75c557]" />Support continu</div><div><BadgeCheck className="mx-auto mb-2 text-[#75c557]" />Formation d&apos;onboarding</div></div>
        </div>
      </section>

      <Section id="faq" title="Questions fréquentes" description="Tout ce que vous devez savoir avant de déployer SLAIVIO." centered>
        <div className="mx-auto max-w-4xl divide-y divide-slate-200 rounded-[30px] border border-slate-200 bg-white">
          {faqs.map(([question, answer], index) => (
            <details key={question} className="group p-6 transition open:bg-emerald-50/40" open={index === 0}>
              <summary className="flex cursor-pointer list-none items-center gap-6 text-lg font-bold">
                <span className="text-[#0B7A45]">{String(index + 1).padStart(2, "0")}</span>
                <span className="flex-1">{question}</span>
                <ChevronDown className="transition group-open:rotate-180" size={20} />
              </summary>
              <p className="ml-12 mt-4 text-base leading-8 text-slate-500">{answer}</p>
            </details>
          ))}
        </div>
      </Section>

      <section id="demo" className="bg-white px-6 py-24">
        <div data-reveal className="landing-cta landing-reveal mx-auto max-w-[1180px] overflow-hidden rounded-[36px] p-10 text-center text-white md:p-16">
          <Image src="/slaivio-mark.png" alt="SLAIVIO" width={64} height={64} className="mx-auto rounded-2xl opacity-90" />
          <h2 className="mx-auto mt-7 max-w-3xl text-4xl font-bold tracking-[-0.04em] md:text-6xl">Prêt à moderniser votre agence cargo ?</h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-emerald-50">Demandez une démonstration personnalisée et découvrez comment SLAIVIO structure vos opérations.</p>
          <div className="mt-9 flex flex-col justify-center gap-4 sm:flex-row">
            <Link href="/sign-up" className="landing-button inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-white px-7 text-sm font-bold text-[#0B7A45]">Réserver une démo <ArrowRight size={17} /></Link>
            <a href="https://wa.me/" className="landing-button inline-flex h-14 items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 px-7 text-sm font-bold text-white"><MessageCircle size={17} /> WhatsApp</a>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#02080d]/90 text-white backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-6 px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/slaivio-mark.png"
            alt="SLAIVIO"
            width={42}
            height={42}
            className="rounded-2xl"
          />
          <div className="text-xl font-bold tracking-tight">SLAIVIO</div>
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-semibold text-slate-200 lg:flex">
          <a href="#features">Fonctionnalités</a>
          <a href="#solutions">Solutions</a>
          <a href="#pricing">Tarifs</a>
          <a href="#faq">Ressources</a>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/sign-in"
            className="hidden text-sm font-bold text-white md:inline-flex"
          >
            Connexion
          </Link>
          <a
            href="#demo"
            className="landing-button inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#12C76F] px-5 text-sm font-bold text-white"
          >
            Demander une démo
            <ArrowRight size={16} />
          </a>
        </div>
      </div>
    </header>
  );
}

function Section({
  id,
  title,
  description,
  centered = false,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  centered?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="bg-white py-24 md:py-32">
      <div className="mx-auto max-w-[1180px] px-6">
        <div className={`mb-14 max-w-3xl ${centered ? "mx-auto text-center" : ""}`}>
          <h2 className="text-4xl font-bold leading-tight tracking-[-0.04em] text-slate-950 md:text-5xl">
            {title}
          </h2>
          {description && (
            <p className="mt-5 text-lg leading-9 text-slate-500">
              {description}
            </p>
          )}
        </div>
        {children}
      </div>
    </section>
  );
}

function Badge({
  children,
  dark = false,
}: {
  children: React.ReactNode;
  dark?: boolean;
}) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] ${
        dark
          ? "border-white/10 bg-white/10 text-emerald-200"
          : "border-emerald-200 bg-[#E8FFF3] text-[#0B7A45]"
      }`}
    >
      <Sparkles size={14} />
      {children}
    </div>
  );
}

function FloatingCard({
  title,
  icon,
  className,
  delay = false,
}: {
  title: string;
  icon: React.ReactNode;
  className: string;
  delay?: boolean;
}) {
  return (
    <div
      className={`absolute hidden items-center gap-3 rounded-2xl border border-white/15 bg-[#071119]/95 px-4 py-3 text-sm font-bold text-white shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur lg:flex ${className} ${
        delay ? "animate-[slaivioFloat_8s_ease-in-out_1.5s_infinite]" : "animate-[slaivioFloat_8s_ease-in-out_infinite]"
      }`}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#12C76F]/20 text-[#12C76F]">
        {icon}
      </div>
      {title}
    </div>
  );
}

function AnimatedCounter({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        const startedAt = performance.now();
        const duration = 1200;

        function update(now: number) {
          const progress = Math.min((now - startedAt) / duration, 1);
          setDisplay(Math.round(value * (1 - Math.pow(1 - progress, 3))));
          if (progress < 1) requestAnimationFrame(update);
        }

        requestAnimationFrame(update);
        observer.disconnect();
      },
      { threshold: 0.4 }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [value]);

  return <span ref={ref}>{display.toLocaleString("fr-FR")}</span>;
}

function SliderButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-emerald-200 text-[#0B7A45] transition hover:bg-[#E8FFF3]"
    >
      {children}
    </button>
  );
}

function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-white/10 bg-[#02080d] py-16 text-white">
      <div className="absolute inset-x-0 bottom-0 h-44 bg-[radial-gradient(ellipse_at_bottom,rgba(18,199,111,0.28),transparent_65%)]" />
      <div className="relative mx-auto grid max-w-[1180px] gap-10 px-6 md:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr_1.25fr]">
        <div>
          <div className="flex items-center gap-3">
            <Image
              src="/slaivio-mark.png"
              alt="SLAIVIO"
              width={42}
              height={42}
              className="rounded-2xl"
            />
            <div className="text-2xl font-bold">SLAIVIO</div>
          </div>
          <p className="mt-5 max-w-sm text-sm leading-7 text-slate-400">La plateforme tout-en-un qui transforme WhatsApp en moteur de croissance pour les agences cargo.</p>
          <div className="mt-6 space-y-3 text-sm text-slate-300"><div className="flex gap-3"><ShieldCheck className="text-[#75c557]" size={18} />Sécurisé et fiable</div><div className="flex gap-3"><Globe2 className="text-[#75c557]" size={18} />Infrastructure cloud</div><div className="flex gap-3"><Headphones className="text-[#75c557]" size={18} />Support dédié</div></div>
        </div>
        <FooterColumn title="Plateforme" links={["Fonctionnalités", "Tarification", "Intégrations", "Sécurité", "Mises à jour"]} />
        <FooterColumn title="Ressources" links={["Documentation", "Guides", "FAQ", "Blog", "Statut système"]} />
        <FooterColumn title="Entreprise" links={["À propos", "Carrières", "Partenaires", "Contact", "Conditions d'utilisation"]} />
        <div><div className="text-sm font-bold uppercase">Restons en contact</div><p className="mt-5 text-sm leading-7 text-slate-400">Recevez nos conseils et actualités pour développer votre agence cargo.</p><input aria-label="Votre email" placeholder="Votre email" className="mt-5 h-14 w-full rounded-lg border border-white/20 bg-transparent px-4 text-sm outline-none focus:border-[#75c557]" /><button className="landing-button mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-[#75c557] text-sm font-bold">S&apos;abonner à la newsletter <ArrowRight size={17} /></button></div>
      </div>
      <div className="relative mx-auto mt-14 flex max-w-[1180px] flex-col items-center justify-between gap-5 border-t border-white/10 px-6 pt-8 text-sm text-slate-400 md:flex-row"><div>Disponible en <strong className="text-white">Français</strong></div><div>© 2026 SLAIVIO. Tous droits réservés.</div><div className="flex gap-3">{[MessageCircle, Globe2, FileText].map((Icon, index) => <a key={index} href="#" className="landing-social flex h-10 w-10 items-center justify-center rounded-full bg-white/5"><Icon size={17} /></a>)}</div></div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: string[];
}) {
  return (
    <div>
      <div className="text-sm font-bold uppercase text-white">{title}</div>
      <div className="mt-4 space-y-3">
        {links.map((link) => (
          <a
            key={link}
            href="#"
            className="landing-footer-link block text-sm font-medium text-slate-400 hover:text-white"
          >
            {link}
          </a>
        ))}
      </div>
    </div>
  );
}
