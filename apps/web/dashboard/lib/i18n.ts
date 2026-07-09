import { routing, type Locale } from "@/i18n/routing";

export const locales = routing.locales;
export const defaultLocale = routing.defaultLocale;

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}
