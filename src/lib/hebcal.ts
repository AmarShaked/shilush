// Nach Yomi schedule via the Hebcal JSON API.
// Sefaria's calendar API does not publish Nach Yomi, so we resolve the daily
// chapter from Hebcal (which returns a title usable directly as a Sefaria ref,
// e.g. "Isaiah 28") and fetch the chapter text itself from Sefaria.

const HEBCAL = "https://www.hebcal.com/hebcal";

interface HebcalItem {
  title?: string;
  hebrew?: string;
  category?: string;
  date?: string;
}
interface HebcalResponse {
  items?: HebcalItem[];
}

/** Resolve the Nach Yomi reference for an ISO date. */
export async function fetchNachYomi(
  iso: string
): Promise<{ ref: string | null; heRef: string | null }> {
  const url = `${HEBCAL}?v=1&cfg=json&nyomi=on&start=${iso}&end=${iso}`;
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return { ref: null, heRef: null };
    const data = (await res.json()) as HebcalResponse;
    const item = data.items?.find((i) => i.category === "nachyomi");
    if (!item?.title) return { ref: null, heRef: null };
    return { ref: item.title, heRef: item.hebrew ?? null };
  } catch {
    return { ref: null, heRef: null };
  }
}
