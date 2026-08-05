// Shared domain types for the Shilush daily-learning app.

export type StudyId = "daf" | "nach" | "shnayim";

/** A single readable segment (verse / line) of Hebrew text. */
export interface Segment {
  he: string;
  /** Verse number (Tanakh only); rendered as a gematria letter. */
  num?: number;
}

/** Extra material shown alongside the base text of a study. */
export interface ExtraText {
  /** Kind of extra: Steinsaltz elucidation, or Targum Onkelos. */
  kind: "steinsaltz" | "targum";
  /** Hebrew label shown in the UI. */
  label: string;
  segments: Segment[];
}

/** Static definition of a study track (the extension point for new studies). */
export interface StudyMeta {
  id: StudyId;
  /** Short Hebrew name used on tabs / cards, e.g. "דף יומי". */
  name: string;
  /** Accent color used across tabs, bars and calendar markers. */
  color: string;
  /** Which extra text this study supports, if any. */
  extra?: "steinsaltz" | "targum";
  /** Whether the extra is on by default (Targum yes, Steinsaltz no). */
  extraDefaultOn: boolean;
  /** Tanakh studies show per-chapter headings and gematria verse numbers. */
  numbered: boolean;
}

/** A study resolved for a specific date: which reference to read. */
export interface ResolvedStudy {
  id: StudyId;
  name: string;
  color: string;
  /** Sefaria reference, e.g. "Chullin 97" or "Isaiah 28". */
  ref: string | null;
  /** Hebrew display reference, e.g. "ברכות ל״ה". */
  heRef: string | null;
}

/** The three studies resolved for a date. */
export interface ResolvedDay {
  date: string; // YYYY-MM-DD
  studies: ResolvedStudy[];
}

/** One chapter/unit of a study: its text plus optional aligned extra material. */
export interface StudySection {
  ref: string | null;
  heRef: string | null;
  segments: Segment[];
  extra?: ExtraText;
}

/** Full payload for the reader: one or more sections (Nach = 2 chapters/day). */
export interface StudyContent extends ResolvedStudy {
  sections: StudySection[];
}
