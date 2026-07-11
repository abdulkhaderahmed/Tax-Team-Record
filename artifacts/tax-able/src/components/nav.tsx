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
          <div className="nav-section-label">Navigation</div>
          <NavLink href="/" exact>Dashboard</NavLink>
          <NavLink href="/review">
            <span>Review Queue</span>
            {openReviewCount > 0 && <span className="badge badge-blue num">{openReviewCount}</span>}
          </NavLink>

          <div className="nav-section-label">Registers</div>
          <NavLink href="/entities">Entity Register</NavLink>
          <NavLink href="/groups">Group Structure</NavLink>
          <NavLink href="/registrations">Tax Registrations</NavLink>
          <NavLink href="/periods">Accounting Periods</NavLink>
          <NavLink href="/obligations">Obligation Register</NavLink>
          <NavLink href="/actions-register">Actions Register</NavLink>
          <NavLink href="/assumptions">Assumptions</NavLink>
          <NavLink href="/caveats">Caveats</NavLink>
          <NavLink href="/tripwires">Tripwires</NavLink>
          <NavLink href="/exceptions">Exceptions</NavLink>
          <NavLink href="/evidence">Evidence</NavLink>
          <NavLink href="/data-requests">Data Requests</NavLink>
          <NavLink href="/approvals">Approvals</NavLink>
          <NavLink href="/obligations/drafts">Draft Obligations</NavLink>
          <NavLink href="/documents">Document Vault</NavLink>

          <div className="nav-section-label">Sources</div>
          <NavLink href="/sources">Source Systems</NavLink>
          <NavLink href="/sources/data-categories">Data Categories</NavLink>
          <NavLink href="/sources/priority-rules">Priority Rules</NavLink>
          <NavLink href="/sources/conflicts">Conflicts</NavLink>

          <div className="nav-section-label">Reference</div>
          <NavLink href="/rules-pack">Controlled Rules</NavLink>
          <NavLink href="/rule-impact">Rule Impacts</NavLink>
          <NavLink href="/ai-assurance">AI Assurance</NavLink>
          <NavLink href="/audit">Audit History</NavLink>
        </nav>

        <div className="sidebar-foot">Tax obligations register</div>
      </aside>

      <main className="main">{children}</main>
    </div>
  );
}
