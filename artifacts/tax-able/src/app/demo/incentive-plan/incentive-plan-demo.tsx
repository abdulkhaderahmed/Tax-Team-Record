"use client";

import { useMemo, useState } from "react";

type PanelId = "coverage" | "triggers" | "routes" | "lands";

type Position = "opined" | "assumed" | "excluded" | "gap" | "na";

type Party = {
  id: string;
  name: string;
  role: string;
};

type HeadRow = {
  head: string;
  cells: Record<string, { position: Position; note: string }>;
};

const parties: Party[] = [
  { id: "company", name: "The Company", role: "Group entity" },
  { id: "ebt", name: "New EBT", role: "Offshore trust" },
  { id: "founders", name: "Founders", role: "Individuals" },
  { id: "participants", name: "Participants", role: "Employees" },
];

const positionLabel: Record<Position, string> = {
  opined: "Opined",
  assumed: "Assumed",
  excluded: "Out of scope",
  gap: "Not addressed",
  na: "—",
};

const coverage: HeadRow[] = [
  {
    head: "Stamp taxes",
    cells: {
      company: { position: "na", note: "New MIP shares are issued, not transferred." },
      ebt: {
        position: "opined",
        note: "0.5% on acquiring the B shares from the Founders, c.£3,300, and 0.5% again on transferring the beneficial interest on exercise.",
      },
      founders: { position: "opined", note: "Transfer on sale to the new EBT." },
      participants: {
        position: "opined",
        note: "0.5% on JSOP proceeds attributable to the participant's interest.",
      },
    },
  },
  {
    head: "Employment income, PAYE and NIC",
    cells: {
      company: {
        position: "assumed",
        note: "The grossed-up bonus is assumed to be paid and reported as earnings. Amount, timing and secondary Class 1 are not stated.",
      },
      ebt: { position: "na", note: "" },
      founders: { position: "na", note: "" },
      participants: {
        position: "assumed",
        note: "Gross-up covers the first £60,000 of JSOP price. A c.£20,000 shortfall is assumed to be met personally.",
      },
    },
  },
  {
    head: "Employment-related securities",
    cells: {
      company: {
        position: "opined",
        note: "CSOP used within a single £60,000 allowance across both share classes, MIP shares first. Three-year holding condition, subject to good-leaver and exit exceptions.",
      },
      ebt: { position: "na", note: "" },
      founders: { position: "na", note: "" },
      participants: {
        position: "opined",
        note: "Partly paid route leaves a notional loan of c.£210,000 outstanding. Beneficial ownership passes on subscription.",
      },
    },
  },
  {
    head: "Corporation tax deduction",
    cells: {
      company: {
        position: "gap",
        note: "Availability, period and amount of relief on each route are not covered, nor the treatment where shares are delivered by the trust rather than newly issued, nor the disallowance of the accounting charge.",
      },
      ebt: { position: "na", note: "" },
      founders: { position: "na", note: "" },
      participants: { position: "na", note: "" },
    },
  },
  {
    head: "Deferred tax and financial reporting",
    cells: {
      company: {
        position: "gap",
        note: "Measurement of the deferred tax asset on the share-based payment, the split between profit and loss and equity, and the tax-note disclosure.",
      },
      ebt: { position: "na", note: "" },
      founders: { position: "na", note: "" },
      participants: { position: "na", note: "" },
    },
  },
  {
    head: "IHT",
    cells: {
      company: { position: "na", note: "" },
      ebt: {
        position: "gap",
        note: "Whether the new trust meets the employee-trust conditions, and the exit position on property leaving it, are not covered.",
      },
      founders: {
        position: "opined",
        note: "Sale at market value with interest at the official rate (3.75%) preserves value for value, so no transfer of value arises. Market value alone would not be sufficient.",
      },
      participants: { position: "na", note: "" },
    },
  },
  {
    head: "CGT",
    cells: {
      company: { position: "na", note: "" },
      ebt: { position: "na", note: "" },
      founders: {
        position: "excluded",
        note: "Founders' personal position on the B-share sale is outside the engagement scope.",
      },
      participants: {
        position: "gap",
        note: "Exit treatment and relief eligibility on the growth interest are not covered.",
      },
    },
  },
  {
    head: "Information reporting",
    cells: {
      company: {
        position: "gap",
        note: "Plan notification and annual returns for the CSOP and for the non-tax-advantaged JSOP.",
      },
      ebt: {
        position: "gap",
        note: "Trust registration, and the trust's classification and reporting position under FATCA and CRS.",
      },
      founders: { position: "na", note: "" },
      participants: { position: "na", note: "" },
    },
  },
  {
    head: "VAT",
    cells: {
      company: {
        position: "gap",
        note: "Recovery on trust establishment, valuation and advisory costs.",
      },
      ebt: { position: "na", note: "" },
      founders: { position: "na", note: "" },
      participants: { position: "na", note: "" },
    },
  },
];

type TriggerEvent = {
  id: string;
  event: string;
  when: string;
  consequences: Array<{
    obligation: string;
    party: string;
    clock: string;
    scale: "short" | "medium" | "annual" | "long";
    status: "open" | "owned" | "done";
  }>;
};

const triggers: TriggerEvent[] = [
  {
    id: "completion",
    event: "New EBT created",
    when: "Completion · 30 Jun 2026",
    consequences: [
      { obligation: "Trust registration", party: "New EBT", clock: "90 days", scale: "medium", status: "open" },
      { obligation: "FATCA / CRS entity classification", party: "New EBT", clock: "Before first reporting period closes", scale: "long", status: "open" },
      { obligation: "Employee-trust conditions confirmed", party: "New EBT", clock: "On creation", scale: "short", status: "open" },
    ],
  },
  {
    id: "transfer",
    event: "B shares transferred, Founders to EBT",
    when: "Completion · 30 Jun 2026",
    consequences: [
      { obligation: "Stamp duty notified and paid, c.£3,300", party: "New EBT", clock: "30 days from execution", scale: "medium", status: "owned" },
      { obligation: "Register not written up until stamped", party: "Company secretarial", clock: "On stamping", scale: "short", status: "owned" },
    ],
  },
  {
    id: "grant",
    event: "CSOP options granted (routes 1 and 3)",
    when: "3 Jul 2026",
    consequences: [
      { obligation: "Plan notification and self-certification", party: "The Company", clock: "6 July following the tax year of grant", scale: "annual", status: "open" },
      { obligation: "Exercise price set at UMV at grant", party: "The Company", clock: "At grant", scale: "short", status: "done" },
    ],
  },
  {
    id: "subscription",
    event: "MIP shares subscribed, partly paid (route 2)",
    when: "3 Jul 2026",
    consequences: [
      { obligation: "Restricted-securities election", party: "Participants", clock: "14 days from acquisition", scale: "short", status: "open" },
      { obligation: "Notional loan of c.£210,000 recorded", party: "The Company", clock: "On subscription", scale: "short", status: "owned" },
    ],
  },
  {
    id: "jsop",
    event: "JSOP awards made (route 4)",
    when: "3 Jul 2026",
    consequences: [
      { obligation: "Restricted-securities election", party: "Participants", clock: "14 days from acquisition", scale: "short", status: "open" },
      { obligation: "Valuation still current at award (£689 UMV)", party: "The Company", clock: "At each award", scale: "short", status: "owned" },
      { obligation: "Annual return for the non-advantaged plan", party: "The Company", clock: "6 July", scale: "annual", status: "open" },
    ],
  },
  {
    id: "bonus",
    event: "Grossed-up bonus paid",
    when: "31 Jul 2026",
    consequences: [
      { obligation: "Payroll reporting on or before payment", party: "Payroll", clock: "Payment date", scale: "short", status: "owned" },
      { obligation: "PAYE and NIC remitted", party: "The Company", clock: "22nd of the following month", scale: "medium", status: "owned" },
    ],
  },
  {
    id: "exercise",
    event: "Options exercised",
    when: "From Jul 2029",
    consequences: [
      { obligation: "Stamp duty on the beneficial-interest transfer", party: "Participants", clock: "30 days from execution", scale: "medium", status: "open" },
      { obligation: "Three-year holding condition tested", party: "The Company", clock: "At exercise", scale: "short", status: "open" },
      { obligation: "Corporation tax deduction claimed", party: "The Company", clock: "Period of acquisition", scale: "long", status: "open" },
    ],
  },
];

const routes = [
  {
    n: "1",
    name: "MIP shares under CSOP",
    band: "Within the £60,000 allowance",
    delivery: "Company grants options over newly issued MIP shares",
    price: "Exercise price at UMV at grant",
    stamp: "None — newly issued",
    figure: "c.£670,000 aggregate CSOP acquisition cost, routes 1 and 3",
  },
  {
    n: "2",
    name: "MIP shares, partly paid",
    band: "MIP value above the allowance",
    delivery: "Subscription at UMV, balance outstanding as a debt",
    price: "Beneficial ownership passes on subscription",
    stamp: "None — newly issued",
    figure: "c.£210,000 notional loan",
  },
  {
    n: "3",
    name: "B shares under CSOP",
    band: "Allowance left after the MIP allocation",
    delivery: "Company grants; new EBT supplies the shares and keeps bare legal title",
    price: "Exercise proceeds applied against the deferred consideration",
    stamp: "0.5% twice — on the EBT's acquisition and on the beneficial-interest transfer",
    figure: "B share UMV £689 at award",
  },
  {
    n: "4",
    name: "B shares under JSOP",
    band: "Above the allowance",
    delivery: "EBT and participant acquire jointly under one agreement",
    price: "EBT keeps initial value plus 5% p.a. carry; participant takes growth above the hurdle",
    stamp: "0.5% on proceeds attributable to each interest",
    figure: "EBT £446 / participant £243 at award; participant cost c.£220,000",
  },
];

const destinations = [
  {
    period: "Year ending 31 December 2026",
    items: [
      { what: "Grossed-up bonus and secondary NIC", where: "Computation adjustment", state: "Awaiting payroll figures" },
      { what: "Trust establishment and valuation costs", where: "Computation adjustment", state: "VAT recovery position open" },
      { what: "Share-based payment charge", where: "Financial-statement disclosure", state: "Deferred tax basis not set" },
      { what: "Stamp duty c.£3,300", where: "Payment", state: "Owned by company secretarial" },
    ],
  },
  {
    period: "Year ending 31 December 2029",
    items: [
      { what: "Relief on shares acquired on exercise", where: "Return box", state: "Availability not yet established" },
      { what: "Accounting charge disallowed", where: "Computation adjustment", state: "Follows the relief position" },
    ],
  },
];

function inputLevels(gapCount: number) {
  return [
    { id: "L0", name: "Footprint", state: "complete", detail: "14 entities, UK group, 1,850 employees" },
    { id: "L1", name: "Periods", state: "complete", detail: "Periods confirmed to 31 Dec 2029" },
    { id: "L2", name: "Events", state: "complete", detail: `${triggers.length} events recorded from the delivery structure` },
    { id: "L3", name: "Advice", state: "partial", detail: `1 schematic · ${gapCount} coverage gaps open` },
    { id: "L4", name: "Numbers", state: "empty", detail: "Payroll and computation figures unlock the period pack" },
  ];
}

export function IncentivePlanDemo() {
  const [panel, setPanel] = useState<PanelId>("coverage");
  const [cell, setCell] = useState<{ head: string; party: string } | null>(null);

  const gaps = useMemo(
    () =>
      coverage.flatMap((row) =>
        parties
          .filter((party) => row.cells[party.id]?.position === "gap")
          .map((party) => ({
            head: row.head,
            party: party.name,
            note: row.cells[party.id].note,
          })),
      ),
    [],
  );

  const panels: Array<{ id: PanelId; label: string; count?: number }> = [
    { id: "coverage", label: "Coverage", count: gaps.length },
    { id: "triggers", label: "Triggers", count: triggers.length },
    { id: "routes", label: "Routes", count: routes.length },
    { id: "lands", label: "Lands in" },
  ];

  const selected = cell
    ? {
        head: cell.head,
        party: parties.find((party) => party.id === cell.party)?.name ?? "",
        ...coverage.find((row) => row.head === cell.head)!.cells[cell.party],
      }
    : null;

  return (
    <div className="matter-demo ip-demo">
      <header className="matter-heading">
        <div className="matter-heading-main">
          <div className="matter-breadcrumbs">
            <span>Matters</span>
            <span>/</span>
            <span>Incentives &amp; reward</span>
          </div>
          <div className="matter-title-row">
            <h1>Management incentive plan</h1>
            <span className="matter-status matter-status-blocked">
              {gaps.length} coverage gaps
            </span>
          </div>
          <p>
            Delivery structure · Northstar Operations Ltd · {parties.length} parties ·{" "}
            {triggers.length} events · illustrative worked example
          </p>
        </div>
        <div className="matter-heading-actions">
          <button className="matter-button matter-button-secondary" type="button">
            Export coverage
          </button>
          <button className="matter-button matter-button-primary" type="button">
            Raise with adviser
          </button>
        </div>
      </header>

      <ol className="ip-levels" aria-label="Input levels">
        {inputLevels(gaps.length).map((level) => (
          <li className={`ip-level ip-level-${level.state}`} key={level.id}>
            <span className="ip-level-id">{level.id}</span>
            <span className="ip-level-name">{level.name}</span>
            <span className="ip-level-detail">{level.detail}</span>
          </li>
        ))}
      </ol>

      <nav aria-label="Matter sections" className="matter-tabs">
        {panels.map((item) => (
          <button
            aria-current={panel === item.id ? "page" : undefined}
            className={panel === item.id ? "active" : ""}
            key={item.id}
            onClick={() => setPanel(item.id)}
            type="button"
          >
            {item.label}
            {item.count !== undefined && <span>{item.count}</span>}
          </button>
        ))}
      </nav>

      {panel === "coverage" && (
        <div className="ip-coverage-layout">
          <section className="matter-tab-panel">
            <div className="ip-matrix-scroll">
              <table className="ip-matrix">
                <thead>
                  <tr>
                    <th scope="col">Tax head</th>
                    {parties.map((party) => (
                      <th key={party.id} scope="col">
                        <strong>{party.name}</strong>
                        <small>{party.role}</small>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {coverage.map((row) => (
                    <tr key={row.head}>
                      <th scope="row">{row.head}</th>
                      {parties.map((party) => {
                        const value = row.cells[party.id];
                        const active =
                          cell?.head === row.head && cell?.party === party.id;
                        return (
                          <td key={party.id}>
                            {value.position === "na" ? (
                              <span className="ip-cell ip-cell-na">—</span>
                            ) : (
                              <button
                                className={`ip-cell ip-cell-${value.position}${active ? " active" : ""}`}
                                onClick={() => setCell({ head: row.head, party: party.id })}
                                type="button"
                              >
                                {positionLabel[value.position]}
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="ip-rail">
            {selected ? (
              <section className="ip-rail-card">
                <div className="ip-rail-head">
                  <span className={`ip-cell ip-cell-${selected.position}`}>
                    {positionLabel[selected.position]}
                  </span>
                  <button
                    className="matter-text-button"
                    onClick={() => setCell(null)}
                    type="button"
                  >
                    Close
                  </button>
                </div>
                <strong>
                  {selected.head} · {selected.party}
                </strong>
                <p>{selected.note}</p>
              </section>
            ) : (
              <section className="ip-rail-card">
                <strong>{gaps.length} gaps</strong>
                <ul className="ip-gap-list">
                  {gaps.map((gap) => (
                    <li key={`${gap.head}-${gap.party}`}>
                      <button
                        onClick={() =>
                          setCell({
                            head: gap.head,
                            party:
                              parties.find((party) => party.name === gap.party)?.id ?? "",
                          })
                        }
                        type="button"
                      >
                        <span>{gap.head}</span>
                        <small>{gap.party}</small>
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="ip-rail-note">
                  Gaps are heads the schematic does not reach. They remain the group&rsquo;s
                  to establish.
                </p>
              </section>
            )}
          </aside>
        </div>
      )}

      {panel === "triggers" && (
        <section className="matter-tab-panel">
          <ol className="ip-timeline">
            {triggers.map((trigger) => (
              <li key={trigger.id}>
                <div className="ip-event">
                  <strong>{trigger.event}</strong>
                  <small>{trigger.when}</small>
                </div>
                <ul className="ip-consequences">
                  {trigger.consequences.map((consequence) => (
                    <li key={consequence.obligation}>
                      <span className={`ip-clock ip-clock-${consequence.scale}`}>
                        {consequence.clock}
                      </span>
                      <span className="ip-obligation">{consequence.obligation}</span>
                      <span className="ip-party">{consequence.party}</span>
                      <span className={`response-state${consequence.status === "done" ? " accepted" : ""}`}>
                        {consequence.status === "done"
                          ? "Met"
                          : consequence.status === "owned"
                            ? "Owned"
                            : "Unowned"}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </section>
      )}

      {panel === "routes" && (
        <section className="matter-tab-panel">
          <p className="ip-rule">
            One £60,000 allowance across both share classes, applied to MIP shares first.
            An allocation change moves a participant between routes.
          </p>
          <div className="ip-routes">
            {routes.map((route) => (
              <article key={route.n}>
                <div className="ip-route-head">
                  <span className="ip-route-n">{route.n}</span>
                  <div>
                    <strong>{route.name}</strong>
                    <small>{route.band}</small>
                  </div>
                </div>
                <dl>
                  <div>
                    <dt>Delivery</dt>
                    <dd>{route.delivery}</dd>
                  </div>
                  <div>
                    <dt>Price</dt>
                    <dd>{route.price}</dd>
                  </div>
                  <div>
                    <dt>Stamp duty</dt>
                    <dd>{route.stamp}</dd>
                  </div>
                </dl>
                <p className="ip-figure">{route.figure}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {panel === "lands" && (
        <section className="matter-tab-panel">
          {destinations.map((group) => (
            <div className="ip-period" key={group.period}>
              <h2>{group.period}</h2>
              <div className="ip-destinations">
                {group.items.map((item) => (
                  <div key={item.what}>
                    <strong>{item.what}</strong>
                    <span className="ip-where">{item.where}</span>
                    <small>{item.state}</small>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <p className="ip-rail-note">
            Destinations feed the period pack. The product records where a decision lands;
            it does not compute the figure.
          </p>
        </section>
      )}

      <p className="ip-boundary">
        Illustrative worked example built from a delivery-structure schematic. Figures are
        indicative. Not tax advice, and no treatment is concluded.
      </p>
    </div>
  );
}
