"use client";

import {
  REGIMES,
  OBLIGATION_TYPES,
  STATUS_VALUES,
  RISK_LEVELS,
  SOURCE_TYPES,
  RECURRENCES,
} from "../_constants";

export type EntityOption = { id: string; legalName: string };

export type ManualObligationFormValues = {
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

  dataCompletenessStatus?: string;
  dataValidationStatus?: string;
  technicalReviewStatus?: string;
  approvalStatus?: string;
  evidenceStatus?: string;
  filingPaymentStatus?: string;
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
  sourceDocumentReference?: string | null;
  sourcePageParagraph?: string | null;
  createdBy?: string | null;
  lastUpdatedBy?: string | null;
};

type Props = {
  action: (formData: FormData) => Promise<void>;
  defaultValues?: ManualObligationFormValues;
  entities: EntityOption[];
  cancelHref: string;
  submitLabel?: string;
};

function StatusSelect({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue?: string;
}) {
  return (
    <div className="form-group">
      <label htmlFor={name}>{label}</label>
      <select id={name} name={name} defaultValue={defaultValue ?? "Not started"}>
        {STATUS_VALUES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
    </div>
  );
}

export function ManualObligationForm({
  action,
  defaultValues: d = {},
  entities,
  cancelHref,
  submitLabel = "Save Obligation",
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

          <div className="form-group span2">
            <label htmlFor="externalAdviser">External adviser</label>
            <input type="text" id="externalAdviser" name="externalAdviser"
              defaultValue={d.externalAdviser ?? ""} placeholder="Firm name or contact" />
          </div>
        </div>
      </div>

      {/* ── 4. Status ────────────────────────────────────── */}
      <div className="panel">
        <h2>Status</h2>
        <div className="form-grid">
          <StatusSelect name="overallWorkflowStatus" label="Overall workflow status"
            defaultValue={d.overallWorkflowStatus} />
          <StatusSelect name="dataCompletenessStatus" label="Data completeness"
            defaultValue={d.dataCompletenessStatus} />
          <StatusSelect name="dataValidationStatus" label="Data validation"
            defaultValue={d.dataValidationStatus} />
          <StatusSelect name="technicalReviewStatus" label="Technical review"
            defaultValue={d.technicalReviewStatus} />
          <StatusSelect name="approvalStatus" label="Approval"
            defaultValue={d.approvalStatus} />
          <StatusSelect name="filingPaymentStatus" label="Filing / payment"
            defaultValue={d.filingPaymentStatus} />
          <StatusSelect name="evidenceStatus" label="Evidence"
            defaultValue={d.evidenceStatus} />
        </div>
      </div>

      {/* ── 5. Evidence ──────────────────────────────────── */}
      <div className="panel">
        <h2>Evidence</h2>
        <div className="checkbox-row" style={{ marginBottom: 16 }}>
          <input type="checkbox" id="evidenceRequired" name="evidenceRequired"
            defaultChecked={d.evidenceRequired ?? false} />
          <label htmlFor="evidenceRequired">Evidence required for this obligation</label>
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
            <label htmlFor="sourceDocumentReference">Source document reference</label>
            <input type="text" id="sourceDocumentReference" name="sourceDocumentReference"
              defaultValue={d.sourceDocumentReference ?? ""} placeholder="Document name or ID" />
          </div>

          <div className="form-group">
            <label htmlFor="sourcePageParagraph">Source page / paragraph</label>
            <input type="text" id="sourcePageParagraph" name="sourcePageParagraph"
              defaultValue={d.sourcePageParagraph ?? ""} placeholder="e.g. p.12, para 4.3" />
          </div>

          <div className="form-group">
            <label htmlFor="createdBy">Created by</label>
            <input type="text" id="createdBy" name="createdBy"
              defaultValue={d.createdBy ?? ""} placeholder="Your name" />
          </div>

          <div className="form-group">
            <label htmlFor="lastUpdatedBy">Last updated by</label>
            <input type="text" id="lastUpdatedBy" name="lastUpdatedBy"
              defaultValue={d.lastUpdatedBy ?? ""} placeholder="Updater name" />
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
