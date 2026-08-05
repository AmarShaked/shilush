// Local completion tracking + streak computation, backed by localStorage.
// This is the single storage boundary — a future synced backend would implement
// the same read/write surface without touching the screens.

import { STUDIES } from "./studies";
import { addDays, diffDays, todayISO } from "./dates";
import type { StudyId } from "./types";

const KEY = "shilush:progress:v1";

/** date (YYYY-MM-DD) -> which studies are complete that day. */
type ProgressMap = Record<string, Partial<Record<StudyId, boolean>>>;

const listeners = new Set<() => void>();
let version = 0;

/** Monotonic version, bumped on every change (for useSyncExternalStore). */
export function getVersion(): number {
  return version;
}

function read(): ProgressMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ProgressMap) : {};
  } catch {
    return {};
  }
}

function write(map: ProgressMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    // storage unavailable/full — tracking degrades, reading still works
  }
  version++;
  listeners.forEach((l) => l());
}

// Cross-tab: when another tab writes, bump version and notify local listeners.
let storageBound = false;
function bindStorage() {
  if (storageBound || typeof window === "undefined") return;
  storageBound = true;
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) {
      version++;
      listeners.forEach((l) => l());
    }
  });
}

/** Subscribe to progress changes (for React useSyncExternalStore). */
export function subscribe(cb: () => void): () => void {
  bindStorage();
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function isComplete(date: string, id: StudyId): boolean {
  return !!read()[date]?.[id];
}

export function setComplete(date: string, id: StudyId, value: boolean): void {
  const map = read();
  const day = { ...(map[date] ?? {}) };
  if (value) day[id] = true;
  else delete day[id];
  if (Object.keys(day).length === 0) delete map[date];
  else map[date] = day;
  write(map);
}

export function toggleComplete(date: string, id: StudyId): void {
  setComplete(date, id, !isComplete(date, id));
}

/** Completion flags for all studies on a date. */
export function dayStatus(date: string): Record<StudyId, boolean> {
  const day = read()[date] ?? {};
  return {
    daf: !!day.daf,
    nach: !!day.nach,
    shnayim: !!day.shnayim,
  };
}

/** How many of the day's studies are complete. */
export function dayCount(date: string): number {
  const s = dayStatus(date);
  return STUDIES.reduce((n, m) => n + (s[m.id] ? 1 : 0), 0);
}

/** A day is fully complete when every active study is complete. */
export function isDayComplete(date: string): boolean {
  return dayCount(date) === STUDIES.length;
}

/**
 * Current streak: consecutive fully-complete days ending today, or ending
 * yesterday if today isn't done yet (so an unfinished today doesn't zero it out).
 */
export function currentStreak(today: string = todayISO()): number {
  let cursor = isDayComplete(today) ? today : addDays(today, -1);
  // If neither today nor yesterday is complete, streak is 0.
  if (!isDayComplete(cursor)) return 0;
  let streak = 0;
  while (isDayComplete(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** Total number of fully-complete days ever recorded. */
export function totalDaysComplete(): number {
  const map = read();
  return Object.keys(map).filter((d) => isDayComplete(d)).length;
}

/** Longest run of consecutive fully-complete days in recorded history. */
export function bestStreak(): number {
  const complete = Object.keys(read())
    .filter((d) => isDayComplete(d))
    .sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of complete) {
    if (prev && diffDays(d, prev) === 1) run++;
    else run = 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

/** Completion flags for the last 7 days (oldest first), for the week dot row. */
export function lastWeek(today: string = todayISO()): { date: string; done: boolean }[] {
  const out: { date: string; done: boolean }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = addDays(today, -i);
    out.push({ date: d, done: isDayComplete(d) });
  }
  return out;
}
