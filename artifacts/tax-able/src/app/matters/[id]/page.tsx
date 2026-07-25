import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/auth";
import { resolveMatter } from "@/app/actions/matters";

export const dynamic = "force-dynamic";

function fmt(date: Date) {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function MatterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const context = await requireOrg();

  const matter = await prisma.matter.findFirst({
    where: { id, organisationId: context.orgId },
    include: {
      entity: { select: { legalName: true } },
      createdBy: { select: { name: true } },
    },
  });
  if (!matter) notFound();

  const isResolved = Boolean(matter.resolvedAt);
  const taxAreas = matter.taxAreas
    ? matter.taxAreas.split(",").map((area) => area.trim()).filter(Boolean)
    : [];

  return (
    <div className="matter-demo">
      <header className="matter-heading">
        <div className="matter-heading-main">
          <div className="matter-breadcrumbs">
            <Link href="/matters">Matters</Link>
            <span>/</span>
            <span>{matter.matterType}</span>
          </div>
          <div className="matter-title-row">
            <h1>{matter.title}</h1>
            <span
              className={`matter-status ${
                isResolved
                  ? "matter-status-approved"
                  : matter.status === "Blocked"
                    ? "matter-status-blocked"
                    : "matter-status-ready"
              }`}
            >
              {matter.status}
            </span>
          </div>
          <p>
            {matter.reference}
            {matter.entity ? ` · ${matter.entity.legalName}` : " · Group"}
            {matter.taxOwner ? ` · Tax owner: ${matter.taxOwner}` : ""}
            {matter.targetDecisionDate
              ? ` · Decision due ${fmt(matter.targetDecisionDate)}`
              : ""}
          </p>
        </div>
      </header>

      <div className="matter-layout">
        <div className="matter-primary-column">
          <section className="decision-panel">
            <div className="decision-panel-top">
              <h2>{matter.decisionQuestion}</h2>
              <span className="decision-id">{matter.reference}</span>
            </div>

            {matter.summary && (
              <div className="decision-position">
                <span>Summary</span>
                <p>{matter.summary}</p>
              </div>
            )}

            {isResolved ? (
              <div className="decision-position">
                <span>Resolution · {fmt(matter.resolvedAt!)}</span>
                <p>{matter.resolutionNote}</p>
              </div>
            ) : (
              <form action={resolveMatter} className="matter-resolve-form">
                <input name="id" type="hidden" value={matter.id} />
                <label htmlFor="resolutionNote">Record the decision</label>
                <textarea
                  id="resolutionNote"
                  name="resolutionNote"
                  placeholder="What was decided, on what basis, and what happens next."
                  required
                  rows={3}
                />
                <div className="matter-resolve-actions">
                  <select defaultValue="Resolved" name="status">
                    <option value="Resolved">Resolved</option>
                    <option value="Not proceeded">Not proceeded</option>
                    <option value="Blocked">Blocked</option>
                    <option value="Awaiting approval">Awaiting approval</option>
                  </select>
                  <button className="matter-button matter-button-primary" type="submit">
                    Record decision
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>

        <aside className="matter-context-rail">
          <section>
            <span className="matter-kicker">Matter</span>
            <dl>
              <div>
                <dt>Type</dt>
                <dd>{matter.matterType}</dd>
              </div>
              <div>
                <dt>Priority</dt>
                <dd>{matter.priority}</dd>
              </div>
              {matter.businessSponsor && (
                <div>
                  <dt>Business sponsor</dt>
                  <dd>{matter.businessSponsor}</dd>
                </div>
              )}
              {matter.externalAdviser && (
                <div>
                  <dt>External adviser</dt>
                  <dd>{matter.externalAdviser}</dd>
                </div>
              )}
              <div>
                <dt>Raised</dt>
                <dd>
                  {fmt(matter.createdAt)}
                  {matter.createdBy ? ` · ${matter.createdBy.name}` : ""}
                </dd>
              </div>
            </dl>
          </section>

          {taxAreas.length > 0 && (
            <section>
              <span className="matter-kicker">Tax areas</span>
              <div className="matter-tax-areas">
                {taxAreas.map((area) => (
                  <span key={area}>{area}</span>
                ))}
              </div>
            </section>
          )}

          <section>
            <span className="matter-kicker">Add to this matter</span>
            <div className="matter-links">
              <Link href="/documents/new">Upload adviser advice</Link>
              <Link href="/actions-register/new">Raise an action</Link>
              <Link href="/data-requests">Request data</Link>
              <Link href="/obligations/new">Add an obligation</Link>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
