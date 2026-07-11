export function obligationDueDate(record: {
  filingDeadline: Date | null;
  paymentDeadline: Date | null;
  internalTargetDate?: Date | null;
}): Date | null {
  return record.filingDeadline ?? record.paymentDeadline ?? record.internalTargetDate ?? null;
}

export function fmtDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function fmtDateShort(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

export function fmtMonthName(month: number): string {
  return new Date(2000, month - 1, 1).toLocaleString("en-GB", { month: "long" });
}

export function toDateInput(d: Date | null | undefined): string {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export { MONTH_NAMES };
