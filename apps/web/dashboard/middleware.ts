import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const hasClerkKey = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export default hasClerkKey
  ? clerkMiddleware()
  : function middleware() {
      return NextResponse.next();
    };

export const config = {
  matcher: [
    "/((?!.*\\..*|_next).*)",
    "/",
  ],
};

