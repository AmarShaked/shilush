// Data access to the Sefaria public API (text only — the schedule is local).
// Runs server-side (from route handlers) to avoid CORS and centralize parsing.

import type { Segment } from "./types";

const SEFARIA = "https://www.sefaria.org/api";

/** Recursively flatten Sefaria's (possibly nested) text arrays into flat strings. */
function flatten(text: unknown, out: string[] = []): string[] {
  if (typeof text === "string") {
    out.push(text);
  } else if (Array.isArray(text)) {
    for (const t of text) flatten(t, out);
  }
  return out;
}

/** Strip HTML tags/footnotes and decode a few entities to plain Hebrew text. */
function clean(s: string): string {
  return s
    .replace(/<sup[\s\S]*?<\/sup>/gi, "")
    .replace(/<i\s+class="footnote"[\s\S]*?<\/i>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;|&thinsp;|&ensp;|&emsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/[ \t]+/g, " ")
    .trim();
}

interface V3Response {
  versions?: { text?: unknown }[];
  heRef?: string;
  error?: string;
}

/**
 * Fetch a text reference from Sefaria v3 and return cleaned Hebrew segments.
 * `version` "source" requests the original-language (Hebrew/Aramaic) version.
 * Returns an empty array if the ref is missing/unavailable (caller degrades gracefully).
 */
export async function fetchSegments(
  ref: string,
  version: "source" | "default" = "source"
): Promise<{ segments: Segment[]; heRef: string | null }> {
  const url =
    `${SEFARIA}/v3/texts/${encodeURIComponent(ref)}` +
    (version === "source" ? "?version=source" : "");

  let data: V3Response;
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return { segments: [], heRef: null };
    data = (await res.json()) as V3Response;
  } catch {
    return { segments: [], heRef: null };
  }

  const text = data.versions?.[0]?.text;
  // If the source version was empty, retry without forcing a version.
  if ((!text || (Array.isArray(text) && text.length === 0)) && version === "source") {
    return fetchSegments(ref, "default");
  }

  const segments = flatten(text)
    .map(clean)
    .filter((s) => s.length > 0)
    .map((he) => ({ he }));

  return { segments, heRef: data.heRef ?? null };
}

interface V3Structured extends V3Response {
  sections?: (string | number)[];
  heTitle?: string;
}

/** One chapter of Tanakh text: chapter number, first verse number, and verse strings. */
export interface ChapterBlock {
  chapterNum: number | null;
  startVerse: number;
  verses: string[];
}

/**
 * Fetch a Tanakh reference structured by chapter, preserving verse numbering.
 * A single-chapter ref returns one block; a multi-chapter range returns one
 * block per chapter (with the correct starting verse for each).
 */
export async function fetchTanakh(
  ref: string
): Promise<{ heTitle: string | null; heRef: string | null; blocks: ChapterBlock[] }> {
  const url = `${SEFARIA}/v3/texts/${encodeURIComponent(ref)}?version=source`;
  let data: V3Structured;
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return { heTitle: null, heRef: null, blocks: [] };
    data = (await res.json()) as V3Structured;
  } catch {
    return { heTitle: null, heRef: null, blocks: [] };
  }

  const text = data.versions?.[0]?.text;
  const sections = (data.sections ?? []).map((s) => Number(s));
  const blocks: ChapterBlock[] = [];

  if (Array.isArray(text) && text.length > 0) {
    if (typeof text[0] === "string") {
      // Single chapter: flat verse array.
      blocks.push({
        chapterNum: Number.isFinite(sections[0]) ? sections[0] : null,
        startVerse: sections.length >= 2 ? sections[1] : 1,
        verses: (text as string[]).map(clean),
      });
    } else {
      // Multi-chapter range: one sub-array per (consecutive) chapter.
      const startChap = Number.isFinite(sections[0]) ? sections[0] : null;
      const startVerse0 = sections.length >= 2 ? sections[1] : 1;
      (text as unknown[]).forEach((sub, j) => {
        const verses = Array.isArray(sub) ? (sub as string[]).map(clean) : [];
        blocks.push({
          chapterNum: startChap != null ? startChap + j : null,
          startVerse: j === 0 ? startVerse0 : 1,
          verses,
        });
      });
    }
  }

  return { heTitle: data.heTitle ?? null, heRef: data.heRef ?? null, blocks };
}
