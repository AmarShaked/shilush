// Learning schedules computed locally with the Hebcal libraries (no network):
//   @hebcal/core     – Hebrew dates + weekly parasha (Sedra)
//   @hebcal/learning – Daf Yomi, Daily Rambam
//   @hebcal/leyning  – parasha aliyah (verse ranges)
// Nach follows a fixed printed calendar (nachSchedule.ts) rather than a library cycle.
// Only the study *text* is fetched remotely (from Sefaria); the *schedule* — which
// daf / chapters / aliyah to learn — is derived here, offline.

import { HDate, getSedra, Locale } from "@hebcal/core";
import {
  DafYomi,
  DafYomiEvent,
  dailyRambam1,
  DailyRambamEvent,
} from "@hebcal/learning";
import { getLeyningForParsha } from "@hebcal/leyning";
import { diffDays, hebrewNumeral } from "./dates";
import { NACH_SCHEDULE, NACH_SCHEDULE_START } from "./nachSchedule";

const IL = true; // Israel schedule (matches the rest of the app)

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

// Hebrew titles for the Sefaria book names used in NACH_SCHEDULE.
const NACH_HE: Record<string, string> = {
  Joshua: "יהושע", Judges: "שופטים", "I Samuel": "שמואל א׳", "II Samuel": "שמואל ב׳",
  "I Kings": "מלכים א׳", "II Kings": "מלכים ב׳", Isaiah: "ישעיהו", Jeremiah: "ירמיהו",
  Ezekiel: "יחזקאל", Hosea: "הושע", Joel: "יואל", Amos: "עמוס", Obadiah: "עובדיה",
  Jonah: "יונה", Micah: "מיכה", Nahum: "נחום", Habakkuk: "חבקוק", Zephaniah: "צפניה",
  Haggai: "חגי", Zechariah: "זכריה", Malachi: "מלאכי", Psalms: "תהילים", Proverbs: "משלי",
  Job: "איוב", "Song of Songs": "שיר השירים", Ruth: "רות", Lamentations: "איכה",
  Ecclesiastes: "קהלת", Esther: "אסתר", Daniel: "דניאל", Ezra: "עזרא", Nehemiah: "נחמיה",
  "I Chronicles": "דברי הימים א׳", "II Chronicles": "דברי הימים ב׳",
};

/**
 * The day's Nach chapters from the printed "whole Nach in a year" calendar:
 * one item per chapter (a verse range stays a single item, e.g. Psalms 119:1-80).
 */
export function nachChapters(iso: string): RefItem[] {
  const entry = NACH_SCHEDULE[diffDays(iso, NACH_SCHEDULE_START)];
  if (!entry) return []; // outside the calendar's year
  const out: RefItem[] = [];
  for (const ref of entry.split("; ")) {
    const m = ref.match(/^(.+) (\d+)(?::(\d+)-(\d+)|-(\d+))?$/);
    if (!m) continue;
    const [, book, from, v1, v2, to] = m;
    const he = NACH_HE[book] ?? book;
    if (v1) {
      out.push({ ref, heRef: `${he} ${hebrewNumeral(+from)} ${hebrewNumeral(+v1)}–${hebrewNumeral(+v2)}` });
      continue;
    }
    for (let c = +from; c <= +(to ?? from); c++) {
      out.push({ ref: `${book} ${c}`, heRef: `${he} ${hebrewNumeral(c)}` });
    }
  }
  return out;
}

/** Today's Daily Rambam chapter (Mishneh Torah, one perek a day). */
export function rambamChapter(iso: string): RefItem {
  const hd = hdFromISO(iso);
  const r = dailyRambam1(hd);
  let heRef: string | null = null;
  try {
    heRef = stripNikud(new DailyRambamEvent(hd, r).render("he")) || null;
  } catch {
    heRef = null;
  }
  return { ref: `Mishneh Torah, ${r.name} ${r.perek}`, heRef };
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
