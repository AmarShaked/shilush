// The study registry — the single place that declares each daily study track.
// Adding a new track later (e.g. רמב״ם יומי) means adding one entry here and a
// ref-resolver branch in resolve.ts.

import type { StudyId, StudyMeta } from "./types";

export const STUDIES: StudyMeta[] = [
  {
    id: "daf",
    name: "דף יומי",
    color: "#a9772e",
    extra: "steinsaltz",
    extraDefaultOn: false,
    numbered: false,
  },
  {
    id: "nach",
    name: "נ״ך יומי",
    color: "#3d7a6f",
    extra: "steinsaltz",
    extraDefaultOn: false,
    numbered: true,
  },
  {
    id: "shnayim",
    name: "שניים מקרא",
    color: "#9c5a52",
    extra: "targum",
    extraDefaultOn: true,
    numbered: true,
  },
];

export function getStudy(id: StudyId): StudyMeta | undefined {
  return STUDIES.find((s) => s.id === id);
}

export function isStudyId(v: string): v is StudyId {
  return v === "daf" || v === "nach" || v === "shnayim";
}
