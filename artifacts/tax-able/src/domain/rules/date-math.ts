import type { DatePeriod, ISODate, ISOInstant } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function parts(value: ISODate): { year: number; month: number; day: number } {
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) {
    throw new RangeError(`Expected an ISO date (YYYY-MM-DD), received: ${value}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new RangeError(`Invalid calendar date: ${value}`);
  }

  return { year, month, day };
}

function fromUtc(date: Date): ISODate {
  return date.toISOString().slice(0, 10);
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function assertPeriod(period: DatePeriod): void {
  parts(period.start);
  parts(period.end);
  if (compareDates(period.start, period.end) > 0) {
    throw new RangeError(`Period start ${period.start} is after period end ${period.end}`);
  }
}

export function compareDates(left: ISODate, right: ISODate): number {
  parts(left);
  parts(right);
  return left.localeCompare(right);
}

export function isOnOrAfter(value: ISODate, boundary: ISODate): boolean {
  return compareDates(value, boundary) >= 0;
}

export function isOnOrBefore(value: ISODate, boundary: ISODate): boolean {
  return compareDates(value, boundary) <= 0;
}

export function addDays(value: ISODate, days: number): ISODate {
  const { year, month, day } = parts(value);
  return fromUtc(new Date(Date.UTC(year, month - 1, day + days)));
}

/**
 * Adds calendar months using the HMRC-style convention used by the rules in
 * this package: a month-end remains month-end; other dates retain their day
 * where possible and clamp only when that day does not exist.
 */
export function addCalendarMonths(value: ISODate, months: number): ISODate {
  const source = parts(value);
  const sourceLastDay = lastDayOfMonth(source.year, source.month);
  const targetFirst = new Date(Date.UTC(source.year, source.month - 1 + months, 1));
  const targetYear = targetFirst.getUTCFullYear();
  const targetMonth = targetFirst.getUTCMonth() + 1;
  const targetLastDay = lastDayOfMonth(targetYear, targetMonth);
  const targetDay = source.day === sourceLastDay ? targetLastDay : Math.min(source.day, targetLastDay);

  return fromUtc(new Date(Date.UTC(targetYear, targetMonth - 1, targetDay)));
}

export function latestDate(...values: Array<ISODate | undefined>): ISODate {
  const present = values.filter((value): value is ISODate => value !== undefined);
  if (present.length === 0) {
    throw new RangeError("latestDate requires at least one date");
  }
  present.forEach(parts);
  return present.reduce((latest, value) => (compareDates(value, latest) > 0 ? value : latest));
}

export function inclusiveDayCount(period: DatePeriod): number {
  assertPeriod(period);
  const start = Date.parse(`${period.start}T00:00:00.000Z`);
  const end = Date.parse(`${period.end}T00:00:00.000Z`);
  return Math.round((end - start) / DAY_MS) + 1;
}

/** Returns an exact whole-calendar-month period length, or null if irregular. */
export function exactPeriodMonths(period: DatePeriod, maximum = 60): number | null {
  assertPeriod(period);
  for (let months = 1; months <= maximum; months += 1) {
    if (addDays(addCalendarMonths(period.start, months), -1) === period.end) {
      return months;
    }
  }
  return null;
}

export function assertInstant(value: ISOInstant): number {
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) {
    throw new RangeError(`Expected an ISO date-time, received: ${value}`);
  }
  return milliseconds;
}
