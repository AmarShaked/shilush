// Nach Yomi schedule via the Hebcal JSON API.
// Sefaria's calendar API does not publish Nach Yomi, so we resolve the daily
// chapters from Hebcal (whose titles double as Sefaria refs, e.g. "Isaiah 28")
// and fetch the chapter text itself from Sefaria.

import { addDays, diffDays } from "./dates";

const HEBCAL = "https://www.hebcal.com/hebcal";

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
