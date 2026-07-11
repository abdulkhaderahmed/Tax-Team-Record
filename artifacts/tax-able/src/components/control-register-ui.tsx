import type { ReactNode } from "react";

export const CONTROL_FORM_GRID = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: 14,
} as const;

export function ControlField({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="form-row" style={wide ? { gridColumn: "1 / -1" } : undefined}>
      <label className="form-label">{label}</label>
      {children}
    </div>
  );
}

export function fmtControlDate(value: Date | null | undefined): string {
  if (!value) return "—";
  return value.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function controlStatusBadge(status: string): string {
  if (["Verified", "Validated", "Approved", "Resolved", "Closed", "Disarmed"].includes(status)) {
    return "badge-green";
  }
  if (["Rejected", "Critical", "Cancelled"].includes(status)) return "badge-red";
  if (["In progress", "Received", "Requested"].includes(status)) return "badge-blue";
  if (["High", "Open", "Armed", "Pending"].includes(status)) return "badge-orange";
  return "badge-grey";
}
