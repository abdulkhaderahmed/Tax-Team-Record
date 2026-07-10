import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { fmtDate, MONTH_NAMES } from "@/lib/obligations";
import { deleteEntity } from "@/app/actions/entities";
import { generateEntityDrafts } from "@/app/actions/draftObligations";

function GenerateButton({ entityId }: { entityId: string }) {
  const action = generateEntityDrafts.bind(null, entityId);
  return (
    <form action={action}>
      <button type="submit" className="btn btn-primary">
        Generate Draft Obligations
      </button>
    </form>
  );
}

function YesNo({ value }: { value: boolean }) {
  return (
    <span className={`badge ${value ? "badge-green" : "badge-grey"}`}>
      {value ? "Yes" : "No"}
    </span>
  );
}

export default async function EntityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const entity = await prisma.entity.findUnique({
    where: { id },
    include: {
      _count: { select: { obligations: true } },
      obligations: {
        where: {
          dueDate: { gte: new Date(), lte: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) },
        },
        orderBy: { dueDate: "asc" },
        take: 5,
        include: { rule: true },
      },
    },
  });

  if (!entity) notFound();

  const deleteAction = deleteEntity.bind(null, entity.id);

  const vatStagger = entity.vatQuarterEndMonth
    ? `${MONTH_NAMES[entity.vatQuarterEndMonth - 1]} stagger`
    : "—";

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href="/">Dashboard</Link> /{" "}
            <Link href="/entities">Entity Register</Link> / {entity.legalName}
          </div>
          <h1>{entity.legalName}</h1>
        </div>
        <div className="flex gap8">
          <Link href={`/entities/${entity.id}/edit`} className="btn btn-secondary">
            Edit
          </Link>
          <Link href={`/entities/${entity.id}/obligations`} className="btn btn-secondary">
            Obligations Calendar
          </Link>
          <GenerateButton entityId={entity.id} />
        </div>
      </div>

      {/* ── Identification ─────────────────────────────────── */}
      <div className="panel">
        <h2>Identification</h2>
        <div className="detail-grid">
          <div className="detail-item">
            <div className="detail-label">Legal name</div>
            <div className="detail-value">{entity.legalName}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Companies House number</div>
            <div className="detail-value">{entity.companiesHouseNumber || "—"}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Jurisdiction</div>
            <div className="detail-value">{entity.jurisdiction}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Entity type</div>
            <div className="detail-value">{entity.entityType || "—"}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">UK tax resident</div>
            <div className="detail-value"><YesNo value={entity.ukTaxResident} /></div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Obligations on record</div>
            <div className="detail-value">{entity._count.obligations}</div>
          </div>
        </div>
        <div className="text-muted text-sm" style={{ marginTop: 14 }}>
          Added {fmtDate(entity.createdAt)} · Last updated {fmtDate(entity.updatedAt)}
        </div>
      </div>

      {/* ── Corporation Tax ────────────────────────────────── */}
      <div className="panel">
        <h2>Corporation Tax</h2>
        <div className="detail-grid">
          <div className="detail-item">
            <div className="detail-label">CT UTR</div>
            <div className="detail-value">{entity.corporationTaxUtr || "—"}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">CT return required</div>
            <div className="detail-value"><YesNo value={entity.ctReturnRequired} /></div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Accounting period start</div>
            <div className="detail-value">{entity.accountingPeriodStart ? fmtDate(entity.accountingPeriodStart) : "—"}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Accounting period end</div>
            <div className="detail-value">{entity.accountingPeriodEnd ? fmtDate(entity.accountingPeriodEnd) : "—"}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">CH accounts due</div>
            <div className="detail-value">{entity.companiesHouseAccountsDue ? fmtDate(entity.companiesHouseAccountsDue) : "—"}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">CT payment method</div>
            <div className="detail-value">{entity.ctPaymentMethod || "—"}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Taxable profits band</div>
            <div className="detail-value">{entity.taxableProfitsBand || "—"}</div>
          </div>
        </div>
        <div className="flag-row" style={{ marginTop: 14 }}>
          {entity.isVeryLargeCompany && <span className="badge badge-purple">Very large (QIPs)</span>}
          {entity.isLargeCompany && !entity.isVeryLargeCompany && <span className="badge badge-blue">Large company</span>}
          {!entity.isLargeCompany && !entity.isVeryLargeCompany && <span className="badge badge-grey">Standard</span>}
        </div>
      </div>

      {/* ── VAT ───────────────────────────────────────────── */}
      <div className="panel">
        <h2>VAT</h2>
        <div className="detail-grid">
          <div className="detail-item">
            <div className="detail-label">VAT registered</div>
            <div className="detail-value"><YesNo value={entity.vatRegistered} /></div>
          </div>
          <div className="detail-item">
            <div className="detail-label">VAT registration number</div>
            <div className="detail-value">{entity.vatRegistrationNumber || "—"}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">VAT quarter stagger</div>
            <div className="detail-value">{vatStagger}</div>
          </div>
        </div>
      </div>

      {/* ── Payroll & Employment ───────────────────────────── */}
      <div className="panel">
        <h2>Payroll &amp; Employment</h2>
        <div className="detail-grid">
          <div className="detail-item">
            <div className="detail-label">PAYE registered</div>
            <div className="detail-value"><YesNo value={entity.payeRegistered} /></div>
          </div>
          <div className="detail-item">
            <div className="detail-label">ERS scheme present</div>
            <div className="detail-value"><YesNo value={entity.hasErs} /></div>
          </div>
          <div className="detail-item">
            <div className="detail-label">EMI scheme present</div>
            <div className="detail-value"><YesNo value={entity.hasEmi} /></div>
          </div>
          <div className="detail-item">
            <div className="detail-label">P11D required</div>
            <div className="detail-value"><YesNo value={entity.p11dRequired} /></div>
          </div>
          <div className="detail-item">
            <div className="detail-label">PSA required</div>
            <div className="detail-value"><YesNo value={entity.psaRequired} /></div>
          </div>
        </div>
      </div>

      {/* ── R&D ───────────────────────────────────────────── */}
      <div className="panel">
        <h2>Research &amp; Development</h2>
        <div className="detail-grid">
          <div className="detail-item">
            <div className="detail-label">R&amp;D claim expected</div>
            <div className="detail-value"><YesNo value={entity.rdClaimExpected} /></div>
          </div>
          <div className="detail-item">
            <div className="detail-label">R&amp;D notification needed</div>
            <div className="detail-value"><YesNo value={entity.rdNotificationNeeded} /></div>
          </div>
          <div className="detail-item">
            <div className="detail-label">R&amp;D additional information form</div>
            <div className="detail-value"><YesNo value={entity.rdAifNeeded} /></div>
          </div>
        </div>
      </div>

      {/* ── Capital Allowances ─────────────────────────────── */}
      <div className="panel">
        <h2>Capital Allowances</h2>
        <div className="detail-grid">
          <div className="detail-item">
            <div className="detail-label">CA activity</div>
            <div className="detail-value"><YesNo value={entity.capitalAllowancesActivity} /></div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Full expensing relevant</div>
            <div className="detail-value"><YesNo value={entity.fullExpensingRelevant} /></div>
          </div>
          <div className="detail-item">
            <div className="detail-label">AIA relevant</div>
            <div className="detail-value"><YesNo value={entity.aiaRelevant} /></div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Special rate pool relevant</div>
            <div className="detail-value"><YesNo value={entity.specialRatePoolRelevant} /></div>
          </div>
        </div>
      </div>

      {/* ── Group & International ──────────────────────────── */}
      <div className="panel">
        <h2>Group &amp; International</h2>
        <div className="detail-grid">
          <div className="detail-item">
            <div className="detail-label">Group relief relevant</div>
            <div className="detail-value"><YesNo value={entity.groupReliefRelevant} /></div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Losses brought forward</div>
            <div className="detail-value"><YesNo value={entity.lossesBroughtForward} /></div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Transfer pricing relevant</div>
            <div className="detail-value"><YesNo value={entity.transferPricingRelevant} /></div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Pillar 2 in scope</div>
            <div className="detail-value"><YesNo value={entity.hasPillar2} /></div>
          </div>
        </div>
      </div>

      {/* ── Governance ─────────────────────────────────────── */}
      <div className="panel">
        <h2>Governance</h2>
        <div className="detail-grid">
          <div className="detail-item">
            <div className="detail-label">SAO in scope</div>
            <div className="detail-value"><YesNo value={entity.saoInScope} /></div>
          </div>
          <div className="detail-item">
            <div className="detail-label">CCO in scope</div>
            <div className="detail-value"><YesNo value={entity.ccoInScope} /></div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Published tax strategy in scope</div>
            <div className="detail-value"><YesNo value={entity.publishedTaxStrategyInScope} /></div>
          </div>
        </div>
      </div>

      {/* ── Ownership ──────────────────────────────────────── */}
      <div className="panel">
        <h2>Ownership</h2>
        <div className="detail-grid">
          <div className="detail-item">
            <div className="detail-label">Primary tax owner</div>
            <div className="detail-value">{entity.primaryTaxOwner || "—"}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Finance owner</div>
            <div className="detail-value">{entity.financeOwner || "—"}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Payroll owner</div>
            <div className="detail-value">{entity.payrollOwner || "—"}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">External adviser</div>
            <div className="detail-value">{entity.externalAdviser || "—"}</div>
          </div>
        </div>
      </div>

      {/* ── Upcoming obligations ────────────────────────────── */}
      {entity.obligations.length > 0 && (
        <div className="panel">
          <div className="flex justify-between items-center" style={{ marginBottom: 14 }}>
            <h2 className="mb0">Upcoming obligations (next 90 days)</h2>
            <Link href={`/entities/${entity.id}/obligations`} className="text-sm">
              Full calendar →
            </Link>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Due Date</th>
                <th>Obligation</th>
                <th>Period</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {entity.obligations.map((ob) => (
                <tr key={ob.id}>
                  <td>{fmtDate(ob.dueDate)}</td>
                  <td>{ob.title}</td>
                  <td className="text-muted text-sm">{ob.period}</td>
                  <td><span className="badge badge-grey">{ob.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {entity._count.obligations === 0 && (
        <div className="alert alert-info">
          No obligations generated yet.{" "}
          <Link href={`/entities/${entity.id}/obligations`}>
            Generate the obligations calendar →
          </Link>
        </div>
      )}

      {/* ── Danger zone ────────────────────────────────────── */}
      <div className="panel" style={{ borderColor: "var(--overdue)", marginTop: 8 }}>
        <h2>Danger zone</h2>
        <p className="text-sm text-muted">
          Deleting this entity will permanently remove it and all its obligations. This cannot be undone.
        </p>
        <form action={deleteAction}>
          <button type="submit" className="btn btn-danger btn-sm">
            Delete entity
          </button>
        </form>
      </div>
    </>
  );
}
