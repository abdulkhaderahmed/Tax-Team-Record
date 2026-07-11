import { AuthorizationError, normalizeRole } from "./authz-policy";

export const ASSUMPTION_STATUSES = ["Active", "Superseded", "Archived"] as const;
export const RELIANCE_LEVELS = ["Low", "Medium", "High", "Critical"] as const;
export const CAVEAT_STATUSES = ["Open", "Resolved", "Superseded", "Archived"] as const;
export const TRIPWIRE_STATUSES = ["Armed", "Disarmed", "Archived"] as const;
export const EXCEPTION_STATUSES = [
  "Open",
  "In progress",
  "Resolved",
  "Accepted risk",
  "Closed",
] as const;
export const EXCEPTION_SEVERITIES = ["Low", "Medium", "High", "Critical"] as const;
export const EVIDENCE_STATUSES = [
  "Required",
  "Requested",
  "Received",
  "Verified",
  "Waived",
  "Rejected",
] as const;
export const DATA_REQUEST_STATUSES = [
  "Draft",
  "Open",
  "Received",
  "Validated",
  "Cancelled",
] as const;
export const APPROVAL_GATES = [
  "Technical review",
  "Accountable approval",
  "Filing release",
  "Evidence waiver",
] as const;
export const APPROVAL_DECISIONS = ["Approved", "Rejected"] as const;

export class ControlValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ControlValidationError";
  }
}

export function allowedValue<const T extends readonly string[]>(
  value: string | null | undefined,
  allowed: T,
  label: string,
  fallback: T[number],
): T[number] {
  const candidate = value?.trim() || fallback;
  if (!allowed.includes(candidate)) {
    throw new ControlValidationError(`${label} is invalid.`);
  }
  return candidate as T[number];
}

export function assertApprovalRequest(requesterId: string, approverId: string): void {
  if (!approverId) throw new ControlValidationError("An approver is required.");
  if (requesterId === approverId) {
    throw new ControlValidationError("The requester cannot approve their own work.");
  }
}

export function assertApprovalDecision(params: {
  actorId: string;
  actorRole: string;
  requesterId: string;
  approverId: string;
  currentStatus: string;
  decision: string;
}): void {
  if (!APPROVAL_DECISIONS.includes(params.decision as (typeof APPROVAL_DECISIONS)[number])) {
    throw new ControlValidationError("Approval decision must be Approved or Rejected.");
  }
  if (params.currentStatus !== "Pending") {
    throw new ControlValidationError("Only pending approvals can be decided.");
  }
  if (params.actorId === params.requesterId) {
    throw new ControlValidationError("The requester cannot decide their own approval.");
  }
  if (params.actorId !== params.approverId && normalizeRole(params.actorRole) !== "admin") {
    throw new AuthorizationError("Only the assigned approver or an administrator can decide this approval.");
  }
}

export function assertExactlyOneApprovalTarget(obligationId?: string | null, actionId?: string | null): void {
  if (Number(Boolean(obligationId)) + Number(Boolean(actionId)) !== 1) {
    throw new ControlValidationError("An approval must relate to exactly one obligation or action.");
  }
}

export function isResolvedExceptionStatus(status: string): boolean {
  return status === "Resolved" || status === "Accepted risk" || status === "Closed";
}

export function isCompletedDataRequestStatus(status: string): boolean {
  return status === "Validated" || status === "Cancelled";
}

export function aggregateApprovalStatus(
  statuses: readonly string[],
): "Not started" | "Under review" | "Blocked" | "Approved" {
  if (statuses.length === 0) return "Not started";
  if (statuses.includes("Pending")) return "Under review";
  if (statuses.includes("Rejected")) return "Blocked";
  return statuses.every((status) => status === "Approved")
    ? "Approved"
    : "Not started";
}
