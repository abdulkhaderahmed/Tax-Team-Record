import { isStatusSatisfied, type StatusFieldKey } from "./raci-constants";

export interface OwnershipControlInput {
  responsibleOwner: string | null;
  riskLevel: string | null;
  exceptionRequired: boolean;
  openIssueBlocker: string | null;

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
}

export interface OverallStatusResult {
  status: string;
  uncertain: boolean;
}

const REQUIREMENT_TO_STATUS_FIELD: Array<[keyof OwnershipControlInput, StatusFieldKey]> = [
  ["dataCollectionRequired", "dataCompletenessStatus"],
  ["dataValidationRequired", "dataValidationStatus"],
  ["technicalReviewRequired", "technicalReviewStatus"],
  ["accountableApprovalRequired", "approvalStatus"],
  ["evidenceRequired", "evidenceStatus"],
  ["filingSubmissionRequired", "filingSubmissionStatus"],
  ["paymentRequired", "paymentStatus"],
];

/**
 * Derives a suggested overall status from the component statuses and
 * requirement flags. Intentionally simple (a handful of ordered rules), per
 * the spec's own instruction not to over-engineer this. The result is always
 * a starting point a human can override with a note — see
 * `overallStatusIsOverride` on the models.
 */
export function computeOverallStatus(input: OwnershipControlInput): OverallStatusResult {
  const highRiskExceptionOpen =
    input.exceptionRequired &&
    !!input.openIssueBlocker?.trim() &&
    (input.riskLevel === "High" || input.riskLevel === "Critical");
  if (highRiskExceptionOpen) return { status: "Blocked", uncertain: false };

  if (!input.responsibleOwner?.trim()) return { status: "Needs owner", uncertain: false };

  const requirementResults = REQUIREMENT_TO_STATUS_FIELD.map(([requiredKey, statusField]) => {
    const required = input[requiredKey] as boolean;
    const value = input[statusField] as string;
    return { required, satisfied: !required || isStatusSatisfied(statusField, value), value };
  });

  if (requirementResults.every((r) => r.satisfied)) {
    return { status: "Complete", uncertain: false };
  }

  const anyBlocked = requirementResults.some((r) => r.required && r.value === "Blocked");
  if (anyBlocked) return { status: "Blocked", uncertain: false };

  const anyNeedsInput = requirementResults.some(
    (r) => r.required && (r.value === "Needs adviser input" || r.value === "Needs source verification")
  );
  if (anyNeedsInput) return { status: "In progress", uncertain: true };

  return { status: "In progress", uncertain: false };
}

export interface OwnershipWarning {
  code: string;
  message: string;
}

/**
 * Surfaces the plain-English warnings the review UI should show. Purely
 * informational — never blocks saving.
 */
export function computeOwnershipWarnings(input: {
  responsibleOwner: string | null;
  accountableOwner: string | null;
  dataCollectionRequired: boolean;
  dataCompletenessStatus: string;
  dataValidationRequired: boolean;
  dataValidationStatus: string;
  technicalReviewRequired: boolean;
  technicalReviewStatus: string;
  accountableApprovalRequired: boolean;
  approvalStatus: string;
  evidenceRequired: boolean;
  evidenceStatus: string;
  filingSubmissionRequired: boolean;
  filingSubmissionStatus: string;
  paymentRequired: boolean;
  paymentStatus: string;
  exceptionRequired: boolean;
  openIssueBlocker: string | null;
}): OwnershipWarning[] {
  const warnings: OwnershipWarning[] = [];
  if (!input.responsibleOwner?.trim()) warnings.push({ code: "no_responsible_owner", message: "No responsible owner." });
  if (!input.accountableOwner?.trim()) warnings.push({ code: "no_accountable_owner", message: "No accountable owner." });
  if (input.dataCollectionRequired && !isStatusSatisfied("dataCompletenessStatus", input.dataCompletenessStatus))
    warnings.push({ code: "data_incomplete", message: "Data incomplete." });
  if (input.dataValidationRequired && !isStatusSatisfied("dataValidationStatus", input.dataValidationStatus))
    warnings.push({ code: "data_not_validated", message: "Data not validated." });
  if (input.technicalReviewRequired && !isStatusSatisfied("technicalReviewStatus", input.technicalReviewStatus))
    warnings.push({ code: "technical_review_outstanding", message: "Technical review outstanding." });
  if (input.accountableApprovalRequired && !isStatusSatisfied("approvalStatus", input.approvalStatus))
    warnings.push({ code: "approval_outstanding", message: "Approval outstanding." });
  if (input.evidenceRequired && !isStatusSatisfied("evidenceStatus", input.evidenceStatus))
    warnings.push({ code: "evidence_missing", message: "Evidence missing." });
  if (input.filingSubmissionRequired && !isStatusSatisfied("filingSubmissionStatus", input.filingSubmissionStatus))
    warnings.push({ code: "filing_not_submitted", message: "Filing not submitted." });
  if (input.paymentRequired && !isStatusSatisfied("paymentStatus", input.paymentStatus))
    warnings.push({ code: "payment_not_made", message: "Payment not made." });
  if (input.exceptionRequired && input.openIssueBlocker?.trim())
    warnings.push({ code: "open_exception", message: "Open exception." });
  if (input.dataValidationStatus === "Needs source verification" || input.dataCompletenessStatus === "Needs source verification")
    warnings.push({ code: "needs_source_verification", message: "Source verification required." });
  return warnings;
}
