// Resolves studies for a date into references and full text.
// Server-side: combines Sefaria (Daf, Parasha, texts) and Hebcal (Nach Yomi).

import { fetchCalendars, fetchSegments } from "./sefaria";
import { fetchNachYomi } from "./hebcal";
import { STUDIES, getStudy } from "./studies";
import type {
  ExtraText,
  ResolvedDay,
  ResolvedStudy,
  StudyContent,
  StudyId,
} from "./types";

/** Resolve the three studies (refs + Hebrew display refs) for an ISO date. */
export async function resolveDay(iso: string): Promise<ResolvedDay> {
  const [cal, nach] = await Promise.all([fetchCalendars(iso), fetchNachYomi(iso)]);

  const refByStudy: Record<StudyId, { ref: string | null; heRef: string | null }> = {
    daf: cal.daf,
    nach,
    shnayim: cal.parasha,
  };

  const studies: ResolvedStudy[] = STUDIES.map((meta) => ({
    id: meta.id,
    name: meta.name,
    color: meta.color,
    ref: refByStudy[meta.id].ref,
    heRef: refByStudy[meta.id].heRef,
  }));

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

/**
 * Resolve one study for a date into full readable content.
 * `wantExtra` controls whether the Steinsaltz/Targum text is fetched.
 */
export async function resolveStudyContent(
  iso: string,
  id: StudyId,
  wantExtra: boolean
): Promise<StudyContent> {
  const day = await resolveDay(iso);
  const base = day.studies.find((s) => s.id === id);
  const meta = getStudy(id);

  if (!base || !meta) {
    return {
      id,
      name: meta?.name ?? id,
      color: meta?.color ?? "#a9772e",
      ref: null,
      heRef: null,
      segments: [],
    };
  }

  if (!base.ref) {
    return { ...base, segments: [] };
  }

  const baseTextP = fetchSegments(base.ref);

  let extra: ExtraText | undefined;
  if (wantExtra && meta.extra) {
    const er = extraRef(id, base.ref);
    if (er) {
      const { segments } = await fetchSegments(er);
      if (segments.length > 0) {
        extra = { kind: meta.extra, label: EXTRA_LABEL[meta.extra], segments };
      }
    }
  }

  const { segments, heRef } = await baseTextP;

  return {
    ...base,
    heRef: base.heRef ?? heRef,
    segments,
    extra,
  };
}
