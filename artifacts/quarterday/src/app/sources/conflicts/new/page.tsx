import { AppShell } from "@/components/nav";
import { prisma } from "@/lib/prisma";
import { createSourceConflict } from "@/app/actions/sourceConflicts";
import { SEVERITY_LEVELS, CONFLICT_STATUSES } from "@/lib/source-constants";
import Link from "next/link";

const ORG_ID = "demo-org";

export default async function NewConflictPage() {
  const [categories, entities, sourceSystems] = await Promise.all([
    prisma.dataCategory.findMany({ orderBy: { displayOrder: "asc" } }),
    prisma.entity.findMany({ where: { organisationId: ORG_ID }, orderBy: { legalName: "asc" } }),
    prisma.sourceSystem.findMany({
      where: { organisationId: ORG_ID, status: { not: "Archived" } },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <AppShell>
      <div style={{ padding: "28px 32px", maxWidth: 760 }}>
        <div style={{ marginBottom: 20 }}>
          <Link href="/sources/conflicts" style={{ color: "#6b7280", fontSize: 13 }}>
            ← Source Conflicts
          </Link>
        </div>
        <h1>Record Source Conflict</h1>
        <p style={{ color: "#6b7280", marginBottom: 24 }}>
          Use this form to record a case where two source systems hold conflicting values for the same data point.
        </p>

        <form action={createSourceConflict}>
          <div className="panel" style={{ marginBottom: 20 }}>
            <h2>Conflict details</h2>

            <div className="form-row">
              <label className="form-label">
                Data category <span style={{ color: "#b91c1c" }}>*</span>
              </label>
              <select name="dataCategoryId" className="form-input" required>
                <option value="">— select category —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="form-row">
              <label className="form-label">Entity (optional)</label>
              <select name="entityId" className="form-input">
                <option value="">— not entity-specific —</option>
                {entities.map((e) => (
                  <option key={e.id} value={e.id}>{e.legalName}</option>
                ))}
              </select>
            </div>

            <div className="form-row">
              <label className="form-label">Severity</label>
              <select name="severity" className="form-input">
                <option value="">— select —</option>
                {SEVERITY_LEVELS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="panel" style={{ marginBottom: 20 }}>
            <h2>Source A</h2>
            <div className="form-row">
              <label className="form-label">
                Source system A <span style={{ color: "#b91c1c" }}>*</span>
              </label>
              <select name="sourceAId" className="form-input" required>
                <option value="">— select source —</option>
                {sourceSystems.map((ss) => (
                  <option key={ss.id} value={ss.id}>{ss.name}</option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label className="form-label">
                Value from Source A <span style={{ color: "#b91c1c" }}>*</span>
              </label>
              <input name="sourceAValue" className="form-input" required
                placeholder="What does Source A say?" />
            </div>
          </div>

          <div className="panel" style={{ marginBottom: 20 }}>
            <h2>Source B</h2>
            <div className="form-row">
              <label className="form-label">
                Source system B <span style={{ color: "#b91c1c" }}>*</span>
              </label>
              <select name="sourceBId" className="form-input" required>
                <option value="">— select source —</option>
                {sourceSystems.map((ss) => (
                  <option key={ss.id} value={ss.id}>{ss.name}</option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label className="form-label">
                Value from Source B <span style={{ color: "#b91c1c" }}>*</span>
              </label>
              <input name="sourceBValue" className="form-input" required
                placeholder="What does Source B say?" />
            </div>
          </div>

          <div className="panel" style={{ marginBottom: 24 }}>
            <h2>Review assignment</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div className="form-row">
                <label className="form-label">Review owner</label>
                <input name="reviewOwner" className="form-input" placeholder="e.g. Alex Smith" />
              </div>
              <div className="form-row">
                <label className="form-label">Required confirmation party</label>
                <input name="requiredConfirmation" className="form-input"
                  placeholder="e.g. Finance, Adviser, Payroll" />
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button type="submit" className="btn btn-primary">Record conflict</button>
            <Link href="/sources/conflicts" className="btn">Cancel</Link>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
