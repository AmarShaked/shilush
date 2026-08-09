// Data access to the Sefaria public API (text only — the schedule is local).
// Runs server-side (from route handlers) to avoid CORS and centralize parsing.

import type { Segment, TextPart } from "./types";

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

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;|&thinsp;|&ensp;|&emsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

/** Drop footnote markup, which is noise in every version. */
function stripNotes(s: string): string {
  return s
    .replace(/<sup[\s\S]*?<\/sup>/gi, "")
    .replace(/<i\s+class="footnote"[\s\S]*?<\/i>/gi, "");
}

/**
 * Like clean(), but preserves <b> emphasis as structured parts. Steinsaltz marks
 * the quoted scripture words in bold and leaves its own elucidation in regular
 * weight (as on Sefaria), so that distinction has to survive into the reader.
 * Returns parts rather than an HTML string so nothing is injected into the DOM.
 */
function cleanParts(s: string): TextPart[] {
  const src = stripNotes(s);
  const parts: TextPart[] = [];
  const re = /<\s*(b|strong)\s*>([\s\S]*?)<\s*\/\s*\1\s*>/gi;
  let last = 0;
  let m: RegExpExecArray | null;

  const push = (raw: string, bold: boolean) => {
    const text = decodeEntities(raw.replace(/<[^>]+>/g, "")).replace(/[ \t]+/g, " ");
    if (text) parts.push({ text, bold });
  };

  while ((m = re.exec(src)) !== null) {
    push(src.slice(last, m.index), false);
    push(m[2], true);
    last = m.index + m[0].length;
  }
  push(src.slice(last), false);

  if (parts.length > 0) {
    parts[0].text = parts[0].text.replace(/^\s+/, "");
    parts[parts.length - 1].text = parts[parts.length - 1].text.replace(/\s+$/, "");
  }
  return parts.filter((p) => p.text.length > 0);
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
    .map((raw) => {
      const parts = cleanParts(raw);
      const he = parts.map((p) => p.text).join("");
      // Only carry parts when the source actually marks emphasis.
      return parts.some((p) => p.bold) ? { he, parts } : { he };
    })
    .filter((s) => s.he.length > 0);

  return { segments, heRef: data.heRef ?? null };
}

interface V3Structured extends V3Response {
  sections?: (string | number)[];
  heTitle?: string;
}

/** One verse: plain text plus emphasis-aware parts when the source marks bold. */
export interface VerseText {
  he: string;
  parts?: TextPart[];
}

/** One chapter of Tanakh text: chapter number, first verse number, and verses. */
export interface ChapterBlock {
  chapterNum: number | null;
  startVerse: number;
  verses: VerseText[];
}

/** Convert a raw Sefaria verse string into text + optional emphasis parts. */
function toVerse(raw: string): VerseText {
  const parts = cleanParts(raw);
  const he = parts.map((p) => p.text).join("");
  return parts.some((p) => p.bold) ? { he, parts } : { he };
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
        verses: (text as string[]).map(toVerse),
      });
    } else {
      // Multi-chapter range: one sub-array per (consecutive) chapter.
      const startChap = Number.isFinite(sections[0]) ? sections[0] : null;
      const startVerse0 = sections.length >= 2 ? sections[1] : 1;
      (text as unknown[]).forEach((sub, j) => {
        const verses = Array.isArray(sub) ? (sub as string[]).map(toVerse) : [];
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
