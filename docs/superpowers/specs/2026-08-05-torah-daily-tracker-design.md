# שילוש — Daily Torah Learning Tracker · Design Spec

**Date:** 2026-08-05
**Working name:** Shilush / שילוש (a nod to the three daily studies)
**Status:** Approved design — ready for implementation planning

---

## 1. Purpose

A personal, mobile-first web app where the user reads and tracks their daily Torah
learning in one place. Phase one covers three daily studies, shown as **full Hebrew
text in-app**, with completion tracking, a streak, and a calendar. The design is built
so additional study tracks (e.g. רמב״ם יומי) can be added later with minimal change.

### Studies in phase one
1. **דף יומי** (Daf Yomi) — the daily Talmud folio.
2. **נ״ך יומי** (Nach Yomi) — the daily chapter of Nevi'im/Ketuvim.
3. **שניים מקרא ואחד תרגום** — the week's parasha: Hebrew text (read twice) + Targum Onkelos (once).

Steinsaltz elucidation is available as a toggle on **Daf Yomi** and **Nach Yomi**.

---

## 2. Scope

### In scope (phase one)
- Read full Hebrew text of all three studies in-app.
- Date navigation: previous/next day, and jump to a specific date.
- Scroll-progress indicator at the top of the reader.
- Steinsaltz elucidation toggle on Daf Yomi and Nach Yomi.
- Completion: mark a study done both **automatically on scroll-to-end** and via a manual **"סיימתי"** button.
- Home screen with current streak and today's three studies at a glance.
- Calendar view showing per-day completion (a colored marker per study), with tap-to-open any date.
- Light + dark mode (manual toggle, defaults to system preference).
- Hebrew-only UI, full RTL.
- Installable PWA (add to home screen, full-screen, offline caching of last-viewed content).

### Explicitly out of scope (phase one)
- Login / accounts / cross-device sync (all state is local to the device).
- Multiple users.
- English translations (Hebrew only).
- Additional study tracks beyond the three above (architecture must allow adding them later, but we do not build them now).
- Notifications / reminders.

### Deferred (designed-for, not built)
- New study tracks (רמב״ם יומי, etc.) — added by extending the study registry.
- Optional cloud sync — would slot behind the same storage interface.

---

## 3. Visual design (approved)

- **Direction:** "קלף חם" — warm parchment. Serif-free Hebrew set in the **Shofar** font
  (licensed; file bundled at `assets/fonts/Shofar-Regular.ttf`).
- **Light palette:** parchment `#f6efe0`, ink `#3a2e1e`, gold accent `#a9772e`.
- **Dark palette (warm night):** background `#1d1710`, cream text `#ecdec2`, gold accent `#d8a24e`.
- **Per-study accent colors:** Daf `#a9772e` (gold), Nach `#3d7a6f` (teal), Shnayim `#9c5a52` (terracotta).
  Used for study tabs, progress bars, and calendar markers.
- **Dark mode:** follows system by default; manual ☾ / ☀︎ override persisted locally.

> Licensing note: confirm the Shofar license permits web/app embedding before public deploy.

### Screens
1. **מסך הבית (Home / streak)** — greeting + Hebrew date; a streak card (large day count, 🔥, this-week dot row); "הלימוד של היום" list of the three studies each showing state (done ✓ / in-progress % / not started).
2. **קורא (Reader)** — top scroll-progress bar; date + study tabs (דף יומי / נ״ך / שניים מקרא); full Hebrew text; Steinsaltz toggle (Daf & Nach); "סיימתי" button; bottom nav.
3. **לוח שנה (Calendar)** — month grid, each day showing a colored marker per completed study; today highlighted, fully-complete days filled; legend; "קפוץ לתאריך" jump control. Tapping a day opens that date's reader.

Bottom navigation across the app: **היום · לוח שנה · רצף** (Today · Calendar · Streak).

---

## 4. Architecture

### Stack
- **Next.js (App Router)** + React, TypeScript.
- **PWA**: web manifest + service worker (installable, offline caching of last-viewed content and app shell).
- **Styling**: CSS with RTL as the document default; light/dark via CSS custom properties + `data-theme`.
- **Hosting**: Vercel.
- **Data source**: Sefaria public API (texts + daily calendar).
- **Local persistence**: browser `localStorage` (phase one), accessed only through a small storage module so it can later be swapped for a synced backend.

### Module boundaries (each independently understandable/testable)
- **`studies` registry** — declares each study track: id, Hebrew name, accent color, how to resolve *today's reference* for a given date, and which text/commentary versions to fetch. Adding רמב״ם later = adding one registry entry. This is the extension point.
- **`calendar-source`** — wraps Sefaria `/api/calendars` (with `year/month/day/diaspora/timezone`) to resolve Daf Yomi and Parashat refs for a date.
- **`nach-schedule`** — computes the Nach Yomi chapter for a date from a bundled cycle table (ordered chapter list + cycle anchor date). *(Sefaria's calendar API does not publish Nach Yomi; only the schedule is local — the chapter text still comes from Sefaria.)*
- **`text-source`** — wraps Sefaria text API to fetch Hebrew text for a ref, plus alternate versions: Targum Onkelos (for Shnayim Mikra) and Steinsaltz elucidation (for Daf & Nach). Version-string resolution is confirmed during implementation.
- **`reader`** — renders a resolved study: text body, scroll-progress tracking, Steinsaltz/Targum toggles, completion triggers.
- **`progress-store`** — the storage module: records completions and computes streaks. Single interface over `localStorage`.
- **`shell`** — layout, bottom nav, theme (light/dark) handling, PWA wiring.

### Data flow (reader, one day)
1. User is on a date (default: today).
2. For each study, the `studies` registry resolves a *ref* for that date — via `calendar-source` (Daf, Shnayim/parasha) or `nach-schedule` (Nach).
3. `text-source` fetches the Hebrew text (and Targum/Steinsaltz on demand) for the ref from Sefaria.
4. `reader` renders it; scroll position drives the top progress bar.
5. Reaching the end **or** tapping "סיימתי" calls `progress-store` to mark that study complete for that date.
6. Home and Calendar read `progress-store` to render streak and per-day markers.

### Study-specific behavior
- **שניים מקרא ואחד תרגום:** the parasha is presented for the standard practice — Hebrew read twice, Targum once. The reader shows the Hebrew text with an inline Targum Onkelos view (toggle/interleave); completion means the user has gone through the parasha's portion. (Exact "twice" affordance — e.g. a two-pass checklist vs. simple read-through — finalized in the plan; default is a straightforward read-through of Hebrew + Targum.)
- **Steinsaltz toggle:** off by default; when on, the elucidated/commentary version is fetched and shown alongside/under the base text for Daf and Nach.

---

## 5. Completion & streak logic
- A **study** for a date is `complete` when the user scrolls to its end or taps "סיימתי" (either triggers it; manual always available).
- A **day** is *fully complete* when all of that day's active studies are complete (used for the filled calendar day and the streak).
- **Streak** = consecutive days (ending today or yesterday) that are fully complete. Definition of "day boundary" uses the device's local date. Exact streak-grace rules (e.g. whether a missed day breaks it immediately) finalized in the plan; default: streak counts consecutive fully-complete days up to today.
- Per-study partial progress (e.g. "40%") is derived from scroll position and shown on Home; it is not persisted as a distinct state beyond complete/not-complete in phase one.

---

## 6. Error handling
- **Offline / Sefaria unreachable:** show cached content if available (PWA); otherwise a clear Hebrew message with a retry. The app shell and last-viewed day remain usable offline.
- **Missing text/version for a ref:** fall back to the base Hebrew text and hide the unavailable toggle (e.g. no Steinsaltz for that ref) rather than erroring the whole screen.
- **Date with no scheduled item** (edge cases in a cycle): show a friendly "אין לימוד להיום" state for that study, not a crash.
- **localStorage unavailable/full:** app still reads text; tracking degrades gracefully with a one-time notice.

---

## 7. Testing approach
- **Unit:** `nach-schedule` date→chapter math (including cycle wrap and anchor); streak computation over sample completion histories; `progress-store` read/write and day-complete logic.
- **Integration (mocked Sefaria):** `calendar-source` and `text-source` parse real sample payloads for Daf, Parasha+Targum, and a Nach chapter, including the Steinsaltz version.
- **Component:** reader scroll-to-complete trigger; Steinsaltz/Targum toggle; date navigation; calendar day rendering from completion data.
- **Manual/E2E smoke:** load today, mark studies done, verify streak + calendar update, reload (persistence), install as PWA and open a cached day offline. RTL and Shofar rendering verified on mobile viewport, light and dark.

---

## 8. Open items to settle in the implementation plan
1. Exact Sefaria version strings for Steinsaltz (Talmud & Tanakh) and Targum Onkelos.
2. Source of the Nach Yomi cycle table (ordered chapters + anchor date) to bundle.
3. Shnayim Mikra "twice" affordance (two-pass checklist vs. read-through).
4. Precise streak grace rule.
5. App icon / PWA manifest assets.
