import assert from "node:assert/strict";
import test from "node:test";
import {
  AuthorizationError,
  assertIndependentDocumentReviewer,
  assertPermission,
  canBypassRestrictedDocumentGrant,
  canUseDocumentPermission,
  documentGrantAllows,
  hasPermission,
  isPositiveDocumentReviewDecision,
  normalizeRole,
  roleFromClerkOrgRole,
} from "./authz-policy";

test("normalizes stored and Clerk organization roles", () => {
  assert.equal(normalizeRole("Head of Tax"), "head_of_tax");
  assert.equal(roleFromClerkOrgRole("org:admin"), "admin");
  assert.equal(roleFromClerkOrgRole("org:member"), "member");
  assert.equal(roleFromClerkOrgRole("org:manager"), "manager");
  assert.equal(roleFromClerkOrgRole(undefined), "member");
  assert.equal(normalizeRole("unexpected-role"), "viewer");
});

test("permission matrix fails closed for destructive and approval operations", () => {
  assert.equal(hasPermission("member", "record:write"), true);
  assert.equal(hasPermission("member", "record:delete"), false);
  assert.equal(hasPermission("reviewer", "approval:decide"), true);
  assert.equal(hasPermission("viewer", "record:write"), false);
  assert.equal(hasPermission("admin", "organisation:manage"), true);

  assert.throws(
    () => assertPermission("member", "rules:approve"),
    (error) => error instanceof AuthorizationError && error.statusCode === 403,
  );
});

test("document grants use explicit, non-linear review and edit permissions", () => {
  assert.equal(documentGrantAllows("manage", "review"), true);
  assert.equal(documentGrantAllows("review", "view"), true);
  assert.equal(documentGrantAllows("review", "edit"), false);
  assert.equal(documentGrantAllows("edit", "review"), false);
  assert.equal(canBypassRestrictedDocumentGrant("head_of_tax"), true);
  assert.equal(canBypassRestrictedDocumentGrant("manager"), false);
});

test("restricted document controls require both a capable role and grant", () => {
  assert.equal(canUseDocumentPermission("reviewer", false, null, "review"), true);
  assert.equal(canUseDocumentPermission("reviewer", true, null, "review"), false);
  assert.equal(canUseDocumentPermission("reviewer", true, "review", "review"), true);
  assert.equal(canUseDocumentPermission("preparer", true, "review", "review"), false);
  assert.equal(canUseDocumentPermission("head_of_tax", true, null, "manage"), true);
});

test("positive document decisions require an independent reviewer", () => {
  assert.equal(
    isPositiveDocumentReviewDecision({
      relianceStatus: "Approved for reliance",
      isAuthoritativeSource: "No",
      sourceConfidence: "Medium",
    }),
    true,
  );
  assert.equal(
    isPositiveDocumentReviewDecision({
      relianceStatus: "Do not rely",
      isAuthoritativeSource: "No",
      sourceConfidence: "Low",
    }),
    false,
  );
  assert.throws(
    () =>
      assertIndependentDocumentReviewer({
        actorUserId: "user-preparer",
        uploadedById: "user-preparer",
        lastEditedById: null,
      }),
    AuthorizationError,
  );
  assert.doesNotThrow(() =>
    assertIndependentDocumentReviewer({
      actorUserId: "user-reviewer",
      uploadedById: "user-preparer",
      lastEditedById: "user-manager",
    }),
  );
});
