"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { HDate } from "@hebcal/core";
import { STUDIES } from "@/lib/studies";
import {
  toISODate,
  todayISO,
  hebrewMonthLabel,
  hebrewNumeral,
  hebrewWeekday,
  hebrewDate,
} from "@/lib/dates";
import { dayStatus, isDayComplete, toggleDayComplete } from "@/lib/progressStore";
import { isStudyEnabled } from "@/lib/settings";
import { useProgressVersion, useHydrated } from "@/lib/useProgress";
import { useSettingsVersion } from "@/lib/useSettings";
import { useLongPress } from "@/lib/useLongPress";
import type { ResolvedDay } from "@/lib/types";

const HE_DOW = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];
const COLOR: Record<string, string> = {
  daf: "var(--daf)",
  nach: "var(--nach)",
  shnayim: "var(--shnayim)",
  rambam: "var(--rambam)",
};

// Absolute day number of the 1st of the Hebrew month containing `iso`.
function monthFirstAbs(iso: string): number {
  const hd = new HDate(new Date(iso + "T12:00:00"));
  return new HDate(1, hd.getMonth(), hd.getFullYear()).abs();
}

export default function CalendarPage() {
  const router = useRouter();
  useProgressVersion();
  useSettingsVersion();
  const mounted = useHydrated();
  const enabledStudies = mounted ? STUDIES.filter((s) => isStudyEnabled(s.id)) : STUDIES;

  const today = todayISO();
  const [firstAbs, setFirstAbs] = useState(() => monthFirstAbs(today));
  const [selected, setSelected] = useState<string | null>(null);
  const [dayInfo, setDayInfo] = useState<{ date: string; data: ResolvedDay } | null>(null);
  const [toast, setToast] = useState<{ text: string; n: number } | null>(null);

  // Load the selected day's studies (refs) for the info panel.
  useEffect(() => {
    if (!selected) return;
    let alive = true;
    fetch(`/api/day?date=${selected}`)
      .then((r) => r.json())
      .then((d) => alive && setDayInfo({ date: selected, data: d }))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [selected]);

  const info = selected && dayInfo?.date === selected ? dayInfo.data : null;

  const { first, monthLabelISO, cells } = useMemo(() => {
    const first = new HDate(firstAbs);
    const days = first.daysInMonth();
    const lead = first.getDay(); // 0 = Sunday
    const list: ({ iso: string; heDay: string } | null)[] = [];
    for (let i = 0; i < lead; i++) list.push(null);
    for (let d = 1; d <= days; d++) {
      const iso = toISODate(new HDate(firstAbs + d - 1).greg());
      list.push({ iso, heDay: hebrewNumeral(d, false) });
    }
    return { first, monthLabelISO: toISODate(first.greg()), cells: list };
  }, [firstAbs]);

  function shiftMonth(delta: number) {
    setSelected(null);
    if (delta < 0) {
      const prevLast = new HDate(first.abs() - 1);
      setFirstAbs(new HDate(1, prevLast.getMonth(), prevLast.getFullYear()).abs());
    } else {
      setFirstAbs(first.abs() + first.daysInMonth());
    }
  }

  function selectDay(iso: string) {
    setSelected((cur) => (cur === iso ? null : iso));
  }

  // Press-and-hold a day to tick every enabled study at once (hold again to undo).
  function markWholeDay(iso: string) {
    const done = toggleDayComplete(iso);
    setToast((cur) => ({
      text: done ? "היום כולו סומן כנלמד ✓" : "סימון היום בוטל",
      n: (cur?.n ?? 0) + 1,
    }));
  }

  const { pressing, bind } = useLongPress<string>({ onLongPress: markWholeDay, onClick: selectDay });

  // Clear the confirmation a moment after the last long press.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <main className="page-pad">
      <div className="cal-head">
        <button aria-label="חודש קודם" onClick={() => shiftMonth(-1)}>
          ‹
        </button>
        <span>{hebrewMonthLabel(monthLabelISO)}</span>
        <button aria-label="חודש הבא" onClick={() => shiftMonth(1)}>
          ›
        </button>
      </div>
      <div className="cal-sub">
        הקש על יום כדי לראות את הלימודים שלו · לחיצה ארוכה לסימון היום כולו
      </div>

      <div className="dow">
        {HE_DOW.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>

      <div className="cal-grid">
        {cells.map((cell, i) => {
          if (!cell) return <div key={`e${i}`} className="cal-day empty" />;
          const { iso, heDay } = cell;
          const isToday = iso === today;
          const future = iso > today;
          const full = mounted && isDayComplete(iso);
          const status = mounted ? dayStatus(iso) : { daf: false, nach: false, shnayim: false, rambam: false };
          return (
            <button
              key={iso}
              className={`cal-day${full ? " full" : ""}${isToday ? " today" : ""}${
                future ? " future" : ""
              }${selected === iso ? " selected" : ""}${pressing === iso ? " pressing" : ""}`}
              title="לחיצה ארוכה לסימון היום כולו"
              {...bind(iso)}
            >
              <span>{heDay}</span>
              <span className="cal-dots">
                {enabledStudies.map((s) =>
                  status[s.id] ? <i key={s.id} style={{ background: COLOR[s.id] }} /> : null
                )}
              </span>
            </button>
          );
        })}
      </div>

      {toast && <div className="cal-toast">{toast.text}</div>}

      <div className="legend">
        {enabledStudies.map((s) => (
          <span key={s.id}>
            <i style={{ background: COLOR[s.id] }} />
            {s.name}
          </span>
        ))}
      </div>

      {selected && (
        <div className="day-panel">
          <div className="day-panel-head">
            {hebrewWeekday(selected)} · {hebrewDate(selected)}
          </div>
          {!info ? (
            <div className="spinner" />
          ) : (
            info.studies
              .filter((s) => enabledStudies.some((e) => e.id === s.id))
              .map((s) => {
                const done = mounted && dayStatus(selected)[s.id];
                return (
                  <button
                    key={s.id}
                    className="study-card"
                    style={{ "--accent": s.color } as React.CSSProperties}
                    onClick={() => router.push(`/reader?date=${selected}&id=${s.id}`)}
                  >
                    <span className={`ring ${done ? "done" : "todo"}`}>{done ? "✓" : "○"}</span>
                    <span className="study-body">
                      <span className="study-name">{s.name}</span>
                      <span className="study-sub" style={{ display: "block" }}>
                        {s.heRef ?? (s.ref ? s.ref : "אין לימוד ליום זה")}
                      </span>
                    </span>
                    <span className="study-chip">פתח ›</span>
                  </button>
                );
              })
          )}
        </div>
      )}
    </main>
  );
}
