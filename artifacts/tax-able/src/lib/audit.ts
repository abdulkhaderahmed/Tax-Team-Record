import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import type { OrgContext } from "./auth";

type AuditWriter = Pick<Prisma.TransactionClient, "auditEvent">;

export type AuditTarget = {
  objectType: string;
  objectId: string;
  entityId?: string | null;
  obligationId?: string | null;
  actionId?: string | null;
};

export type StructuredAuditInput = {
  organisationId: string;
  userId?: string | null;
  action: string;
  target?: AuditTarget;
  detail?: string | null;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
  correlationId?: string | null;
  actorNameSnapshot?: string | null;
  actorEmailSnapshot?: string | null;
};

export type UserAuditInput = Omit<
  StructuredAuditInput,
  "organisationId" | "userId"
>;

export const RESTRICTED_DOCUMENT_REDACTION = "[restricted document]";

export type RestrictedDocumentDescriptor = {
  id: string;
  filename: string;
};

type RedactableAuditEvent = {
  objectType: string | null;
  objectId: string | null;
  detail: string | null;
  reason: string | null;
  beforeJson: unknown;
  afterJson: unknown;
};

const RESTRICTED_SOURCE_KEYS = new Set([
  "documentId",
  "sourceDocumentId",
  "filename",
  "storageKey",
  "contentHash",
  "accessNotes",
  "sourceDocumentReference",
  "sourcePageParagraph",
  "pageReference",
  "pageOrChunk",
  "sourceTextExcerpt",
  "sourceChunkId",
  "documentReference",
]);

function redactRestrictedDocumentText(
  value: string | null,
  documents: readonly RestrictedDocumentDescriptor[],
): string | null {
  if (value == null) return null;
  let redacted = value;
  for (const document of documents) {
    for (const secret of [document.id, document.filename]) {
      if (secret) redacted = redacted.split(secret).join(RESTRICTED_DOCUMENT_REDACTION);
    }
  }
  return redacted;
}

function redactRestrictedDocumentJson(
  value: unknown,
  documents: readonly RestrictedDocumentDescriptor[],
): unknown {
  if (typeof value === "string") {
    return redactRestrictedDocumentText(value, documents);
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactRestrictedDocumentJson(item, documents));
  }
  if (!value || typeof value !== "object") return value;

  const record = value as Record<string, unknown>;
  const restrictedIds = new Set(documents.map((document) => document.id));
  const isDocumentSnapshot =
    typeof record.id === "string" &&
    restrictedIds.has(record.id) &&
    ("filename" in record || "storageKey" in record || "contentHash" in record);
  const isDocumentDerivedSnapshot =
    typeof record.documentId === "string" && restrictedIds.has(record.documentId);
  if (isDocumentSnapshot || isDocumentDerivedSnapshot) {
    return { restrictedDocument: true };
  }

  const referencesRestrictedSource =
    typeof record.sourceDocumentId === "string" &&
    restrictedIds.has(record.sourceDocumentId);

  return Object.fromEntries(
    Object.entries(record).map(([key, nestedValue]) => [
      key,
      referencesRestrictedSource && RESTRICTED_SOURCE_KEYS.has(key)
        ? RESTRICTED_DOCUMENT_REDACTION
        : redactRestrictedDocumentJson(nestedValue, documents),
    ]),
  );
}

/**
 * Produces an audit-display copy that cannot reveal restricted document
 * identifiers, filenames, source locations or snapshots to an ungranted user.
 */
export function redactAuditEventForRestrictedDocuments<
  T extends RedactableAuditEvent,
>(
  event: T,
  documents: readonly RestrictedDocumentDescriptor[],
): T {
  if (documents.length === 0) return event;
  const restrictedIds = new Set(documents.map((document) => document.id));
  const restrictedDocumentTarget =
    event.objectType?.toLowerCase() === "document" &&
    event.objectId != null &&
    restrictedIds.has(event.objectId);

  return {
    ...event,
    objectId: restrictedDocumentTarget
      ? RESTRICTED_DOCUMENT_REDACTION
      : redactRestrictedDocumentText(event.objectId, documents),
    detail: redactRestrictedDocumentText(event.detail, documents),
    reason: redactRestrictedDocumentText(event.reason, documents),
    beforeJson: restrictedDocumentTarget
      ? { restrictedDocument: true }
      : redactRestrictedDocumentJson(event.beforeJson, documents),
    afterJson: restrictedDocumentTarget
      ? { restrictedDocument: true }
      : redactRestrictedDocumentJson(event.afterJson, documents),
  } as T;
}

function auditJson(
  value: unknown,
): Prisma.InputJsonValue | Prisma.NullTypes.JsonNull | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;

  // JSON serialization gives audit snapshots stable values for Dates and strips
  // undefined object members. It also rejects cycles instead of silently
  // recording an incomplete change history.
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function buildAuditEventData(
  input: StructuredAuditInput,
): Prisma.AuditEventUncheckedCreateInput {
  if (!input.organisationId)
    throw new Error("organisationId is required for an audit event.");
  if (!input.action.trim())
    throw new Error("action is required for an audit event.");
  if (
    input.target &&
    (!input.target.objectType.trim() || !input.target.objectId.trim())
  ) {
    throw new Error("Audit targets require both objectType and objectId.");
  }

  return {
    organisationId: input.organisationId,
    userId: input.userId ?? null,
    entityId: input.target?.entityId ?? null,
    obligationId: input.target?.obligationId ?? null,
    actionId: input.target?.actionId ?? null,
    action: input.action.trim(),
    detail: input.detail ?? null,
    objectType: input.target?.objectType ?? null,
    objectId: input.target?.objectId ?? null,
    beforeJson: auditJson(input.before),
    afterJson: auditJson(input.after),
    reason: input.reason ?? null,
    correlationId: input.correlationId ?? null,
    actorNameSnapshot: input.actorNameSnapshot ?? null,
    actorEmailSnapshot: input.actorEmailSnapshot ?? null,
  };
}

/** Writes one append-only audit event. Pass a transaction client with the mutation. */
export function recordAuditEvent(
  input: StructuredAuditInput,
  client: AuditWriter = prisma,
) {
  return client.auditEvent.create({ data: buildAuditEventData(input) });
}

/** Attributes an interactive audit event to the authenticated internal User id. */
export function recordUserAuditEvent(
  context: OrgContext,
  input: UserAuditInput,
  client: AuditWriter = prisma,
) {
  return recordAuditEvent(
    {
      ...input,
      organisationId: context.orgId,
      userId: context.userId,
      actorNameSnapshot: context.user.name,
      actorEmailSnapshot: context.user.email,
    },
    client,
  );
}
