import Link from "next/link";
import { createEntity } from "@/app/actions/entities";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

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

export default function NewEntityPage() {
  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href="/">Dashboard</Link> /{" "}
            <Link href="/entities">Entity Register</Link> / New Entity
          </div>
          <h1>Add Entity</h1>
        </div>
      </div>

      <div className="panel" style={{ maxWidth: 780 }}>
        <form action={createEntity}>
          {/* ── Identification ── */}
          <h2>Identification</h2>
          <div className="form-grid">
            <div className="form-group span2">
              <label htmlFor="legalName">Legal name *</label>
              <input
                type="text"
                id="legalName"
                name="legalName"
                required
                placeholder="e.g. Acme Holdings Limited"
              />
            </div>

            <div className="form-group">
              <label htmlFor="companiesHouseNumber">
                Companies House number
              </label>
              <input
                type="text"
                id="companiesHouseNumber"
                name="companiesHouseNumber"
                placeholder="e.g. 01234567"
                maxLength={8}
              />
              <div className="form-hint">8-digit number (UK incorporated entities)</div>
            </div>

            <div className="form-group">
              <label htmlFor="jurisdiction">Jurisdiction *</label>
              <select id="jurisdiction" name="jurisdiction" required>
                {JURISDICTIONS.map((j) => (
                  <option key={j} value={j}>
                    {j}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <hr className="section-divider" />

          {/* ── Accounting period ── */}
          <h2>Accounting period</h2>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="accountingYearEndMonth">
                Accounting year end — month *
              </label>
              <select id="accountingYearEndMonth" name="accountingYearEndMonth" required>
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1} selected={i === 11}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="accountingYearEndDay">
                Accounting year end — day *
              </label>
              <input
                type="number"
                id="accountingYearEndDay"
                name="accountingYearEndDay"
                min={1}
                max={31}
                defaultValue={31}
                required
              />
              <div className="form-hint">Day of month (1–31)</div>
            </div>
          </div>

          <hr className="section-divider" />

          {/* ── VAT ── */}
          <h2>VAT</h2>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="vatQuarterEndMonth">
                VAT quarter end month
              </label>
              <select id="vatQuarterEndMonth" name="vatQuarterEndMonth">
                <option value="">Not VAT registered</option>
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
              <div className="form-hint">
                The month in which the first VAT quarter ends (e.g. March for
                Mar/Jun/Sep/Dec stagger)
              </div>
            </div>
          </div>

          <hr className="section-divider" />

          {/* ── Classification flags ── */}
          <h2>Classification</h2>

          <div className="checkbox-row">
            <input type="checkbox" id="isLargeCompany" name="isLargeCompany" />
            <label htmlFor="isLargeCompany">Large company</label>
            <span className="hint">(profits &gt; £1.5m, standard QIPs rules apply)</span>
          </div>

          <div className="checkbox-row">
            <input
              type="checkbox"
              id="isVeryLargeCompany"
              name="isVeryLargeCompany"
            />
            <label htmlFor="isVeryLargeCompany">Very large company</label>
            <span className="hint">(augmented profits &gt; £20m, quarterly instalment payments)</span>
          </div>

          <div className="checkbox-row">
            <input type="checkbox" id="hasErs" name="hasErs" />
            <label htmlFor="hasErs">ERS (Employment-Related Securities)</label>
            <span className="hint">(has share plans or securities arrangements)</span>
          </div>

          <div className="checkbox-row">
            <input type="checkbox" id="hasPillar2" name="hasPillar2" />
            <label htmlFor="hasPillar2">Pillar 2</label>
            <span className="hint">(in scope for global minimum tax)</span>
          </div>

          <hr className="section-divider" />

          <div className="flex gap8">
            <button type="submit" className="btn btn-primary">
              Save Entity
            </button>
            <Link href="/entities" className="btn btn-secondary">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </>
  );
}
