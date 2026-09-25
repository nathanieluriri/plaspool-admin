// A settable clock for the seed, so a customer journey written "30 days ago" is
// stamped 30 days ago by the app's own code. The server reads time through
// Date.now() only, so that is the one thing moved.

const realDateNow = Date.now.bind(Date);
let offset = 0;

export const DAY = 86_400_000;
export const HOUR = 3_600_000;
export const MINUTE = 60_000;

export function installClock(): void {
  Date.now = () => realDateNow() + offset;
}

export function uninstallClock(): void {
  offset = 0;
  Date.now = realDateNow;
}

export function realNow(): number {
  return realDateNow();
}

export function setNow(epochMs: number): void {
  offset = epochMs - realDateNow();
}

export function advance(ms: number): void {
  offset += ms;
}

/** A moment `days` before today, at a Lagos wall-clock time. */
export function daysAgo(days: number, hour = 11, minute = 0): number {
  const today = new Date(realDateNow() + HOUR);
  const utcMidnight = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return utcMidnight - days * DAY + (hour - 1) * HOUR + minute * MINUTE;
}
