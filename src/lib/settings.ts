// User settings: reading font size, which studies are active daily, and theme.
// Backed by localStorage, mirroring the progress-store pattern.

import { STUDIES } from "./studies";
import type { StudyId } from "./types";

const KEY = "shilush:settings:v1";
const THEME_KEY = "shilush:theme";

export type Theme = "light" | "dark";

export interface Settings {
  fontScale: number; // 1 = default reading size
  font: string; // font key (see FONTS)
  studies: Record<StudyId, boolean>;
}

export const FONT_MIN = 0.8;
export const FONT_MAX = 1.6;
export const FONT_STEP = 0.1;

/** Selectable Hebrew fonts. `css` is the font-family value applied to the app. */
export interface FontOption {
  key: string;
  label: string;
  css: string;
}
export const FONTS: FontOption[] = [
  { key: "shofar", label: "שופר", css: '"Shofar"' },
  { key: "frank", label: "פרנק רוהל", css: "var(--font-frank)" },
  { key: "david", label: "דוד", css: "var(--font-david)" },
  { key: "notoserif", label: "נוטו סריף", css: "var(--font-notoserif)" },
  { key: "assistant", label: "אסיסטנט", css: "var(--font-assistant)" },
];
const FONT_KEYS = FONTS.map((f) => f.key);

const DEFAULTS: Settings = {
  fontScale: 1,
  font: "shofar",
  studies: { daf: true, nach: true, shnayim: true, rambam: false },
};

const listeners = new Set<() => void>();
let version = 0;

export function getSettingsVersion(): number {
  return version;
}
export function subscribeSettings(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function notify() {
  version++;
  listeners.forEach((l) => l());
}

function read(): Settings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const p = JSON.parse(raw) as Partial<Settings>;
    const fs = typeof p.fontScale === "number" ? p.fontScale : 1;
    return {
      fontScale: Math.min(FONT_MAX, Math.max(FONT_MIN, fs)),
      font: typeof p.font === "string" && FONT_KEYS.includes(p.font) ? p.font : "shofar",
      studies: {
        daf: p.studies?.daf !== false,
        nach: p.studies?.nach !== false,
        shnayim: p.studies?.shnayim !== false,
        rambam: p.studies?.rambam === true, // default off
      },
    };
  } catch {
    return DEFAULTS;
  }
}

function write(s: Settings): void {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(s));
    } catch {}
    applyFontScale(s.fontScale);
    applyFont(s.font);
  }
  notify();
}

export function getSettings(): Settings {
  return read();
}

/** Study ids the user has enabled, in registry order. */
export function getEnabledStudyIds(): StudyId[] {
  const s = read();
  return STUDIES.map((m) => m.id).filter((id) => s.studies[id]);
}

export function isStudyEnabled(id: StudyId): boolean {
  return read().studies[id];
}

/** Enable/disable a study, keeping at least one enabled. */
export function setStudyEnabled(id: StudyId, on: boolean): void {
  const s = read();
  const studies = { ...s.studies, [id]: on };
  if (Object.values(studies).every((v) => !v)) return; // never zero
  write({ ...s, studies });
}

export function setFontScale(v: number): void {
  const clamped = Math.min(FONT_MAX, Math.max(FONT_MIN, Number(v.toFixed(2))));
  write({ ...read(), fontScale: clamped });
}

/** Push the reading scale to a CSS variable used by the reader. */
export function applyFontScale(v: number): void {
  if (typeof document !== "undefined") {
    document.documentElement.style.setProperty("--reader-scale", String(v));
  }
}

export function setFont(key: string): void {
  write({ ...read(), font: key });
}

/** Apply the chosen font via a data attribute (CSS maps it to --app-font). */
export function applyFont(key: string): void {
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-font", key || "shofar");
  }
}

// --- theme (kept under its own key so the pre-paint bootstrap can read it) ---
export function getTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return (document.documentElement.getAttribute("data-theme") as Theme) ?? "light";
}
export function setTheme(t: Theme): void {
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", t);
    try {
      window.localStorage.setItem(THEME_KEY, t);
    } catch {}
  }
  notify();
}
