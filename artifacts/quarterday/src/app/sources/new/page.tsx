import { AppShell } from "@/components/nav";
import { createSourceSystem } from "@/app/actions/sourceSystems";
import { SYSTEM_TYPES, ACCESS_METHODS, SOURCE_SYSTEM_STATUSES } from "@/lib/source-constants";
import Link from "next/link";

export default function NewSourceSystemPage() {
  return (
    <AppShell>
      <div style={{ padding: "28px 32px", maxWidth: 760 }}>
        <div style={{ marginBottom: 20 }}>
          <Link href="/sources" style={{ color: "#6b7280", fontSize: 13 }}>
            ← Source Systems
          </Link>
        </div>
        <h1>Add Source System</h1>

        <form action={createSourceSystem}>
          <div className="panel" style={{ marginBottom: 20 }}>
            <h2>Core details</h2>

            <div className="form-row">
              <label className="form-label">
                Source system name <span style={{ color: "#b91c1c" }}>*</span>
              </label>
              <input name="name" className="form-input" required placeholder="e.g. HMRC Online Services" />
            </div>

            <div className="form-row">
              <label className="form-label">
                System type <span style={{ color: "#b91c1c" }}>*</span>
              </label>
              <select name="systemType" className="form-input" required>
                <option value="">— select type —</option>
                {SYSTEM_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div className="form-row">
              <label className="form-label">Description</label>
              <textarea name="description" className="form-input" rows={3}
                placeholder="What tax-relevant data does this system hold?" />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div className="form-row">
                <label className="form-label">Owner</label>
                <input name="owner" className="form-input" placeholder="e.g. Alex Smith" />
              </div>
              <div className="form-row">
                <label className="form-label">Department</label>
                <input name="department" className="form-input" placeholder="e.g. Finance" />
              </div>
            </div>

            <div className="form-row">
              <label className="form-label">External provider (if applicable)</label>
              <input name="externalProvider" className="form-input" placeholder="e.g. Sage, Xero, HMRC" />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div className="form-row">
                <label className="form-label">Access method</label>
                <select name="accessMethod" className="form-input">
                  <option value="">— select —</option>
                  {ACCESS_METHODS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <label className="form-label">Data refresh frequency</label>
                <input name="refreshFrequency" className="form-input" placeholder="e.g. Monthly, Ad hoc" />
              </div>
            </div>
          </div>

          <div className="panel" style={{ marginBottom: 20 }}>
            <h2>Data classification</h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
              <div>
                <label className="form-label">Contains personal data?</label>
                <div style={{ display: "flex", gap: 16, marginTop: 6 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input type="radio" name="containsPersonalData" value="true" /> Yes
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input type="radio" name="containsPersonalData" value="false" defaultChecked /> No
                  </label>
                </div>
              </div>
              <div>
                <label className="form-label">Contains privileged / confidential data?</label>
                <div style={{ display: "flex", gap: 16, marginTop: 6 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input type="radio" name="containsPrivilegedData" value="true" /> Yes
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input type="radio" name="containsPrivilegedData" value="false" defaultChecked /> No
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="panel" style={{ marginBottom: 24 }}>
            <h2>Status</h2>
            <div className="form-row">
              <label className="form-label">Status</label>
              <select name="status" className="form-input">
                {SOURCE_SYSTEM_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button type="submit" className="btn btn-primary">Save source system</button>
            <Link href="/sources" className="btn">Cancel</Link>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
