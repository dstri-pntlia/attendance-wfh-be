import { DateTime, IANAZone } from 'luxon';

export const WORK_START_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_ONLY_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

export function daysBetween(from: string, to: string): number {
  const ms =
    Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`);
  return ms / 86_400_000;
}

export function isValidTimeZone(timeZone: string): boolean {
  return IANAZone.isValidZone(timeZone);
}

function toZoned(instant: Date, timeZone: string): DateTime {
  const local = DateTime.fromJSDate(instant, { zone: timeZone });
  if (!local.isValid) {
    throw new Error(
      `Cannot convert instant to time zone "${timeZone}": ${local.invalidReason}`,
    );
  }
  return local;
}

export function toWorkDate(instant: Date, timeZone: string): string {
  return toZoned(instant, timeZone).toFormat('yyyy-MM-dd');
}

export function isLate(
  instant: Date,
  timeZone: string,
  workStartTime: string,
): boolean {
  if (!WORK_START_TIME_PATTERN.test(workStartTime)) {
    throw new Error(
      `Invalid work start time "${workStartTime}"; expected HH:mm`,
    );
  }
  const [hour, minute] = workStartTime.split(':').map(Number);
  const local = toZoned(instant, timeZone);
  const start = local.set({ hour, minute, second: 0, millisecond: 0 });
  return local.toMillis() > start.toMillis();
}
