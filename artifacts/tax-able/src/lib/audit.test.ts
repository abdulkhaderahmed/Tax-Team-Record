import assert from "node:assert/strict";
import test from "node:test";
import {
  RESTRICTED_DOCUMENT_REDACTION,
  buildAuditEventData,
  redactAuditEventForRestrictedDocuments,
} from "./audit";

test("builds an attributed, structured audit event", () => {
  const data = buildAuditEventData({
    organisationId: "org-1",
    userId: "user-1",
    action: " obligation_updated ",
    target: {
      objectType: "Obligation",
      objectId: "obligation-1",
      entityId: "entity-1",
      obligationId: "obligation-1",
    },
    before: { filingDeadline: new Date("2026-09-30T00:00:00.000Z") },
    after: { filingDeadline: "2026-10-01T00:00:00.000Z" },
    reason: "Deadline confirmed against source",
    correlationId: "request-1",
  });

  assert.equal(data.organisationId, "org-1");
  assert.equal(data.userId, "user-1");
  assert.equal(data.action, "obligation_updated");
  assert.equal(data.objectType, "Obligation");
  assert.equal(data.objectId, "obligation-1");
  assert.deepEqual(data.beforeJson, {
    filingDeadline: "2026-09-30T00:00:00.000Z",
  });
  assert.deepEqual(data.afterJson, {
    filingDeadline: "2026-10-01T00:00:00.000Z",
  });
});

test("rejects incomplete audit identity and targets", () => {
  assert.throws(() =>
    buildAuditEventData({ organisationId: "", action: "changed" }),
  );
  assert.throws(() =>
    buildAuditEventData({
      organisationId: "org-1",
      action: "changed",
      target: { objectType: "Document", objectId: "" },
    }),
  );
});

test("redacts a restricted document target and its snapshots", () => {
  const event = redactAuditEventForRestrictedDocuments(
    {
      objectType: "Document",
      objectId: "doc-secret",
      detail: "Uploaded secret-tax-memo.pdf",
      reason: "Replaced doc-secret",
      beforeJson: null,
      afterJson: {
        id: "doc-secret",
        filename: "secret-tax-memo.pdf",
        storageKey: "org/doc-secret/secret-tax-memo.pdf",
      },
    },
    [{ id: "doc-secret", filename: "secret-tax-memo.pdf" }],
  );

  assert.equal(event.objectId, RESTRICTED_DOCUMENT_REDACTION);
  assert.equal(event.detail, `Uploaded ${RESTRICTED_DOCUMENT_REDACTION}`);
  assert.equal(event.reason, `Replaced ${RESTRICTED_DOCUMENT_REDACTION}`);
  assert.deepEqual(event.afterJson, { restrictedDocument: true });
});

test("preserves record audit detail while redacting its restricted source", () => {
  const event = redactAuditEventForRestrictedDocuments(
    {
      objectType: "Obligation",
      objectId: "obligation-1",
      detail: null,
      reason: null,
      beforeJson: null,
      afterJson: {
        id: "obligation-1",
        description: "Corporation tax return",
        sourceDocumentId: "doc-secret",
        sourceDocumentReference: "secret-tax-memo.pdf",
        sourcePageParagraph: "page 19",
      },
    },
    [{ id: "doc-secret", filename: "secret-tax-memo.pdf" }],
  );

  assert.deepEqual(event.afterJson, {
    id: "obligation-1",
    description: "Corporation tax return",
    sourceDocumentId: RESTRICTED_DOCUMENT_REDACTION,
    sourceDocumentReference: RESTRICTED_DOCUMENT_REDACTION,
    sourcePageParagraph: RESTRICTED_DOCUMENT_REDACTION,
  });
});
