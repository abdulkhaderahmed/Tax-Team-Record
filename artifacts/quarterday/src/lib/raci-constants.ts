export const PARTY_TYPES = [
  "Internal tax",
  "Finance",
  "Payroll",
  "HR",
  "Legal",
  "Treasury",
  "Company secretarial",
  "Share plan administrator",
  "External tax adviser",
  "External legal adviser",
  "Auditor",
  "Board/CFO",
  "Other",
] as const;

export type PartyType = (typeof PARTY_TYPES)[number];

export const RACI_ROLES = [
  "Responsible",
  "Accountable",
  "Consulted",
  "Informed",
  "External adviser",
  "External operational owner",
] as const;

export type RaciRole = (typeof RACI_ROLES)[number];

export const RACI_ROLE_DEFINITIONS: Record<RaciRole, string> = {
  Responsible: "The person or team doing the work.",
  Accountable: "The person who owns the outcome and risk.",
  Consulted: "People or teams who must provide input before completion.",
  Informed: "People or teams who need to be kept aware but do not approve the work.",
  "External adviser": "An external adviser engaged on this item.",
  "External operational owner": "An external party actually operating a task (e.g. a payroll bureau).",
};

export const STATUS_VALUES = [
  "Not started",
  "In progress",
  "Blocked",
  "Needs owner",
  "Needs source verification",
  "Needs adviser input",
  "Ready for review",
  "Under review",
  "Approved",
  "Complete",
  "Submitted",
  "Paid",
  "Waived",
  "Not applicable",
] as const;

export type StatusValue = (typeof STATUS_VALUES)[number];

export const STATUS_FIELD_LABELS = {
  dataCompletenessStatus: "Data completeness status",
  dataValidationStatus: "Data validation status",
  technicalReviewStatus: "Technical review status",
  approvalStatus: "Approval status",
  workflowProgressStatus: "Workflow progress status",
  evidenceStatus: "Evidence status",
  filingSubmissionStatus: "Filing/submission status",
  paymentStatus: "Payment status",
} as const;

export type StatusFieldKey = keyof typeof STATUS_FIELD_LABELS;

export const STATUS_FIELD_DEFINITIONS: Record<StatusFieldKey, string> = {
  dataCompletenessStatus: "Whether all required data has been collected.",
  dataValidationStatus: "Whether the collected data has been checked against source systems.",
  technicalReviewStatus: "Whether the tax treatment or technical position has been reviewed.",
  approvalStatus: "Whether the accountable person has approved the item.",
  workflowProgressStatus: "Whether the operational task itself is moving.",
  evidenceStatus: "Whether required supporting evidence is attached or waived.",
  filingSubmissionStatus: "Whether a return, form, notification or report has been submitted.",
  paymentStatus: "Whether a payment has been made, if payment applies.",
};

export const REQUIREMENT_FLAG_LABELS = {
  dataCollectionRequired: "Data collection required",
  dataValidationRequired: "Data validation required",
  technicalReviewRequired: "Technical review required",
  accountableApprovalRequired: "Accountable approval required",
  evidenceRequired: "Evidence required",
  filingSubmissionRequired: "Filing/submission required",
  paymentRequired: "Payment required",
} as const;

export type RequirementFlagKey = keyof typeof REQUIREMENT_FLAG_LABELS;

// Which status values count as "this dimension is satisfied" for the overall-status computation.
const SATISFIED_VALUES: Record<StatusFieldKey, readonly StatusValue[]> = {
  dataCompletenessStatus: ["Complete", "Not applicable", "Waived"],
  dataValidationStatus: ["Complete", "Not applicable", "Waived"],
  workflowProgressStatus: ["Complete", "Not applicable", "Waived"],
  technicalReviewStatus: ["Approved", "Complete", "Not applicable", "Waived"],
  approvalStatus: ["Approved", "Complete", "Not applicable", "Waived"],
  evidenceStatus: ["Complete", "Not applicable", "Waived"],
  filingSubmissionStatus: ["Submitted", "Complete", "Not applicable", "Waived"],
  paymentStatus: ["Paid", "Complete", "Not applicable", "Waived"],
};

export function isStatusSatisfied(field: StatusFieldKey, value: string): boolean {
  return (SATISFIED_VALUES[field] as readonly string[]).includes(value);
}
