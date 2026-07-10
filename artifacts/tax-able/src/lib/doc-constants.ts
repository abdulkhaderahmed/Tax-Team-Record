export const DOCUMENT_TYPES = [
  "Adviser proposal",
  "Adviser tax memo",
  "Steps paper",
  "Valuation report",
  "R&D report",
  "R&D claim schedule",
  "Capital allowances analysis",
  "Fixed asset register",
  "CT computation",
  "CT600 draft/final",
  "VAT return",
  "ERS return",
  "EMI return",
  "P11D/P11D(b)",
  "PSA calculation",
  "Payroll report",
  "HR report",
  "Cap table",
  "Legal agreement",
  "Board minutes/approval",
  "HMRC correspondence",
  "Filing confirmation",
  "Payment evidence",
  "Other",
];

export const SENSITIVITY_LEVELS = [
  "Low",
  "Medium",
  "High",
  "Highly confidential",
];

export const PRIVILEGE_STATUSES = [
  "Not privileged",
  "Potentially privileged",
  "Legally privileged",
  "Unknown",
];

export const RELIANCE_STATUSES = [
  "Draft",
  "Under review",
  "Approved for reliance",
  "Superseded",
  "Do not rely",
];

export const SOURCE_CONFIDENCE_LEVELS = ["High", "Medium", "Low", "Unknown"];

export const YES_NO_UNKNOWN = ["Yes", "No", "Unknown"];

export const HEALTH_MARKERS: Array<{ key: string; label: string; pattern: RegExp }> = [
  { key: "xx",                pattern: /\bXX\b/g,               label: "XX placeholder" },
  { key: "tbc",               pattern: /\bTBC\b/gi,             label: "TBC (to be confirmed)" },
  { key: "insert_placeholder",pattern: /\[insert [^\]]+\]/gi,   label: "[insert …] placeholder" },
  { key: "date_placeholder",  pattern: /<<[^>]+>>/g,            label: "<<…>> placeholder" },
  { key: "do_do_not",         pattern: /\bdo\/do not\b/gi,      label: "do/do not ambiguity" },
  { key: "wrong",             pattern: /\bwrong\b/gi,           label: "word 'wrong'" },
];
