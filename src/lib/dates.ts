// Date helpers. Uses local device time; the "day" boundary is the device's date.

/** Format a Date as YYYY-MM-DD in local time. */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse a YYYY-MM-DD string into a local Date (noon, to avoid DST edges). */
export function fromISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

/** Today's date as YYYY-MM-DD in local time. */
export function todayISO(): string {
  return toISODate(new Date());
}

/** Shift an ISO date by n days, returning a new ISO date. */
export function addDays(iso: string, n: number): string {
  const d = fromISODate(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

/** Difference in whole days between two ISO dates (a - b). */
export function diffDays(a: string, b: string): number {
  const ms = fromISODate(a).getTime() - fromISODate(b).getTime();
  return Math.round(ms / 86400000);
}

const HE_WEEKDAY = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

/** "יום שלישי" for the given ISO date. */
export function hebrewWeekday(iso: string): string {
  return "יום " + HE_WEEKDAY[fromISODate(iso).getDay()];
}

const HE_ONES = ["", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט"];
const HE_TENS = ["", "י", "כ", "ל", "מ", "נ", "ס", "ע", "פ", "צ"];
const HE_HUND = ["", "ק", "ר", "ש", "ת", "תק", "תר", "תש", "תת", "תתק"];

/**
 * Convert a number to a Hebrew gematria numeral, e.g. 22 -> "כ״ב", 786 -> "תשפ״ו".
 * Pass punctuate=false for bare letters like verse numbers, e.g. 26 -> "כו".
 */
export function hebrewNumeral(num: number, punctuate = true): string {
  const n = num % 1000;
  let s = HE_HUND[Math.floor(n / 100)];
  const rest = n % 100;
  if (rest === 15) s += "טו";
  else if (rest === 16) s += "טז";
  else s += HE_TENS[Math.floor(rest / 10)] + HE_ONES[rest % 10];
  if (s.length === 0) return String(num);
  if (!punctuate) return s;
  if (s.length === 1) return s + "׳"; // geresh
  return s.slice(0, -1) + "״" + s.slice(-1); // gershayim before last letter
}

// Formats a Hebrew-calendar date, swapping Intl's Latin day/year for gematria.
function formatHebrew(iso: string, opts: Intl.DateTimeFormatOptions): string {
  try {
    const parts = new Intl.DateTimeFormat("he-u-ca-hebrew", opts).formatToParts(
      fromISODate(iso)
    );
    return parts
      .map((p) =>
        p.type === "day"
          ? hebrewNumeral(Number(p.value))
          : p.type === "year"
            ? hebrewNumeral(Number(p.value) % 1000)
            : p.value
      )
      .join("");
  } catch {
    return "";
  }
}

/** Hebrew calendar date, e.g. "כ״ב באב תשפ״ו". */
export function hebrewDate(iso: string): string {
  return formatHebrew(iso, { day: "numeric", month: "long", year: "numeric" });
}

/** Gregorian month + year label, e.g. "August 2026". */
export function gregorianMonthLabel(iso: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
  }).format(fromISODate(iso));
}

/** Hebrew month + year label for a date, e.g. "אב תשפ״ו". */
export function hebrewMonthLabel(iso: string): string {
  return formatHebrew(iso, { month: "long", year: "numeric" });
}
