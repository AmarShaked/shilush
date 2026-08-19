# שילוש · Shilush — Daily Torah Learning Tracker

A mobile-first PWA for reading and tracking three daily Torah studies in one place:

- **דף יומי** (Daf Yomi)
- **נ״ך יומי** (Nach Yomi)
- **שניים מקרא ואחד תרגום** (the week's parasha + Targum Onkelos)

Hebrew-only, RTL, warm-parchment design (Shofar font) with a light/dark toggle.
Reading progress, a scroll-progress bar, day-completion tracking, a streak, and a
month calendar — all stored locally on the device (no login in phase one).

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000 (designed for a mobile viewport).

```bash
npm run build   # production build
npm run lint
```

## How it works

- **Content**: fetched from the [Sefaria](https://www.sefaria.org) public API.
  - **Schedule is computed locally, offline** (`src/lib/hebcal.ts`) with the Hebcal
    libraries — no network: Daf Yomi & Nach Yomi via `@hebcal/learning`, the parasha
    via `@hebcal/core` (`Sedra`), and the daily aliyah verse ranges via `@hebcal/leyning`.
  - **Text is fetched from Sefaria** `/api/v3/texts`; Targum Onkelos via `Onkelos <ref>`;
    Steinsaltz Hebrew elucidation via `Steinsaltz on <ref>`.
  - Server-side route handlers (`/api/day`, `/api/study`) build the refs locally and
    fetch text from Sefaria.
- **Tracking**: completions + streak live in `localStorage` behind a single module
  (`src/lib/progressStore.ts`) so a synced backend could replace it later.
  In the calendar, a **long press** on a day marks all of its active studies complete
  at once (hold again to undo).
- **Studies registry** (`src/lib/studies.ts`) is the extension point — add a new
  track (e.g. רמב״ם יומי) with one entry plus a ref-resolver branch in `resolve.ts`.
- **PWA**: installable (`public/manifest.webmanifest`), with a service worker
  (`public/sw.js`) caching the app shell and last-viewed study data for offline use.

Design spec: [`docs/superpowers/specs/2026-08-05-torah-daily-tracker-design.md`](docs/superpowers/specs/2026-08-05-torah-daily-tracker-design.md).

## Notes

- The **Shofar** font (`public/fonts/`) is commercial — confirm the license permits
  web/app embedding before a public deploy.
- Parashat Hashavua uses the **Israel** schedule (`DIASPORA = false` in `src/lib/sefaria.ts`).
