export type ControlledRecordFields = {
  dataCollectionRequired: boolean;
  dataValidationRequired: boolean;
  technicalReviewRequired: boolean;
  accountableApprovalRequired: boolean;
  evidenceRequired: boolean;
  filingSubmissionRequired: boolean;
  paymentRequired: boolean;
  dataCompletenessStatus: string;
  dataValidationStatus: string;
  technicalReviewStatus: string;
  approvalStatus: string;
  workflowProgressStatus: string;
  evidenceStatus: string;
  filingSubmissionStatus: string;
  paymentStatus: string;
  exceptionRequired: boolean;
  openIssueBlocker: string | null;
};

export function initialControlledRecordState<T extends ControlledRecordFields>(data: T): T {
  return {
    ...data,
    dataCompletenessStatus: "Not started",
    dataValidationStatus: "Not started",
    technicalReviewStatus: "Not started",
    approvalStatus: "Not started",
    workflowProgressStatus: "Not started",
    evidenceStatus: "Not started",
    filingSubmissionStatus: "Not started",
    paymentStatus: "Not started",
  };
}

/**
 * Generic record edits can describe work, but cannot manufacture first-class
 * control outcomes. Data completeness, technical review, approval and evidence
 * are always derived from their operating registers/gates. Preparers may add a
 * requirement or blocker, but only a reviewer can remove one.
 */
export function protectControlledRecordState<T extends ControlledRecordFields>(
  submitted: T,
  before: T,
  canReview: boolean,
): T {
  return {
    ...submitted,
    dataCompletenessStatus: before.dataCompletenessStatus,
    technicalReviewStatus: before.technicalReviewStatus,
    approvalStatus: before.approvalStatus,
    evidenceStatus: before.evidenceStatus,
    dataCollectionRequired: canReview
      ? submitted.dataCollectionRequired
      : before.dataCollectionRequired || submitted.dataCollectionRequired,
    dataValidationRequired: canReview
      ? submitted.dataValidationRequired
      : before.dataValidationRequired || submitted.dataValidationRequired,
    technicalReviewRequired: canReview
      ? submitted.technicalReviewRequired
      : before.technicalReviewRequired || submitted.technicalReviewRequired,
    accountableApprovalRequired: canReview
      ? submitted.accountableApprovalRequired
      : before.accountableApprovalRequired || submitted.accountableApprovalRequired,
    evidenceRequired: canReview
      ? submitted.evidenceRequired
      : before.evidenceRequired || submitted.evidenceRequired,
    filingSubmissionRequired: canReview
      ? submitted.filingSubmissionRequired
      : before.filingSubmissionRequired || submitted.filingSubmissionRequired,
    paymentRequired: canReview
      ? submitted.paymentRequired
      : before.paymentRequired || submitted.paymentRequired,
    dataValidationStatus: canReview
      ? submitted.dataValidationStatus
      : before.dataValidationStatus,
    exceptionRequired: canReview
      ? submitted.exceptionRequired
      : before.exceptionRequired || submitted.exceptionRequired,
    openIssueBlocker:
      !canReview && before.exceptionRequired && before.openIssueBlocker
        ? before.openIssueBlocker
        : submitted.openIssueBlocker,
  };
}
