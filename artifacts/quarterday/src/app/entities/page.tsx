import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function EntitiesPage() {
  const entities = await prisma.entity.findMany({
    orderBy: { legalName: "asc" },
    include: {
      _count: { select: { obligations: true } },
    },
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
        <Link href="/entities/new" className="btn btn-primary">
          + New Entity
        </Link>
      </div>

      {entities.length === 0 ? (
        <div className="panel" style={{ textAlign: "center", padding: "48px 24px" }}>
          <p style={{ color: "#6b7280", marginBottom: 16 }}>
            No entities yet. Add your first entity to get started.
          </p>
          <Link href="/entities/new" className="btn btn-primary">
            + New Entity
          </Link>
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Legal Name</th>
              <th>Companies House No.</th>
              <th>Jurisdiction</th>
              <th>Year End</th>
              <th>VAT Quarter</th>
              <th>Flags</th>
              <th>Obligations</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {entities.map((e) => {
              const flags = [
                e.isLargeCompany && "Large",
                e.isVeryLargeCompany && "VL",
                e.hasErs && "ERS",
                e.hasPillar2 && "P2",
              ].filter(Boolean);

              const vatLabel = e.vatQuarterEndMonth
                ? new Date(2000, e.vatQuarterEndMonth - 1, 1).toLocaleString(
                    "en-GB",
                    { month: "short" }
                  )
                : "—";

              return (
                <tr key={e.id}>
                  <td>
                    <Link href={`/entities/${e.id}`}>{e.legalName}</Link>
                  </td>
                  <td>{e.companiesHouseNumber || "—"}</td>
                  <td>{e.jurisdiction}</td>
                  <td>
                    {e.accountingYearEndDay}{" "}
                    {new Date(
                      2000,
                      e.accountingYearEndMonth - 1,
                      1
                    ).toLocaleString("en-GB", { month: "short" })}
                  </td>
                  <td>{vatLabel}</td>
                  <td>
                    <div className="flag-row">
                      {flags.map((f) => (
                        <span key={f as string} className="badge badge-blue">
                          {f}
                        </span>
                      ))}
                      {flags.length === 0 && (
                        <span className="text-muted">—</span>
                      )}
                    </div>
                  </td>
                  <td>{e._count.obligations}</td>
                  <td>
                    <Link
                      href={`/entities/${e.id}/obligations`}
                      className="btn btn-secondary btn-sm"
                    >
                      Calendar
                    </Link>
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
