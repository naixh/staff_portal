/**
 * The official Maldivian Rufiyaa sign is U+20C2 (Unicode 18.0). It has almost
 * no font coverage yet, so the UI draws the glyph as vector art instead of text
 * (see `src/components/money.tsx`). This constant is kept as the canonical
 * codepoint for reference / future use once fonts catch up.
 */
export const CURRENCY_SYMBOL = "\u20C2";

// `en-MV` gives Western digit grouping (1,234,567), matching MVR conventions.
const numberFormat = new Intl.NumberFormat("en-MV", {
  maximumFractionDigits: 0,
});

/** Format a number with MVR digit grouping (no currency sign). */
export function formatAmount(n: number): string {
  return numberFormat.format(n);
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

/** Parse an "HH:MM" (24h) or "h:MM AM/PM" time into minutes since midnight. */
export function timeToMinutes(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?:\s*([AaPp][Mm]))?$/);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();
  if (meridiem === "PM" && hours < 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

/** Minutes between two times, or null if either is missing/invalid. */
export function minutesBetween(
  start: string | null | undefined,
  end: string | null | undefined,
): number | null {
  const from = timeToMinutes(start);
  const to = timeToMinutes(end);
  if (from === null || to === null) return null;
  return Math.max(0, to - from);
}

/** Format a duration in minutes, e.g. 405 -> "6h 45m". */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || minutes <= 0) return "—";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0 ? `${hours}h ${String(rest).padStart(2, "0")}m` : `${rest}m`;
}
