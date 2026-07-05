import Link from "next/link";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <Link href="/" className="logo" style={{ textDecoration: "none" }}>
          Quarterday
        </Link>
        <span className="tagline">Tax obligations register</span>
      </header>

      <nav className="sidebar">
        <div className="nav-section-label">Navigation</div>
        <Link href="/" className="nav-link">Dashboard</Link>
        <Link href="/entities" className="nav-link">Entity Register</Link>
        <Link href="/obligations" className="nav-link">Obligation Register</Link>
        <Link href="/obligations/drafts" className="nav-link">Draft Obligations</Link>

        <div className="nav-section-label" style={{ marginTop: 8 }}>Sources</div>
        <Link href="/sources" className="nav-link">Source Systems</Link>
        <Link href="/sources/data-categories" className="nav-link">Data Categories</Link>
        <Link href="/sources/priority-rules" className="nav-link">Priority Rules</Link>
        <Link href="/sources/conflicts" className="nav-link">Conflicts</Link>

        <div className="nav-section-label" style={{ marginTop: 8 }}>Reference</div>
        <Link href="/rules" className="nav-link">Obligation Rules</Link>
        <Link href="/rules-pack" className="nav-link">Rules Pack</Link>
      </nav>

      <main className="main">{children}</main>
    </div>
  );
}
