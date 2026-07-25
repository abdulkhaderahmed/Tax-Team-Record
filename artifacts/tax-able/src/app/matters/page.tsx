import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/auth";

export const dynamic = "force-dynamic";

const OPEN_STATUSES = ["Open", "Blocked", "Awaiting approval"];

function fmt(date: Date) {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function MattersPage() {
  const context = await requireOrg();
  const matters = await prisma.matter.findMany({
    where: { organisationId: context.orgId, archivedAt: null },
    include: { entity: { select: { legalName: true } } },
    orderBy: [{ status: "asc" }, { targetDecisionDate: "asc" }, { createdAt: "desc" }],
  });

  const open = matters.filter((matter) => OPEN_STATUSES.includes(matter.status));

  return (
    <div className="hq-home">
      <header className="hq-header">
        <div>
          <div className="eyebrow">{context.organisation.name}</div>
          <h1>Matters</h1>
          <p>Tax work that needs a decision, an owner or an escalation.</p>
        </div>
        <div className="hq-header-actions">
          <Link href="/documents/new" className="matter-button matter-button-secondary">
            Upload adviser advice
          </Link>
          <Link href="/matters/new" className="matter-button matter-button-primary">
            Add tax matter
          </Link>
        </div>
      </header>

      <section className="hq-card">
        <div className="hq-card-heading">
          <div>
            <div className="eyebrow">Register</div>
            <h2>{open.length} open</h2>
          </div>
          <span>{matters.length} total</span>
        </div>

        {matters.length === 0 ? (
          <div className="hq-empty">
            No matters yet. Add the first one, or upload an adviser document and raise
            a matter from it.
          </div>
        ) : (
          <div className="hq-matter-list">
            {matters.map((matter) => (
              <Link className="hq-matter-row" href={`/matters/${matter.id}`} key={matter.id}>
                <span className="hq-matter-identity">
                  <span className="hq-matter-icon">
                    {matter.matterType.slice(0, 2).toUpperCase()}
                  </span>
                  <span>
                    <strong>{matter.title}</strong>
                    <small>
                      {matter.reference} · {matter.matterType}
                      {matter.entity ? ` · ${matter.entity.legalName}` : ""}
                    </small>
                  </span>
                </span>
                <span className="hq-matter-detail">
                  <small>Decision required</small>
                  <strong>{matter.decisionQuestion}</strong>
                </span>
                <span className="hq-matter-status">
                  <span
                    className={
                      matter.status === "Resolved"
                        ? "response-state accepted"
                        : "response-state"
                    }
                  >
                    {matter.status}
                  </span>
                  <small>
                    {matter.targetDecisionDate
                      ? `Due ${fmt(matter.targetDecisionDate)}`
                      : "No target date"}
                  </small>
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
