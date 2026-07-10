export const REGIMES = [
  "Corporation Tax",
  "Corporation Tax Payment",
  "Quarterly Instalment Payments",
  "VAT",
  "PAYE/NIC",
  "P11D/P11D(b)",
  "PSA",
  "ERS",
  "EMI",
  "R&D",
  "Capital Allowances",
  "Transfer Pricing",
  "SAO",
  "CCO",
  "Published Tax Strategy",
  "Pillar 2",
  "FATCA/CRS",
  "BBSI",
  "Other",
] as const;

export const OBLIGATION_TYPES = [
  "Filing",
  "Payment",
  "Claim",
  "Notification",
  "Additional information form",
  "Evidence preparation",
  "Review",
  "Approval",
  "Registration",
  "Re-attestation",
  "Monitoring",
  "R&D claim notification",
  "R&D additional information form",
  "R&D technical evidence pack",
  "R&D claim review before CT600 submission",
  "Fixed asset register review",
  "Capital expenditure evidence collection",
  "AIA review",
  "Full expensing review",
  "Special rate pool review",
  "Capital allowances position included in CT computation",
  "Other",
] as const;

export { STATUS_VALUES } from "@/lib/raci-constants";

export const RISK_LEVELS = ["Low", "Medium", "High", "Critical"] as const;

export const SOURCE_TYPES = [
  "Manual",
  "Rules pack",
  "Adviser document",
  "HMRC guidance",
  "Imported file",
  "Other",
] as const;

export const RECURRENCES = [
  "Annual",
  "Semi-annual",
  "Quarterly",
  "Monthly",
  "Ad hoc",
  "One-off",
] as const;
