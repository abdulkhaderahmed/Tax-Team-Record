import Link from "next/link";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { MONTH_NAMES } from "@/lib/obligations";
import { REGIMES, STATUS_VALUES } from "../_constants";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function dateKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function buildCalendarGrid(year: number, month: number): Date[][] {
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const dayOfWeek = firstOfMonth.getUTCDay(); // 0=Sun … 6=Sat
  const offset = (dayOfWeek + 6) % 7;        // Mon=0 … Sun=6

  const current = new Date(firstOfMonth);
  current.setUTCDate(current.getUTCDate() - offset);

  const weeks: Date[][] = [];
  while (weeks.length < 6) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(current));
      current.setUTCDate(current.getUTCDate() + 1);
    }
    weeks.push(week);
    // Stop once we've fully passed the month (min 4 rows)
    if (weeks.length >= 4 && current.getUTCMonth() + 1 !== month) break;
  }
  return weeks;
}

function calEventClass(status: string): string {
  if (status === "In progress")      return "cal-event cal-event-ip";
  if (status === "Blocked")          return "cal-event cal-event-blocked";
  if (status === "Ready for review") return "cal-event cal-event-rfr";
  if (status === "Approved")         return "cal-event cal-event-approved";
  if (status === "Complete")         return "cal-event cal-event-complete";
  if (status === "Not applicable")   return "cal-event cal-event-na";
  return "cal-event cal-event-ns";
}

export default async function ObligationsCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{
    year?: string;
    month?: string;
    entity?: string;
    regime?: string;
    status?: string;
  }>;
}) {
  const sp = await searchParams;

  const nowUtc = new Date();
  const year  = parseInt(sp.year  ?? String(nowUtc.getUTCFullYear()),     10);
  const month = parseInt(sp.month ?? String(nowUtc.getUTCMonth() + 1),    10);

  const monthName = MONTH_NAMES[month - 1];

  // Prev / next month (with filters preserved)
  const filterParams = new URLSearchParams();
  if (sp.entity) filterParams.set("entity", sp.entity);
  if (sp.regime) filterParams.set("regime", sp.regime);
  if (sp.status) filterParams.set("status", sp.status);

  const prevMonth = month === 1  ? 12 : month - 1;
  const prevYear  = month === 1  ? year - 1 : year;
  const nextMonth = month === 12 ? 1  : month + 1;
  const nextYear  = month === 12 ? year + 1 : year;

  const makeMonthParams = (y: number, m: number) => {
    const p = new URLSearchParams(filterParams);
    p.set("year", String(y));
    p.set("month", String(m));
    return p.toString();
  };

  const todayKey = dateKey(nowUtc);

  // Calendar grid
  const grid = buildCalendarGrid(year, month);
  const startOfGrid = grid[0][0];
  const endOfGrid   = new Date(grid[grid.length - 1][6]);
  endOfGrid.setUTCDate(endOfGrid.getUTCDate() + 1);

  // Data
  const org = await prisma.organisation.findFirst();
  const entities = org
    ? await prisma.entity.findMany({
        where: { organisationId: org.id },
        orderBy: { legalName: "asc" },
        select: { id: true, legalName: true },
      })
    : [];

  const conditions: Prisma.ManualObligationWhereInput[] = [
    { organisationId: org?.id ?? "" },
    { archivedAt: null },
    { filingDeadline: { gte: startOfGrid, lt: endOfGrid } },
  ];
  if (sp.entity) conditions.push({ entityId: sp.entity });
  if (sp.regime) conditions.push({ regime: sp.regime });
  if (sp.status) conditions.push({ overallWorkflowStatus: sp.status });

  const obligations = await prisma.manualObligation.findMany({
    where: { AND: conditions },
    include: { entity: { select: { id: true, legalName: true } } },
    orderBy: { filingDeadline: "asc" },
  });

  // Group by UTC date key
  const byDate = new Map<string, typeof obligations>();
  for (const ob of obligations) {
    if (!ob.filingDeadline) continue;
    const k = dateKey(ob.filingDeadline);
    if (!byDate.has(k)) byDate.set(k, []);
    byDate.get(k)!.push(ob);
  }

  const hasFilters = !!(sp.entity || sp.regime || sp.status);
  const MAX_VISIBLE = 3;

  return (
    <>
      {/* Page header */}
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href="/">Dashboard</Link> /{" "}
            <Link href="/obligations">Obligation Register</Link> / Calendar
          </div>
          <h1>{monthName} {year}</h1>
        </div>

        {/* Month navigation */}
        <div className="flex gap8" style={{ alignItems: "center" }}>
          <Link
            href={`/obligations/calendar?${makeMonthParams(prevYear, prevMonth)}`}
            className="btn btn-secondary"
          >
            ← {MONTH_NAMES[prevMonth - 1]}
          </Link>
          <Link
            href={`/obligations/calendar?${makeMonthParams(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth() + 1)}`}
            className="btn btn-secondary btn-sm"
            style={{ whiteSpace: "nowrap" }}
          >
            Today
          </Link>
          <Link
            href={`/obligations/calendar?${makeMonthParams(nextYear, nextMonth)}`}
            className="btn btn-secondary"
          >
            {MONTH_NAMES[nextMonth - 1]} →
          </Link>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="tab-bar">
        <Link href="/obligations" className="tab">List</Link>
        <Link href={`/obligations/calendar?${filterParams}`} className="tab tab-active">Calendar</Link>
      </div>

      {/* Filter bar */}
      <div className="panel" style={{ padding: "12px 20px", marginBottom: 16 }}>
        <form method="GET" action="/obligations/calendar">
          <input type="hidden" name="year"  value={year} />
          <input type="hidden" name="month" value={month} />

          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 16px", alignItems: "flex-end" }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--ink-secondary)", marginBottom: 3 }}>
                Entity
              </label>
              <select name="entity" defaultValue={sp.entity ?? ""} style={{ fontSize: 12, padding: "5px 8px" }}>
                <option value="">All entities</option>
                {entities.map((e) => (
                  <option key={e.id} value={e.id}>{e.legalName}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--ink-secondary)", marginBottom: 3 }}>
                Regime
              </label>
              <select name="regime" defaultValue={sp.regime ?? ""} style={{ fontSize: 12, padding: "5px 8px" }}>
                <option value="">All regimes</option>
                {REGIMES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--ink-secondary)", marginBottom: 3 }}>
                Overall status
              </label>
              <select name="status" defaultValue={sp.status ?? ""} style={{ fontSize: 12, padding: "5px 8px" }}>
                <option value="">Any status</option>
                {STATUS_VALUES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="flex gap8">
              <button type="submit" className="btn btn-primary btn-sm">Apply</button>
              {hasFilters && (
                <a
                  href={`/obligations/calendar?year=${year}&month=${month}`}
                  className="btn btn-secondary btn-sm"
                >
                  Clear
                </a>
              )}
            </div>
          </div>
        </form>
      </div>

      {/* Calendar grid */}
      <div className="cal-wrapper">
        {/* Weekday headers */}
        <div className="cal-grid">
          {WEEKDAYS.map((d) => (
            <div key={d} className="cal-weekday">{d}</div>
          ))}

          {/* Day cells */}
          {grid.map((week, wi) =>
            week.map((day, di) => {
              const key = dateKey(day);
              const isCurrentMonth = day.getUTCMonth() + 1 === month;
              const isToday = key === todayKey;
              const dayObs = byDate.get(key) ?? [];
              const extra = dayObs.length - MAX_VISIBLE;

              return (
                <div
                  key={`${wi}-${di}`}
                  className={`cal-cell${!isCurrentMonth ? " cal-cell-other" : ""}`}
                >
                  <div
                    className="cal-day-num"
                    style={{
                      background: isToday ? "var(--brand)" : undefined,
                      color: isToday ? "#fff" : !isCurrentMonth ? "var(--border-strong)" : "var(--ink-secondary)",
                    }}
                  >
                    {day.getUTCDate()}
                  </div>

                  {dayObs.slice(0, MAX_VISIBLE).map((ob) => (
                    <Link
                      key={ob.id}
                      href={`/obligations/${ob.id}`}
                      className={calEventClass(ob.overallWorkflowStatus)}
                      title={`${ob.description} — ${ob.overallWorkflowStatus}`}
                    >
                      {ob.entity?.legalName ? `${ob.entity.legalName} · ` : ""}
                      {ob.obligationType}
                    </Link>
                  ))}

                  {extra > 0 && (
                    <div className="cal-more">+{extra} more</div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap12" style={{ marginTop: 12, flexWrap: "wrap" }}>
        {[
          { cls: "cal-event-ns",       label: "Not started" },
          { cls: "cal-event-ip",       label: "In progress" },
          { cls: "cal-event-blocked",  label: "Blocked" },
          { cls: "cal-event-rfr",      label: "Ready for review" },
          { cls: "cal-event-approved", label: "Approved" },
          { cls: "cal-event-complete", label: "Complete" },
          { cls: "cal-event-na",       label: "Not applicable" },
        ].map(({ cls, label }) => (
          <div key={label} className="flex" style={{ alignItems: "center", gap: 5 }}>
            <span
              className={cls}
              style={{
                display: "inline-block",
                width: 14,
                height: 14,
                borderRadius: 3,
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 11, color: "var(--ink-secondary)" }}>{label}</span>
          </div>
        ))}
      </div>
    </>
  );
}
