import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhook(.*)",
  "/_next(.*)",
  "/favicon.ico",
  "/public(.*)",
]);

const clerkConfigured = Boolean(process.env.CLERK_SECRET_KEY);

export default clerkMiddleware(async (auth, request) => {
  if (clerkConfigured && !isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|json)).*)",
  ],
};
