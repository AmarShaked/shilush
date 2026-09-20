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

/** Convert one raw Sefaria string into a segment, keeping any marked emphasis. */
function toSegment(raw: string): Segment {
  const parts = cleanParts(raw);
  const he = parts.map((p) => p.text).join("");
  return parts.some((p) => p.bold) ? { he, parts } : { he };
}

interface V3Response {
  versions?: { text?: unknown }[];
  /** The ref spelled the way Sefaria titles it, whatever alias was asked for. */
  ref?: string;
  heRef?: string;
  error?: string;
}

async function getV3(ref: string, version: "source" | "default"): Promise<V3Response | null> {
  const url =
    `${SEFARIA}/v3/texts/${encodeURIComponent(ref)}` +
    (version === "source" ? "?version=source" : "");
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return (await res.json()) as V3Response;
  } catch {
    return null;
  }
}

/**
 * Raw (still nested, still marked-up) text for a ref. `version` "source" asks
 * for the original-language version and falls back to the default one when the
 * source turns out to be empty.
 */
async function fetchRaw(
  ref: string,
  version: "source" | "default" = "source"
): Promise<{ text: unknown; ref: string | null; heRef: string | null }> {
  const data = await getV3(ref, version);
  if (!data) return { text: null, ref: null, heRef: null };

  const text = data.versions?.[0]?.text;
  if ((!text || (Array.isArray(text) && text.length === 0)) && version === "source") {
    return fetchRaw(ref, "default");
  }
  return { text, ref: data.ref ?? null, heRef: data.heRef ?? null };
}

/**
 * Fetch a text reference from Sefaria and return cleaned Hebrew segments.
 * Empty segments are dropped unless `keepEmpty` is set — studies that number
 * their segments (Rambam halachot) need the original indexing to survive.
 * Returns an empty array if the ref is missing/unavailable (caller degrades gracefully).
 */
export async function fetchSegments(
  ref: string,
  { keepEmpty = false }: { keepEmpty?: boolean } = {}
): Promise<{ segments: Segment[]; ref: string | null; heRef: string | null }> {
  const { text, ref: canonical, heRef } = await fetchRaw(ref);
  const segments = flatten(text).map(toSegment);
  return {
    segments: keepEmpty ? segments : segments.filter((s) => s.he.length > 0),
    ref: canonical,
    heRef,
  };
}

/**
 * Fetch commentary as notes aligned by index to the base text.
 *
 * Both shapes Sefaria returns are nested, so the caller says which one to
 * expect. `grouped` (the Mishneh Torah) means one entry per base segment,
 * holding the glosses on that halacha's phrases — kept apart so each reads as
 * its own line, and left empty where the commentary says nothing, so the
 * halachot after it still line up. Otherwise (the Talmud, nested by amud) the
 * whole thing flattens to one note per segment.
 *
 * The commentary may simply stop short of the base; the caller pads the tail.
 */
export async function fetchCommentary(
  ref: string,
  { grouped = false }: { grouped?: boolean } = {}
): Promise<Segment[]> {
  const { text } = await fetchRaw(ref);
  if (!Array.isArray(text)) return [];

  if (!grouped) {
    return flatten(text)
      .map(toSegment)
      .filter((s) => s.he.length > 0);
  }

  return text.map((group) => {
    const glosses = flatten(group)
      .map(toSegment)
      .filter((g) => g.he.length > 0);
    if (glosses.length === 0) return { he: "" };
    if (glosses.length === 1) return glosses[0];
    return { he: glosses.map((g) => g.he).join(" "), glosses };
  });
}

interface V3Structured extends V3Response {
  sections?: (string | number)[];
  heTitle?: string;
}

/** One chapter of Tanakh text: chapter number, first verse number, and verses. */
export interface ChapterBlock {
  chapterNum: number | null;
  startVerse: number;
  verses: Segment[];
}

/**
 * Fetch a Tanakh reference structured by chapter, preserving verse numbering.
 * A single-chapter ref returns one block; a multi-chapter range returns one
 * block per chapter (with the correct starting verse for each).
 */
export async function fetchTanakh(
  ref: string
): Promise<{
  heTitle: string | null;
  ref: string | null;
  heRef: string | null;
  blocks: ChapterBlock[];
}> {
  const empty = { heTitle: null, ref: null, heRef: null, blocks: [] };
  const data = (await getV3(ref, "source")) as V3Structured | null;
  if (!data) return empty;

  const text = data.versions?.[0]?.text;
  const sections = (data.sections ?? []).map((s) => Number(s));
  const blocks: ChapterBlock[] = [];

  if (Array.isArray(text) && text.length > 0) {
    if (typeof text[0] === "string") {
      // Single chapter: flat verse array.
      blocks.push({
        chapterNum: Number.isFinite(sections[0]) ? sections[0] : null,
        startVerse: sections.length >= 2 ? sections[1] : 1,
        verses: (text as string[]).map(toSegment),
      });
    } else {
      // Multi-chapter range: one sub-array per (consecutive) chapter.
      const startChap = Number.isFinite(sections[0]) ? sections[0] : null;
      const startVerse0 = sections.length >= 2 ? sections[1] : 1;
      (text as unknown[]).forEach((sub, j) => {
        const verses = Array.isArray(sub) ? (sub as string[]).map(toSegment) : [];
        blocks.push({
          chapterNum: startChap != null ? startChap + j : null,
          startVerse: j === 0 ? startVerse0 : 1,
          verses,
        });
      });
    }
  }

  return {
    heTitle: data.heTitle ?? null,
    ref: data.ref ?? null,
    heRef: data.heRef ?? null,
    blocks,
  };
}
