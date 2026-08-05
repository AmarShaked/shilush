"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import { todayISO, hebrewWeekday, hebrewDate, fromISODate } from "@/lib/dates";
import { currentStreak, dayStatus, lastWeek } from "@/lib/progressStore";
import { useProgressVersion, useHydrated } from "@/lib/useProgress";
import type { ResolvedDay } from "@/lib/types";

const HE_DOW = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

export default function HomePage() {
  const today = todayISO();
  useProgressVersion(); // re-render when completions change
  const mounted = useHydrated();
  const [day, setDay] = useState<ResolvedDay | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/day?date=${today}`)
      .then((r) => r.json())
      .then((d) => alive && setDay(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [today]);

  const streak = mounted ? currentStreak(today) : 0;
  const week = mounted ? lastWeek(today) : [];
  const status = mounted ? dayStatus(today) : { daf: false, nach: false, shnayim: false };

  return (
    <main>
      <div className="page-pad">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div className="greeting">שלום 👋</div>
            <div className="subdate">
              {hebrewWeekday(today)} · {hebrewDate(today)}
            </div>
          </div>
          <ThemeToggle />
        </div>

        <Link href="/streak" className="streak-card" style={{ display: "block", marginTop: 14 }}>
          <div className="streak-num">{streak}</div>
          <div className="streak-label">🔥 ימים ברצף</div>
          <div className="week-row">
            {week.map((w) => (
              <span key={w.date} className={`week-dot${w.done ? " on" : ""}`}>
                {w.done ? "✓" : HE_DOW[fromISODate(w.date).getDay()]}
              </span>
            ))}
          </div>
        </Link>

        <div className="section-title">הלימוד של היום</div>

        {!day ? (
          <div className="spinner" />
        ) : (
          day.studies.map((s) => {
            const done = status[s.id];
            return (
              <Link
                key={s.id}
                href={`/reader?date=${today}&id=${s.id}`}
                className="study-card"
                style={{ "--accent": s.color } as React.CSSProperties}
              >
                <span className={`ring ${done ? "done" : "todo"}`}>{done ? "✓" : "○"}</span>
                <span className="study-body">
                  <span className="study-name">{s.name}</span>
                  <span className="study-sub" style={{ display: "block" }}>
                    {s.heRef ?? (s.ref ? s.ref : "אין לימוד להיום")}
                  </span>
                </span>
                <span className="study-chip">{done ? "הושלם" : "פתח"}</span>
              </Link>
            );
          })
        )}
      </div>
    </main>
  );
}
