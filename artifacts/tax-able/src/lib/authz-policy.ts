export const APP_ROLES = [
  "admin",
  "head_of_tax",
  "manager",
  "reviewer",
  "preparer",
  "member",
  "viewer",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const APP_PERMISSIONS = [
  "organisation:manage",
  "entity:read",
  "entity:write",
  "entity:delete",
  "record:read",
  "record:write",
  "record:delete",
  "review:perform",
  "approval:decide",
  "rules:read",
  "rules:edit",
  "rules:approve",
  "document:read",
  "document:upload",
  "document:edit",
  "document:review",
  "document:manage_access",
  "audit:read",
] as const;

export type AppPermission = (typeof APP_PERMISSIONS)[number];

export type DocumentPermission = "view" | "edit" | "review" | "manage";

const READ_PERMISSIONS: AppPermission[] = [
  "entity:read",
  "record:read",
  "rules:read",
  "document:read",
  "audit:read",
];

const PREPARER_PERMISSIONS: AppPermission[] = [
  ...READ_PERMISSIONS,
  "entity:write",
  "record:write",
  "document:upload",
  "document:edit",
];

const REVIEWER_PERMISSIONS: AppPermission[] = [
  ...READ_PERMISSIONS,
  "review:perform",
  "approval:decide",
  "document:review",
];

const MANAGER_PERMISSIONS: AppPermission[] = [
  ...PREPARER_PERMISSIONS,
  ...REVIEWER_PERMISSIONS,
  "rules:edit",
];

const HEAD_OF_TAX_PERMISSIONS: AppPermission[] = [
  ...MANAGER_PERMISSIONS,
  "entity:delete",
  "record:delete",
  "rules:approve",
  "document:manage_access",
];

const ROLE_PERMISSIONS: Record<AppRole, ReadonlySet<AppPermission>> = {
  admin: new Set(APP_PERMISSIONS),
  head_of_tax: new Set(HEAD_OF_TAX_PERMISSIONS),
  manager: new Set(MANAGER_PERMISSIONS),
  reviewer: new Set(REVIEWER_PERMISSIONS),
  preparer: new Set(PREPARER_PERMISSIONS),
  member: new Set(PREPARER_PERMISSIONS),
  viewer: new Set(READ_PERMISSIONS),
};

const ROLE_ALIASES: Record<string, AppRole> = {
  "org:admin": "admin",
  administrator: "admin",
  "head of tax": "head_of_tax",
  "tax manager": "manager",
  contributor: "preparer",
  "tax preparer": "preparer",
  "read only": "viewer",
  readonly: "viewer",
};

const DOCUMENT_PERMISSION_REQUIREMENTS: Record<
  DocumentPermission,
  AppPermission
> = {
  view: "document:read",
  edit: "document:edit",
  review: "document:review",
  manage: "document:manage_access",
};

const DOCUMENT_GRANT_HIERARCHY: Record<
  DocumentPermission,
  readonly DocumentPermission[]
> = {
  view: ["view", "edit", "review", "manage"],
  edit: ["edit", "manage"],
  review: ["review", "manage"],
  manage: ["manage"],
};

const RESTRICTED_DOCUMENT_BYPASS_ROLES = new Set<AppRole>([
  "admin",
  "head_of_tax",
]);

export class AuthorizationError extends Error {
  readonly code: "forbidden" | "not_found";
  readonly statusCode: 403 | 404;

  constructor(
    message = "Access denied.",
    code: "forbidden" | "not_found" = "forbidden",
  ) {
    super(message);
    this.name = "AuthorizationError";
    this.code = code;
    this.statusCode = code === "not_found" ? 404 : 403;
  }
}

export function normalizeRole(role: string | null | undefined): AppRole {
  if (!role) return "viewer";
  const normalized = role
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, "_");
  if ((APP_ROLES as readonly string[]).includes(normalized))
    return normalized as AppRole;
  return ROLE_ALIASES[role.trim().toLowerCase()] ?? "viewer";
}

export function roleFromClerkOrgRole(role: string | null | undefined): AppRole {
  if (!role) return "member";
  const withoutNamespace = role.startsWith("org:") ? role.slice(4) : role;
  return normalizeRole(withoutNamespace);
}

export function hasPermission(
  role: string | null | undefined,
  permission: AppPermission,
): boolean {
  return ROLE_PERMISSIONS[normalizeRole(role)].has(permission);
}

export function assertPermission(
  role: string | null | undefined,
  permission: AppPermission,
): void {
  if (!hasPermission(role, permission)) {
    throw new AuthorizationError(`Permission required: ${permission}.`);
  }
}

export function assertRole(
  role: string | null | undefined,
  allowedRoles: readonly AppRole[],
): void {
  if (!allowedRoles.includes(normalizeRole(role))) {
    throw new AuthorizationError(
      `Role required: ${allowedRoles.join(" or ")}.`,
    );
  }
}

export function requiredPermissionForDocument(
  permission: DocumentPermission,
): AppPermission {
  return DOCUMENT_PERMISSION_REQUIREMENTS[permission];
}

export function documentGrantPermissions(
  permission: DocumentPermission,
): readonly DocumentPermission[] {
  return DOCUMENT_GRANT_HIERARCHY[permission];
}

export function documentGrantAllows(
  grantedPermission: string | null | undefined,
  requiredPermission: DocumentPermission,
): boolean {
  if (!grantedPermission) return false;
  return DOCUMENT_GRANT_HIERARCHY[requiredPermission].includes(
    grantedPermission.trim().toLowerCase() as DocumentPermission,
  );
}

export function canBypassRestrictedDocumentGrant(
  role: string | null | undefined,
): boolean {
  return RESTRICTED_DOCUMENT_BYPASS_ROLES.has(normalizeRole(role));
}

/**
 * Pure counterpart to documentAccessWhere for deciding which controls may be
 * rendered. Restricted documents still require both the role permission and a
 * sufficient, explicit document grant unless the role has the narrow bypass.
 */
export function canUseDocumentPermission(
  role: string | null | undefined,
  restrictedAccess: boolean,
  grantedPermission: string | null | undefined,
  requiredPermission: DocumentPermission,
): boolean {
  if (!hasPermission(role, requiredPermissionForDocument(requiredPermission))) {
    return false;
  }
  if (!restrictedAccess || canBypassRestrictedDocumentGrant(role)) return true;
  return documentGrantAllows(grantedPermission, requiredPermission);
}

export function isPositiveDocumentReviewDecision(input: {
  relianceStatus: string;
  isAuthoritativeSource: string;
  sourceConfidence: string;
}): boolean {
  return (
    input.relianceStatus === "Approved for reliance" ||
    input.isAuthoritativeSource === "Yes" ||
    input.sourceConfidence === "High"
  );
}

/** Enforces preparer/reviewer separation for positive source decisions. */
export function assertIndependentDocumentReviewer(input: {
  actorUserId: string;
  uploadedById?: string | null;
  lastEditedById?: string | null;
}): void {
  if (
    input.actorUserId === input.uploadedById ||
    input.actorUserId === input.lastEditedById
  ) {
    throw new AuthorizationError(
      "The uploader or latest metadata editor cannot approve this document for reliance or authority.",
    );
  }
}
