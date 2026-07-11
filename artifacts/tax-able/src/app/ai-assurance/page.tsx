import Link from "next/link";
import goldInventory from "../../../eval/extraction-benchmark/gold-concepts.json";
import { requireOrg } from "@/lib/auth";

type Inventory = {
  inventoryStatus: string;
  fixtures: Array<{
    targetSet: { completeness: string; verificationStatus: string };
    concepts: Array<{
      recordType: string;
      annotationStatus: string;
      materialityStatus: string;
      citation: { acceptedPhysicalPages: number[]; verificationStatus: string };
    }>;
  }>;
};

export default async function AiAssurancePage() {
  await requireOrg();
  const inventory = goldInventory as Inventory;
  const concepts = inventory.fixtures.flatMap((fixture) => fixture.concepts);
  const verifiedConcepts = concepts.filter(
    (concept) => concept.annotationStatus === "verified" && concept.materialityStatus === "verified",
  ).length;
  const verifiedCompleteFixtures = inventory.fixtures.filter(
    (fixture) => fixture.targetSet.completeness === "complete" && fixture.targetSet.verificationStatus === "verified",
  ).length;
  const pageAnnotatedConcepts = concepts.filter(
    (concept) => concept.citation.acceptedPhysicalPages.length > 0,
  ).length;
  const targetConcepts = concepts.filter((concept) => ["obligation", "action"].includes(concept.recordType)).length;
  const claimAllowed =
    inventory.inventoryStatus === "verified" &&
    verifiedCompleteFixtures === inventory.fixtures.length &&
    verifiedConcepts === concepts.length;

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb"><Link href="/">Dashboard</Link> / AI assurance</div>
          <h1>AI assurance</h1>
        </div>
        <span className={`badge ${claimAllowed ? "badge-green" : "badge-red"}`}>
          {claimAllowed ? "Accuracy claims permitted" : "Accuracy claims disabled"}
        </span>
      </div>

      <div className="alert alert-warning">
        The five-document benchmark is wired but its tax annotations are still draft and require two-reviewer verification. The product must not publish an extraction-accuracy percentage until the verified gates pass.
      </div>

      <div className="stat-row">
        <div className="stat-card"><div className="stat-value">{inventory.fixtures.length}</div><div className="stat-label">Private fixtures identified by hash</div></div>
        <div className="stat-card"><div className="stat-value">{targetConcepts}</div><div className="stat-label">Draft obligation/action concepts</div></div>
        <div className="stat-card"><div className="stat-value">{verifiedConcepts}/{concepts.length}</div><div className="stat-label">Concepts independently verified</div></div>
        <div className="stat-card"><div className="stat-value">{verifiedCompleteFixtures}/5</div><div className="stat-label">Complete verified target sets</div></div>
        <div className="stat-card"><div className="stat-value">{pageAnnotatedConcepts}</div><div className="stat-label">Draft concepts with page leads</div></div>
      </div>

      <div className="panel">
        <h2>Release gates</h2>
        <table className="data-table">
          <thead><tr><th>Control</th><th>Threshold</th><th>Current status</th></tr></thead>
          <tbody>
            <tr><td>Material obligation/action recall</td><td>100% — no material target missed</td><td><span className="badge badge-grey">Not yet scorable</span></td></tr>
            <tr><td>Page citation accuracy</td><td>At least 95% of confirmed extracted items</td><td><span className="badge badge-grey">Not yet scorable</span></td></tr>
            <tr><td>False positives / precision</td><td>Measured only after each fixture target set is complete</td><td><span className="badge badge-grey">Guarded</span></td></tr>
            <tr><td>Condition preservation</td><td>Conditional advice remains conditional in the record</td><td><span className="badge badge-grey">Harness ready</span></td></tr>
            <tr><td>Quote grounding</td><td>Every scored citation independently verified against source text</td><td><span className="badge badge-grey">Harness ready</span></td></tr>
          </tbody>
        </table>
      </div>

      <div className="panel">
        <h2>What the evaluator prevents</h2>
        <p className="text-sm text-muted" style={{ marginBottom: 0 }}>
          Draft annotations can produce provisional development reports, but never a publishable accuracy claim. Unmatched predictions count as false positives only for complete target sets, duplicate predictions cannot inflate recall, and citations are scored against one-based physical PDF pages.
        </p>
      </div>
    </>
  );
}
