import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { fmtDate } from "@/lib/obligations";
import { activateDraft, restoreDraftToPending } from "@/app/actions/draftObligations";
import { getRuleById } from "@/lib/rules-pack";

function reviewBadge(status: string | null) {
  if (status === "pending")        return <span className="badge badge-yellow">Pending review</span>;
  if (status === "activated")      return <span className="badge badge-green">Activated</span>;
  if (status === "rejected")       return <span className="badge badge-red">Rejected</span>;
  if (status === "not_applicable") return <span className="badge badge-grey">Not applicable</span>;
  return <span className="badge badge-grey">—</span>;
}

export default async function DraftsPage({
  searchParams,
}: {
  searchParams: Promise<{
    entity?: string;
    tab?: string;
    generated?: string;
  }>;
}) {
  const sp = await searchParams;
  const tab = sp.tab ?? "pending";

  const org = await prisma.organisation.findFirst();
  const entities = org
    ? await prisma.entity.findMany({
        where: { organisationId: org.id },
        orderBy: { legalName: "asc" },
        select: { id: true, legalName: true },
      })
    : [];

  const whereBase = {
    organisationId: org?.id ?? "",
    ruleId: { not: null as null },
    archivedAt: null,
    ...(sp.entity ? { entityId: sp.entity } : {}),
  };

  const statusFilter =
    tab === "pending" ? "pending"
    : tab === "rejected" ? "rejected"
    : tab === "na" ? "not_applicable"
    : undefined; // "all"

  const drafts = await prisma.manualObligation.findMany({
    where: {
      ...whereBase,
      ...(statusFilter ? { draftReviewStatus: statusFilter } : {
        draftReviewStatus: { in: ["pending", "rejected", "not_applicable"] },
      }),
    },
    include: { entity: { select: { id: true, legalName: true } } },
    orderBy: [{ draftReviewStatus: "asc" }, { filingDeadline: "asc" }],
    take: 500,
  });

  // Counts for tab labels
  const counts = await prisma.manualObligation.groupBy({
    by: ["draftReviewStatus"],
    where: {
      ...whereBase,
      draftReviewStatus: { in: ["pending", "rejected", "not_applicable"] },
    },
    _count: { id: true },
  });
  const countMap: Record<string, number> = {};
  for (const c of counts) {
    if (c.draftReviewStatus) countMap[c.draftReviewStatus] = c._count.id;
  }

  const tabParams = sp.entity ? `?entity=${sp.entity}` : "?";

  const generatedMsg = sp.generated ? parseInt(sp.generated, 10) : null;

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href="/">Dashboard</Link> / Draft Generated Obligations
          </div>
          <h1>Draft Generated Obligations</h1>
        </div>
      </div>

      {generatedMsg !== null && (
        <div className="alert alert-info" style={{ marginBottom: 16 }}>
          {generatedMsg === 0
            ? "No new obligations were generated — all applicable rules are already covered or previously reviewed."
            : `${generatedMsg} draft obligation${generatedMsg === 1 ? "" : "s"} generated. Review each one below before activating.`}
        </div>
      )}

      {/* Entity filter */}
      <div className="panel" style={{ padding: "12px 20px", marginBottom: 16 }}>
        <form method="GET" action="/obligations/drafts">
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--ink-secondary)", marginBottom: 3 }}>
                Entity
              </label>
              <select name="entity" defaultValue={sp.entity ?? ""} style={{ fontSize: 12, padding: "5px 8px" }}>
                <option value="">All entities</option>
                {entities.map((e) => (
                  <option key={e.id} value={e.id}>{e.legalName}</option>
                ))}
              </select>
            </div>
            <input type="hidden" name="tab" value={tab} />
            <button type="submit" className="btn btn-primary btn-sm">Filter</button>
            {sp.entity && (
              <a href={`/obligations/drafts?tab=${tab}`} className="btn btn-secondary btn-sm">Clear</a>
            )}
          </div>
        </form>
      </div>

      {/* Tabs */}
      <div className="tab-bar">
        <Link href={`/obligations/drafts${tabParams}&tab=pending`}
          className={`tab${tab === "pending" ? " tab-active" : ""}`}>
          Pending review {countMap["pending"] ? `(${countMap["pending"]})` : ""}
        </Link>
        <Link href={`/obligations/drafts${tabParams}&tab=rejected`}
          className={`tab${tab === "rejected" ? " tab-active" : ""}`}>
          Rejected {countMap["rejected"] ? `(${countMap["rejected"]})` : ""}
        </Link>
        <Link href={`/obligations/drafts${tabParams}&tab=na`}
          className={`tab${tab === "na" ? " tab-active" : ""}`}>
          Not applicable {countMap["not_applicable"] ? `(${countMap["not_applicable"]})` : ""}
        </Link>
        <Link href={`/obligations/drafts${tabParams}&tab=all`}
          className={`tab${tab === "all" ? " tab-active" : ""}`}>
          All
        </Link>
      </div>

      {drafts.length === 0 ? (
        <div className="panel" style={{ padding: 32, textAlign: "center" }}>
          <p className="text-muted" style={{ marginBottom: 12 }}>
            {tab === "pending"
              ? "No obligations pending review."
              : "Nothing here."}
          </p>
          <p className="text-sm text-muted">
            Go to an entity and click <strong>Generate Draft Obligations</strong> to create drafts from the rules pack.
          </p>
          <div style={{ marginTop: 16 }}>
            <Link href="/entities" className="btn btn-primary">Entity Register →</Link>
          </div>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="data-table" style={{ minWidth: 1100 }}>
            <thead>
              <tr>
                <th>Entity</th>
                <th>Regime</th>
                <th>Obligation type</th>
                <th>Description</th>
                <th>Filing deadline</th>
                <th>Period</th>
                <th>Status</th>
                <th style={{ minWidth: 280 }}>Why generated / Calculation basis</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {drafts.map((ob) => {
                const rule = ob.ruleId ? getRuleById(ob.ruleId) : undefined;
                const activateAction = activateDraft.bind(null, ob.id);
                const restoreAction = restoreDraftToPending.bind(null, ob.id);
                const isPending = ob.draftReviewStatus === "pending";
                const isRejectedOrNa = ob.draftReviewStatus === "rejected" || ob.draftReviewStatus === "not_applicable";

                return (
                  <tr key={ob.id}>
                    <td className="text-sm">
                      {ob.entity ? (
                        <Link href={`/entities/${ob.entity.id}`}>{ob.entity.legalName}</Link>
                      ) : "—"}
                    </td>
                    <td className="text-sm">
                      <span className="badge badge-grey" style={{ fontSize: 10 }}>{ob.regime}</span>
                    </td>
                    <td className="text-sm text-muted">{ob.obligationType}</td>
                    <td className="text-sm" style={{ maxWidth: 260 }}>
                      {ob.description}
                      {rule?.warningFlag && (
                        <span className="badge badge-orange" style={{ fontSize: 9, marginLeft: 4 }}>
                          ⚠ Review required
                        </span>
                      )}
                    </td>
                    <td className="text-sm" style={{ whiteSpace: "nowrap" }}>
                      {ob.filingDeadline ? fmtDate(ob.filingDeadline) : "—"}
                    </td>
                    <td className="text-sm text-muted" style={{ whiteSpace: "nowrap" }}>
                      {ob.periodStart && ob.periodEnd
                        ? `${fmtDate(ob.periodStart)} – ${fmtDate(ob.periodEnd)}`
                        : "—"}
                    </td>
                    <td>{reviewBadge(ob.draftReviewStatus)}</td>
                    <td style={{ maxWidth: 320, fontSize: 11, color: "var(--ink-secondary)" }}>
                      <div style={{ marginBottom: 4 }}>
                        <strong style={{ color: "var(--ink-secondary)" }}>Why:</strong>{" "}
                        {ob.humanExplanation ?? "—"}
                      </div>
                      <div>
                        <strong style={{ color: "var(--ink-secondary)" }}>Calc:</strong>{" "}
                        {ob.calculationBasis ?? "—"}
                      </div>
                      {ob.draftNote && (
                        <div style={{ marginTop: 4, color: "var(--overdue)" }}>
                          <strong>Note:</strong> {ob.draftNote}
                        </div>
                      )}
                      {ob.statutoryBasis && (
                        <div style={{ marginTop: 4 }}>
                          <strong style={{ color: "var(--ink-secondary)" }}>Basis:</strong>{" "}
                          {ob.statutoryBasis}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="flex" style={{ flexDirection: "column", gap: 4, minWidth: 120 }}>
                        {isPending && (
                          <>
                            <form action={activateAction}>
                              <button type="submit" className="btn btn-primary btn-sm" style={{ width: "100%" }}>
                                Activate
                              </button>
                            </form>
                            <Link
                              href={`/obligations/${ob.id}/edit`}
                              className="btn btn-secondary btn-sm"
                              style={{ textAlign: "center", display: "block" }}
                            >
                              Edit
                            </Link>
                            <Link
                              href={`/obligations/drafts/${ob.id}/reject`}
                              className="btn btn-secondary btn-sm"
                              style={{ textAlign: "center", display: "block" }}
                            >
                              Reject →
                            </Link>
                            <Link
                              href={`/obligations/drafts/${ob.id}/not-applicable`}
                              className="btn btn-secondary btn-sm"
                              style={{ textAlign: "center", display: "block" }}
                            >
                              Not applicable →
                            </Link>
                          </>
                        )}
                        {isRejectedOrNa && (
                          <form action={restoreAction}>
                            <button type="submit" className="btn btn-secondary btn-sm" style={{ width: "100%" }}>
                              Restore to pending
                            </button>
                          </form>
                        )}
                        <Link
                          href={`/obligations/${ob.id}`}
                          className="text-sm"
                          style={{ textAlign: "center" }}
                        >
                          View →
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
