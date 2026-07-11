import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { prisma } from "./prisma";
import { requireValidClerkConfiguration } from "./clerk-config";
import {
  assertPermission,
  assertRole,
  normalizeRole,
  roleFromClerkOrgRole,
  type AppPermission,
  type AppRole,
} from "./authz-policy";

export type OrgContext = {
  organisation: { id: string; name: string; clerkOrgId: string | null };
  user: {
    id: string;
    name: string;
    email: string;
    clerkUserId: string | null;
    role: AppRole;
  };
  orgId: string;
  userId: string;
};

const clerkConfigured =
  requireValidClerkConfiguration(process.env) === "configured";

function toContext(
  organisation: { id: string; name: string; clerkOrgId: string | null },
  user: {
    id: string;
    name: string;
    email: string;
    clerkUserId: string | null;
    role: string;
  },
): OrgContext {
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
      role: normalizeRole(user.role),
    },
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
    (await prisma.organisation.findUnique({
      where: { clerkOrgId: "demo-org" },
    })) ??
    (await prisma.organisation.findFirst({ orderBy: { createdAt: "asc" } }));
  if (!organisation) {
    organisation = await prisma.organisation.create({
      data: { name: "Demo Organisation", clerkOrgId: "demo-org" },
    });
  }

  let user = await prisma.user.findFirst({
    where: { organisationId: organisation.id },
    orderBy: { createdAt: "asc" },
  });
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
  // Every organisation-scoped view is request-specific, including keyless
  // local demo mode. Without this boundary Next can freeze database-backed
  // registers at build time when Clerk is deliberately absent.
  await connection();

  if (!clerkConfigured) {
    return demoOrgContext();
  }

  const { userId, orgId, orgSlug, orgRole } = await auth();
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
        : (clerkUser?.firstName ?? clerkUser?.username ?? "User");
    user = await prisma.user.create({
      data: {
        name,
        email: primaryEmail ?? `${userId}@placeholder.local`,
        clerkUserId: userId,
        organisationId: organisation.id,
        role: roleFromClerkOrgRole(orgRole),
      },
    });
  }

  if (user.organisationId !== organisation.id) {
    throw new Error(
      "This authenticated user is already linked to another organisation. Multi-organisation memberships are not enabled in this build.",
    );
  }

  const currentOrgRole = roleFromClerkOrgRole(orgRole);
  if (normalizeRole(user.role) !== currentOrgRole) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { role: currentOrgRole },
    });
  }

  return toContext(organisation, user);
}

export async function requireRole(
  ...allowedRoles: AppRole[]
): Promise<OrgContext> {
  const context = await requireOrg();
  assertRole(context.user.role, allowedRoles);
  return context;
}

export async function requirePermission(
  permission: AppPermission,
): Promise<OrgContext> {
  const context = await requireOrg();
  assertPermission(context.user.role, permission);
  return context;
}

export function requireAdmin(): Promise<OrgContext> {
  return requireRole("admin");
}
