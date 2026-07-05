import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { fmtDate } from "@/lib/obligations";

export default async function EntitiesPage() {
  const entities = await prisma.entity.findMany({
    orderBy: { legalName: "asc" },
    include: { _count: { select: { obligations: true } } },
  });

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href="/">Dashboard</Link> / Entity Register
          </div>
          <h1>Entity Register</h1>
        </div>
        <Link href="/entities/new" className="btn btn-primary">+ New Entity</Link>
      </div>

      {entities.length === 0 ? (
        <div className="panel" style={{ textAlign: "center", padding: "48px 24px" }}>
          <p style={{ color: "#6b7280", marginBottom: 16 }}>
            No entities yet. Add your first entity to get started.
          </p>
          <Link href="/entities/new" className="btn btn-primary">+ New Entity</Link>
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Legal Name</th>
              <th>Type</th>
              <th>CH No.</th>
              <th>Period End</th>
              <th>Flags</th>
              <th>Obligations</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {entities.map((e) => {
              const flags: string[] = [
                e.vatRegistered ? "VAT" : "",
                e.payeRegistered ? "PAYE" : "",
                e.isLargeCompany && !e.isVeryLargeCompany ? "Large" : "",
                e.isVeryLargeCompany ? "VL" : "",
                e.hasErs ? "ERS" : "",
                e.hasPillar2 ? "P2" : "",
                e.saoInScope ? "SAO" : "",
                e.rdClaimExpected ? "R&D" : "",
              ].filter(Boolean) as string[];

              const periodEnd = e.accountingPeriodEnd
                ? fmtDate(e.accountingPeriodEnd)
                : "—";

              return (
                <tr key={e.id}>
                  <td>
                    <Link href={`/entities/${e.id}`}>{e.legalName}</Link>
                  </td>
                  <td className="text-muted text-sm">{e.entityType || "—"}</td>
                  <td className="text-muted">{e.companiesHouseNumber || "—"}</td>
                  <td>{periodEnd}</td>
                  <td>
                    <div className="flag-row">
                      {flags.map((f) => (
                        <span key={f} className="badge badge-blue">{f}</span>
                      ))}
                      {flags.length === 0 && <span className="text-muted">—</span>}
                    </div>
                  </td>
                  <td>{e._count.obligations}</td>
                  <td>
                    <div className="flex gap8">
                      <Link href={`/entities/${e.id}/edit`} className="btn btn-secondary btn-sm">
                        Edit
                      </Link>
                      <Link href={`/entities/${e.id}/obligations`} className="btn btn-secondary btn-sm">
                        Calendar
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}
