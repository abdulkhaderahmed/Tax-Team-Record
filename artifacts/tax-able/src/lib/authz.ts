import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { requirePermission, type OrgContext } from "./auth";
import {
  AuthorizationError,
  assertPermission,
  canBypassRestrictedDocumentGrant,
  documentGrantPermissions,
  requiredPermissionForDocument,
  type DocumentPermission,
} from "./authz-policy";

/**
 * Produces the tenant- and ACL-scoped predicate that document-derived queries
 * must use. Restricted documents are visible only to privileged roles or to a
 * user with a sufficient DocumentAccess grant.
 */
export function documentAccessWhere(
  context: OrgContext,
  permission: DocumentPermission = "view",
): Prisma.DocumentWhereInput {
  assertPermission(
    context.user.role,
    requiredPermissionForDocument(permission),
  );

  if (canBypassRestrictedDocumentGrant(context.user.role)) {
    return { organisationId: context.orgId, deletedAt: null };
  }

  return {
    organisationId: context.orgId,
    deletedAt: null,
    OR: [
      { restrictedAccess: false },
      {
        accessGrants: {
          some: {
            organisationId: context.orgId,
            userId: context.userId,
            permission: { in: [...documentGrantPermissions(permission)] },
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
        },
      },
    ],
  };
}

export type AccessibleDocument = {
  id: string;
  organisationId: string;
  restrictedAccess: boolean;
};

/**
 * Authorizes access without revealing whether an inaccessible document exists.
 * Callers can pass an existing context to avoid resolving the session twice.
 */
export async function requireDocumentAccess(
  documentId: string,
  permission: DocumentPermission = "view",
  existingContext?: OrgContext,
): Promise<{ context: OrgContext; document: AccessibleDocument }> {
  const context =
    existingContext ??
    (await requirePermission(requiredPermissionForDocument(permission)));

  if (existingContext) {
    assertPermission(
      context.user.role,
      requiredPermissionForDocument(permission),
    );
  }

  const document = await prisma.document.findFirst({
    where: {
      AND: [{ id: documentId }, documentAccessWhere(context, permission)],
    },
    select: {
      id: true,
      organisationId: true,
      restrictedAccess: true,
    },
  });

  if (!document) {
    throw new AuthorizationError(
      "Document not found or access denied.",
      "not_found",
    );
  }

  return { context, document };
}

export {
  AuthorizationError,
  hasPermission,
  normalizeRole,
  type AppPermission,
  type AppRole,
  type DocumentPermission,
} from "./authz-policy";
