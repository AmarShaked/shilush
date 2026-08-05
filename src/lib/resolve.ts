// Resolves studies for a date into references and full text.
// Schedule (which daf / chapters / aliyah) is computed locally in hebcal.ts;
// only the text itself is fetched from Sefaria (sefaria.ts).

import { fetchSegments, fetchTanakh } from "./sefaria";
import { dafYomiRef, nachChapters, dailyAliyah } from "./hebcal";
import { STUDIES, getStudy } from "./studies";
import { hebrewNumeral } from "./dates";
import type {
  ExtraText,
  ResolvedDay,
  ResolvedStudy,
  StudyContent,
  StudyId,
  StudySection,
} from "./types";

type RefItem = { ref: string | null; heRef: string | null };

/** Per-study ordered list of references for a date (all computed locally). */
function resolveRefs(iso: string): Record<StudyId, RefItem[]> {
  const daf = dafYomiRef(iso);
  const aliyah = dailyAliyah(iso); // Shnayim Mikra: only today's aliyah of the parasha
  return {
    daf: daf.ref ? [daf] : [],
    nach: nachChapters(iso),
    shnayim: aliyah ? [aliyah] : [],
  };
}

/** Build a single Hebrew display label from one or more references. */
function combineHeRefs(list: RefItem[]): string | null {
  const hes = list.map((l) => l.heRef).filter(Boolean) as string[];
  if (hes.length === 0) return null;
  if (hes.length === 1) return hes[0];
  return `${hes[0]} – ${hes[hes.length - 1]}`;
}

function toResolvedStudy(id: StudyId, list: RefItem[]): ResolvedStudy {
  const meta = getStudy(id);
  return {
    id,
    name: meta?.name ?? id,
    color: meta?.color ?? "#a9772e",
    ref: list[0]?.ref ?? null,
    heRef: combineHeRefs(list),
  };
}

/** Resolve the studies (display refs) for an ISO date. */
export async function resolveDay(iso: string): Promise<ResolvedDay> {
  const refs = resolveRefs(iso);
  const studies = STUDIES.map((meta) => toResolvedStudy(meta.id, refs[meta.id]));
  return { date: iso, studies };
}

/** Build the Sefaria ref for a study's extra material (Steinsaltz / Targum). */
function extraRef(id: StudyId, baseRef: string): string | null {
  const meta = getStudy(id);
  if (!meta?.extra) return null;
  if (meta.extra === "steinsaltz") return `Steinsaltz on ${baseRef}`;
  if (meta.extra === "targum") return `Onkelos ${baseRef}`;
  return null;
}

const EXTRA_LABEL: Record<"steinsaltz" | "targum", string> = {
  steinsaltz: "ביאור שטיינזלץ",
  targum: "תרגום אונקלוס",
};

/** Talmud (unnumbered): a single flat section, extra aligned by segment index. */
async function buildFlatSections(
  id: StudyId,
  item: RefItem,
  wantExtra: boolean
): Promise<StudySection[]> {
  const meta = getStudy(id);
  const { segments, heRef } = await fetchSegments(item.ref!);

  let extra: ExtraText | undefined;
  if (wantExtra && meta?.extra) {
    const er = extraRef(id, item.ref!);
    if (er) {
      const r = await fetchSegments(er);
      if (r.segments.length > 0) {
        extra = { kind: meta.extra, label: EXTRA_LABEL[meta.extra], segments: r.segments };
      }
    }
  }

  return [{ ref: item.ref!, heRef: item.heRef ?? heRef, segments, extra }];
}

/** Tanakh (numbered): one section per chapter, verses numbered, extra aligned per verse. */
async function buildTanakhSections(
  id: StudyId,
  item: RefItem,
  wantExtra: boolean
): Promise<StudySection[]> {
  const meta = getStudy(id);
  const base = await fetchTanakh(item.ref!);

  // Fetch the aligned extra (Targum / Steinsaltz) with the same chapter structure.
  let extraBlocks: { verses: string[] }[] = [];
  if (wantExtra && meta?.extra) {
    const er = extraRef(id, item.ref!);
    if (er) extraBlocks = (await fetchTanakh(er)).blocks;
  }

  return base.blocks.map((block, bi) => {
    const heRef =
      block.chapterNum != null && base.heTitle
        ? `${base.heTitle} ${hebrewNumeral(block.chapterNum)}`
        : item.heRef;
    const segments = block.verses.map((he, vi) => ({ he, num: block.startVerse + vi }));

    let extra: ExtraText | undefined;
    const exVerses = extraBlocks[bi]?.verses;
    if (meta?.extra && exVerses && exVerses.length > 0) {
      extra = {
        kind: meta.extra,
        label: EXTRA_LABEL[meta.extra],
        segments: exVerses.map((he) => ({ he })),
      };
    }

    return { ref: item.ref!, heRef, segments, extra };
  });
}

/** Resolve one study for a date into full readable content (one or more sections). */
export async function resolveStudyContent(
  iso: string,
  id: StudyId,
  wantExtra: boolean
): Promise<StudyContent> {
  const refs = resolveRefs(iso);
  const list = refs[id] ?? [];
  const base = toResolvedStudy(id, list);
  const meta = getStudy(id);

  const withRef = list.filter((l) => l.ref);
  if (withRef.length === 0) return { ...base, sections: [] };

  const build = meta?.numbered ? buildTanakhSections : buildFlatSections;
  const nested = await Promise.all(withRef.map((item) => build(id, item, wantExtra)));
  return { ...base, sections: nested.flat() };
}
