import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/auth";
import { reviewRuleImpact } from "@/app/actions/rules";

function fmt(date: Date | null) {
  return date?.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) ?? "—";
}

export default async function RuleImpactPage() {
  const { orgId } = await requireOrg();
  const impacts = await prisma.ruleImpactReview.findMany({
    where: { organisationId: orgId },
    include: {
      entity: { select: { legalName: true } },
      ruleVersion: { include: { rule: true } },
      reviewedBy: { select: { name: true, id: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
  return (
    <>
      <div className="page-header">
        <div><div className="breadcrumb"><Link href="/rules-pack">Controlled rules</Link> / Impact queue</div><h1>Regulatory impact queue</h1></div>
      </div>
      <div className="alert alert-info">A rule approval creates explicit entity-level reviews here. Existing obligations are not silently changed.</div>
      {impacts.length === 0 ? <div className="panel"><p className="text-muted">No impact reviews.</p></div> : (
        <table className="data-table">
          <thead><tr><th>Rule version</th><th>Entity</th><th>Impact</th><th>Due</th><th>Status</th><th>Review</th></tr></thead>
          <tbody>{impacts.map((impact) => {
            const action = reviewRuleImpact.bind(null, impact.id);
            return <tr key={impact.id}>
              <td>{impact.ruleVersion.rule.ruleKey} · v{impact.ruleVersion.version}</td>
              <td>{impact.entity.legalName}</td>
              <td style={{ whiteSpace: "pre-wrap", maxWidth: 520 }}>{impact.impactSummary}</td>
              <td>{fmt(impact.dueDate)}</td>
              <td><span className={`badge ${impact.status === "Needs review" ? "badge-yellow" : "badge-green"}`}>{impact.status}</span>{impact.reviewedBy && <div className="text-sm text-muted">{impact.reviewedBy.name} ({impact.reviewedBy.id})</div>}</td>
              <td>{impact.status === "Needs review" ? <form action={action}>
                <select name="status" required defaultValue=""><option value="" disabled>Outcome</option><option>Confirmed applicable</option><option>Not applicable</option><option>Remediated</option></select>
                <textarea name="reviewNote" required rows={2} placeholder="Impact assessment and decision" style={{ marginTop: 6 }} />
                <button type="submit" className="btn btn-primary btn-sm" style={{ marginTop: 6 }}>Record review</button>
              </form> : impact.reviewNote ?? "—"}</td>
            </tr>;
          })}</tbody>
        </table>
      )}
    </>
  );
}
