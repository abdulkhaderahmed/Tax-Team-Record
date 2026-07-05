import { AppShell } from "@/components/nav";
import { prisma } from "@/lib/prisma";
import { upsertSourcePriorityRule } from "@/app/actions/sourcePriorityRules";
import { CONFLICT_HANDLING } from "@/lib/source-constants";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

const ORG_ID = "demo-org";

export default async function EditPriorityRulePage({
  params,
}: {
  params: Promise<{ categoryId: string }>;
}) {
  const { categoryId } = await params;

  const [category, rule, sourceSystems] = await Promise.all([
    prisma.dataCategory.findUnique({ where: { id: categoryId } }),
    prisma.sourcePriorityRule.findUnique({
      where: { organisationId_dataCategoryId: { organisationId: ORG_ID, dataCategoryId: categoryId } },
      include: { authSource: true, secondarySource: true, tertiarySource: true },
    }),
    prisma.sourceSystem.findMany({
      where: { organisationId: ORG_ID, status: { not: "Archived" } },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!category) notFound();

  async function handleSubmit(formData: FormData) {
    "use server";
    await upsertSourcePriorityRule(categoryId, formData);
    redirect("/sources/priority-rules");
  }

  return (
    <AppShell>
      <div style={{ padding: "28px 32px", maxWidth: 760 }}>
        <div style={{ marginBottom: 20 }}>
          <Link href="/sources/priority-rules" style={{ color: "#6b7280", fontSize: 13 }}>
            ← Priority Rules
          </Link>
        </div>
        <h1>Configure Priority Rule</h1>
        <p style={{ color: "#6b7280", marginBottom: 24 }}>
          Data category: <strong style={{ color: "#111827" }}>{category.name}</strong>
        </p>

        <form action={handleSubmit}>
          <div className="panel" style={{ marginBottom: 20 }}>
            <h2>Source hierarchy</h2>
            <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 16 }}>
              Define which source system is authoritative for this data category. When two sources disagree,
              the authoritative source takes precedence (or the conflict handling rule applies).
            </p>

            <div className="form-row">
              <label className="form-label">Authoritative source</label>
              <select name="authSourceId" className="form-input" defaultValue={rule?.authSourceId ?? ""}>
                <option value="">— none configured —</option>
                {sourceSystems.map((ss) => (
                  <option key={ss.id} value={ss.id}>{ss.name} ({ss.systemType})</option>
                ))}
              </select>
            </div>

            <div className="form-row">
              <label className="form-label">Secondary source</label>
              <select name="secondarySourceId" className="form-input" defaultValue={rule?.secondarySourceId ?? ""}>
                <option value="">— none —</option>
                {sourceSystems.map((ss) => (
                  <option key={ss.id} value={ss.id}>{ss.name} ({ss.systemType})</option>
                ))}
              </select>
            </div>

            <div className="form-row">
              <label className="form-label">Tertiary source</label>
              <select name="tertiarySourceId" className="form-input" defaultValue={rule?.tertiarySourceId ?? ""}>
                <option value="">— none —</option>
                {sourceSystems.map((ss) => (
                  <option key={ss.id} value={ss.id}>{ss.name} ({ss.systemType})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="panel" style={{ marginBottom: 20 }}>
            <h2>Conflict handling</h2>

            <div className="form-row">
              <label className="form-label">When sources conflict</label>
              <select name="conflictHandling" className="form-input" defaultValue={rule?.conflictHandling ?? ""}>
                <option value="">— select —</option>
                {CONFLICT_HANDLING.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div className="form-row">
                <label className="form-label">Review owner</label>
                <input name="reviewOwner" className="form-input"
                  defaultValue={rule?.reviewOwner ?? ""}
                  placeholder="e.g. Alex Smith" />
              </div>
              <div className="form-row">
                <label className="form-label">Review frequency</label>
                <input name="reviewFrequency" className="form-input"
                  defaultValue={rule?.reviewFrequency ?? ""}
                  placeholder="e.g. Annually, Per filing" />
              </div>
            </div>

            <div className="form-row">
              <label className="form-label">Notes</label>
              <textarea name="notes" className="form-input" rows={3}
                defaultValue={rule?.notes ?? ""}
                placeholder="Any additional notes on how this source priority should be applied…" />
            </div>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button type="submit" className="btn btn-primary">Save priority rule</button>
            <Link href="/sources/priority-rules" className="btn">Cancel</Link>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
