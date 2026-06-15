"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  FileText,
  Globe2,
  HelpCircle,
  MessageCircle,
  PackageCheck,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  Truck,
  Warehouse,
} from "lucide-react";

import {
  createDemoRequest,
  createTrialLead,
  getLandingData,
  LandingMetric,
  LandingPricingPlan,
  LandingTestimonial,
} from "@/services/landing";

const problems = [
  "Excel files everywhere",
  "Lost shipments",
  "Manual follow-ups",
  "WhatsApp chaos",
  "Missed payments",
  "No visibility",
];

const solutions = [
  "Customer Management",
  "Shipment Management",
  "Warehouse Operations",
  "Tracking",
  "Payments",
  "Notifications",
  "Reporting",
];

const features = [
  ["WhatsApp Automation", "Receive, organize and respond to cargo requests through WhatsApp."],
  ["Customer Management", "Keep every customer, contact and request connected to the right agency."],
  ["Quotation Engine", "Turn requests into structured quote workflows."],
  ["Shipment Creation", "Create operational records from qualified cargo requests."],
  ["Warehouse Receiving", "Track received packages, damage, photos and unidentified cargo."],
  ["Tracking", "Give the team visibility from intake to delivery."],
  ["Notifications", "Keep customers updated without manual chasing."],
  ["Payment Tracking", "Connect payment status to cargo release decisions."],
  ["Pickup Management", "Prepare pickup and delivery workflows cleanly."],
  ["Documents", "Centralize manifests, customs and proof documents."],
  ["Reports", "Read operations across messages, shipments and finance."],
  ["Audit Logs", "Keep decisions, handoffs and actions traceable."],
];

const showcase = [
  {
    title: "Dashboard",
    image: "/landing/dashboard.png",
    description: "Command center overview from the real SLAIVIO product.",
  },
  {
    title: "Inbox",
    image: "/landing/inbox.png",
    description: "WhatsApp conversations, workflow and team actions.",
  },
  {
    title: "Customers & Dossiers",
    image: "/landing/dossiers.png",
    description: "Customer requests organized around operational dossiers.",
  },
  {
    title: "Settings",
    image: "/landing/settings.png",
    description: "Agency configuration, access and operating controls.",
  },
];

const steps = [
  "Connect WhatsApp",
  "Configure Agency",
  "Receive Requests",
  "Manage Shipments",
  "Track Operations",
  "Grow Agency",
];

const benefits = [
  "Reduce manual work",
  "Increase customer satisfaction",
  "Improve visibility",
  "Scale operations",
  "Centralize workflows",
  "Professionalize agency",
];

const faqs = [
  [
    "How does WhatsApp work?",
    "SLAIVIO connects your official WhatsApp Business setup and turns incoming messages into structured workflows.",
  ],
  [
    "Can I manage multiple offices?",
    "Yes. The platform is built around agencies, teams and tenant isolation for multi-office operations.",
  ],
  [
    "Can I manage warehouses?",
    "Warehouse workflows are part of the Cargo OS foundation and are exposed when the onboarding block is validated.",
  ],
  [
    "Can I track shipments?",
    "Yes. Shipments are tracked from intake through warehouse, route, delivery and final status.",
  ],
  [
    "Do customers need an app?",
    "No. Customers can keep using WhatsApp while your team works inside SLAIVIO.",
  ],
  [
    "Can I customize prices?",
    "Yes. Pricing is driven by catalog and configuration, not hardcoded values.",
  ],
  [
    "How long does setup take?",
    "The onboarding flow is designed to guide an agency from account setup to WhatsApp connection step by step.",
  ],
];

export function LandingPageClient() {
  const [metrics, setMetrics] = useState<LandingMetric[]>([]);
  const [pricing, setPricing] = useState<LandingPricingPlan[]>([]);
  const [testimonials, setTestimonials] = useState<LandingTestimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [demoStatus, setDemoStatus] = useState("");
  const [trialEmail, setTrialEmail] = useState("");

  useEffect(() => {
    getLandingData()
      .then((data) => {
        setMetrics(data.metrics);
        setPricing(data.pricing);
        setTestimonials(data.testimonials);
      })
      .catch(() => {
        setMetrics([]);
        setPricing([]);
        setTestimonials([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const orderedPricing = useMemo(
    () =>
      [...pricing].sort(
        (a, b) => a.monthly_price_minor - b.monthly_price_minor
      ),
    [pricing]
  );

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

    setDemoStatus("Demo request received. Our team will contact you.");
    event.currentTarget.reset();
  }

  return (
    <main className="min-h-screen bg-white text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-5 py-4">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/slaivio-mark.png"
              alt="SLAIVIO"
              width={42}
              height={42}
              className="rounded-2xl"
            />
            <div>
              <div className="text-xl font-black tracking-tight">SLAIVIO</div>
              <div className="text-[11px] font-black uppercase tracking-[0.28em] text-emerald-600">
                Cargo OS
              </div>
            </div>
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-bold text-slate-600 lg:flex">
            <a href="#features">Features</a>
            <a href="#showcase">Product</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/sign-in"
              className="hidden text-sm font-black text-slate-700 md:inline"
            >
              Login
            </Link>
            <a
              href="#demo"
              className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-xl transition hover:-translate-y-0.5"
            >
              Book Demo
            </a>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_34rem),linear-gradient(180deg,#f8fafc_0%,#ffffff_78%)]" />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-5 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-28">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-[0.2em] text-emerald-700">
              <Globe2 size={14} />
              Enterprise SaaS for Cargo Agencies
            </div>

            <h1 className="mt-7 max-w-4xl text-5xl font-black tracking-tight md:text-7xl">
              Run Your Cargo Agency On WhatsApp.
              <span className="block text-slate-500">
                Without Excel. Without Chaos.
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-9 text-slate-600">
              SLAIVIO helps cargo and freight agencies automate operations,
              customer communication, shipment tracking and warehouse workflows
              through WhatsApp and a powerful operating system.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <form
                onSubmit={submitTrialLead}
                className="flex w-full max-w-xl flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-2 shadow-xl sm:flex-row"
              >
                <input
                  value={trialEmail}
                  onChange={(event) => setTrialEmail(event.target.value)}
                  type="email"
                  required
                  placeholder="Work email"
                  className="min-h-12 flex-1 rounded-2xl px-4 text-sm font-semibold outline-none"
                />
                <button className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-600">
                  Start Free Trial
                  <ArrowRight size={16} />
                </button>
              </form>

              <a
                href="#demo"
                className="inline-flex min-h-16 items-center justify-center rounded-3xl border border-slate-200 bg-white px-6 text-sm font-black text-slate-950 shadow-sm transition hover:-translate-y-0.5"
              >
                Book Demo
              </a>
            </div>

            <div className="mt-8 flex flex-wrap gap-3 text-sm font-bold text-slate-500">
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 size={17} className="text-emerald-600" />
                WhatsApp-first
              </span>
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 size={17} className="text-emerald-600" />
                Multi-agency ready
              </span>
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 size={17} className="text-emerald-600" />
                Built for international cargo
              </span>
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-3 shadow-2xl">
            <div className="overflow-hidden rounded-[1.5rem] border border-slate-100">
              <Image
                src="/landing/dashboard.png"
                alt="SLAIVIO dashboard screenshot"
                width={1600}
                height={900}
                priority
                className="h-auto w-full"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-950 py-8 text-white">
        <div className="mx-auto grid max-w-7xl gap-4 px-5 md:grid-cols-4">
          {(loading ? [] : metrics).map((metric) => (
            <div key={metric.metric_key} className="rounded-3xl bg-white/5 p-5">
              <div className="text-3xl font-black">
                {metric.metric_value.toLocaleString()}
              </div>
              <div className="mt-2 text-sm font-bold text-slate-400">
                {metric.metric_label}
              </div>
            </div>
          ))}
          {!loading && metrics.length === 0 && (
            <div className="col-span-full rounded-3xl bg-white/5 p-5 text-sm font-semibold text-slate-300">
              Trust metrics are connected to the backend and waiting for
              production data.
            </div>
          )}
        </div>
      </section>

      <Section id="problem" eyebrow="Problem" title="Cargo Operations Are Broken.">
        <div className="grid gap-4 md:grid-cols-3">
          {problems.map((item) => (
            <ProblemCard key={item} title={item} />
          ))}
        </div>
      </Section>

      <Section
        id="solution"
        eyebrow="Solution"
        title="One Platform For Your Entire Cargo Business"
        description="SLAIVIO brings the messy pieces of a freight agency into one operating system."
      >
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
          {solutions.map((item) => (
            <SolutionCard key={item} title={item} />
          ))}
        </div>
      </Section>

      <Section
        id="features"
        eyebrow="Features"
        title="Everything your agency needs to operate professionally"
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map(([title, description]) => (
            <FeatureCard key={title} title={title} description={description} />
          ))}
        </div>
      </Section>

      <Section
        id="showcase"
        eyebrow="Product Showcase"
        title="Real product screens. No fake mockups."
        description="Screenshots are captured from SLAIVIO itself and will be refreshed as each block reaches production validation."
      >
        <div className="grid gap-5 lg:grid-cols-2">
          {showcase.map((item) => (
            <div
              key={item.title}
              className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl"
            >
              <Image
                src={item.image}
                alt={`${item.title} screenshot`}
                width={1600}
                height={900}
                className="h-auto w-full border-b border-slate-200"
              />
              <div className="p-5">
                <div className="font-black text-slate-950">{item.title}</div>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section id="how-it-works" eyebrow="How it works" title="From WhatsApp request to managed cargo workflow">
        <div className="grid gap-4 md:grid-cols-3">
          {steps.map((step, index) => (
            <div
              key={step}
              className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-sm font-black text-white">
                {index + 1}
              </div>
              <div className="mt-5 text-lg font-black text-slate-950">
                {step}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section id="benefits" eyebrow="Benefits" title="Give your agency an operating backbone">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {benefits.map((benefit) => (
            <div
              key={benefit}
              className="flex items-center gap-3 rounded-3xl border border-emerald-100 bg-emerald-50 p-5 text-sm font-black text-emerald-800"
            >
              <CheckCircle2 size={18} />
              {benefit}
            </div>
          ))}
        </div>
      </Section>

      <Section
        id="testimonials"
        eyebrow="Testimonials"
        title="Real agencies only"
        description="No invented quotes. This section is connected to real testimonial data."
      >
        {testimonials.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-3">
            {testimonials.map((item) => (
              <div
                key={`${item.agency_name}-${item.owner_name}`}
                className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"
              >
                <p className="text-sm leading-7 text-slate-600">“{item.quote}”</p>
                <div className="mt-5 font-black text-slate-950">
                  {item.agency_name}
                </div>
                <div className="text-sm text-slate-500">
                  {item.country}
                  {item.owner_name ? ` · ${item.owner_name}` : ""}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-[2rem] border border-dashed border-slate-300 bg-slate-50 p-8 text-sm font-semibold leading-7 text-slate-600">
            Testimonials will be published after verified production pilots.
            No fake agency quote is displayed.
          </div>
        )}
      </Section>

      <Section id="pricing" eyebrow="Pricing" title="Choose the package that fits your agency">
        <div className="grid gap-5 lg:grid-cols-3">
          {orderedPricing.map((plan) => (
            <PricingCard key={plan.code} plan={plan} />
          ))}
          {!loading && orderedPricing.length === 0 && (
            <div className="col-span-full rounded-[2rem] border border-dashed border-slate-300 bg-slate-50 p-8 text-sm font-semibold text-slate-600">
              Pricing is connected to the backend catalog and waiting for
              published plans.
            </div>
          )}
        </div>
      </Section>

      <Section id="faq" eyebrow="FAQ" title="Questions agencies ask before starting">
        <div className="grid gap-4 lg:grid-cols-2">
          {faqs.map(([question, answer]) => (
            <div
              key={question}
              className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center gap-3 font-black text-slate-950">
                <HelpCircle size={18} className="text-emerald-600" />
                {question}
              </div>
              <p className="mt-3 text-sm leading-7 text-slate-500">{answer}</p>
            </div>
          ))}
        </div>
      </Section>

      <section id="demo" className="bg-slate-950 py-20 text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[0.2em] text-emerald-200">
              <Sparkles size={14} />
              Final CTA
            </div>
            <h2 className="mt-6 text-4xl font-black tracking-tight md:text-6xl">
              Ready To Modernize Your Cargo Operations?
            </h2>
            <p className="mt-5 max-w-xl text-base leading-8 text-slate-300">
              Start with a free trial or book a guided demo with the SLAIVIO
              team.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/sign-up"
                className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-600"
              >
                Start Free Trial
              </Link>
              <a
                href="#demo-form"
                className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black text-white"
              >
                Book Demo
              </a>
            </div>
          </div>

          <form
            id="demo-form"
            onSubmit={submitDemoRequest}
            className="rounded-[2rem] border border-white/10 bg-white p-6 text-slate-950 shadow-2xl"
          >
            <h3 className="text-2xl font-black">Book a product demo</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Tell us about your agency. We’ll help you see if SLAIVIO fits
              your operation.
            </p>
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <Input name="full_name" label="Full name" required />
              <Input name="email" label="Work email" type="email" required />
              <Input name="agency_name" label="Agency name" />
              <Input name="phone" label="WhatsApp / phone" />
              <Input name="country" label="Country" />
              <Input name="monthly_shipments" label="Monthly shipments" />
            </div>
            <label className="mt-3 block">
              <span className="text-sm font-black text-slate-700">Message</span>
              <textarea
                name="message"
                className="mt-2 min-h-[110px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
              />
            </label>
            <button className="mt-4 w-full rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white">
              Send Demo Request
            </button>
            {demoStatus && (
              <div className="mt-4 rounded-2xl bg-emerald-50 p-3 text-sm font-black text-emerald-700">
                {demoStatus}
              </div>
            )}
          </form>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white py-10">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 md:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]">
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
                <div className="font-black">SLAIVIO</div>
                <div className="text-xs font-black uppercase tracking-[0.22em] text-emerald-600">
                  Cargo OS
                </div>
              </div>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-7 text-slate-500">
              Enterprise cargo operating system for freight and import/export
              agencies.
            </p>
          </div>

          <FooterColumn title="Company" links={["About", "Contact", "LinkedIn", "Facebook"]} />
          <FooterColumn title="Product" links={["Features", "Documentation", "Pricing"]} />
          <FooterColumn title="Legal" links={["Privacy", "Terms"]} />
        </div>
      </footer>
    </main>
  );
}

function Section({
  id,
  eyebrow,
  title,
  description,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="py-20">
      <div className="mx-auto max-w-7xl px-5">
        <div className="mb-10 max-w-3xl">
          <div className="text-xs font-black uppercase tracking-[0.22em] text-emerald-600">
            {eyebrow}
          </div>
          <h2 className="mt-3 text-4xl font-black tracking-tight text-slate-950 md:text-5xl">
            {title}
          </h2>
          {description && (
            <p className="mt-4 text-base leading-8 text-slate-500">
              {description}
            </p>
          )}
        </div>
        {children}
      </div>
    </section>
  );
}

function ProblemCard({ title }: { title: string }) {
  return (
    <div className="rounded-[1.5rem] border border-red-100 bg-red-50 p-5 text-sm font-black text-red-800">
      {title}
    </div>
  );
}

function SolutionCard({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[1.5rem] border border-slate-200 bg-white p-5 text-sm font-black text-slate-800 shadow-sm">
      <PackageCheck size={18} className="text-emerald-600" />
      {title}
    </div>
  );
}

function FeatureCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const icons = [MessageCircle, Truck, Warehouse, CreditCard, FileText, SearchCheck, Boxes, ClipboardCheck, ShieldCheck];
  const Icon = icons[title.length % icons.length];

  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
        <Icon size={18} />
      </div>
      <h3 className="mt-5 text-lg font-black text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-slate-500">{description}</p>
    </div>
  );
}

function PricingCard({ plan }: { plan: LandingPricingPlan }) {
  const price = `${plan.currency_code} ${(plan.monthly_price_minor / 100).toFixed(0)}`;

  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="text-2xl font-black text-slate-950">{plan.name}</div>
      <p className="mt-2 min-h-[56px] text-sm leading-7 text-slate-500">
        {plan.description}
      </p>
      <div className="mt-6 flex items-end gap-2">
        <span className="text-4xl font-black">{price}</span>
        <span className="pb-1 text-sm font-semibold text-slate-500">/ month</span>
      </div>
      <div className="mt-6 space-y-3 text-sm font-semibold text-slate-700">
        <PlanLine label={`${plan.max_users || "Unlimited"} users`} />
        <PlanLine label={`${plan.max_whatsapp_numbers || "Unlimited"} WhatsApp number(s)`} />
        <PlanLine label={`${plan.max_monthly_messages || "Unlimited"} monthly messages`} />
        <PlanLine label={plan.ai_enabled ? "AI enabled" : "AI not included"} />
        <PlanLine label={plan.multi_number_enabled ? "Multi-number enabled" : "Single-number workflow"} />
      </div>
      <Link
        href="/sign-up"
        className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white"
      >
        Start Free Trial
      </Link>
    </div>
  );
}

function PlanLine({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <CheckCircle2 size={17} className="text-emerald-600" />
      {label}
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
      <span className="text-sm font-black text-slate-700">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
      />
    </label>
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
      <div className="text-sm font-black text-slate-950">{title}</div>
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
