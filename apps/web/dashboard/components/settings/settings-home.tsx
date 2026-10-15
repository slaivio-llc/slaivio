"use client";

import Link from "next/link";
import {
  ArrowRight,
  Bell,
  Building2,
  CreditCard,
  Languages,
  LockKeyhole,
  MessageCircle,
  Route,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { setDashboardLocale, useDashboardLocale } from "@/components/i18n/dashboard-language";
import { PermissionGuard } from "@/components/permissions/permission-guard";

type SettingsHomeProps = {
  pilot: boolean;
  transportEnabled?: boolean;
};

const cardClass =
  "rounded-2xl border border-[#e6e9e8] bg-white p-5 shadow-[0_4px_20px_rgba(25,40,35,.035)] sm:p-6";
const linkClass =
  "group flex min-h-12 items-center justify-between gap-3 rounded-xl px-3 py-2 text-[13px] font-medium text-[#38434a] transition hover:bg-[#f3f8f5] hover:text-[#087a46]";

export function SettingsHome({ pilot, transportEnabled }: SettingsHomeProps) {
  const locale = useDashboardLocale();
  const english = locale === "en";
  const section = (name: string) => `/app/settings?section=${name}`;
  const cards = [
    {
      title: english ? "General" : "Général",
      description: english
        ? "Agency identity and shared regional settings."
        : "Identité de l’agence et paramètres régionaux partagés.",
      icon: Building2,
      links: [
        [english ? "Agency identity" : "Identité de l’agence", section(pilot ? "company" : "agency")],
        [english ? "Reference time zone and formats" : "Fuseau de référence et formats", section(pilot ? "company" : "general")],
      ],
    },
    {
      title: english ? "Communication" : "Communication",
      description: english
        ? "Connected channels, AI behavior and automatic replies."
        : "Canaux connectés, comportement de l’IA et réponses automatiques.",
      icon: MessageCircle,
      links: [
        [english ? "Channels and WhatsApp" : "Canaux et WhatsApp", section(pilot ? "channels" : "integrations")],
        [english ? "AI and conversation handling" : "IA et traitement des conversations", pilot ? section("ai") : "/app/assistant"],
      ],
    },
    {
      title: english ? "Payments" : "Paiements",
      description: english
        ? "Invoices, collections and payment policies."
        : "Factures, encaissements et politiques de paiement.",
      icon: CreditCard,
      links: [
        [english ? "Finance and payment methods" : "Finance et moyens de paiement", "/app/finance"],
        [english ? "Pricing and billing terms" : "Tarifs et conditions de facturation", "/app/pricing"],
      ],
    },
    {
      title: english ? "Security and access" : "Sécurité et accès",
      description: english
        ? "Team access, permissions, account protection and privacy."
        : "Accès de l’équipe, permissions, protection des comptes et confidentialité.",
      icon: ShieldCheck,
      links: pilot
        ? [
            [english ? "Users and offices" : "Utilisateurs et bureaux", section("network")],
            [english ? "Privacy and data" : "Confidentialité et données", section("privacy")],
            [english ? "Action history" : "Historique des actions", section("audit")],
          ]
        : [
            [english ? "Users and team" : "Utilisateurs et équipe", section("team")],
            [english ? "Roles and permissions" : "Rôles et permissions", section("roles")],
            [english ? "Account security" : "Sécurité des comptes", section("security")],
            [english ? "Privacy and data" : "Confidentialité et données", section("data")],
            [english ? "Action history" : "Historique des actions", section("audit")],
          ],
    },
    {
      title: english ? "Transport services and routes" : "Services et routes",
      description: english
        ? "Configure the offer before creating prices or operations."
        : "Configurez l’offre avant de créer des tarifs ou des opérations.",
      icon: Route,
      links: [
        [english ? "Transport services" : "Services de transport", section(pilot ? "services" : "services")],
        [english ? "Commercial routes" : "Routes commerciales", section(pilot ? "routes" : "routes")],
        [english ? "Published prices" : "Tarifs publiés", "/app/pricing"],
      ],
    },
  ] as const;

  return (
    <div className="min-h-[calc(100vh-170px)] bg-[#f7f9f8] px-4 py-6 sm:px-7 sm:py-9">
      <div className="mx-auto max-w-[1180px]">
        <section className="relative mb-6 overflow-hidden rounded-2xl bg-[#123e30] px-6 py-7 text-white shadow-[0_14px_36px_rgba(18,62,48,.16)] sm:px-8 sm:py-9">
          <div className="absolute -right-10 -top-24 h-64 w-64 rounded-full border-[36px] border-white/[.06]" />
          <div className="relative flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <div className="max-w-2xl">
              <span className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[.12em] text-emerald-100">
                <LockKeyhole size={13} />
                {english ? "Workspace control center" : "Centre de configuration"}
              </span>
              <h1 className="text-2xl font-semibold tracking-[-.03em] sm:text-[30px]">
                {english ? "Settings" : "Paramètres"}
              </h1>
              <p className="mt-2 max-w-xl text-[13px] leading-6 text-emerald-50/80 sm:text-sm">
                {english
                  ? "One place to find each setting. Its business module remains responsible for the data."
                  : "Retrouvez chaque réglage au même endroit. Les données restent gérées par leur module métier."}
              </p>
            </div>
            <label className="grid shrink-0 gap-1.5 text-[11px] font-medium text-emerald-50/80">
              <span className="flex items-center gap-1.5"><Languages size={13}/>{english ? "Your interface language" : "Langue de votre interface"}</span>
              <select
                aria-label={english ? "Your interface language" : "Langue de votre interface"}
                value={locale}
                onChange={(event) => setDashboardLocale(event.target.value as "fr" | "en")}
                className="h-10 min-w-44 rounded-lg border border-white/20 bg-white px-3 text-[13px] font-medium text-[#26342e] outline-none focus:ring-2 focus:ring-emerald-300"
              >
                <option value="fr">Français</option>
                <option value="en">English</option>
              </select>
            </label>
          </div>
        </section>

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e6e9e8] bg-white px-4 py-3 text-[12px] text-[#78827e]">
          <span className="flex items-center gap-2">
            <Bell size={14}/>
            {english
              ? "Your language is personal; agency identity and time zone are shared."
              : "Votre langue est personnelle; l’identité et le fuseau horaire sont partagés par l’agence."}
          </span>
          <Link href={section("notifications")} className="font-semibold text-[#087a46] hover:underline">
            {english ? "Personal notifications" : "Notifications personnelles"} <ArrowRight size={13} className="inline"/>
          </Link>
        </div>

        <section aria-label={english ? "Settings categories" : "Catégories de paramètres"} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.filter(({ title }) => title !== (english ? "Transport services and routes" : "Services et routes") || transportEnabled !== false).map(({ title, description, icon: Icon, links: cardLinks }) => {
            const links = title === (english ? "Security and access" : "Sécurité et accès") && pilot && transportEnabled === false
              ? cardLinks.filter(([label]) => label !== (english ? "Users and offices" : "Utilisateurs et bureaux"))
              : cardLinks;
            return (
            <article key={title} className={cardClass}>
              <div className="mb-4 flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#e8f4ed] text-[#087a46]">
                  <Icon size={19}/>
                </span>
                <div>
                  <h2 className="text-[15px] font-semibold text-[#26322d]">{title}</h2>
                  <p className="mt-1 text-[12px] leading-5 text-[#78827e]">{description}</p>
                </div>
              </div>
              <div className="grid gap-1">
                {links.map(([label, href]) => {
                  const link = (
                    <Link href={href} className={linkClass}>
                      <span>{label}</span>
                      <ArrowRight size={15} className="shrink-0 text-[#9aa49f] transition group-hover:translate-x-0.5 group-hover:text-[#087a46]"/>
                    </Link>
                  );
                  return href.endsWith("section=audit")
                    ? <PermissionGuard key={label} permission="audit.read" fallback={null}>{link}</PermissionGuard>
                    : <span key={label}>{link}</span>;
                })}
              </div>
            </article>
            );
          })}
        </section>
        <p className="mt-5 flex items-center gap-2 px-1 text-[11px] leading-5 text-[#89938e]">
          <Truck size={14}/>
          {english
            ? "Opening hours and local contact details are managed per office in Organization."
            : "Les horaires et coordonnées locales se configurent par bureau dans Organisation."}
        </p>
      </div>
    </div>
  );
}
