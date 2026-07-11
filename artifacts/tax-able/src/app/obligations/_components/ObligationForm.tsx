"use client";

import {
  REGIMES,
  OBLIGATION_TYPES,
  STATUS_VALUES,
  RISK_LEVELS,
  SOURCE_TYPES,
  RECURRENCES,
} from "../_constants";
import { REQUIREMENT_FLAG_LABELS } from "@/lib/raci-constants";

export type EntityOption = { id: string; legalName: string };
export type DocumentOption = { id: string; filename: string; versionNumber: number };

export type ObligationFormValues = {
  entityId?: string | null;
  regime?: string;
  obligationType?: string;
  description?: string;
  statutoryBasis?: string | null;
  filingDeadline?: string;
  paymentDeadline?: string;
  internalTargetDate?: string;
  recurrence?: string | null;
  periodStart?: string;
  periodEnd?: string;
  source?: string | null;

  responsibleOwner?: string | null;
  accountableOwner?: string | null;
  consultedParty?: string | null;
  informedParty?: string | null;
  externalAdviser?: string | null;
  externalOperationalOwner?: string | null;

  dataCollectionRequired?: boolean;
  dataValidationRequired?: boolean;
  technicalReviewRequired?: boolean;
  accountableApprovalRequired?: boolean;
  filingSubmissionRequired?: boolean;
  paymentRequired?: boolean;

  dataCompletenessStatus?: string;
  dataValidationStatus?: string;
  technicalReviewStatus?: string;
  approvalStatus?: string;
  workflowProgressStatus?: string;
  evidenceStatus?: string;
  filingSubmissionStatus?: string;
  paymentStatus?: string;
  overallWorkflowStatus?: string;

  evidenceRequired?: boolean;
  evidenceDescription?: string | null;
  evidenceFileLink?: string | null;
  evidenceOwner?: string | null;

  riskLevel?: string | null;
  consequenceOfMissingDeadline?: string | null;
  openIssueBlocker?: string | null;
  notes?: string | null;
  exceptionRequired?: boolean;

  sourceType?: string | null;
  sourceDocumentId?: string | null;
  sourceDocumentReference?: string | null;
  sourcePageParagraph?: string | null;
};

type Props = {
  action: (formData: FormData) => Promise<void>;
  defaultValues?: ObligationFormValues;
  entities: EntityOption[];
  documents: DocumentOption[];
  cancelHref: string;
  submitLabel?: string;
  canReviewControls?: boolean;
  isNew?: boolean;
};

function StatusSelect({
  name,
  label,
  defaultValue,
  disabled = false,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  disabled?: boolean;
}) {
  return (
    <div className="form-group">
      <label htmlFor={name}>{label}</label>
      <select id={name} name={name} defaultValue={defaultValue ?? "Not started"} disabled={disabled}>
        {STATUS_VALUES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
    </div>
  );
}

export function ObligationForm({
  action,
  defaultValues: d = {},
  entities,
  documents,
  cancelHref,
  submitLabel = "Save Obligation",
  canReviewControls = false,
  isNew = false,
}: Props) {
  return (
    <form action={action} className="form-page">

      {/* ── 1. Entity & Core ─────────────────────────────── */}
      <div className="panel">
        <h2>Core details</h2>
        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="entityId">Entity</label>
            <select id="entityId" name="entityId" defaultValue={d.entityId ?? ""}>
              <option value="">— none —</option>
              {entities.map((e) => (
                <option key={e.id} value={e.id}>{e.legalName}</option>
              ))}
            </select>
            {entities.length === 0 && (
              <div className="form-hint">No entities yet — <a href="/entities/new">add one first</a></div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="regime">Regime *</label>
            <select id="regime" name="regime" required defaultValue={d.regime ?? ""}>
              <option value="">— select —</option>
              {REGIMES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="obligationType">Obligation type *</label>
            <select id="obligationType" name="obligationType" required defaultValue={d.obligationType ?? ""}>
              <option value="">— select —</option>
              {OBLIGATION_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="source">Source (brief)</label>
            <input type="text" id="source" name="source"
              defaultValue={d.source ?? ""} placeholder="e.g. HMRC guidance, adviser note" />
          </div>

          <div className="form-group span2">
            <label htmlFor="description">Description *</label>
            <textarea id="description" name="description" rows={3} required
              defaultValue={d.description ?? ""}
              placeholder="Describe this obligation clearly" />
          </div>

          <div className="form-group span2">
            <label htmlFor="statutoryBasis">Statutory basis</label>
            <input type="text" id="statutoryBasis" name="statutoryBasis"
              defaultValue={d.statutoryBasis ?? ""}
              placeholder="e.g. CTA 2009 s.1" />
          </div>
        </div>
      </div>

      {/* ── 2. Dates & Recurrence ────────────────────────── */}
      <div className="panel">
        <h2>Dates &amp; Recurrence</h2>
        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="filingDeadline">Filing deadline</label>
            <input type="date" id="filingDeadline" name="filingDeadline"
              defaultValue={d.filingDeadline ?? ""} />
          </div>

          <div className="form-group">
            <label htmlFor="paymentDeadline">Payment deadline</label>
            <input type="date" id="paymentDeadline" name="paymentDeadline"
              defaultValue={d.paymentDeadline ?? ""} />
          </div>

          <div className="form-group">
            <label htmlFor="internalTargetDate">Internal target date</label>
            <input type="date" id="internalTargetDate" name="internalTargetDate"
              defaultValue={d.internalTargetDate ?? ""} />
            <div className="form-hint">Earlier internal deadline before statutory due date</div>
          </div>

          <div className="form-group">
            <label htmlFor="recurrence">Recurrence</label>
            <select id="recurrence" name="recurrence" defaultValue={d.recurrence ?? ""}>
              <option value="">— select —</option>
              {RECURRENCES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="periodStart">Period start</label>
            <input type="date" id="periodStart" name="periodStart"
              defaultValue={d.periodStart ?? ""} />
          </div>

          <div className="form-group">
            <label htmlFor="periodEnd">Period end</label>
            <input type="date" id="periodEnd" name="periodEnd"
              defaultValue={d.periodEnd ?? ""} />
          </div>
        </div>
      </div>

      {/* ── 3. Ownership / RACI ──────────────────────────── */}
      <div className="panel">
        <h2>Ownership</h2>
        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="responsibleOwner">Responsible owner</label>
            <input type="text" id="responsibleOwner" name="responsibleOwner"
              defaultValue={d.responsibleOwner ?? ""} placeholder="Does the work" />
          </div>

          <div className="form-group">
            <label htmlFor="accountableOwner">Accountable owner</label>
            <input type="text" id="accountableOwner" name="accountableOwner"
              defaultValue={d.accountableOwner ?? ""} placeholder="Accountable for outcome" />
          </div>

          <div className="form-group">
            <label htmlFor="consultedParty">Consulted party</label>
            <input type="text" id="consultedParty" name="consultedParty"
              defaultValue={d.consultedParty ?? ""} placeholder="Input sought from" />
          </div>

          <div className="form-group">
            <label htmlFor="informedParty">Informed party</label>
            <input type="text" id="informedParty" name="informedParty"
              defaultValue={d.informedParty ?? ""} placeholder="Kept informed" />
          </div>

          <div className="form-group">
            <label htmlFor="externalAdviser">External adviser</label>
            <input type="text" id="externalAdviser" name="externalAdviser"
              defaultValue={d.externalAdviser ?? ""} placeholder="Firm name or contact" />
          </div>

          <div className="form-group">
            <label htmlFor="externalOperationalOwner">External operational owner</label>
            <input type="text" id="externalOperationalOwner" name="externalOperationalOwner"
              defaultValue={d.externalOperationalOwner ?? ""} placeholder="e.g. payroll bureau actually doing the work" />
          </div>
        </div>
        <div className="form-hint" style={{ marginTop: 8 }}>
          For multiple consulted/informed parties with full contact details, add them from the
          Ownership and Controls section on the obligation&apos;s detail page once it&apos;s saved.
        </div>
      </div>

      {/* ── 4. Requirement flags ─────────────────────────── */}
      <div className="panel">
        <h2>What does this obligation actually require?</h2>
        <div className="form-hint" style={{ marginBottom: 12 }}>
          Not every obligation needs every step below — untick anything that doesn&apos;t apply so
          the overall status isn&apos;t blocked waiting on something irrelevant.
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 20px" }}>
          {(Object.keys(REQUIREMENT_FLAG_LABELS) as Array<keyof typeof REQUIREMENT_FLAG_LABELS>).map((key) => {
            const defaultForNew = key === "paymentRequired" || key === "evidenceRequired" ? false : true;
            return (
            <div className="checkbox-row" key={key} style={{ marginBottom: 0 }}>
              <input type="checkbox" id={key} name={key}
                disabled={!canReviewControls && Boolean(d[key as keyof ObligationFormValues])}
                defaultChecked={(d[key as keyof ObligationFormValues] as boolean) ?? defaultForNew} />
              <label htmlFor={key}>{REQUIREMENT_FLAG_LABELS[key]}</label>
            </div>
            );
          })}
        </div>
      </div>

      {/* ── 5. Status ────────────────────────────────────── */}
      <div className="panel">
        <h2>Status</h2>
        {isNew ? (
          <div className="alert alert-info">
            New records start at “Not started”. Data, evidence and approval states are then derived from their linked registers and independent decisions.
          </div>
        ) : <>
        <div className="form-grid">
          <StatusSelect name="dataCompletenessStatus" label="Data completeness"
            defaultValue={d.dataCompletenessStatus} disabled />
          <StatusSelect name="dataValidationStatus" label="Data validation"
            defaultValue={d.dataValidationStatus} disabled={!canReviewControls} />
          <StatusSelect name="technicalReviewStatus" label="Technical review"
            defaultValue={d.technicalReviewStatus} disabled />
          <StatusSelect name="approvalStatus" label="Approval"
            defaultValue={d.approvalStatus} disabled />
          <StatusSelect name="workflowProgressStatus" label="Workflow progress"
            defaultValue={d.workflowProgressStatus} />
          <StatusSelect name="evidenceStatus" label="Evidence"
            defaultValue={d.evidenceStatus} disabled />
          <StatusSelect name="filingSubmissionStatus" label="Filing / submission"
            defaultValue={d.filingSubmissionStatus} />
          <StatusSelect name="paymentStatus" label="Payment"
            defaultValue={d.paymentStatus} />
        </div>
        <div className="form-grid" style={{ marginTop: 8 }}>
          <div className="form-group">
            <label htmlFor="overallStatusOverride">Overall status override</label>
            <select id="overallStatusOverride" name="overallStatusOverride" defaultValue="" disabled={!canReviewControls}>
              <option value="">— let the system compute it —</option>
              {STATUS_VALUES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <div className="form-hint">
              Current: {d.overallWorkflowStatus ?? "Not started"}. Overall readiness is recalculated from active controls.
              {!canReviewControls && " Review permission is required for an override."}
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="statusChangeReason">Reason for this change (optional)</label>
            <input type="text" id="statusChangeReason" name="statusChangeReason"
              placeholder="Recorded in status history" />
          </div>
        </div>
        </>}
      </div>

      {/* ── 5. Evidence ──────────────────────────────────── */}
      <div className="panel">
        <h2>Evidence</h2>
        <div className="form-hint" style={{ marginBottom: 16 }}>
          Whether evidence is required is set via the &quot;Evidence required&quot; flag above.
        </div>

        <div className="form-grid">
          <div className="form-group span2">
            <label htmlFor="evidenceDescription">Evidence description</label>
            <textarea id="evidenceDescription" name="evidenceDescription" rows={2}
              defaultValue={d.evidenceDescription ?? ""}
              placeholder="Describe the evidence needed" />
          </div>

          <div className="form-group">
            <label htmlFor="evidenceFileLink">Evidence file link / reference</label>
            <input type="text" id="evidenceFileLink" name="evidenceFileLink"
              defaultValue={d.evidenceFileLink ?? ""}
              placeholder="URL or document reference" />
          </div>

          <div className="form-group">
            <label htmlFor="evidenceOwner">Evidence owner</label>
            <input type="text" id="evidenceOwner" name="evidenceOwner"
              defaultValue={d.evidenceOwner ?? ""} placeholder="Who holds the evidence" />
          </div>
        </div>
      </div>

      {/* ── 6. Risk & Control ────────────────────────────── */}
      <div className="panel">
        <h2>Risk &amp; Control</h2>
        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="riskLevel">Risk level</label>
            <select id="riskLevel" name="riskLevel" defaultValue={d.riskLevel ?? ""}>
              <option value="">— select —</option>
              {RISK_LEVELS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <div className="checkbox-row" style={{ marginBottom: 0, marginTop: 20 }}>
              <input type="checkbox" id="exceptionRequired" name="exceptionRequired"
                disabled={!canReviewControls && Boolean(d.exceptionRequired)}
                defaultChecked={d.exceptionRequired ?? false} />
              <label htmlFor="exceptionRequired">Exception required</label>
            </div>
          </div>

          <div className="form-group span2">
            <label htmlFor="consequenceOfMissingDeadline">Consequence of missing deadline</label>
            <textarea id="consequenceOfMissingDeadline" name="consequenceOfMissingDeadline" rows={2}
              defaultValue={d.consequenceOfMissingDeadline ?? ""}
              placeholder="e.g. Penalty, interest, HMRC enquiry" />
          </div>

          <div className="form-group span2">
            <label htmlFor="openIssueBlocker">Open issue / blocker</label>
            <textarea id="openIssueBlocker" name="openIssueBlocker" rows={2}
              disabled={!canReviewControls && Boolean(d.exceptionRequired && d.openIssueBlocker)}
              defaultValue={d.openIssueBlocker ?? ""}
              placeholder="Any blockers or open issues preventing completion" />
          </div>

          <div className="form-group span2">
            <label htmlFor="notes">Notes</label>
            <textarea id="notes" name="notes" rows={3}
              defaultValue={d.notes ?? ""}
              placeholder="Additional context, background, or commentary" />
          </div>
        </div>
      </div>

      {/* ── 7. Source & Audit ────────────────────────────── */}
      <div className="panel">
        <h2>Source &amp; Audit</h2>
        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="sourceType">Source type</label>
            <select id="sourceType" name="sourceType" defaultValue={d.sourceType ?? ""}>
              <option value="">— select —</option>
              {SOURCE_TYPES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="sourceDocumentId">Linked source document</label>
            <select id="sourceDocumentId" name="sourceDocumentId" defaultValue={d.sourceDocumentId ?? ""}>
              <option value="">— no linked vault document —</option>
              {documents.map((document) => (
                <option key={document.id} value={document.id}>{document.filename} · v{document.versionNumber}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="sourceDocumentReference">Source document reference</label>
            <input type="text" id="sourceDocumentReference" name="sourceDocumentReference"
              defaultValue={d.sourceDocumentReference ?? ""} placeholder="Document name or ID" />
          </div>

          <div className="form-group">
            <label htmlFor="sourcePageParagraph">Source page / paragraph</label>
            <input type="text" id="sourcePageParagraph" name="sourcePageParagraph"
              defaultValue={d.sourcePageParagraph ?? ""} placeholder="e.g. p.12, para 4.3" />
          </div>

          <div className="form-hint span2">
            Creator and updater are recorded automatically from the authenticated user; they cannot be supplied by this form.
          </div>
        </div>
      </div>

      {/* ── Actions ──────────────────────────────────────── */}
      <div className="flex gap8" style={{ marginBottom: 40 }}>
        <button type="submit" className="btn btn-primary">{submitLabel}</button>
        <a href={cancelHref} className="btn btn-secondary">Cancel</a>
      </div>

    </form>
  );
}
