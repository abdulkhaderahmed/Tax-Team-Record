"use client";

const JURISDICTIONS = [
  "England & Wales",
  "Scotland",
  "Northern Ireland",
  "Republic of Ireland",
  "Jersey",
  "Guernsey",
  "Isle of Man",
  "Other",
];

const ENTITY_TYPES = [
  "",
  "Private limited company (Ltd)",
  "Public limited company (PLC)",
  "Limited liability partnership (LLP)",
  "General partnership",
  "Sole trader",
  "UK branch of overseas company",
  "Unlimited company",
  "Charitable company (limited by guarantee)",
  "Community Interest Company (CIC)",
  "Other",
];

const CT_PAYMENT_METHODS = [
  "",
  "Standard (9 months + 1 day)",
  "Large company QIPs",
  "Very large company QIPs",
];

const TAXABLE_PROFIT_BANDS = [
  "",
  "Below £50,000",
  "£50,000 – £250,000",
  "£250,000 – £1.5 million",
  "£1.5 million – £20 million",
  "Above £20 million",
  "Not applicable / unknown",
];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export type EntityFormValues = {
  legalName?: string;
  companiesHouseNumber?: string | null;
  jurisdiction?: string;
  entityType?: string | null;
  ukTaxResident?: boolean;

  corporationTaxUtr?: string | null;
  accountingPeriodStart?: string;
  accountingPeriodEnd?: string;
  companiesHouseAccountsDue?: string;
  ctReturnRequired?: boolean;
  ctPaymentMethod?: string | null;
  isLargeCompany?: boolean;
  isVeryLargeCompany?: boolean;
  taxableProfitsBand?: string | null;

  vatRegistered?: boolean;
  vatRegistrationNumber?: string | null;
  vatQuarterEndMonth?: number | null;

  payeRegistered?: boolean;
  hasErs?: boolean;
  hasEmi?: boolean;
  p11dRequired?: boolean;
  psaRequired?: boolean;

  rdClaimExpected?: boolean;
  rdNotificationNeeded?: boolean;
  rdAifNeeded?: boolean;

  capitalAllowancesActivity?: boolean;
  fullExpensingRelevant?: boolean;
  aiaRelevant?: boolean;
  specialRatePoolRelevant?: boolean;

  groupReliefRelevant?: boolean;
  lossesBroughtForward?: boolean;
  transferPricingRelevant?: boolean;
  hasPillar2?: boolean;

  saoInScope?: boolean;
  ccoInScope?: boolean;
  publishedTaxStrategyInScope?: boolean;

  primaryTaxOwner?: string | null;
  financeOwner?: string | null;
  payrollOwner?: string | null;
  externalAdviser?: string | null;
};

type Props = {
  action: (formData: FormData) => Promise<void>;
  defaultValues?: EntityFormValues;
  cancelHref: string;
  submitLabel?: string;
};

export function EntityForm({ action, defaultValues: d = {}, cancelHref, submitLabel = "Save Entity" }: Props) {
  return (
    <form action={action} className="form-page">

      {/* ── 1. Identification ───────────────────────────────── */}
      <div className="panel">
        <h2>Identification</h2>
        <div className="form-grid">
          <div className="form-group span2">
            <label htmlFor="legalName">Legal name *</label>
            <input type="text" id="legalName" name="legalName" required
              defaultValue={d.legalName ?? ""} placeholder="e.g. Acme Holdings Limited" />
          </div>

          <div className="form-group">
            <label htmlFor="companiesHouseNumber">Companies House number</label>
            <input type="text" id="companiesHouseNumber" name="companiesHouseNumber"
              defaultValue={d.companiesHouseNumber ?? ""} placeholder="e.g. 01234567" maxLength={8} />
            <div className="form-hint">8-digit number (UK companies)</div>
          </div>

          <div className="form-group">
            <label htmlFor="jurisdiction">Jurisdiction *</label>
            <select id="jurisdiction" name="jurisdiction" required defaultValue={d.jurisdiction ?? "England & Wales"}>
              {JURISDICTIONS.map((j) => <option key={j} value={j}>{j}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="entityType">Entity type</label>
            <select id="entityType" name="entityType" defaultValue={d.entityType ?? ""}>
              {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t || "— select —"}</option>)}
            </select>
          </div>

          <div className="form-group" style={{ display: "flex", alignItems: "flex-end" }}>
            <div className="checkbox-row" style={{ marginBottom: 0 }}>
              <input type="checkbox" id="ukTaxResident" name="ukTaxResident"
                defaultChecked={d.ukTaxResident ?? true} />
              <label htmlFor="ukTaxResident">UK tax resident</label>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. Corporation Tax ──────────────────────────────── */}
      <div className="panel">
        <h2>Corporation Tax</h2>
        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="corporationTaxUtr">CT Unique Taxpayer Reference (UTR)</label>
            <input type="text" id="corporationTaxUtr" name="corporationTaxUtr"
              defaultValue={d.corporationTaxUtr ?? ""} placeholder="10-digit UTR" maxLength={10} />
          </div>

          <div className="form-group">
            <label htmlFor="taxableProfitsBand">Estimated taxable profits band</label>
            <select id="taxableProfitsBand" name="taxableProfitsBand" defaultValue={d.taxableProfitsBand ?? ""}>
              {TAXABLE_PROFIT_BANDS.map((b) => <option key={b} value={b}>{b || "— select —"}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="accountingPeriodStart">Accounting period start</label>
            <input type="date" id="accountingPeriodStart" name="accountingPeriodStart"
              defaultValue={d.accountingPeriodStart ?? ""} />
          </div>

          <div className="form-group">
            <label htmlFor="accountingPeriodEnd">Accounting period end</label>
            <input type="date" id="accountingPeriodEnd" name="accountingPeriodEnd"
              defaultValue={d.accountingPeriodEnd ?? ""} />
            <div className="form-hint">Used to generate the obligations calendar</div>
          </div>

          <div className="form-group">
            <label htmlFor="companiesHouseAccountsDue">Companies House accounts due</label>
            <input type="date" id="companiesHouseAccountsDue" name="companiesHouseAccountsDue"
              defaultValue={d.companiesHouseAccountsDue ?? ""} />
          </div>

          <div className="form-group">
            <label htmlFor="ctPaymentMethod">CT payment method</label>
            <select id="ctPaymentMethod" name="ctPaymentMethod" defaultValue={d.ctPaymentMethod ?? ""}>
              {CT_PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m || "— select —"}</option>)}
            </select>
          </div>
        </div>

        <div className="checkbox-grid" style={{ marginTop: 4 }}>
          <div className="checkbox-row">
            <input type="checkbox" id="ctReturnRequired" name="ctReturnRequired"
              defaultChecked={d.ctReturnRequired ?? true} />
            <label htmlFor="ctReturnRequired">CT return required</label>
          </div>
          <div className="checkbox-row">
            <input type="checkbox" id="isLargeCompany" name="isLargeCompany"
              defaultChecked={d.isLargeCompany ?? false} />
            <label htmlFor="isLargeCompany">Large company for QIPs</label>
            <span className="hint">(profits &gt; £1.5m)</span>
          </div>
          <div className="checkbox-row">
            <input type="checkbox" id="isVeryLargeCompany" name="isVeryLargeCompany"
              defaultChecked={d.isVeryLargeCompany ?? false} />
            <label htmlFor="isVeryLargeCompany">Very large company for QIPs</label>
            <span className="hint">(profits &gt; £20m)</span>
          </div>
        </div>
      </div>

      {/* ── 3. VAT ─────────────────────────────────────────── */}
      <div className="panel">
        <h2>VAT</h2>
        <div className="checkbox-row" style={{ marginBottom: 14 }}>
          <input type="checkbox" id="vatRegistered" name="vatRegistered"
            defaultChecked={d.vatRegistered ?? false} />
          <label htmlFor="vatRegistered">VAT registered</label>
        </div>
        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="vatRegistrationNumber">VAT registration number</label>
            <input type="text" id="vatRegistrationNumber" name="vatRegistrationNumber"
              defaultValue={d.vatRegistrationNumber ?? ""} placeholder="e.g. GB 123 4567 89" />
          </div>

          <div className="form-group">
            <label htmlFor="vatQuarterEndMonth">VAT quarter stagger (quarter end month)</label>
            <select id="vatQuarterEndMonth" name="vatQuarterEndMonth"
              defaultValue={d.vatQuarterEndMonth?.toString() ?? ""}>
              <option value="">— not applicable —</option>
              {MONTHS.map((m, i) => (
                <option key={m} value={String(i + 1)}>{m}</option>
              ))}
            </select>
            <div className="form-hint">Month in which the VAT quarter ends (e.g. March for Mar/Jun/Sep/Dec stagger)</div>
          </div>
        </div>
      </div>

      {/* ── 4. Payroll & Employment ─────────────────────────── */}
      <div className="panel">
        <h2>Payroll &amp; Employment</h2>
        <div className="checkbox-grid">
          <div className="checkbox-row">
            <input type="checkbox" id="payeRegistered" name="payeRegistered"
              defaultChecked={d.payeRegistered ?? false} />
            <label htmlFor="payeRegistered">PAYE registered</label>
          </div>
          <div className="checkbox-row">
            <input type="checkbox" id="hasErs" name="hasErs"
              defaultChecked={d.hasErs ?? false} />
            <label htmlFor="hasErs">ERS scheme present</label>
            <span className="hint">(Employment-Related Securities)</span>
          </div>
          <div className="checkbox-row">
            <input type="checkbox" id="hasEmi" name="hasEmi"
              defaultChecked={d.hasEmi ?? false} />
            <label htmlFor="hasEmi">EMI scheme present</label>
            <span className="hint">(Enterprise Management Incentives)</span>
          </div>
          <div className="checkbox-row">
            <input type="checkbox" id="p11dRequired" name="p11dRequired"
              defaultChecked={d.p11dRequired ?? false} />
            <label htmlFor="p11dRequired">P11D required</label>
          </div>
          <div className="checkbox-row">
            <input type="checkbox" id="psaRequired" name="psaRequired"
              defaultChecked={d.psaRequired ?? false} />
            <label htmlFor="psaRequired">PSA required</label>
            <span className="hint">(PAYE Settlement Agreement)</span>
          </div>
        </div>
      </div>

      {/* ── 5. R&D ─────────────────────────────────────────── */}
      <div className="panel">
        <h2>Research &amp; Development</h2>
        <div className="checkbox-grid">
          <div className="checkbox-row">
            <input type="checkbox" id="rdClaimExpected" name="rdClaimExpected"
              defaultChecked={d.rdClaimExpected ?? false} />
            <label htmlFor="rdClaimExpected">R&amp;D claim expected</label>
          </div>
          <div className="checkbox-row">
            <input type="checkbox" id="rdNotificationNeeded" name="rdNotificationNeeded"
              defaultChecked={d.rdNotificationNeeded ?? false} />
            <label htmlFor="rdNotificationNeeded">R&amp;D claim notification needed</label>
          </div>
          <div className="checkbox-row">
            <input type="checkbox" id="rdAifNeeded" name="rdAifNeeded"
              defaultChecked={d.rdAifNeeded ?? false} />
            <label htmlFor="rdAifNeeded">R&amp;D additional information form needed</label>
          </div>
        </div>
      </div>

      {/* ── 6. Capital Allowances ───────────────────────────── */}
      <div className="panel">
        <h2>Capital Allowances</h2>
        <div className="checkbox-grid">
          <div className="checkbox-row">
            <input type="checkbox" id="capitalAllowancesActivity" name="capitalAllowancesActivity"
              defaultChecked={d.capitalAllowancesActivity ?? false} />
            <label htmlFor="capitalAllowancesActivity">Capital allowances activity</label>
          </div>
          <div className="checkbox-row">
            <input type="checkbox" id="fullExpensingRelevant" name="fullExpensingRelevant"
              defaultChecked={d.fullExpensingRelevant ?? false} />
            <label htmlFor="fullExpensingRelevant">Full expensing relevant</label>
          </div>
          <div className="checkbox-row">
            <input type="checkbox" id="aiaRelevant" name="aiaRelevant"
              defaultChecked={d.aiaRelevant ?? false} />
            <label htmlFor="aiaRelevant">AIA relevant</label>
            <span className="hint">(Annual Investment Allowance)</span>
          </div>
          <div className="checkbox-row">
            <input type="checkbox" id="specialRatePoolRelevant" name="specialRatePoolRelevant"
              defaultChecked={d.specialRatePoolRelevant ?? false} />
            <label htmlFor="specialRatePoolRelevant">Special rate pool relevant</label>
          </div>
        </div>
      </div>

      {/* ── 7. Group & International ────────────────────────── */}
      <div className="panel">
        <h2>Group &amp; International</h2>
        <div className="checkbox-grid">
          <div className="checkbox-row">
            <input type="checkbox" id="groupReliefRelevant" name="groupReliefRelevant"
              defaultChecked={d.groupReliefRelevant ?? false} />
            <label htmlFor="groupReliefRelevant">Group relief relevant</label>
          </div>
          <div className="checkbox-row">
            <input type="checkbox" id="lossesBroughtForward" name="lossesBroughtForward"
              defaultChecked={d.lossesBroughtForward ?? false} />
            <label htmlFor="lossesBroughtForward">Losses brought forward</label>
          </div>
          <div className="checkbox-row">
            <input type="checkbox" id="transferPricingRelevant" name="transferPricingRelevant"
              defaultChecked={d.transferPricingRelevant ?? false} />
            <label htmlFor="transferPricingRelevant">Transfer pricing relevant</label>
          </div>
          <div className="checkbox-row">
            <input type="checkbox" id="hasPillar2" name="hasPillar2"
              defaultChecked={d.hasPillar2 ?? false} />
            <label htmlFor="hasPillar2">Pillar 2 in scope</label>
            <span className="hint">(global minimum tax)</span>
          </div>
        </div>
      </div>

      {/* ── 8. Governance ──────────────────────────────────── */}
      <div className="panel">
        <h2>Governance</h2>
        <div className="checkbox-grid">
          <div className="checkbox-row">
            <input type="checkbox" id="saoInScope" name="saoInScope"
              defaultChecked={d.saoInScope ?? false} />
            <label htmlFor="saoInScope">SAO in scope</label>
            <span className="hint">(Senior Accounting Officer)</span>
          </div>
          <div className="checkbox-row">
            <input type="checkbox" id="ccoInScope" name="ccoInScope"
              defaultChecked={d.ccoInScope ?? false} />
            <label htmlFor="ccoInScope">CCO in scope</label>
            <span className="hint">(Corporate Criminal Offence)</span>
          </div>
          <div className="checkbox-row">
            <input type="checkbox" id="publishedTaxStrategyInScope" name="publishedTaxStrategyInScope"
              defaultChecked={d.publishedTaxStrategyInScope ?? false} />
            <label htmlFor="publishedTaxStrategyInScope">Published tax strategy in scope</label>
          </div>
        </div>
      </div>

      {/* ── 9. Ownership ───────────────────────────────────── */}
      <div className="panel">
        <h2>Ownership</h2>
        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="primaryTaxOwner">Primary tax owner</label>
            <input type="text" id="primaryTaxOwner" name="primaryTaxOwner"
              defaultValue={d.primaryTaxOwner ?? ""} placeholder="Name or team" />
          </div>
          <div className="form-group">
            <label htmlFor="financeOwner">Finance owner</label>
            <input type="text" id="financeOwner" name="financeOwner"
              defaultValue={d.financeOwner ?? ""} placeholder="Name or team" />
          </div>
          <div className="form-group">
            <label htmlFor="payrollOwner">Payroll owner</label>
            <input type="text" id="payrollOwner" name="payrollOwner"
              defaultValue={d.payrollOwner ?? ""} placeholder="Name or team" />
          </div>
          <div className="form-group">
            <label htmlFor="externalAdviser">External adviser</label>
            <input type="text" id="externalAdviser" name="externalAdviser"
              defaultValue={d.externalAdviser ?? ""} placeholder="Firm name" />
          </div>
        </div>
      </div>

      {/* ── Actions ─────────────────────────────────────────── */}
      <div className="flex gap8" style={{ marginBottom: 40 }}>
        <button type="submit" className="btn btn-primary">{submitLabel}</button>
        <a href={cancelHref} className="btn btn-secondary">Cancel</a>
      </div>

    </form>
  );
}
