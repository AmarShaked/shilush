// Learning schedules computed locally with the Hebcal libraries (no network):
//   @hebcal/core     – Hebrew dates + weekly parasha (Sedra)
//   @hebcal/learning – Daf Yomi, Nach Yomi
//   @hebcal/leyning  – parasha aliyah (verse ranges)
// Only the study *text* is fetched remotely (from Sefaria); the *schedule* — which
// daf / chapters / aliyah to learn — is derived here, offline.

import { HDate, getSedra, Locale } from "@hebcal/core";
import { DafYomi, DafYomiEvent, NachYomiIndex, NachYomiEvent } from "@hebcal/learning";
import { getLeyningForParsha } from "@hebcal/leyning";
import { diffDays } from "./dates";

const IL = true; // Israel schedule (matches the rest of the app)

// This user's Nach program: 2 chapters/day, started 2026-05-22 at Joshua 1–2.
const NACH_START = "2026-05-22";
const NACH_PER_DAY = 2;
// A date on which Nach Yomi (1/day) reads Joshua 1 — used to map a linear chapter
// index onto the schedule. Verified: 2026-02-12 = Joshua 1, +174 days = Isaiah 28.
const NACH_ANCHOR = { y: 2026, m: 1, d: 12 }; // JS month is 0-based (1 = February)

// Shnayim Mikra: the parasha split into 7 aliyot, one per weekday (Sun = 1 … Shabbat = 7).
const ALIYAH_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שביעי"];

type RefItem = { ref: string; heRef: string | null };

const HEBREW_MARKS = /[֑-ֽֿ-ׇ]/g; // niqqud + cantillation
const stripNikud = (s: string) => s.replace(HEBREW_MARKS, "").trim();

function hdFromISO(iso: string): HDate {
  return new HDate(new Date(iso + "T12:00:00"));
}

/** Today's Daf Yomi reference, e.g. { ref: "Chullin 97", heRef: "חולין צ״ז" }. */
export function dafYomiRef(iso: string): RefItem {
  const hd = hdFromISO(iso);
  const daf = new DafYomi(hd);
  const ref = `${daf.name} ${daf.blatt}`;
  let heRef: string | null = null;
  try {
    // render('he') → "דף יומי: חולין דף צ״ז"; reduce to "חולין צ״ז".
    const he = stripNikud(new DafYomiEvent(hd).render("he"));
    const afterColon = he.includes(":") ? he.slice(he.indexOf(":") + 1) : he;
    heRef = afterColon.replace(/דף\s+/, "").trim() || null;
  } catch {
    heRef = null;
  }
  return { ref, heRef };
}

/** The two Nach Yomi chapters for a date, per this user's 2-chapters/day schedule. */
export function nachChapters(iso: string): RefItem[] {
  const dayIndex = diffDays(iso, NACH_START);
  if (dayIndex < 0) return []; // before the cycle started
  const linearStart = dayIndex * NACH_PER_DAY;
  const nyi = new NachYomiIndex();
  const out: RefItem[] = [];
  for (let k = 0; k < NACH_PER_DAY; k++) {
    const hd = new HDate(new Date(NACH_ANCHOR.y, NACH_ANCHOR.m, NACH_ANCHOR.d + linearStart + k));
    const r = nyi.lookup(hd);
    let heRef: string | null = null;
    try {
      heRef = stripNikud(new NachYomiEvent(hd, r).render("he")) || null;
    } catch {
      heRef = null;
    }
    out.push({ ref: `${r.k} ${r.v}`, heRef });
  }
  return out;
}

/** The daily Shnayim Mikra aliyah of the week's parasha, or null on a holiday week. */
export function dailyAliyah(iso: string): RefItem | null {
  const hd = hdFromISO(iso);
  const weekday = hd.getDay(); // 0 = Sunday … 6 = Shabbat
  const shabbat = new Date(iso + "T12:00:00");
  shabbat.setDate(shabbat.getDate() + (6 - weekday)); // the week's reading Shabbat
  const shabbatHd = new HDate(shabbat);

  const look = getSedra(shabbatHd.getFullYear(), IL).lookup(shabbatHd.abs());
  const parshaList = look?.parsha;
  if (look?.chag || !parshaList || parshaList.length === 0) return null;
  const name = parshaList.join("-");

  let aliyah: { k: string; b: string; e: string } | undefined;
  try {
    aliyah = getLeyningForParsha(name).fullkriyah?.[String(weekday + 1)];
  } catch {
    return null;
  }
  if (!aliyah) return null;

  const heName = parshaList
    .map((p) => {
      try {
        return stripNikud(Locale.gettext(p, "he")) || p;
      } catch {
        return p;
      }
    })
    .join("־");

  return {
    ref: `${aliyah.k} ${aliyah.b}-${aliyah.e}`,
    heRef: `${heName} · ${ALIYAH_NAMES[weekday]}`,
  };
}
