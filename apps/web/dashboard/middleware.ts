import { clerkMiddleware } from "@clerk/nextjs/server";
import createIntlMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { routing } from "@/i18n/routing";

const hasClerkKey = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
const intlMiddleware = createIntlMiddleware(routing);

const protectedPrefixes = [
  "/app",
  "/broadcasts",
  "/commercial",
  "/customs",
  "/delivery",
  "/dossiers",
  "/escalations",
  "/financial",
  "/inbox",
  "/knowledge",
  "/manifests",
  "/onboarding",
  "/operations",
  "/settings",
  "/shipment-batches",
  "/shipments",
  "/test-api",
  "/warehouse",
  "/whatsapp",
  "/whatsapp-settings",
];

const clerkProtection = clerkMiddleware(async (auth) => {
  await auth.protect();
});

function isProtectedRoute(pathname: string) {
  return protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isPublicI18nRoute(pathname: string) {
  return pathname === "/" || pathname === "/landing" || /^\/(fr|en)(\/.*)?$/.test(pathname);
}

export default function middleware(request: NextRequest, event: Parameters<typeof clerkProtection>[1]) {
  const { pathname } = request.nextUrl;

  if (isProtectedRoute(pathname)) {
    if (hasClerkKey) {
      return clerkProtection(request, event);
    }

    return NextResponse.next();
  }

  if (isPublicI18nRoute(pathname)) {
    return intlMiddleware(request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
