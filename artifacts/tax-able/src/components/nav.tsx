import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/auth";
import { NavLink } from "./nav-link";

const OPEN_REVIEW_STATUSES = ["Needs review", "In review", "Needs adviser input", "Needs source verification"];

export async function AppShell({ children }: { children: React.ReactNode }) {
  let openReviewCount = 0;
  try {
    const { orgId } = await requireOrg();
    openReviewCount = await prisma.reviewItem.count({
      where: { organisationId: orgId, reviewStatus: { in: OPEN_REVIEW_STATUSES } },
    });
  } catch {
    openReviewCount = 0;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="sidebar-mark">
          <span className="mark-glyph">T</span>
          <span className="mark-name">Tax-Able</span>
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
          <NavLink href="/obligations">Obligation Register</NavLink>
          <NavLink href="/actions-register">Actions Register</NavLink>
          <NavLink href="/obligations/drafts">Draft Obligations</NavLink>
          <NavLink href="/documents">Document Vault</NavLink>

          <div className="nav-section-label">Sources</div>
          <NavLink href="/sources">Source Systems</NavLink>
          <NavLink href="/sources/data-categories">Data Categories</NavLink>
          <NavLink href="/sources/priority-rules">Priority Rules</NavLink>
          <NavLink href="/sources/conflicts">Conflicts</NavLink>

          <div className="nav-section-label">Reference</div>
          <NavLink href="/rules">Obligation Rules</NavLink>
          <NavLink href="/rules-pack">Rules Pack</NavLink>
        </nav>

        <div className="sidebar-foot">Tax obligations register</div>
      </aside>

      <main className="main">{children}</main>
    </div>
  );
}
