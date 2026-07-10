export const SYSTEM_TYPES = [
  "Payroll",
  "HR",
  "ERP / general ledger",
  "Fixed asset register",
  "Cap table",
  "Company secretarial system",
  "Legal documents",
  "Adviser documents",
  "Companies House",
  "HMRC portal",
  "Filing software",
  "Share plan administrator",
  "Spreadsheet",
  "Email inbox",
  "Document management system",
  "Other",
];

export const ACCESS_METHODS = [
  "Manual entry",
  "File upload",
  "CSV export",
  "API later",
  "Email attachment",
  "Read-only document",
  "External adviser provided",
  "Unknown",
];

export const CONFLICT_HANDLING = [
  "Authoritative source wins",
  "Manual review required",
  "Tax owner approval required",
  "Adviser confirmation required",
  "Finance confirmation required",
  "Payroll confirmation required",
  "Legal confirmation required",
];

export const CONFLICT_STATUSES = [
  "Open",
  "Under review",
  "Awaiting adviser",
  "Awaiting finance",
  "Awaiting payroll",
  "Awaiting legal",
  "Resolved",
  "Closed as not material",
];

export const SEVERITY_LEVELS = ["High", "Medium", "Low"];

export const CONFIDENCE_LEVELS = ["High", "Medium", "Low"];

export const SOURCE_SYSTEM_STATUSES = ["Active", "Planned", "Archived"];
