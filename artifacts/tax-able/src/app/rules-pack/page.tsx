import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/auth";
import { CONTROLLED_RULE_ENGINE_VERSION } from "@/lib/controlled-rule-definitions";
import { approveRuleVersion, proposeRuleVersion } from "@/app/actions/rules";

function fmt(date: Date | null) {
  return date?.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) ?? "—";
}

export default async function RulesPackPage() {
  const { orgId, user } = await requireOrg();
  const rules = await prisma.taxRule.findMany({
    where: { organisationId: orgId },
    include: {
      versions: {
        include: {
          createdBy: { select: { id: true, name: true } },
          reviewedBy: { select: { id: true, name: true } },
          citations: true,
          _count: { select: { impactReviews: true, obligations: true } },
        },
        orderBy: { version: "desc" },
      },
    },
    orderBy: [{ regime: "asc" }, { ruleKey: "asc" }],
  });

  const approvedCount = rules.reduce(
    (count, rule) => count + rule.versions.filter((version) => version.status === "Approved").length,
    0,
  );
  const draftCount = rules.reduce(
    (count, rule) => count + rule.versions.filter((version) => version.status === "Draft").length,
    0,
  );

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb"><Link href="/">Dashboard</Link> / Controlled UK Rules</div>
          <h1>Controlled UK Rules</h1>
        </div>
        <Link href="/rule-impact" className="btn btn-primary">Regulatory impact queue</Link>
      </div>

      <div className="panel">
        <p className="text-sm" style={{ marginTop: 0 }}>
          Rules are versioned, effective-dated controlled content. Every live generated obligation retains the exact version and its “why this applies” trace. Approving a change creates an impact review for active entities; it never silently rewrites their records.
        </p>
        <div className="flex gap8">
          <span className="badge badge-green">{approvedCount} approved versions</span>
          <span className="badge badge-yellow">{draftCount} draft versions</span>
          <span className="badge badge-grey">Current engine {CONTROLLED_RULE_ENGINE_VERSION}</span>
          <span className="badge badge-grey">Signed in as {user.name} ({user.id})</span>
        </div>
      </div>

      {rules.length === 0 ? (
        <div className="alert alert-warning">No controlled rules are seeded for this organisation.</div>
      ) : rules.map((rule) => {
        const latest = rule.versions[0];
        const propose = proposeRuleVersion.bind(null, rule.id);
        return (
          <div key={rule.id} className="panel" style={{ marginBottom: 16 }}>
            <div className="flex justify-between items-center" style={{ marginBottom: 12 }}>
              <div>
                <h2 style={{ margin: 0 }}>{rule.ruleKey}</h2>
                <div className="text-sm text-muted">{rule.regime}</div>
              </div>
              <span className={`badge ${rule.active ? "badge-green" : "badge-grey"}`}>
                {rule.active ? "Active" : "Inactive"}
              </span>
            </div>

            <div className="table-scroll">
              <table className="data-table" style={{ minWidth: 1200 }}>
                <thead>
                  <tr>
                    <th>Version / engine</th><th>Status / dates</th><th>Controlled content</th><th>Authority</th><th>Editor / reviewer</th><th>Rationale</th><th>Use / impacts</th><th>Control</th>
                  </tr>
                </thead>
                <tbody>
                  {rule.versions.map((version) => {
                    const approve = approveRuleVersion.bind(null, version.id);
                    const engineCompatible =
                      version.engineVersion === CONTROLLED_RULE_ENGINE_VERSION;
                    return (
                      <tr key={version.id}>
                        <td>
                          <strong>v{version.version}</strong>
                          <div>
                            <span className={`badge ${engineCompatible ? "badge-green" : "badge-yellow"}`}>
                              Engine {version.engineVersion}
                            </span>
                          </div>
                          <div className="text-sm text-muted">{version.id}</div>
                        </td>
                        <td>
                          <span className={`badge ${version.status === "Approved" ? "badge-green" : version.status === "Draft" ? "badge-yellow" : "badge-grey"}`}>{version.status}</span>
                          <div className="text-sm">{fmt(version.effectiveFrom)} – {fmt(version.effectiveTo)}</div>
                        </td>
                        <td style={{ maxWidth: 320 }}>
                          <strong>{version.name}</strong>
                          <div className="text-sm text-muted">{version.triggerDescription}</div>
                          <div className="text-sm">{version.calculationDescription}</div>
                        </td>
                        <td style={{ maxWidth: 260 }}>
                          <span className="badge badge-grey">{version.authorityLevel}</span>
                          <div className="text-sm">{version.legalStatus}</div>
                          <a href={version.statutoryUrl} target="_blank" rel="noreferrer" className="text-sm">{version.statutoryBasis}</a>
                          <div className="text-sm text-muted">Checked {fmt(version.sourceLastCheckedAt)}</div>
                          {version.citations.length > 0 && (
                            <details style={{ marginTop: 6 }}>
                              <summary className="text-sm" style={{ cursor: "pointer" }}>{version.citations.length} controlled citation(s)</summary>
                              {version.citations.map((citation) => (
                                <div key={citation.id} className="text-sm" style={{ marginTop: 4 }}>
                                  <a href={citation.url} target="_blank" rel="noreferrer">{citation.title}</a>
                                  <div className="text-muted">{citation.authorityLevel}{citation.locator ? ` · ${citation.locator}` : ""} · checked {fmt(citation.checkedAt)}</div>
                                </div>
                              ))}
                            </details>
                          )}
                        </td>
                        <td className="text-sm">
                          Editor: {version.createdBy.name} ({version.createdBy.id})<br />
                          Reviewer: {version.reviewedBy ? `${version.reviewedBy.name} (${version.reviewedBy.id})` : "Pending"}<br />
                          Reviewed: {fmt(version.reviewedAt)}
                        </td>
                        <td className="text-sm">{version.changeRationale}</td>
                        <td className="text-sm">{version._count.obligations} obligation(s)<br />{version._count.impactReviews} impact review(s)</td>
                        <td>
                          {version.status === "Draft" && engineCompatible ? (
                            <form action={approve}>
                              <textarea name="reviewNote" required rows={2} placeholder="Independent review note" className="form-input" />
                              <button type="submit" className="btn btn-primary btn-sm" style={{ marginTop: 6 }}>Approve + create impacts</button>
                            </form>
                          ) : version.status === "Draft" ? (
                            <div className="alert alert-warning text-sm">
                              Approval blocked: create a version bound to the current engine.
                            </div>
                          ) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {latest && (
              <details style={{ marginTop: 14 }}>
                <summary className="btn btn-secondary btn-sm" style={{ display: "inline-block", cursor: "pointer" }}>Propose new version</summary>
                <form action={propose} className="form-grid" style={{ marginTop: 12 }}>
                  <div className="alert alert-info span2">
                    This draft will be immutably bound to deterministic engine {CONTROLLED_RULE_ENGINE_VERSION}. If the engine changes before approval, create a fresh version for review.
                  </div>
                  <div className="form-group"><label>Effective from</label><input name="effectiveFrom" type="date" required /></div>
                  <div className="form-group"><label>Source last checked</label><input name="sourceLastCheckedAt" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></div>
                  <div className="form-group span2"><label>Change rationale</label><textarea name="changeRationale" required rows={2} /></div>
                  <div className="form-group span2"><label>Statutory basis</label><input name="statutoryBasis" defaultValue={latest.statutoryBasis} /></div>
                  <div className="form-group span2"><label>Statutory URL</label><input name="statutoryUrl" type="url" defaultValue={latest.statutoryUrl} /></div>
                  <div className="form-group span2"><label>Trigger description</label><textarea name="triggerDescription" defaultValue={latest.triggerDescription} rows={2} /></div>
                  <div className="form-group span2"><label>Calculation description</label><textarea name="calculationDescription" defaultValue={latest.calculationDescription} rows={2} /></div>
                  <button type="submit" className="btn btn-primary">Create draft version</button>
                </form>
              </details>
            )}
          </div>
        );
      })}
    </>
  );
}
