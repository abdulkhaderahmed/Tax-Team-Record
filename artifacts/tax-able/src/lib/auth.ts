import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";

export type OrgContext = {
  organisation: { id: string; name: string; clerkOrgId: string | null };
  user: { id: string; name: string; email: string; clerkUserId: string | null };
  orgId: string;
  userId: string;
};

const clerkConfigured = Boolean(process.env.CLERK_SECRET_KEY);

function toContext(
  organisation: { id: string; name: string; clerkOrgId: string | null },
  user: { id: string; name: string; email: string; clerkUserId: string | null },
): OrgContext {
  return {
    organisation: { id: organisation.id, name: organisation.name, clerkOrgId: organisation.clerkOrgId },
    user: { id: user.id, name: user.name, email: user.email, clerkUserId: user.clerkUserId },
    orgId: organisation.id,
    userId: user.id,
  };
}

/**
 * Dev/keyless fallback used when Clerk is not configured: resolves to a stable
 * demo organisation and user so the app is viewable without auth. Never used
 * when CLERK_SECRET_KEY is set.
 */
async function demoOrgContext(): Promise<OrgContext> {
  let organisation =
    (await prisma.organisation.findUnique({ where: { clerkOrgId: "demo-org" } })) ??
    (await prisma.organisation.findFirst({ orderBy: { createdAt: "asc" } }));
  if (!organisation) {
    organisation = await prisma.organisation.create({
      data: { name: "Demo Organisation", clerkOrgId: "demo-org" },
    });
  }

  let user =
    (await prisma.user.findFirst({ where: { organisationId: organisation.id }, orderBy: { createdAt: "asc" } }));
  if (!user) {
    user = await prisma.user.create({
      data: {
        name: "Demo User",
        email: "demo@tax-able.local",
        organisationId: organisation.id,
        role: "admin",
      },
    });
  }

  return toContext(organisation, user);
}

/**
 * Resolves the current Clerk session to an internal organisation and user.
 * Creates the internal Organisation and User rows on first sign-in.
 * Throws a redirect to /sign-in if the session is missing or has no org.
 */
export async function requireOrg(): Promise<OrgContext> {
  if (!clerkConfigured) {
    return demoOrgContext();
  }

  const { userId, orgId, orgSlug } = await auth();
  if (!userId || !orgId) {
    redirect("/sign-in");
  }

  let organisation = await prisma.organisation.findUnique({
    where: { clerkOrgId: orgId },
  });

  if (!organisation) {
    const orgName = orgSlug
      ? orgSlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      : "Organisation";
    organisation = await prisma.organisation.create({
      data: { name: orgName, clerkOrgId: orgId },
    });
  }

  let user = await prisma.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) {
    const clerkUser = await currentUser();
    const primaryEmail = clerkUser?.emailAddresses[0]?.emailAddress;
    const name =
      clerkUser?.firstName && clerkUser?.lastName
        ? `${clerkUser.firstName} ${clerkUser.lastName}`
        : clerkUser?.firstName ?? clerkUser?.username ?? "User";
    user = await prisma.user.create({
      data: {
        name,
        email: primaryEmail ?? `${userId}@placeholder.local`,
        clerkUserId: userId,
        organisationId: organisation.id,
        role: "member",
      },
    });
  }

  if (user.organisationId !== organisation.id) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { organisationId: organisation.id },
    });
  }

  return {
    organisation: {
      id: organisation.id,
      name: organisation.name,
      clerkOrgId: organisation.clerkOrgId,
    },
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      clerkUserId: user.clerkUserId,
    },
    orgId: organisation.id,
    userId: user.id,
  };
}

export async function requireAdmin(): Promise<OrgContext> {
  if (!clerkConfigured) {
    return demoOrgContext();
  }
  const { orgRole } = await auth();
  if (orgRole !== "admin") {
    throw new Error("Admin role required");
  }
  return requireOrg();
}
