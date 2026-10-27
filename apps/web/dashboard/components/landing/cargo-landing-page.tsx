"use client";

import Link from "next/link";
import { useLocale } from "next-intl";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { ArrowRight, BarChart3, Building2, Check, CheckCircle2, CreditCard, FileText, Menu, MessageCircle, Package, Route, Truck, Users, Warehouse, X } from "lucide-react";
import { SlaivioBrand } from "@/components/ui/slaivio-brand";
import { createDemoRequest } from "@/services/landing";
import { landingCopy } from "./landing-copy";
import styles from "./landing-page.module.css";

type Copy = typeof landingCopy.fr;
const anchors = ['plateforme', 'parcours', 'equipe', 'tarifs', 'questions'];
const featureIcons = [Package, Truck, CreditCard, MessageCircle];
const journeyIcons = [MessageCircle, Package, Truck, CheckCircle2];

export function LandingPageClient() {
  const locale = useLocale() === 'en' ? 'en' : 'fr';
  const copy = landingCopy[locale];
  const [menuOpen, setMenuOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const requestDemo = () => { setMenuOpen(false); setDemoOpen(true); };
  return <main className={styles.page}>
    <a href="#contenu" className={styles.skip}>{locale === 'fr' ? 'Aller au contenu' : 'Skip to content'}</a>
    <div className={styles.heroBackground}>
      <header className={styles.header}>
        <Link href={`/${locale}`} aria-label="Slaivio"><SlaivioBrand inverse compact /></Link>
        <nav aria-label={locale === 'fr' ? 'Navigation principale' : 'Main navigation'} className={styles.desktopNav}>{copy.nav.map((label, index) => <a key={label} href={`#${anchors[index]}`}>{label}</a>)}</nav>
        <div className={styles.headerActions}>
          <Link href="/sign-in" className={styles.login}>{copy.login}</Link>
          <button type="button" className={`${styles.button} ${styles.headerDemo}`} onClick={requestDemo}>{copy.demo}</button>
          <Link href={locale === 'fr' ? '/en' : '/fr'} className={styles.language} hrefLang={locale === 'fr' ? 'en' : 'fr'} aria-label={locale === 'fr' ? 'Read in English' : 'Lire en français'}>{locale === 'fr' ? 'EN' : 'FR'}</Link>
          <button type="button" className={styles.menuButton} aria-label={menuOpen ? copy.close : copy.menu} aria-expanded={menuOpen} aria-controls="landing-mobile-nav" onClick={() => setMenuOpen(value => !value)}>{menuOpen ? <X size={21} /> : <Menu size={21} />}</button>
        </div>
        {menuOpen && <nav id="landing-mobile-nav" className={styles.mobileNav} aria-label={copy.menu} onKeyDown={event => { if (event.key === 'Escape') setMenuOpen(false); }}>{copy.nav.map((label, index) => <a key={label} href={`#${anchors[index]}`} onClick={() => setMenuOpen(false)}>{label}</a>)}<button type="button" onClick={requestDemo}>{copy.demo}<ArrowRight size={15} /></button></nav>}
      </header>
      <section id="contenu" className={styles.hero}>
        <p className={styles.heroEyebrow}>{copy.eyebrow}</p><h1>{copy.title[0]}<br />{copy.title[1]}</h1>
        <p className={styles.heroIntro}>{copy.intro}</p>
        <button type="button" className={`${styles.button} ${styles.darkButton}`} onClick={requestDemo}>{copy.demo}<ArrowRight size={16} /></button>
        <p className={styles.heroNote}>{copy.heroNote}</p><ProductPreview copy={copy} />
      </section>
    </div>
    <section className={`${styles.container} ${styles.pillars}`} aria-label={copy.platformEyebrow}>{copy.pillars.map(([title, description], index) => { const Icon = [Package, Users, MessageCircle][index]; return <div key={title}><span className={styles.lineIcon}><Icon size={23} strokeWidth={1.5} /></span><h2>{title}</h2><p>{description}</p></div>; })}</section>
    <section id="plateforme" className={`${styles.container} ${styles.section}`}>
      <SectionHeading eyebrow={copy.platformEyebrow} title={copy.platformTitle} description={copy.platformIntro} />
      <div className={styles.featureGrid}>{copy.features.map(([title, description], index) => { const Icon = featureIcons[index]; return <article className={styles.featureCard} key={title}><div className={styles.featureArt} aria-hidden="true"><FeatureArt index={index} copy={copy} /></div><div className={styles.featureText}><span className={styles.featureNumber}>0{index + 1}<Icon size={17} strokeWidth={1.5} /></span><h3>{title}</h3><p>{description}</p></div></article>; })}</div>
    </section>
    <section id="parcours" className={styles.journeySection}><div className={styles.container}>
      <SectionHeading eyebrow={copy.workflowEyebrow} title={copy.workflowTitle} description={copy.workflowIntro} />
      <ol className={styles.journey}>{copy.workflow.map(([title, description], index) => { const Icon = journeyIcons[index]; return <li key={title}><div className={styles.journeyIcon}><Icon size={22} strokeWidth={1.5} /></div><span className={styles.step}>0{index + 1}</span><h3>{title}</h3><p>{description}</p></li>; })}</ol>
    </div></section>
    <section id="equipe" className={`${styles.container} ${styles.teamSection}`}>
      <div><p className={styles.eyebrow}>{copy.teamEyebrow}</p><h2 className={styles.sectionTitle}>{copy.teamTitle}</h2><p className={styles.teamDescription}>{copy.teamText}</p><ul className={styles.checklist}>{copy.teamItems.map(item => <li key={item}><Check size={16} />{item}</li>)}</ul></div>
      <div className={styles.networkArt} aria-label={copy.configured}>
        <div className={styles.networkNode}><span className={styles.nodeIcon}><Warehouse size={24} strokeWidth={1.5} /></span><small>{copy.warehouse}</small><strong>{copy.warehouseCity}</strong></div><span className={styles.connectionLine} aria-hidden="true"><Route size={24} /></span><div className={styles.networkNode}><span className={styles.nodeIcon}><Building2 size={24} strokeWidth={1.5} /></span><small>{copy.office}</small><strong>{copy.officeCity}</strong></div><p>{copy.example}</p>
      </div>
    </section>
    <p className={`${styles.container} ${styles.availability}`}>{copy.note}</p>
    <section id="tarifs" aria-labelledby="landing-pricing-title" className={`${styles.container} ${styles.pricingSection}`}>
      <div className={styles.sectionHeading}><p className={styles.eyebrow}>{copy.pricingEyebrow}</p><h2 id="landing-pricing-title" className={styles.sectionTitle}>{copy.pricingTitle}</h2><p className={styles.sectionIntro}>{copy.pricingIntro}</p></div>
      <p className={styles.pricingCommon}>{copy.pricingCommon}</p>
      <div className={styles.pricingGrid}>{copy.pricingPlans.map(plan => <article key={plan.name} className={styles.pricingCard} aria-label={plan.name}>
        <h3>{plan.name}</h3><p className={styles.planDescription}>{plan.description}</p>
        <p className={styles.planPrice}><strong>{plan.price} <span>$</span></strong><span>{copy.pricingPeriod}</span></p><p className={styles.planCurrency}>{copy.pricingCurrency}</p>
        <ul>{plan.features.map(feature => <li key={feature}><Check size={16} aria-hidden="true" /><span>{feature}</span></li>)}</ul>
        <button type="button" className={`${styles.button} ${styles.planButton}`} aria-label={`${copy.demo} · ${plan.name}`} onClick={requestDemo}>{copy.demo}<ArrowRight size={15} aria-hidden="true" /></button>
      </article>)}</div>
      <p className={styles.pricingNote}>{copy.pricingNote}</p>
    </section>
    <section id="questions" className={`${styles.container} ${styles.faqSection}`}><SectionHeading eyebrow="FAQ" title={copy.faqTitle} /><div className={styles.faqList}>{copy.faqs.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div></section>
    <section className={styles.finalSection}><div className={styles.container}><p className={styles.eyebrow}>SLAIVIO</p><h2 className={styles.sectionTitle}>{copy.finalTitle}</h2><p>{copy.finalText}</p><button type="button" className={`${styles.button} ${styles.greenButton}`} onClick={requestDemo}>{copy.demo}<ArrowRight size={16} /></button></div></section>
    <footer className={`${styles.container} ${styles.footer}`}><div><SlaivioBrand compact /><p>{copy.footer}</p></div><div className={styles.footerLinks}><Link href="/sign-in">{copy.login}</Link><button type="button" onClick={requestDemo}>{copy.demo}</button><span>© {new Date().getFullYear()} Slaivio. {copy.rights}</span></div></footer>
    {demoOpen && <DemoDialog copy={copy} close={() => setDemoOpen(false)} />}
  </main>;
}

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return <div className={styles.sectionHeading}><p className={styles.eyebrow}>{eyebrow}</p><h2 className={styles.sectionTitle}>{title}</h2>{description && <p className={styles.sectionIntro}>{description}</p>}</div>;
}

function ProductPreview({ copy }: { copy: Copy }) {
  const [tab, setTab] = useState(0);
  const rows = [copy.rows, copy.shipmentRows, copy.paymentRows][tab];
  return <figure className={styles.previewFigure}>
    <div className={styles.productFrame}>
      <div className={styles.browserBar}><span aria-hidden="true"><i /><i /><i /></span><span>slaivio.com</span><span aria-hidden="true" /></div>
      <div className={styles.productBody}>
        <aside className={styles.previewSidebar} aria-hidden="true"><SlaivioBrand compact /><div className={styles.sidebarItems}>{[BarChart3, Package, Truck, MessageCircle, CreditCard].map((Icon, index) => <span key={index} className={index === tab + 1 ? styles.sidebarSelected : ''}><Icon size={16} /><i /></span>)}</div><div className={styles.sidebarOffice}><Building2 size={15} /><span>Kinshasa</span></div></aside>
        <div className={styles.previewMain}>
          <div className={styles.previewTitle}><h2>{copy.preview}</h2><span><Building2 size={13} />Kinshasa</span></div>
          <div className={styles.previewTabs} role="group" aria-label={copy.preview}>{copy.tabs.map((label, index) => <button key={label} type="button" aria-pressed={index === tab} onClick={() => setTab(index)}>{label}</button>)}</div>
          <div className={styles.previewCards}><div><Package size={18} /><span>{copy.rows[0][0]}</span><strong>12,5 kg</strong></div><div><Route size={18} /><span>{copy.tracking}</span><strong>{copy.steps[1]}</strong></div><div><CreditCard size={18} /><span>{copy.tabs[2]}</span><strong>{copy.paymentRows[1][1]}</strong></div></div>
          <table className={styles.previewTable}><thead><tr>{copy.table.map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{rows.map(([reference, status]) => <tr key={reference}><td>{reference}</td><td>{copy.route}</td><td><span>{status}</span></td></tr>)}</tbody></table>
          <div className={styles.previewBottom}><div className={styles.trackingCard}><span>{copy.tracking}</span><div>{copy.steps.map((step, index) => <span key={step}><i className={index < 2 ? styles.completeStep : ''} />{step}</span>)}</div></div><div className={styles.messageCard}><MessageCircle size={18} /><p>{copy.message}</p></div></div>
        </div>
      </div>
    </div><figcaption>{copy.example}</figcaption>
  </figure>;
}

function FeatureArt({ index, copy }: { index: number; copy: Copy }) {
  if (index === 0) return <div className={styles.parcelArt}><span><Package size={38} strokeWidth={1.2} /></span><div><small>COL-2026-0012</small><strong>12,5 kg <span>·</span> 0,08 m³</strong><p><CheckCircle2 size={13} />{copy.rows[0][1]}</p></div></div>;
  if (index === 1) return <div className={styles.routeArt}><span>Guangzhou</span><i /><Truck size={30} strokeWidth={1.3} /><i /><span>Kinshasa</span></div>;
  if (index === 2) return <div className={styles.invoiceArt}><span><FileText size={23} />FAC-2026-0025</span><i /><i /><p><CheckCircle2 size={15} />{copy.paymentRows[1][1]}</p></div>;
  return <div className={styles.chatArt}><span><MessageCircle size={15} />WhatsApp</span><p>{copy.message}</p><small><Check size={12} /><Check size={12} /></small></div>;
}

function DemoDialog({ copy, close }: { copy: Copy; close: () => void }) {
  const id = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const inFlight = useRef(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const busy = status === 'loading';
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.querySelector<HTMLInputElement>('input')?.focus();
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  useEffect(() => {
    if (status === 'success') dialog.current?.querySelector<HTMLElement>('[role="status"] button')?.focus();
    if (status === 'loading') dialog.current?.focus();
  }, [status]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (inFlight.current) return;
    inFlight.current = true; setStatus('loading');
    const form = event.currentTarget;
    const data = new FormData(form);
    const value = (key: string) => String(data.get(key) || '').trim();
    try {
      await createDemoRequest({ full_name: value('full_name'), email: value('email'), agency_name: value('agency_name'), country: value('country'), phone: value('phone'), message: value('message') });
      form.reset(); setStatus('success');
    } catch { setStatus('error'); }
    finally { inFlight.current = false; }
  }
  return <div className={styles.modalBackdrop} onMouseDown={event => { if (event.target === event.currentTarget && !busy) close(); }}>
    <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={id} className={styles.dialog} onKeyDown={event => {
      if (event.key === 'Escape' && !busy) { event.stopPropagation(); close(); }
      if (event.key !== 'Tab') return;
      const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled)') || []);
      const first = controls[0], last = controls[controls.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
      <button type="button" onClick={close} disabled={busy} className={styles.closeButton} aria-label={copy.close}><X size={20} /></button><SlaivioBrand compact />
      <h2 id={id}>{status === 'success' ? copy.successTitle : copy.formTitle}</h2>
      {status === 'success' ? <div role="status" className={styles.success}><CheckCircle2 size={30} /><p>{copy.successText}</p><button type="button" className={`${styles.button} ${styles.greenButton}`} onClick={close}>{copy.close}</button></div> : <>
        <p className={styles.formIntro}>{copy.formIntro}</p>
        <form onSubmit={event => void submit(event)} aria-busy={busy}>
          <fieldset disabled={busy} className={styles.formGrid}>{['full_name', 'email', 'agency_name', 'country', 'phone'].map((name, index) => <label key={name}>{copy.fields[index]}<input name={name} required={index < 4} type={name === 'email' ? 'email' : name === 'phone' ? 'tel' : 'text'} autoComplete={['name', 'email', 'organization', 'country-name', 'tel'][index]} maxLength={name === 'email' ? 254 : 160} minLength={name === 'full_name' || name === 'agency_name' ? 2 : undefined} /></label>)}<label className={styles.fullWidth}>{copy.fields[5]}<textarea name="message" rows={3} maxLength={2000} /></label></fieldset>
          {status === 'error' && <p role="alert" className={styles.formError}>{copy.error}</p>}
          <button type="submit" disabled={busy} className={`${styles.button} ${styles.greenButton} ${styles.fullButton}`}>{busy ? copy.sending : copy.demo}{!busy && <ArrowRight size={16} />}</button>
          <p className={styles.formPrivacy}>{copy.privacy}</p>
        </form>
      </>}
    </div>
  </div>;
}
