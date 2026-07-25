import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/auth";
import { createMatter } from "@/app/actions/matters";

export const dynamic = "force-dynamic";

const MATTER_TYPES = [
  "Transaction",
  "Advice implementation",
  "Enquiry",
  "Reorganisation",
  "Incentives & reward",
  "Compliance",
  "Other",
];

const STATUSES = ["Open", "Blocked", "Awaiting approval"];
const PRIORITIES = ["Low", "Normal", "High", "Critical"];

export default async function NewMatterPage() {
  const context = await requireOrg();
  const entities = await prisma.entity.findMany({
    where: { organisationId: context.orgId, archivedAt: null },
    select: { id: true, legalName: true },
    orderBy: { legalName: "asc" },
  });

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href="/">Dashboard</Link> / <Link href="/matters">Matters</Link> / New
          </div>
          <h1>Add tax matter</h1>
        </div>
      </div>

      <form action={createMatter} className="form-page">
        <section className="card">
          <h2>What needs resolving</h2>

          <div className="field">
            <label htmlFor="title">
              Title <span className="req">*</span>
            </label>
            <input
              id="title"
              name="title"
              placeholder="e.g. Management incentive plan following the acquisition"
              required
              type="text"
            />
          </div>

          <div className="field">
            <label htmlFor="decisionQuestion">
              Decision required <span className="req">*</span>
            </label>
            <input
              id="decisionQuestion"
              name="decisionQuestion"
              placeholder="e.g. Can Tax release the transaction for board approval?"
              required
              type="text"
            />
            <small>
              The question this matter exists to answer. A matter without a decision to
              reach is a folder, not a matter.
            </small>
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="matterType">
                Matter type <span className="req">*</span>
              </label>
              <select defaultValue="Transaction" id="matterType" name="matterType" required>
                {MATTER_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="entityId">Entity</label>
              <select defaultValue="" id="entityId" name="entityId">
                <option value="">— group / not entity-specific —</option>
                {entities.map((entity) => (
                  <option key={entity.id} value={entity.id}>
                    {entity.legalName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <label htmlFor="summary">Summary</label>
            <textarea
              id="summary"
              name="summary"
              placeholder="What happened, and why Tax is involved."
              rows={3}
            />
          </div>
        </section>

        <section className="card">
          <h2>Ownership and timing</h2>

          <div className="field-row">
            <div className="field">
              <label htmlFor="status">Status</label>
              <select defaultValue="Open" id="status" name="status">
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="priority">Priority</label>
              <select defaultValue="Normal" id="priority" name="priority">
                {PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="taxOwner">Tax owner</label>
              <input id="taxOwner" name="taxOwner" placeholder="e.g. Head of Tax" type="text" />
            </div>
            <div className="field">
              <label htmlFor="businessSponsor">Business sponsor</label>
              <input id="businessSponsor" name="businessSponsor" placeholder="e.g. CFO" type="text" />
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="externalAdviser">External adviser</label>
              <input id="externalAdviser" name="externalAdviser" type="text" />
            </div>
            <div className="field">
              <label htmlFor="targetDecisionDate">Target decision date</label>
              <input id="targetDecisionDate" name="targetDecisionDate" type="date" />
            </div>
          </div>

          <div className="field">
            <label htmlFor="taxAreas">Tax areas</label>
            <input
              id="taxAreas"
              name="taxAreas"
              placeholder="e.g. Corporation tax, VAT, Employment-related securities"
              type="text"
            />
            <small>Comma separated.</small>
          </div>
        </section>

        <div className="form-actions">
          <Link className="matter-button matter-button-secondary" href="/matters">
            Cancel
          </Link>
          <button className="matter-button matter-button-primary" type="submit">
            Create matter
          </button>
        </div>
      </form>
    </>
  );
}
