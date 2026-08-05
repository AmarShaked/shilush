"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { STUDIES } from "@/lib/studies";
import { toISODate, todayISO, hebrewMonthLabel, gregorianMonthLabel } from "@/lib/dates";
import { dayStatus, isDayComplete } from "@/lib/progressStore";
import { isStudyEnabled } from "@/lib/settings";
import { useProgressVersion, useHydrated } from "@/lib/useProgress";
import { useSettingsVersion } from "@/lib/useSettings";

const HE_DOW = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];
const COLOR: Record<string, string> = {
  daf: "var(--daf)",
  nach: "var(--nach)",
  shnayim: "var(--shnayim)",
};

export default function CalendarPage() {
  const router = useRouter();
  useProgressVersion();
  useSettingsVersion();
  const mounted = useHydrated();
  const enabledStudies = mounted ? STUDIES.filter((s) => isStudyEnabled(s.id)) : STUDIES;
  const dateInput = useRef<HTMLInputElement>(null);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-11

  const today = todayISO();
  const firstISO = `${year}-${String(month + 1).padStart(2, "0")}-01`;

  const cells = useMemo(() => {
    const first = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const lead = first.getDay(); // 0=Sunday -> leading empties
    const out: (string | null)[] = [];
    for (let i = 0; i < lead; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) out.push(toISODate(new Date(year, month, d)));
    return out;
  }, [year, month]);

  function shiftMonth(delta: number) {
    const m = month + delta;
    const y = year + Math.floor(m / 12);
    const nm = ((m % 12) + 12) % 12;
    setYear(y);
    setMonth(nm);
  }

  function openDay(iso: string) {
    router.push(`/reader?date=${iso}&id=daf`);
  }

  function jump() {
    const el = dateInput.current;
    if (!el) return;
    // showPicker where supported; otherwise the input is visible to tap.
    if (typeof el.showPicker === "function") el.showPicker();
    else el.focus();
  }

  return (
    <main className="page-pad">
      <div className="cal-head">
        <button aria-label="חודש קודם" onClick={() => shiftMonth(-1)}>
          ›
        </button>
        <span>{hebrewMonthLabel(firstISO)}</span>
        <button aria-label="חודש הבא" onClick={() => shiftMonth(1)}>
          ‹
        </button>
      </div>
      <div className="cal-sub">{gregorianMonthLabel(firstISO)} · הקש על יום כדי לפתוח את הלימוד שלו</div>

      <div className="dow">
        {HE_DOW.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>

      <div className="cal-grid">
        {cells.map((iso, i) => {
          if (!iso) return <div key={`e${i}`} className="cal-day empty" />;
          const isToday = iso === today;
          const future = iso > today;
          const full = mounted && isDayComplete(iso);
          const status = mounted ? dayStatus(iso) : { daf: false, nach: false, shnayim: false };
          const dayNum = Number(iso.slice(8, 10));
          return (
            <button
              key={iso}
              className={`cal-day${full ? " full" : ""}${isToday ? " today" : ""}${
                future ? " future" : ""
              }`}
              onClick={() => openDay(iso)}
            >
              <span>{dayNum}</span>
              <span className="cal-dots">
                {enabledStudies.map((s) =>
                  status[s.id] ? (
                    <i key={s.id} style={{ background: COLOR[s.id] }} />
                  ) : null
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div className="legend">
        {enabledStudies.map((s) => (
          <span key={s.id}>
            <i style={{ background: COLOR[s.id] }} />
            {s.name}
          </span>
        ))}
      </div>

      <button className="jump-btn" onClick={jump}>
        📅 קפוץ לתאריך
      </button>
      <input
        ref={dateInput}
        type="date"
        className="jump-input"
        defaultValue={today}
        onChange={(e) => e.target.value && openDay(e.target.value)}
      />
    </main>
  );
}
