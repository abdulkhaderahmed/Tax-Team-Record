import assert from "node:assert/strict";
import test from "node:test";
import {
  ControlValidationError,
  assertApprovalDecision,
  assertApprovalRequest,
  assertExactlyOneApprovalTarget,
  aggregateApprovalStatus,
} from "./control-register-policy";
import { AuthorizationError } from "./authz-policy";

test("approval requests require an independent approver and one target", () => {
  assert.doesNotThrow(() => assertApprovalRequest("requester", "reviewer"));
  assert.throws(
    () => assertApprovalRequest("same-user", "same-user"),
    ControlValidationError,
  );
  assert.doesNotThrow(() => assertExactlyOneApprovalTarget("obligation-1", null));
  assert.throws(() => assertExactlyOneApprovalTarget(null, null), ControlValidationError);
  assert.throws(
    () => assertExactlyOneApprovalTarget("obligation-1", "action-1"),
    ControlValidationError,
  );
});

test("approval aggregation fails closed across multiple active gates", () => {
  assert.equal(aggregateApprovalStatus([]), "Not started");
  assert.equal(aggregateApprovalStatus(["Approved"]), "Approved");
  assert.equal(aggregateApprovalStatus(["Approved", "Pending"]), "Under review");
  assert.equal(aggregateApprovalStatus(["Approved", "Rejected"]), "Blocked");
  assert.equal(aggregateApprovalStatus(["Superseded"]), "Not started");
});

test("only the assigned approver or an admin can decide", () => {
  const base = {
    requesterId: "requester",
    approverId: "approver",
    currentStatus: "Pending",
    decision: "Approved",
  };

  assert.doesNotThrow(() =>
    assertApprovalDecision({ ...base, actorId: "approver", actorRole: "reviewer" }),
  );
  assert.doesNotThrow(() =>
    assertApprovalDecision({ ...base, actorId: "admin", actorRole: "admin" }),
  );
  assert.throws(
    () => assertApprovalDecision({ ...base, actorId: "other", actorRole: "manager" }),
    AuthorizationError,
  );
  assert.throws(
    () => assertApprovalDecision({ ...base, actorId: "requester", actorRole: "admin" }),
    ControlValidationError,
  );
});
