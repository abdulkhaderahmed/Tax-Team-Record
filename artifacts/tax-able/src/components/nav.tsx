import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/auth";
import { NavLink } from "./nav-link";
import { documentAccessWhere } from "@/lib/authz";

const OPEN_REVIEW_STATUSES = ["Needs review", "In review", "Needs adviser input", "Needs source verification"];

export async function AppShell({ children }: { children: React.ReactNode }) {
  let openReviewCount = 0;
  try {
    const context = await requireOrg();
    const { orgId } = context;
    openReviewCount = await prisma.reviewItem.count({
      where: {
        organisationId: orgId,
        document: documentAccessWhere(context, "view"),
        reviewStatus: { in: OPEN_REVIEW_STATUSES },
      },
    });
  } catch {
    openReviewCount = 0;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="sidebar-mark">
          <span className="mark-glyph">t</span>
          <span className="mark-name">tax-able</span>
        </Link>

        <nav className="nav">
          <div className="nav-section-label">Work</div>
          <NavLink href="/" exact>Tax workbench</NavLink>
          <NavLink href="/review">
            <span>Advice review</span>
            {openReviewCount > 0 && <span className="badge badge-blue num">{openReviewCount}</span>}
          </NavLink>
          <NavLink href="/actions-register">Actions</NavLink>
          <NavLink href="/data-requests">Data requests</NavLink>
          <NavLink href="/exceptions">Blockers</NavLink>
          <NavLink href="/approvals">Approvals</NavLink>
          <NavLink href="/demo/advice">Guided demo</NavLink>

          <div className="nav-section-label">Records</div>
          <NavLink href="/documents">Source documents</NavLink>
          <NavLink href="/obligations">Deadlines &amp; filings</NavLink>
          <NavLink href="/entities">Entities &amp; groups</NavLink>
          <NavLink href="/evidence">Evidence</NavLink>

          <details className="nav-details">
            <summary>All registers and settings</summary>
            <div className="nav-details-links">
              <NavLink href="/groups">Group structure</NavLink>
              <NavLink href="/registrations">Tax registrations</NavLink>
              <NavLink href="/periods">Accounting periods</NavLink>
              <NavLink href="/assumptions">Assumptions</NavLink>
              <NavLink href="/caveats">Caveats</NavLink>
              <NavLink href="/tripwires">Tripwires</NavLink>
              <NavLink href="/obligations/drafts">Draft obligations</NavLink>
              <NavLink href="/sources">Source systems</NavLink>
              <NavLink href="/sources/data-categories">Data categories</NavLink>
              <NavLink href="/sources/priority-rules">Priority rules</NavLink>
              <NavLink href="/sources/conflicts">Source conflicts</NavLink>
              <NavLink href="/rules-pack">Controlled rules</NavLink>
              <NavLink href="/rule-impact">Rule impacts</NavLink>
              <NavLink href="/ai-assurance">AI assurance</NavLink>
              <NavLink href="/audit">Audit history</NavLink>
            </div>
          </details>
        </nav>

        <div className="sidebar-foot">Advice, decisions and controls</div>
      </aside>

      <main className="main">{children}</main>
    </div>
  );
}
