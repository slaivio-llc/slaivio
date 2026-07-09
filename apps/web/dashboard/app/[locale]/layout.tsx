import type { Metadata } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { routing, type Locale } from "@/i18n/routing";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const t = await getTranslations({ locale, namespace: "metadata" });
  const canonical = `https://slaivio.com/${locale}`;

  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical,
      languages: {
        fr: "https://slaivio.com/fr",
        en: "https://slaivio.com/en",
        "x-default": "https://slaivio.com/fr",
      },
    },
    openGraph: {
      title: t("ogTitle"),
      description: t("ogDescription"),
      url: canonical,
      siteName: "Slaivio",
      type: "website",
      locale,
      alternateLocale: routing.locales.filter((item) => item !== locale),
      images: [
        {
          url: "/slaivio-logo-official-dark.png",
          alt: "SLAIVIO",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: t("ogTitle"),
      description: t("ogDescription"),
      images: ["/slaivio-logo-official-dark.png"],
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages({ locale });

  return (
    <NextIntlClientProvider locale={locale as Locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
