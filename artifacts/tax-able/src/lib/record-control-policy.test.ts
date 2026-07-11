import assert from "node:assert/strict";
import test from "node:test";
import {
  initialControlledRecordState,
  protectControlledRecordState,
  type ControlledRecordFields,
} from "./record-control-policy";

function state(overrides: Partial<ControlledRecordFields> = {}): ControlledRecordFields {
  return {
    dataCollectionRequired: true,
    dataValidationRequired: true,
    technicalReviewRequired: true,
    accountableApprovalRequired: true,
    evidenceRequired: true,
    filingSubmissionRequired: true,
    paymentRequired: true,
    dataCompletenessStatus: "In progress",
    dataValidationStatus: "Under review",
    technicalReviewStatus: "Under review",
    approvalStatus: "Under review",
    workflowProgressStatus: "In progress",
    evidenceStatus: "In progress",
    filingSubmissionStatus: "Not started",
    paymentStatus: "Not started",
    exceptionRequired: true,
    openIssueBlocker: "Missing payroll reconciliation",
    ...overrides,
  };
}

test("new records cannot arrive with pre-asserted control outcomes", () => {
  const result = initialControlledRecordState(state({
    approvalStatus: "Approved",
    evidenceStatus: "Complete",
    technicalReviewStatus: "Approved",
  }));
  assert.equal(result.approvalStatus, "Not started");
  assert.equal(result.evidenceStatus, "Not started");
  assert.equal(result.technicalReviewStatus, "Not started");
});

test("preparers cannot clear requirements, blockers, or derived outcomes", () => {
  const before = state();
  const submitted = state({
    dataCollectionRequired: false,
    technicalReviewRequired: false,
    accountableApprovalRequired: false,
    evidenceRequired: false,
    dataCompletenessStatus: "Complete",
    technicalReviewStatus: "Approved",
    approvalStatus: "Approved",
    evidenceStatus: "Waived",
    exceptionRequired: false,
    openIssueBlocker: null,
  });
  const result = protectControlledRecordState(submitted, before, false);
  assert.equal(result.dataCollectionRequired, true);
  assert.equal(result.technicalReviewRequired, true);
  assert.equal(result.approvalStatus, "Under review");
  assert.equal(result.evidenceStatus, "In progress");
  assert.equal(result.technicalReviewStatus, "Under review");
  assert.equal(result.exceptionRequired, true);
  assert.equal(result.openIssueBlocker, "Missing payroll reconciliation");
});

test("reviewers may change requirements but not approval/evidence/technical gate outcomes", () => {
  const before = state();
  const submitted = state({
    evidenceRequired: false,
    dataValidationStatus: "Complete",
    technicalReviewStatus: "Approved",
    approvalStatus: "Approved",
    evidenceStatus: "Waived",
  });
  const result = protectControlledRecordState(submitted, before, true);
  assert.equal(result.evidenceRequired, false);
  assert.equal(result.dataValidationStatus, "Complete");
  assert.equal(result.technicalReviewStatus, "Under review");
  assert.equal(result.approvalStatus, "Under review");
  assert.equal(result.evidenceStatus, "In progress");
});
