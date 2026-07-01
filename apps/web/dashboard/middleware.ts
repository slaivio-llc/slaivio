import { clerkMiddleware } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const hasClerkKey = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export default hasClerkKey
  ? clerkMiddleware(async (auth, request) => {
      await auth.protect();
    })
  : function middleware(_request: NextRequest) {
      return NextResponse.next();
    };

export const config = {
  matcher: [
    "/app(.*)",
    "/broadcasts(.*)",
    "/commercial(.*)",
    "/customs(.*)",
    "/delivery(.*)",
    "/dossiers(.*)",
    "/escalations(.*)",
    "/financial(.*)",
    "/inbox(.*)",
    "/knowledge(.*)",
    "/manifests(.*)",
    "/onboarding(.*)",
    "/operations(.*)",
    "/settings(.*)",
    "/shipment-batches(.*)",
    "/shipments(.*)",
    "/test-api(.*)",
    "/warehouse(.*)",
    "/whatsapp(.*)",
    "/whatsapp-settings(.*)",
  ],
};
