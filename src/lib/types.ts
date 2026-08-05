// Shared domain types for the Shilush daily-learning app.

export type StudyId = "daf" | "nach" | "shnayim";

/** A single readable segment (verse / line) of Hebrew text. */
export interface Segment {
  he: string;
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

/** Full payload for the reader: base text plus optional extra. */
export interface StudyContent extends ResolvedStudy {
  segments: Segment[];
  extra?: ExtraText;
}
