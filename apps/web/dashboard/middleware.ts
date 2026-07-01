import {
  clerkMiddleware,
  createRouteMatcher,
} from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const hasClerkKey = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

const publicPathnames = new Set([
  "/",
  "/login",
]);

const isPublicRoute = createRouteMatcher([
  "/",
  "/landing(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/login",
]);

export default hasClerkKey
  ? clerkMiddleware(async (auth, request) => {
      if (
        publicPathnames.has(request.nextUrl.pathname) ||
        request.nextUrl.pathname.startsWith("/landing") ||
        request.nextUrl.pathname.startsWith("/sign-in") ||
        request.nextUrl.pathname.startsWith("/sign-up")
      ) {
        return NextResponse.next();
      }

      if (!isPublicRoute(request)) {
        await auth.protect();
      }
    })
  : function middleware(_request: NextRequest) {
      return NextResponse.next();
    };

export const config = {
  matcher: [
    "/((?!.*\\..*|_next).*)",
    "/",
  ],
};
