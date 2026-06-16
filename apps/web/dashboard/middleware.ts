import {
  clerkMiddleware,
  createRouteMatcher,
} from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const hasClerkKey = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

const isPublicRoute = createRouteMatcher([
  "/",
  "/landing(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/login",
]);

export default hasClerkKey
  ? clerkMiddleware(async (auth, request) => {
      if (request.nextUrl.pathname === "/") {
        return NextResponse.rewrite(new URL("/landing", request.url));
      }

      if (!isPublicRoute(request)) {
        await auth.protect();
      }
    })
  : function middleware(request: NextRequest) {
      if (request.nextUrl.pathname === "/") {
        return NextResponse.rewrite(new URL("/landing", request.url));
      }

      return NextResponse.next();
    };

export const config = {
  matcher: [
    "/((?!.*\\..*|_next).*)",
    "/",
  ],
};
