"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Bot,
  Building2,
  Check,
  ChevronDown,
  CreditCard,
  FileText,
  Globe2,
  Headphones,
  MessageCircle,
  PackageCheck,
  ShieldCheck,
  Sparkles,
  Truck,
  Warehouse,
  type LucideIcon,
} from "lucide-react";

import {
  createDemoRequest,
  createTrialLead,
} from "@/services/landing";

const stats = [
  ["250+", "agences"],
  ["1.2M+", "colis gérés"],
  ["8M+", "conversations"],
  ["95%", "satisfaction"],
];

const trustLogos = [
  "DHL",
  "FedEx",
  "Maersk",
  "Aramex",
  "Chronopost",
  "DP World",
  "Kuehne+Nagel",
];

const problems = [
  "WhatsApp dispersé",
  "Excel partout",
  "Relances oubliées",
  "Colis difficiles à suivre",
  "Données perdues",
  "Manque de visibilité",
  "Trop de tâches manuelles",
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

const features: Array<[string, LucideIcon]> = [
  ["WhatsApp Business", MessageCircle],
  ["IA Cargo", Bot],
  ["Gestion des expéditions", Truck],
  ["Gestion des clients", Building2],
  ["Reporting", BarChart3],
  ["Multi-bureaux", Globe2],
  ["Tracking", PackageCheck],
  ["Gestion des paiements", CreditCard],
  ["Base de connaissances IA", FileText],
];

const steps = [
  "Connexion WhatsApp",
  "Configuration de l'agence",
  "Formation de l'équipe",
  "Automatisation des opérations",
  "Croissance",
];

const pricing = [
  {
    name: "STARTER",
    price: "119$",
    founder: "99$/mois à vie",
    value: "Déploiement inclus, valeur 500$ offerte",
    highlight: false,
  },
  {
    name: "GROWTH",
    price: "299$",
    founder: "249$/mois à vie",
    value: "Déploiement inclus, valeur 1 500$ offerte",
    highlight: true,
  },
  {
    name: "ENTERPRISE",
    price: "799$",
    founder: "649$/mois à vie",
    value: "Déploiement inclus, valeur 5 000$ offerte",
    highlight: false,
  },
  {
    name: "ELITE",
    price: "Sur devis",
    founder: "Architecture dédiée",
    value: "Accompagnement stratégique et déploiement sur mesure",
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

export function LandingPageClient() {
  const [trialEmail, setTrialEmail] = useState("");
  const [demoStatus, setDemoStatus] = useState("");

  async function submitTrialLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (trialEmail.trim()) {
      await createTrialLead({
        email: trialEmail.trim(),
      });
    }

    window.location.href = "/sign-up";
  }

  async function submitDemoRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    await createDemoRequest({
      full_name: String(form.get("full_name") || ""),
      email: String(form.get("email") || ""),
      agency_name: String(form.get("agency_name") || ""),
      phone: String(form.get("phone") || ""),
      country: String(form.get("country") || ""),
      monthly_shipments: String(form.get("monthly_shipments") || ""),
      message: String(form.get("message") || ""),
    });

    setDemoStatus("Demande reçue. Notre équipe vous contacte rapidement.");
    event.currentTarget.reset();
  }

  return (
    <main className="min-h-screen bg-white text-[#111827]">
      <Header />

      <section className="relative overflow-hidden border-b border-slate-100 bg-white">
        <div className="absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(circle_at_20%_10%,rgba(18,199,111,0.14),transparent_32rem)]" />
        <div className="relative mx-auto grid max-w-[1280px] grid-cols-1 gap-16 px-6 py-24 lg:grid-cols-[0.42fr_0.58fr] lg:items-center lg:py-32">
          <div className="max-w-xl">
            <Badge>La plateforme #1 pour les agences cargo</Badge>
            <h1 className="mt-8 text-5xl font-bold leading-[1.05] tracking-[-0.05em] text-slate-950 md:text-7xl">
              L&apos;Operating System des Agences Cargo
            </h1>
            <p className="mt-7 text-lg leading-9 text-slate-600">
              Automatisez vos opérations, centralisez vos données et développez
              votre agence sans augmenter votre charge opérationnelle.
            </p>
            <p className="mt-4 text-base leading-8 text-slate-500">
              Transformez votre agence cargo fonctionnant sur WhatsApp et Excel
              en une entreprise moderne, automatisée et pilotée par la donnée.
            </p>

            <form
              onSubmit={submitTrialLead}
              className="mt-9 flex max-w-xl flex-col gap-3 rounded-[22px] border border-slate-200 bg-white p-2 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:flex-row"
            >
              <input
                value={trialEmail}
                onChange={(event) => setTrialEmail(event.target.value)}
                type="email"
                required
                placeholder="Email professionnel"
                className="min-h-14 flex-1 rounded-2xl px-4 text-sm font-semibold outline-none"
              />
              <button className="inline-flex h-14 items-center justify-center gap-2 rounded-[14px] bg-[#12C76F] px-6 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#0B7A45]">
                Demander une démo
                <ArrowRight size={17} />
              </button>
            </form>

            <div className="mt-4 flex flex-wrap gap-3">
              <a
                href="https://wa.me/"
                className="inline-flex h-14 items-center justify-center gap-2 rounded-[14px] border border-emerald-200 bg-white px-6 text-sm font-bold text-[#0B7A45] transition hover:-translate-y-0.5 hover:bg-[#E8FFF3]"
              >
                <MessageCircle size={17} />
                Parler à un conseiller
              </a>
            </div>

            <div className="mt-10 grid grid-cols-2 gap-5 sm:grid-cols-4">
              {stats.map(([value, label]) => (
                <div key={label}>
                  <div className="text-3xl font-bold tracking-tight text-slate-950">
                    {value}
                  </div>
                  <div className="mt-1 text-sm font-medium text-slate-500">
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="animate-[slaivioReveal_900ms_ease-out] rounded-[32px] border border-slate-200 bg-white p-4 shadow-[0_40px_120px_rgba(15,23,42,0.16)]">
              <div className="overflow-hidden rounded-[24px] border border-slate-100 bg-slate-50">
                <Image
                  src="/landing/dashboard.png"
                  alt="Dashboard SLAIVIO"
                  width={1600}
                  height={900}
                  priority
                  className="h-auto w-full transition duration-700 hover:scale-[1.03]"
                />
              </div>
            </div>
            <FloatingCard className="-left-5 top-14" title="Nouveau colis arrivé" icon={<PackageCheck size={18} />} />
            <FloatingCard className="-right-3 top-48" title="Message WhatsApp traité" icon={<MessageCircle size={18} />} delay />
            <FloatingCard className="bottom-10 left-16" title="Paiement reçu" icon={<CreditCard size={18} />} />
          </div>
        </div>
      </section>

      <section className="border-b border-slate-100 bg-white py-12">
        <div className="mx-auto max-w-[1180px] px-6 text-center">
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-slate-400">
            Références opérationnelles du cargo international
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-12 gap-y-6 text-xl font-bold text-slate-300">
            {trustLogos.map((logo) => (
              <span key={logo}>{logo}</span>
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
            {problems.map((problem, index) => (
              <div
                key={problem}
                className="rounded-2xl border border-red-100 bg-red-50/70 p-4 text-base font-semibold text-red-800"
                style={{ animationDelay: `${index * 80}ms` }}
              >
                {problem}
              </div>
            ))}
          </div>
          <div className="rounded-[32px] border border-slate-200 bg-[#F8FAFC] p-8">
            <div className="grid gap-4">
              {["WhatsApp", "Excel", "Paiements", "Tracking", "Warehouse"].map(
                (item) => (
                  <div
                    key={item}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <span className="font-bold text-slate-700">{item}</span>
                    <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">
                      dispersé
                    </span>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </Section>

      <Section
        id="solutions"
        centered
        title="Imaginez une agence qui fonctionne différemment."
        description="SLAIVIO transforme vos conversations, feuilles Excel et opérations terrain en un flux clair et automatisé."
      >
        <div className="mx-auto mt-4 grid max-w-5xl gap-4 md:grid-cols-6">
          {["WhatsApp + Excel", "Chaos", "SLAIVIO", "Contrôle", "Automatisation", "Croissance"].map(
            (step, index) => (
              <div
                key={step}
                className={`rounded-3xl border p-5 text-center text-sm font-bold ${
                  index >= 2
                    ? "border-emerald-200 bg-[#E8FFF3] text-[#0B7A45]"
                    : "border-slate-200 bg-white text-slate-500"
                }`}
              >
                {step}
              </div>
            )
          )}
        </div>
      </Section>

      <Section
        id="benefits"
        title="Ce que SLAIVIO apporte à votre agence"
      >
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {benefits.map(([title, description]) => (
            <div
              key={title}
              className="rounded-[28px] border border-slate-200 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-[0_24px_70px_rgba(15,23,42,0.10)]"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E8FFF3] text-[#0B7A45]">
                <Check size={20} />
              </div>
              <h3 className="mt-6 text-2xl font-semibold tracking-tight text-slate-950">
                {title}
              </h3>
              <p className="mt-3 text-base leading-8 text-slate-500">
                {description}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section
        id="showcase"
        title="Un tableau de bord pensé pour votre quotidien."
        description="Visualisez tout, décidez plus vite et pilotez votre croissance."
      >
        <div className="grid gap-10 lg:grid-cols-[0.4fr_0.6fr] lg:items-center">
          <div>
            <ul className="space-y-4 text-base font-semibold text-slate-600">
              {[
                "Conversations WhatsApp centralisées",
                "Dossiers et expéditions structurés",
                "Warehouse, douane, paiements et delivery dans un seul flux",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <BadgeCheck size={18} className="text-[#12C76F]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-[32px] border border-slate-200 bg-white p-4 shadow-[0_32px_90px_rgba(15,23,42,0.12)]">
            <Image
              src="/landing/dashboard.png"
              alt="Dashboard SLAIVIO"
              width={1600}
              height={900}
              className="h-auto w-full rounded-[24px] border border-slate-100"
            />
          </div>
        </div>
      </Section>

      <Section id="features" title="Tout ce dont votre agence a besoin.">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {features.map(([title, Icon]) => (
            <div
              key={String(title)}
              className="rounded-[26px] border border-slate-200 bg-white p-6 transition hover:-translate-y-1 hover:shadow-xl"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
                <Icon size={19} />
              </div>
              <h3 className="mt-5 text-xl font-semibold tracking-tight">
                {title}
              </h3>
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
          <div className="absolute left-0 right-0 top-8 hidden h-1 bg-[#E8FFF3] md:block" />
          {steps.map((step, index) => (
            <div key={step} className="relative rounded-[24px] border border-slate-200 bg-white p-5 text-center shadow-sm">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#12C76F] text-sm font-bold text-white">
                {index + 1}
              </div>
              <div className="mt-4 text-sm font-bold text-slate-700">
                {step}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <section className="bg-[#F8FAFC] py-24 md:py-32">
        <div className="mx-auto max-w-[1180px] px-6">
          <div className="grid gap-5 md:grid-cols-4">
            {stats.map(([value, label]) => (
              <div key={label} className="rounded-[28px] border border-slate-200 bg-white p-7">
                <div className="text-5xl font-bold tracking-tight">{value}</div>
                <div className="mt-2 font-semibold text-slate-500">{label}</div>
              </div>
            ))}
          </div>
          <div className="mt-8 rounded-[32px] border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
            Les témoignages et études de cas vérifiés seront publiés après les
            premiers déploiements Founding Partners.
          </div>
        </div>
      </section>

      <section className="bg-[#0B7A45] py-24 text-white md:py-32">
        <div className="mx-auto max-w-[1180px] px-6 text-center">
          <h2 className="text-4xl font-bold tracking-tight md:text-6xl">
            Accompagnement jusqu&apos;à l&apos;adoption réelle.
          </h2>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-9 text-emerald-50">
            Nous ne vendons pas simplement un logiciel. Nous vous accompagnons
            jusqu&apos;à ce que votre équipe l&apos;utilise réellement dans ses
            opérations quotidiennes.
          </p>
          <div className="mt-12 grid gap-4 md:grid-cols-5">
            {["Déploiement", "Formation", "Configuration", "Support", "Adoption"].map(
              (item) => (
                <div key={item} className="rounded-2xl border border-white/15 bg-white/10 p-5 font-bold">
                  {item}
                </div>
              )
            )}
          </div>
        </div>
      </section>

      <Section
        id="founding"
        title="Programme Founding Partners"
        description="Réservé aux 10 premières agences cargo qui veulent participer à la construction du premier Operating System dédié aux agences cargo africaines."
      >
        <div className="rounded-[36px] bg-slate-950 p-8 text-white md:p-12">
          <div className="grid gap-8 lg:grid-cols-[0.7fr_0.3fr] lg:items-center">
            <div>
              <Badge dark>Places restantes : 10</Badge>
              <h3 className="mt-6 text-4xl font-bold tracking-tight">
                Devenez agence fondatrice SLAIVIO.
              </h3>
              <div className="mt-8 grid gap-4 md:grid-cols-2">
                {[
                  "Tarif fondateur à vie",
                  "Accompagnement prioritaire",
                  "Accès anticipé",
                  "Participation à la roadmap",
                  "Badge Founding Partner",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3 text-sm font-bold text-slate-200">
                    <Check size={17} className="text-[#12C76F]" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <a
              href="#demo"
              className="inline-flex h-14 items-center justify-center rounded-[14px] bg-[#12C76F] px-6 text-sm font-bold text-white transition hover:scale-[1.02]"
            >
              Rejoindre le programme
            </a>
          </div>
        </div>
      </Section>

      <Section id="pricing" title="Tarification">
        <div className="grid gap-5 lg:grid-cols-4">
          {pricing.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-[30px] border p-7 ${
                plan.highlight
                  ? "border-[#12C76F] bg-[#E8FFF3] shadow-[0_24px_70px_rgba(18,199,111,0.18)]"
                  : "border-slate-200 bg-white"
              }`}
            >
              <div className="text-sm font-bold uppercase tracking-[0.18em] text-[#0B7A45]">
                {plan.name}
              </div>
              <div className="mt-5 text-4xl font-bold tracking-tight">
                {plan.price}
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-500">
                /mois
              </div>
              <p className="mt-6 min-h-16 text-sm leading-7 text-slate-600">
                {plan.value}
              </p>
              <div className="mt-6 rounded-2xl bg-white/70 p-4 text-sm font-bold text-[#0B7A45]">
                Offre fondateur : {plan.founder}
              </div>
              <Link
                href="/sign-up"
                className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-[14px] bg-slate-950 text-sm font-bold text-white"
              >
                Commencer
              </Link>
            </div>
          ))}
        </div>
      </Section>

      <Section id="faq" title="Questions fréquentes">
        <div className="mx-auto max-w-4xl divide-y divide-slate-200 rounded-[30px] border border-slate-200 bg-white">
          {faqs.map(([question, answer]) => (
            <details key={question} className="group p-6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-lg font-bold">
                {question}
                <ChevronDown className="transition group-open:rotate-180" size={20} />
              </summary>
              <p className="mt-4 text-base leading-8 text-slate-500">{answer}</p>
            </details>
          ))}
        </div>
      </Section>

      <section id="demo" className="px-6 pb-24">
        <div className="mx-auto max-w-[1180px] rounded-[42px] bg-[linear-gradient(135deg,#0B7A45,#12C76F)] p-8 text-white md:p-14">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <h2 className="text-4xl font-bold tracking-tight md:text-6xl">
                Prêt à moderniser votre agence cargo ?
              </h2>
              <p className="mt-6 text-lg leading-9 text-emerald-50">
                Demandez une démonstration personnalisée et voyons comment
                SLAIVIO peut structurer vos opérations.
              </p>
              <a
                href="https://wa.me/"
                className="mt-8 inline-flex h-14 items-center justify-center rounded-[14px] border border-white/20 bg-white/10 px-6 text-sm font-bold text-white"
              >
                WhatsApp
              </a>
            </div>

            <form
              onSubmit={submitDemoRequest}
              className="rounded-[30px] bg-white p-6 text-slate-950 shadow-2xl"
            >
              <h3 className="text-2xl font-bold">Réserver une démo</h3>
              <div className="mt-6 grid gap-3 md:grid-cols-2">
                <Input name="full_name" label="Nom complet" required />
                <Input name="email" label="Email" type="email" required />
                <Input name="agency_name" label="Agence" />
                <Input name="phone" label="WhatsApp" />
                <Input name="country" label="Pays" />
                <Input name="monthly_shipments" label="Colis par mois" />
              </div>
              <label className="mt-3 block">
                <span className="text-sm font-bold text-slate-700">Message</span>
                <textarea
                  name="message"
                  className="mt-2 min-h-[110px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#12C76F] focus:ring-4 focus:ring-emerald-100"
                />
              </label>
              <button className="mt-4 h-14 w-full rounded-[14px] bg-slate-950 text-sm font-bold text-white">
                Envoyer la demande
              </button>
              {demoStatus && (
                <div className="mt-4 rounded-2xl bg-[#E8FFF3] p-3 text-sm font-bold text-[#0B7A45]">
                  {demoStatus}
                </div>
              )}
            </form>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-6 px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/slaivio-mark.png"
            alt="SLAIVIO"
            width={42}
            height={42}
            className="rounded-2xl"
          />
          <div>
            <div className="text-xl font-bold tracking-tight">SLAIVIO</div>
            <div className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#12C76F]">
              Cargo OS
            </div>
          </div>
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-semibold text-slate-600 lg:flex">
          <a href="#features">Fonctionnalités</a>
          <a href="#solutions">Solutions</a>
          <a href="#pricing">Tarifs</a>
          <a href="#faq">Ressources</a>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/sign-in"
            className="hidden text-sm font-bold text-slate-700 md:inline-flex"
          >
            Connexion
          </Link>
          <a
            href="#demo"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-[14px] bg-slate-950 px-5 text-sm font-bold text-white transition hover:-translate-y-0.5"
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
      className={`absolute hidden items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 shadow-[0_20px_60px_rgba(15,23,42,0.16)] lg:flex ${className} ${
        delay ? "animate-[slaivioFloat_8s_ease-in-out_1.5s_infinite]" : "animate-[slaivioFloat_8s_ease-in-out_infinite]"
      }`}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E8FFF3] text-[#0B7A45]">
        {icon}
      </div>
      {title}
    </div>
  );
}

function Input({
  name,
  label,
  type = "text",
  required = false,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-700">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none focus:border-[#12C76F] focus:ring-4 focus:ring-emerald-100"
      />
    </label>
  );
}

function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white py-12">
      <div className="mx-auto grid max-w-[1180px] gap-10 px-6 md:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr]">
        <div>
          <div className="flex items-center gap-3">
            <Image
              src="/slaivio-mark.png"
              alt="SLAIVIO"
              width={42}
              height={42}
              className="rounded-2xl"
            />
            <div>
              <div className="font-bold">SLAIVIO</div>
              <div className="text-xs font-bold uppercase tracking-[0.22em] text-[#12C76F]">
                Cargo OS
              </div>
            </div>
          </div>
          <p className="mt-5 max-w-sm text-sm leading-7 text-slate-500">
            L&apos;Operating System des agences cargo modernes.
          </p>
          <p className="mt-4 text-sm font-semibold text-slate-500">
            Copyright SLAIVIO
          </p>
        </div>
        <FooterColumn title="Contact" links={["Email", "WhatsApp", "Site Web"]} />
        <FooterColumn title="Réseaux" links={["LinkedIn", "Facebook", "YouTube"]} />
        <FooterColumn title="Légal" links={["Politique de confidentialité", "Conditions d'utilisation"]} />
      </div>
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
      <div className="text-sm font-bold text-slate-950">{title}</div>
      <div className="mt-4 space-y-3">
        {links.map((link) => (
          <a
            key={link}
            href="#"
            className="block text-sm font-semibold text-slate-500 hover:text-slate-950"
          >
            {link}
          </a>
        ))}
      </div>
    </div>
  );
}
