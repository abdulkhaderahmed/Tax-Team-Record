import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { requireValidClerkConfiguration } from "@/lib/clerk-config";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhook(.*)",
  "/_next(.*)",
  "/favicon.ico",
  "/public(.*)",
]);

const clerkMode = requireValidClerkConfiguration(process.env);

const middleware =
  clerkMode === "configured"
    ? clerkMiddleware(async (auth, request) => {
        if (!isPublicRoute(request)) {
          await auth.protect();
        }
      })
    : (_request: NextRequest) => NextResponse.next();

export default middleware;

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|json)).*)",
  ],
};
