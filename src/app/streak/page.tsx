"use client";

import ThemeToggle from "@/components/ThemeToggle";
import { todayISO, hebrewDate, hebrewWeekday, fromISODate } from "@/lib/dates";
import {
  currentStreak,
  bestStreak,
  totalDaysComplete,
  lastWeek,
} from "@/lib/progressStore";
import { useProgressVersion, useHydrated } from "@/lib/useProgress";

const HE_DOW = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

export default function StreakPage() {
  const today = todayISO();
  useProgressVersion();
  const mounted = useHydrated();

  const streak = mounted ? currentStreak(today) : 0;
  const best = mounted ? bestStreak() : 0;
  const total = mounted ? totalDaysComplete() : 0;
  const week = mounted ? lastWeek(today) : [];

  return (
    <main className="page-pad">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div className="greeting">הרצף שלי</div>
          <div className="subdate">
            {hebrewWeekday(today)} · {hebrewDate(today)}
          </div>
        </div>
        <ThemeToggle />
      </div>

      <div className="streak-card" style={{ marginTop: 14 }}>
        <div className="streak-num">{streak}</div>
        <div className="streak-label">🔥 ימים ברצף</div>
        <div className="week-row">
          {week.map((w) => (
            <span key={w.date} className={`week-dot${w.done ? " on" : ""}`}>
              {w.done ? "✓" : HE_DOW[fromISODate(w.date).getDay()]}
            </span>
          ))}
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-box">
          <div className="n">{best}</div>
          <div className="l">הרצף הארוך ביותר</div>
        </div>
        <div className="stat-box">
          <div className="n">{total}</div>
          <div className="l">ימים שהושלמו</div>
        </div>
      </div>

      <p className="notice" style={{ paddingTop: 28 }}>
        יום נחשב כהושלם כאשר סיימת את כל שלושת הלימודים שלו.
      </p>
    </main>
  );
}
