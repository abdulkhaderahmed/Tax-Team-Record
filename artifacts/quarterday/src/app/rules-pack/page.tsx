import Link from "next/link";
import { RULES } from "@/lib/rules-pack";

const REGIME_ORDER = [
  "Corporation Tax",
  "Corporation Tax Payment",
  "Quarterly Instalment Payments",
  "VAT",
  "P11D/P11D(b)",
  "PSA",
  "ERS",
  "EMI",
  "R&D",
  "Capital Allowances",
  "SAO",
  "Published Tax Strategy",
  "Pillar 2",
];

export default function RulesPackPage() {
  const activeRules = RULES.filter((r) => r.active);

  const byRegime = REGIME_ORDER.map((regime) => ({
    regime,
    rules: activeRules.filter((r) => r.regime === regime),
  })).filter((g) => g.rules.length > 0);

  const otherRules = activeRules.filter((r) => !REGIME_ORDER.includes(r.regime));

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href="/">Dashboard</Link> / UK Obligations Rules Pack
          </div>
          <h1>UK Obligations Rules Pack</h1>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <p className="text-sm text-muted" style={{ margin: 0 }}>
          This rules pack defines the UK tax obligations that Quarterday generates from entity profile data.
          Rules are applied when you click <strong>Generate Draft Obligations</strong> on an entity.
          All generated obligations are <strong>draft</strong> until reviewed and activated by a human.
          No calculations, no filing — this is a planning and workflow tool only.
        </p>
        <div className="flex gap8" style={{ marginTop: 12 }}>
          <Link href="/obligations/drafts" className="btn btn-primary btn-sm">View draft obligations</Link>
          <Link href="/entities" className="btn btn-secondary btn-sm">Entity register</Link>
        </div>
      </div>

      <div className="flex gap8" style={{ marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        <span className="text-sm text-muted">{activeRules.length} active rules across {byRegime.length} regimes</span>
        <span className="badge badge-yellow" style={{ fontSize: 10 }}>⚠ Review required = date depends on user-provided flags — verify with tax adviser</span>
      </div>

      {byRegime.map(({ regime, rules }) => (
        <div key={regime} className="panel" style={{ marginBottom: 16 }}>
          <h2 style={{ marginBottom: 16 }}>{regime}</h2>
          <div className="table-scroll">
            <table className="data-table" style={{ minWidth: 900 }}>
              <thead>
                <tr>
                  <th style={{ width: 110 }}>Rule ID</th>
                  <th>Name</th>
                  <th>Trigger condition</th>
                  <th>Date calculation</th>
                  <th>Obligation type</th>
                  <th>Recurrence</th>
                  <th>Statutory basis</th>
                  <th>Effective from</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id}>
                    <td>
                      <code style={{ fontSize: 11 }}>{rule.id}</code>
                      {rule.warningFlag && (
                        <span className="badge badge-orange" style={{ fontSize: 9, marginLeft: 4 }}>
                          ⚠ Review
                        </span>
                      )}
                    </td>
                    <td className="text-sm">{rule.name}</td>
                    <td className="text-sm text-muted">{rule.triggerCondition}</td>
                    <td className="text-sm">{rule.dateCalcLogic}</td>
                    <td className="text-sm">
                      <span className="badge badge-grey" style={{ fontSize: 10 }}>{rule.obligationType}</span>
                    </td>
                    <td className="text-sm">{rule.recurrence}</td>
                    <td className="text-sm text-muted" style={{ fontSize: 10 }}>{rule.statutoryBasis}</td>
                    <td className="text-sm text-muted">{rule.effectiveFrom}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rules.some((r) => r.notes) && (
            <div style={{ marginTop: 12 }}>
              {rules.filter((r) => r.notes).map((r) => (
                <p key={r.id} className="text-sm text-muted" style={{ marginBottom: 4 }}>
                  <code style={{ fontSize: 11 }}>{r.id}</code>: {r.notes}
                </p>
              ))}
            </div>
          )}
        </div>
      ))}

      {otherRules.length > 0 && (
        <div className="panel">
          <h2>Other rules</h2>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Rule ID</th>
                  <th>Regime</th>
                  <th>Name</th>
                  <th>Trigger</th>
                  <th>Date calculation</th>
                </tr>
              </thead>
              <tbody>
                {otherRules.map((r) => (
                  <tr key={r.id}>
                    <td><code style={{ fontSize: 11 }}>{r.id}</code></td>
                    <td><span className="badge badge-grey">{r.regime}</span></td>
                    <td>{r.name}</td>
                    <td className="text-sm text-muted">{r.triggerCondition}</td>
                    <td className="text-sm">{r.dateCalcLogic}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
