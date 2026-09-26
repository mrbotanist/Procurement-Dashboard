// Business dates (due dates, ETAs, order dates) are date-only values.
// Inside the app they travel as ISO strings "YYYY-MM-DD" so no timezone can shift them.

export type IsoDate = string;

const DAY_MS = 86_400_000;

/** Today's date in the business timezone (Asia/Dubai by default). */
export function todayIso(timeZone = process.env.APP_TIMEZONE || "Asia/Dubai"): IsoDate {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

/** Prisma returns @db.Date columns as UTC midnight. */
export function toIsoDate(d: Date): IsoDate;
export function toIsoDate(d: Date | null | undefined): IsoDate | null;
export function toIsoDate(d: Date | null | undefined): IsoDate | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

/** For writing @db.Date columns. */
export function fromIsoDate(s: IsoDate): Date {
  return new Date(s + "T00:00:00.000Z");
}

export function addDays(s: IsoDate, n: number): IsoDate {
  return toIsoDate(new Date(fromIsoDate(s).getTime() + n * DAY_MS));
}

/** Whole days from a to b (positive when b is later). */
export function daysBetween(a: IsoDate, b: IsoDate): number {
  return Math.round((fromIsoDate(b).getTime() - fromIsoDate(a).getTime()) / DAY_MS);
}
