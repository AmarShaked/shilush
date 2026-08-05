// Nach Yomi schedule via the Hebcal JSON API.
// Sefaria's calendar API does not publish Nach Yomi, so we resolve the daily
// chapters from Hebcal (whose titles double as Sefaria refs, e.g. "Isaiah 28")
// and fetch the chapter text itself from Sefaria.

import { addDays, diffDays, fromISODate } from "./dates";

const HEBCAL = "https://www.hebcal.com/hebcal";

// Shnayim Mikra: the parasha is split into its 7 aliyot, one learned per day
// (Sunday = 1st aliyah … Shabbat = 7th).
const ALIYAH_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שביעי"];

// This user's Nach program: 2 chapters/day, started 2026-05-22 at Joshua 1–2.
const NACH_START = "2026-05-22";
const NACH_PER_DAY = 2;

// Hebcal's OU Nach Yomi cycle advances one chapter/day and anchors at
// 2026-02-12 = Joshua 1 (linear chapter index 0). Verified: 2026-08-05 -> Isaiah 28.
// We use it purely as an ordered chapter enumerator: linear index L is the Nach
// chapter on Hebcal date (anchor + L days).
const HEBCAL_ANCHOR = "2026-02-12";

interface HebcalItem {
  title?: string;
  hebrew?: string;
  category?: string;
  date?: string;
  leyning?: Record<string, string>;
}
interface HebcalResponse {
  items?: HebcalItem[];
}

async function fetchNachRange(
  start: string,
  end: string
): Promise<{ ref: string; heRef: string | null }[]> {
  const url = `${HEBCAL}?v=1&cfg=json&nyomi=on&start=${start}&end=${end}`;
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as HebcalResponse;
    return (data.items ?? [])
      .filter((i) => i.category === "nachyomi" && i.title)
      .map((i) => ({ ref: i.title!, heRef: i.hebrew ?? null }));
  } catch {
    return [];
  }
}

/** Resolve the (2) Nach Yomi chapters for an ISO date, per this user's schedule. */
export async function fetchNachChapters(
  iso: string
): Promise<{ ref: string; heRef: string | null }[]> {
  const dayIndex = diffDays(iso, NACH_START);
  if (dayIndex < 0) return []; // before the cycle started
  const linearStart = dayIndex * NACH_PER_DAY;
  const start = addDays(HEBCAL_ANCHOR, linearStart);
  const end = addDays(start, NACH_PER_DAY - 1);
  return fetchNachRange(start, end);
}

/**
 * Resolve the daily Shnayim Mikra portion: the aliyah of the week's parasha for
 * the current weekday (Sunday = 1st … Shabbat = 7th). Returns the Sefaria ref
 * for that aliyah plus a Hebrew label like "ראה · רביעי".
 */
export async function fetchDailyAliyah(
  iso: string
): Promise<{ ref: string; heRef: string | null } | null> {
  const weekday = fromISODate(iso).getDay(); // 0 = Sunday … 6 = Shabbat
  const shabbat = addDays(iso, 6 - weekday); // the week's Torah-reading Shabbat
  const url = `${HEBCAL}?v=1&cfg=json&s=on&i=on&leyning=on&start=${shabbat}&end=${shabbat}`;
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as HebcalResponse;
    const item = data.items?.find((i) => i.category === "parashat" && i.leyning);
    const ref = item?.leyning?.[String(weekday + 1)];
    if (!ref) return null;
    const parasha = (item!.hebrew ?? "").replace(/^פרשת\s*/, "");
    const heRef = parasha ? `${parasha} · ${ALIYAH_NAMES[weekday]}` : ALIYAH_NAMES[weekday];
    return { ref, heRef };
  } catch {
    return null;
  }
}
