"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { FormEvent, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  ChevronDown,
  FileText,
  Facebook,
  Globe2,
  Headphones,
  Linkedin,
  Mail,
  MessageCircle,
  ShieldCheck,
  Youtube,
} from "lucide-react";

import { createDemoRequest } from "@/services/landing";

const official = "/landing/official";

const pricing = [
  {
    name: "Starter",
    price: "119$",
    description: "Idéal pour les petites agences qui débutent.",
    features: [
      "1 utilisateur inclus",
      "Jusqu'à 500 conversations WhatsApp",
      "Gestion des expéditions",
      "Gestion des clients",
      "Reporting de base",
      "Support par WhatsApp",
    ],
  },
  {
    name: "Growth",
    price: "299$",
    description: "Parfait pour les agences en pleine croissance.",
    popular: true,
    features: [
      "5 utilisateurs inclus",
      "Jusqu'à 2 500 conversations WhatsApp",
      "Toutes les fonctionnalités Starter",
      "IA Cargo & automatisations",
      "Relances automatiques",
      "Support prioritaire",
    ],
  },
  {
    name: "Enterprise",
    price: "799$",
    description: "Pour les agences établies qui veulent aller plus loin.",
    features: [
      "10 utilisateurs inclus",
      "Jusqu'à 10 000 conversations WhatsApp",
      "Toutes les fonctionnalités Growth",
      "Multi-bureaux & équipes",
      "Gestion des paiements",
      "Support prioritaire 24/7",
    ],
  },
  {
    name: "Enterprise+",
    price: "Sur devis",
    description: "Pour les groupes cargo, transitaires et agences multi-pays.",
    features: [
      "Utilisateurs illimités",
      "Conversations WhatsApp illimitées",
      "Intégrations spécifiques",
      "Déploiement multi-pays",
      "SLA premium",
      "Account Manager dédié",
    ],
  },
];

const faqs = [
  [
    "SLAIVIO est-il réservé aux grandes agences ?",
    "Non. SLAIVIO est conçu aussi bien pour les petites agences que pour les groupes cargo opérant dans plusieurs pays.",
  ],
  [
    "Dois-je avoir un compte WhatsApp Business ?",
    "Oui. SLAIVIO utilise la connexion officielle WhatsApp Business de Meta et vous accompagne pendant sa configuration.",
  ],
  [
    "Mes données sont-elles sécurisées ?",
    "Oui. Les accès, les organisations et les rôles sont séparés, et les échanges sont protégés en production.",
  ],
  [
    "Combien de temps faut-il pour démarrer ?",
    "L'onboarding guidé permet de configurer l'agence, l'équipe et WhatsApp étape par étape.",
  ],
  [
    "Puis-je gérer plusieurs bureaux ?",
    "Oui. La plateforme est pensée pour les opérations multi-bureaux, multi-numéros et multi-pays.",
  ],
  [
    "SLAIVIO remplace-t-il WhatsApp ?",
    "Non. SLAIVIO connecte WhatsApp à vos opérations afin de centraliser les conversations et automatiser le travail.",
  ],
  [
    "Puis-je suivre mes expéditions et mes colis ?",
    "Oui. Les expéditions, statuts, clients, paiements et événements opérationnels sont réunis dans la plateforme.",
  ],
  [
    "Puis-je changer de plan plus tard ?",
    "Oui. Votre plan peut évoluer avec le volume et les besoins de votre agence.",
  ],
];

const testimonials = [
  {
    quote:
      "SLAIVIO a complètement transformé notre façon de travailler. Nous avons gagné en visibilité et en productivité.",
    name: "Abidjan M. KOFFI",
    role: "Directeur Général",
    agency: "Abidjan Cargo Services",
  },
  {
    quote:
      "Grâce à l'automatisation WhatsApp et au suivi des expéditions, nous répondons plus vite et ne manquons plus aucune relance.",
    name: "Awa TRAORE",
    role: "Responsable des Opérations",
    agency: "Global Express",
  },
  {
    quote:
      "Le reporting et la centralisation des données nous permettent de prendre de meilleures décisions plus rapidement.",
    name: "Bintou DIALLO",
    role: "CEO",
    agency: "Bintou Cargo",
  },
];

const countries = ["RDC", "Cameroun", "Côte d'Ivoire", "Ghana", "Kenya", "Zimbabwe", "Sénégal"];
const countryFlags = ["🇨🇩", "🇨🇲", "🇨🇮", "🇬🇭", "🇰🇪", "🇿🇼", "🇸🇳"];

const operationalProblems = [
  ["WhatsApp dispersé", "Les conversations sont éparpillées et difficiles à retrouver."],
  ["Excel partout", "Les données sont réparties dans plusieurs fichiers, sources d'erreurs."],
  ["Relances oubliées", "Les suivis manuels entraînent des retards et des opportunités perdues."],
  ["Colis difficiles à suivre", "Les équipes manquent de visibilité sur les statuts en temps réel."],
  ["Trop de tâches manuelles", "Les opérations répétitives ralentissent la croissance de l'agence."],
];

export function LandingPageClient() {
  const [testimonialIndex, setTestimonialIndex] = useState(0);
  const [locale, setLocale] = useState<"fr" | "en">("fr");
  const reduceMotion = useReducedMotion();

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
      { threshold: 0.12 }
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <main className="min-h-screen overflow-x-hidden bg-white text-[#07111f]">
      <Header locale={locale} onLocaleChange={setLocale} />

      <section className="relative overflow-hidden bg-[#02080d] pb-28 pt-20 text-white md:pt-28">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_48%,rgba(0,206,103,0.20),transparent_38rem),linear-gradient(rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:auto,44px_44px,44px_44px]" />
        <div className="relative mx-auto max-w-[1240px] px-5 text-center md:px-8">
          <motion.h1
            initial={reduceMotion ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: "easeOut" }}
            className="mx-auto max-w-4xl text-5xl font-bold leading-[1.04] tracking-[-0.055em] md:text-7xl"
          >
            {locale === "fr" ? "L'Operating System" : "The Operating System"}
            <span className="block">
              {locale === "fr" ? "des" : "for"} <span className="text-[#12C76F]">{locale === "fr" ? "Agences Cargo" : "Cargo Agencies"}</span>
            </span>
          </motion.h1>
          <p
            data-reveal
            className="landing-reveal mx-auto mt-7 max-w-2xl text-lg leading-8 text-slate-300"
          >
            {locale === "fr"
              ? "Automatisez vos opérations, centralisez vos données et développez votre agence sans augmenter votre charge opérationnelle."
              : "Automate operations, centralize data and grow your agency without increasing its operational workload."}
          </p>
          <p
            data-reveal
            className="landing-reveal mx-auto mt-3 max-w-3xl leading-7 text-slate-400"
          >
            {locale === "fr"
              ? "Transformez votre agence cargo fonctionnant sur WhatsApp et Excel en une entreprise moderne, automatisée et pilotée par la donnée."
              : "Turn a cargo agency running on WhatsApp and Excel into a modern, automated and data-driven company."}
          </p>
          <div
            data-reveal
            className="landing-reveal mt-9 flex flex-col justify-center gap-4 sm:flex-row"
          >
            <a
              href="#demo"
              className="landing-button inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-[#00C96B] px-7 text-sm font-bold text-white shadow-[0_16px_50px_rgba(0,201,107,0.30)]"
            >
              {locale === "fr" ? "Demander une démo" : "Request a demo"} <ArrowRight size={17} />
            </a>
            <a
              href="#contact"
              className="landing-button inline-flex h-14 items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/[0.04] px-7 text-sm font-bold text-white"
            >
              <MessageCircle size={17} /> {locale === "fr" ? "Parler à un conseiller" : "Talk to an advisor"}
            </a>
          </div>

          <div className="relative mx-auto mt-12 max-w-[1060px] pb-16 lg:pb-32">
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="overflow-hidden rounded-[28px] border border-emerald-400/25 bg-[#061018] p-2 shadow-[0_0_100px_rgba(0,201,107,0.24)]"
            >
              <Image
                src={`${official}/hero-dashboard.png`}
                alt="Tableau de bord SLAIVIO présenté dans la maquette officielle"
                width={1536}
                height={1024}
                priority
                className="h-auto w-full rounded-[22px]"
              />
            </motion.div>
            <OfficialFloatingCard
              src={`${official}/card-package.png`}
              alt="Nouveau colis reçu"
              className="-left-14 bottom-10"
            />
            <OfficialFloatingCard
              src={`${official}/card-whatsapp.png`}
              alt="Message WhatsApp traité"
              className="bottom-0 left-[34%]"
              delay
            />
            <OfficialFloatingCard
              src={`${official}/card-arrival.png`}
              alt="Expédition arrivée"
              className="-right-14 bottom-12"
            />
          </div>
        </div>
      </section>

      <ExactVisualSection
        id="features"
        src={`${official}/features.png`}
        alt="Fonctionnalités principales de SLAIVIO selon la maquette officielle"
      />

      <ExactVisualSection
        id="how-it-works"
        src={`${official}/how-it-works.png`}
        alt="Mise en place simple et rapide de SLAIVIO selon la maquette officielle"
        muted
      />

      <ProblemSection />

      <section id="transformation" className="bg-[#f8fbf9] py-24">
        <div className="mx-auto max-w-[1240px] px-5 md:px-8">
          <SectionHeading
            eyebrow="La transformation"
            title="Imaginez une agence qui fonctionne différemment."
            description="Passez d'opérations dispersées à une organisation moderne, centralisée et automatisée."
          />
          <div className="mt-14 grid gap-8 lg:grid-cols-[0.85fr_0.8fr_1.15fr] lg:items-center">
            <div data-reveal className="landing-reveal rounded-[28px] border border-red-100 bg-white p-7 shadow-sm">
              <div className="text-lg font-bold text-red-600">Avant SLAIVIO</div>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                WhatsApp, Excel et téléphone dispersent les informations et
                rendent les relances, le suivi et les décisions plus difficiles.
              </p>
            </div>
            <div className="space-y-3">
              {["Chaos", "SLAIVIO", "Contrôle", "Automatisation", "Croissance"].map(
                (step, index) => (
                  <div
                    key={step}
                    data-reveal
                    className={`landing-reveal rounded-2xl border p-4 text-center text-sm font-bold ${
                      index === 0
                        ? "border-red-100 bg-red-50 text-red-600"
                        : "border-emerald-200 bg-white text-[#078d48]"
                    }`}
                    style={{ transitionDelay: `${index * 90}ms` }}
                  >
                    {step}
                  </div>
                )
              )}
            </div>
            <div data-reveal className="landing-reveal rounded-[28px] border border-emerald-100 bg-white p-4 shadow-xl">
              <div className="mb-4 flex items-center gap-2 px-2 font-bold text-[#078d48]">
                <BadgeCheck size={19} /> Avec SLAIVIO
              </div>
              <Image
                src={`${official}/hero-dashboard.png`}
                alt="Opérations centralisées avec SLAIVIO"
                width={1536}
                height={1024}
                className="h-auto w-full rounded-2xl"
              />
            </div>
          </div>
        </div>
      </section>

      <section id="dashboard" className="bg-white py-24">
        <div className="mx-auto max-w-[1240px] px-5 md:px-8">
          <SectionHeading
            eyebrow="Dashboard & opérations"
            title="Un tableau de bord pensé pour votre quotidien."
            description="Dashboard, tracking, inbox WhatsApp, expéditions et analytics réunis dans une seule plateforme."
          />
          <div
            data-reveal
            className="landing-dashboard-reveal mt-12 rounded-[30px] border border-slate-200 bg-white p-3 shadow-[0_32px_90px_rgba(15,23,42,0.12)]"
          >
            <div className="grid overflow-hidden rounded-[24px] border border-slate-100 bg-[#f8faf9] lg:grid-cols-[230px_1fr]">
              <aside className="border-b border-slate-200 bg-[#020807] p-5 text-white lg:border-b-0 lg:border-r">
                <div className="mb-6 flex items-center gap-3">
                  <Image src="/slaivio-mark.png" alt="" width={34} height={34} className="rounded-lg" />
                  <span className="font-bold">SLAIVIO</span>
                </div>
                <nav aria-label="Menu du dashboard SLAIVIO" className="grid grid-cols-2 gap-1 text-xs text-white/65 sm:grid-cols-3 lg:grid-cols-1">
                  {["Dashboard", "Clients", "Dossiers", "Colis", "Expéditions", "Tracking", "WhatsApp Inbox", "Entrepôts", "Tarification", "Paramètres"].map((item, index) => (
                    <div key={item} className={`rounded-lg px-3 py-2.5 ${index === 0 ? "bg-[#12C76F] font-bold text-white" : ""}`}>{item}</div>
                  ))}
                </nav>
              </aside>
              <Image
                src={`${official}/hero-dashboard.png`}
                alt="Dashboard et opérations SLAIVIO"
                width={1536}
                height={1024}
                className="h-full w-full object-cover"
              />
            </div>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {["Dashboard", "Tracking", "Inbox WhatsApp", "Shipments", "Analytics"].map(
              (item, index) => (
                <div
                  key={item}
                  data-reveal
                  className="landing-card landing-reveal rounded-2xl border border-slate-200 bg-white p-5 text-center text-sm font-bold shadow-sm"
                  style={{ transitionDelay: `${index * 70}ms` }}
                >
                  <Check className="mx-auto mb-3 text-[#00A957]" size={20} />
                  {item}
                </div>
              )
            )}
          </div>
        </div>
      </section>

      <section id="social-proof" className="bg-[#f8fbf9] py-24">
        <div className="mx-auto max-w-[1240px] px-5 md:px-8">
          <SectionHeading
            eyebrow="Preuves sociales"
            title="Les agences cargo adoptent déjà SLAIVIO."
            description="Des résultats concrets. Des agences transformées."
          />
          <div className="mt-12 grid gap-4 md:grid-cols-4">
            {[
              [250, "+", "Agences"],
              [1200000, "+", "Colis gérés"],
              [8000000, "+", "Conversations automatisées"],
              [95, "%", "Satisfaction client"],
            ].map(([value, suffix, label], index) => (
              <div
                key={String(label)}
                data-reveal
                className="landing-reveal rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                style={{ transitionDelay: `${index * 70}ms` }}
              >
                <div className="text-3xl font-bold text-[#079348]">
                  <AnimatedCounter value={Number(value)} />
                  {suffix}
                </div>
                <div className="mt-2 font-bold">{label}</div>
              </div>
            ))}
          </div>
          <div className="mt-8 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-xl font-bold">Témoignages</h3>
              <div className="flex gap-2">
                <SliderButton
                  label="Témoignage précédent"
                  onClick={() =>
                    setTestimonialIndex(
                      (testimonialIndex + testimonials.length - 1) % testimonials.length
                    )
                  }
                >
                  ←
                </SliderButton>
                <SliderButton
                  label="Témoignage suivant"
                  onClick={() =>
                    setTestimonialIndex((testimonialIndex + 1) % testimonials.length)
                  }
                >
                  →
                </SliderButton>
              </div>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {testimonials.map((testimonial, index) => (
                <article
                  key={testimonial.name}
                  className={`rounded-2xl border p-6 transition duration-500 ${
                    index === testimonialIndex
                      ? "border-emerald-300 shadow-md"
                      : "border-slate-200 opacity-70"
                  }`}
                >
                  <div className="text-4xl font-black text-[#00A957]">“</div>
                  <p className="min-h-32 text-sm leading-7 text-slate-600">
                    {testimonial.quote}
                  </p>
                  <div className="mt-5 font-bold">{testimonial.name}</div>
                  <div className="text-xs leading-5 text-slate-500">
                    {testimonial.role}
                    <br />
                    {testimonial.agency}
                  </div>
                </article>
              ))}
            </div>
          </div>
          <div className="mt-6 grid gap-3 rounded-[26px] border border-slate-200 bg-white p-5 sm:grid-cols-4 lg:grid-cols-7">
            {countries.map((country, index) => (
              <div
                key={country}
                data-reveal
                className="landing-reveal rounded-xl border border-slate-100 p-4 text-center text-sm font-bold"
                style={{ transitionDelay: `${index * 55}ms` }}
              >
                <span className="mb-2 block text-2xl" aria-hidden="true">{countryFlags[index]}</span>
                {country}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="relative overflow-hidden bg-[#02080d] py-24 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(0,201,107,0.18),transparent_28rem),radial-gradient(circle_at_90%_55%,rgba(0,201,107,0.12),transparent_30rem)]" />
        <div className="relative mx-auto max-w-[1240px] px-5 md:px-8">
          <SectionHeading
            eyebrow="Tarification"
            title="Choisissez le plan adapté à votre agence."
            description="Développez votre activité avec le plan correspondant à votre volume d'opérations."
            dark
          />
          <div className="mt-12 grid gap-4 lg:grid-cols-4">
            {pricing.map((plan, index) => (
              <div
                key={plan.name}
                data-reveal
                className={`landing-pricing-card landing-reveal relative rounded-xl border bg-white/[0.025] p-7 ${
                  plan.popular
                    ? "border-[#75c557] shadow-[0_0_45px_rgba(117,197,87,0.12)]"
                    : "border-white/20"
                }`}
                style={{ transitionDelay: `${index * 80}ms` }}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded bg-[#75c557] px-5 py-2 text-[11px] font-black uppercase text-[#071009]">
                    Le plus populaire
                  </div>
                )}
                <h3 className={`text-2xl font-bold ${plan.popular ? "text-[#75c557]" : ""}`}>
                  {plan.name}
                </h3>
                <p className="mt-3 min-h-14 text-sm leading-6 text-slate-400">
                  {plan.description}
                </p>
                <div className="mt-7 text-4xl font-bold">
                  {plan.price}
                  {plan.name !== "Enterprise+" && (
                    <span className="ml-2 text-sm font-medium text-slate-400">/mois</span>
                  )}
                </div>
                <div className="mt-6 border-t border-white/10 pt-5">
                  {plan.features.map((feature) => (
                    <div key={feature} className="mt-3 flex gap-2 text-xs leading-5 text-slate-200">
                      <Check className="mt-0.5 shrink-0 text-[#75c557]" size={15} />
                      {feature}
                    </div>
                  ))}
                </div>
                <a
                  href="#demo"
                  className={`landing-button mt-8 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg border text-sm font-bold ${
                    plan.popular
                      ? "border-[#75c557] bg-[#75c557]"
                      : "border-[#75c557]"
                  }`}
                >
                  {plan.name === "Enterprise+" ? "Parler à un expert" : "Commencer"}
                  <ArrowRight size={16} />
                </a>
              </div>
            ))}
          </div>
          <div className="mt-6 grid gap-5 rounded-xl border border-white/15 bg-white/[0.025] p-6 text-center text-sm text-slate-300 md:grid-cols-3">
            <div><ShieldCheck className="mx-auto mb-2 text-[#75c557]" />Hébergement sécurisé</div>
            <div><Headphones className="mx-auto mb-2 text-[#75c557]" />Support continu</div>
            <div><BadgeCheck className="mx-auto mb-2 text-[#75c557]" />Formation d&apos;onboarding</div>
          </div>
        </div>
      </section>

      <section id="faq" className="bg-white py-24">
        <div className="mx-auto max-w-[1040px] px-5 md:px-8">
          <SectionHeading
            eyebrow="FAQ"
            title="Questions fréquentes"
            description="Tout ce que vous devez savoir avant de déployer SLAIVIO."
          />
          <div className="mt-12 overflow-hidden rounded-[24px] border border-slate-200 bg-white">
            {faqs.map(([question, answer], index) => (
              <details
                key={question}
                className="group border-b border-slate-200 p-6 transition last:border-0 open:bg-emerald-50/40"
                open={index === 0}
              >
                <summary className="flex cursor-pointer list-none items-center gap-6 text-lg font-bold">
                  <span className="text-[#078d48]">{String(index + 1).padStart(2, "0")}</span>
                  <span className="flex-1">{question}</span>
                  <ChevronDown className="transition group-open:rotate-180" size={20} />
                </summary>
                <p className="ml-12 mt-4 text-base leading-8 text-slate-600">{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <DemoSection />
      <Footer />
    </main>
  );
}

function Header({
  locale,
  onLocaleChange,
}: {
  locale: "fr" | "en";
  onLocaleChange: (locale: "fr" | "en") => void;
}) {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#02080d]/90 text-white backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-5 px-5 py-4 md:px-8">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/slaivio-mark.png" alt="SLAIVIO" width={42} height={42} className="rounded-xl" />
          <span className="text-xl font-bold tracking-tight">SLAIVIO</span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-semibold text-slate-200 lg:flex">
          <a href="#features">Fonctionnalités</a>
          <a href="#transformation">Solutions</a>
          <a href="#pricing">Tarifs</a>
          <a href="#faq">Ressources</a>
        </nav>
        <div className="flex items-center gap-4">
          <div role="group" className="hidden items-center rounded-lg border border-white/10 bg-white/[0.04] p-1 text-xs font-bold sm:flex" aria-label="Choisir la langue">
            <button type="button" aria-pressed={locale === "fr"} onClick={() => onLocaleChange("fr")} className={`rounded-md px-2 py-1.5 ${locale === "fr" ? "bg-white text-[#020807]" : "text-white/65"}`}>FR</button>
            <span className="text-white/20">|</span>
            <button type="button" aria-pressed={locale === "en"} onClick={() => onLocaleChange("en")} className={`rounded-md px-2 py-1.5 ${locale === "en" ? "bg-white text-[#020807]" : "text-white/65"}`}>EN</button>
          </div>
          <Link href="/sign-in" className="hidden text-sm font-bold sm:inline-flex">Connexion</Link>
          <a href="#demo" className="landing-button inline-flex h-11 items-center gap-2 rounded-lg bg-[#00C96B] px-4 text-sm font-bold">
            Demander une démo <ArrowRight size={15} />
          </a>
        </div>
      </div>
    </header>
  );
}

function ProblemSection() {
  return (
    <section id="problem" className="border-t border-slate-100 bg-white py-24">
      <div className="mx-auto grid max-w-[1240px] gap-12 px-5 md:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <div className="inline-flex rounded-full border border-red-200 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-red-600">Le problème</div>
          <h2 className="mt-6 text-4xl font-bold leading-tight tracking-[-0.045em] md:text-6xl">
            Votre agence grandit, mais vos opérations deviennent plus difficiles à gérer.
          </h2>
          <p className="mt-5 text-lg leading-8 text-slate-500">
            Entre WhatsApp, Excel et les tâches manuelles, vos équipes perdent du temps et de la visibilité.
          </p>
          <div className="mt-8 space-y-3">
            {operationalProblems.map(([title, description], index) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.45, delay: index * 0.07 }}
                className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 font-bold text-red-500" aria-hidden="true">×</span>
                <span>
                  <strong className="block text-slate-950">{title}</strong>
                  <span className="mt-1 block text-sm leading-6 text-slate-500">{description}</span>
                </span>
              </motion.div>
            ))}
          </div>
        </div>
        <motion.figure
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="relative min-h-[430px] overflow-hidden rounded-[30px] bg-slate-100 shadow-[0_28px_80px_rgba(15,23,42,0.12)] md:min-h-[620px]"
        >
          <Image
            src="/landing/real-cargo-team.jpg"
            alt="Une équipe professionnelle travaillant ensemble dans un bureau"
            fill
            sizes="(max-width: 1024px) 100vw, 55vw"
            className="object-cover"
          />
          <figcaption className="absolute inset-x-5 bottom-5 rounded-2xl border border-white/25 bg-[#020807]/80 p-5 text-sm leading-6 text-white backdrop-blur-md">
            Des informations dispersées ralentissent les équipes et rendent chaque décision plus difficile.
          </figcaption>
        </motion.figure>
      </div>
    </section>
  );
}

function ExactVisualSection({
  id,
  src,
  alt,
  muted = false,
}: {
  id: string;
  src: string;
  alt: string;
  muted?: boolean;
}) {
  return (
    <section id={id} className={`py-10 md:py-16 ${muted ? "bg-[#f8fbf9]" : "bg-white"}`}>
      <div className="mx-auto max-w-[1536px] px-2 md:px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.65, ease: "easeOut" }}
          className="overflow-hidden rounded-[18px] bg-white"
        >
          <Image src={src} alt={alt} width={1536} height={1024} sizes="100vw" className="h-auto w-full" />
        </motion.div>
      </div>
    </section>
  );
}

function OfficialFloatingCard({
  src,
  alt,
  className,
  delay = false,
}: {
  src: string;
  alt: string;
  className: string;
  delay?: boolean;
}) {
  return (
    <motion.div
      animate={{ y: delay ? [0, 8, 0] : [0, -8, 0] }}
      transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: delay ? 1.5 : 0 }}
      className={`absolute hidden w-[270px] overflow-hidden rounded-[28px] shadow-[0_24px_65px_rgba(0,0,0,0.38)] lg:block ${className}`}
    >
      <Image src={src} alt={alt} width={1536} height={1024} className="h-auto w-full" />
    </motion.div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  dark = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  dark?: boolean;
}) {
  return (
    <div className="mx-auto max-w-4xl text-center">
      <div className={`inline-flex rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] ${dark ? "border-emerald-400/30 text-emerald-300" : "border-emerald-200 text-[#078d48]"}`}>
        {eyebrow}
      </div>
      <h2 className={`mt-6 text-4xl font-bold tracking-[-0.045em] md:text-6xl ${dark ? "text-white" : "text-[#07111f]"}`}>
        {title}
      </h2>
      <p className={`mx-auto mt-5 max-w-3xl text-lg leading-8 ${dark ? "text-slate-400" : "text-slate-500"}`}>
        {description}
      </p>
    </div>
  );
}

function DemoSection() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setStatus("loading");

    try {
      await createDemoRequest({
        full_name: String(data.get("full_name") || ""),
        email: String(data.get("email") || ""),
        agency_name: String(data.get("agency_name") || ""),
        phone: String(data.get("phone") || ""),
        country: String(data.get("country") || ""),
        monthly_shipments: String(data.get("monthly_shipments") || ""),
        message: String(data.get("message") || ""),
      });
      form.reset();
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  return (
    <section id="demo" className="border-t border-slate-100 bg-white px-5 py-24 md:px-8">
      <div className="landing-cta mx-auto grid max-w-[1240px] overflow-hidden rounded-[36px] p-8 text-white md:p-14 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14">
        <div data-reveal className="landing-reveal self-center">
          <Image src="/slaivio-mark.png" alt="SLAIVIO" width={60} height={60} className="rounded-2xl" />
          <h2 className="mt-7 text-4xl font-bold tracking-[-0.04em] md:text-6xl">
            Prêt à moderniser votre agence ?
          </h2>
          <p className="mt-5 max-w-xl text-lg leading-8 text-emerald-50">
            Demandez une démonstration personnalisée. Notre équipe vous montrera
            comment SLAIVIO s'adapte à vos opérations.
          </p>
        </div>
        <form onSubmit={submit} className="mt-10 grid gap-4 rounded-[26px] bg-white p-6 text-slate-950 shadow-2xl sm:grid-cols-2 lg:mt-0">
          <DemoInput name="full_name" label="Nom complet" required />
          <DemoInput name="email" label="Email professionnel" type="email" required />
          <DemoInput name="agency_name" label="Nom de l'agence" />
          <DemoInput name="phone" label="Téléphone / WhatsApp" />
          <DemoInput name="country" label="Pays" />
          <DemoInput name="monthly_shipments" label="Taille de l'agence" />
          <label className="sm:col-span-2">
            <span className="mb-2 block text-xs font-bold text-slate-600">Votre besoin</span>
            <textarea name="message" rows={4} className="slaivo-focus w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" />
          </label>
          <button
            type="submit"
            disabled={status === "loading"}
            className="landing-button inline-flex h-13 items-center justify-center gap-2 rounded-xl bg-[#07111f] px-6 py-4 text-sm font-bold text-white disabled:opacity-60 sm:col-span-2"
          >
            {status === "loading" ? "Envoi en cours..." : "Demander une démo"}
            <ArrowRight size={16} />
          </button>
          {status === "success" && <p className="text-center text-sm font-semibold text-emerald-700 sm:col-span-2">Votre demande a bien été envoyée.</p>}
          {status === "error" && <p className="text-center text-sm font-semibold text-red-600 sm:col-span-2">Impossible d'envoyer la demande. Réessayez dans un instant.</p>}
        </form>
      </div>
    </section>
  );
}

function DemoInput({ name, label, type = "text", required = false }: { name: string; label: string; type?: string; required?: boolean }) {
  return (
    <label>
      <span className="mb-2 block text-xs font-bold text-slate-600">{label}</span>
      <input name={name} type={type} required={required} className="slaivo-focus h-12 w-full rounded-xl border border-slate-200 px-4 text-sm" />
    </label>
  );
}

function AnimatedCounter({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => {
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
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [value]);

  return <span ref={ref}>{display.toLocaleString("fr-FR")}</span>;
}

function SliderButton({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="flex h-9 w-9 items-center justify-center rounded-full border border-emerald-200 text-[#078d48] transition hover:bg-emerald-50">
      {children}
    </button>
  );
}

function Footer() {
  return (
    <footer id="contact" className="relative overflow-hidden border-t border-white/10 bg-[#02080d] py-16 text-white">
      <div className="absolute inset-x-0 bottom-0 h-44 bg-[radial-gradient(ellipse_at_bottom,rgba(0,201,107,0.24),transparent_65%)]" />
      <div className="relative mx-auto grid max-w-[1240px] gap-9 px-5 md:grid-cols-2 md:px-8 lg:grid-cols-[1.25fr_0.7fr_0.7fr_0.7fr_0.7fr]">
        <div>
          <div className="flex items-center gap-3">
            <Image src="/slaivio-mark.png" alt="SLAIVIO" width={44} height={44} className="rounded-xl" />
            <span className="text-2xl font-bold">SLAIVIO</span>
          </div>
          <p className="mt-5 max-w-sm text-sm leading-7 text-slate-400">La plateforme tout-en-un qui transforme WhatsApp en véritable moteur de croissance pour les agences cargo.</p>
          <div className="mt-6 space-y-3 text-sm text-slate-300">
            <div className="flex gap-3"><ShieldCheck className="text-[#75c557]" size={18} />Sécurisé et fiable</div>
            <div className="flex gap-3"><Globe2 className="text-[#75c557]" size={18} />Infrastructure cloud</div>
            <div className="flex gap-3"><Headphones className="text-[#75c557]" size={18} />Support dédié</div>
          </div>
        </div>
        <FooterColumn title="Produit" links={["Fonctionnalités", "Tarification", "Intégrations", "Sécurité"]} />
        <FooterColumn title="Ressources" links={["Documentation", "Guides", "FAQ", "Statut"]} />
        <FooterColumn title="Entreprise" links={["À propos", "Partenaires", "Contact", "Carrières"]} />
        <FooterColumn title="Légal" links={["Confidentialité", "Conditions", "Cookies", "Données"]} />
      </div>
      <div className="relative mx-auto mt-14 flex max-w-[1240px] flex-col items-center justify-between gap-5 border-t border-white/10 px-5 pt-8 text-sm text-slate-400 md:flex-row md:px-8">
        <div><strong className="text-white">FR</strong> | EN</div>
        <div>© 2026 SLAIVIO. Tous droits réservés.</div>
        <div className="flex gap-3">
          {[Linkedin, Facebook, MessageCircle, Youtube, Mail].map((Icon, index) => (
            <a key={index} href="#" aria-label={["LinkedIn", "Facebook", "WhatsApp", "YouTube", "Email"][index]} className="landing-social flex h-10 w-10 items-center justify-center rounded-full bg-white/5">
              <Icon size={17} />
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: string[] }) {
  return (
    <div>
      <div className="text-sm font-bold uppercase">{title}</div>
      <div className="mt-4 space-y-3">
        {links.map((link) => (
          <a key={link} href="#" className="landing-footer-link block text-sm font-medium text-slate-400 hover:text-white">{link}</a>
        ))}
      </div>
    </div>
  );
}
