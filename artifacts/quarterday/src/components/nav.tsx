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

        <div className="nav-section-label" style={{ marginTop: 8 }}>Reference</div>
        <Link href="/rules" className="nav-link">Obligation Rules</Link>
      </nav>

      <main className="main">{children}</main>
    </div>
  );
}
