"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { STUDIES, getStudy, isStudyId } from "@/lib/studies";
import { todayISO, addDays, hebrewWeekday, hebrewDate } from "@/lib/dates";
import { isComplete, setComplete } from "@/lib/progressStore";
import { useProgressVersion } from "@/lib/useProgress";
import type { StudyContent, StudyId } from "@/lib/types";

function ReaderInner() {
  const params = useSearchParams();
  const initialId = params.get("id") ?? "daf";
  const initialDate = params.get("date") ?? todayISO();

  const [date, setDate] = useState(initialDate);
  const [studyId, setStudyId] = useState<StudyId>(isStudyId(initialId) ? initialId : "daf");
  // Fetched content, tagged with the key it belongs to so we can tell stale from fresh.
  const [loaded, setLoaded] = useState<{ key: string; data: StudyContent } | null>(null);
  // Per-study override of the extra toggle; falls back to each study's default.
  const [extraByStudy, setExtraByStudy] = useState<Partial<Record<StudyId, boolean>>>({});
  // Which pesukim have their Steinsaltz perush expanded, scoped to the current day+study.
  const [expandedState, setExpandedState] = useState<{ key: string; map: Record<number, boolean> }>({
    key: "",
    map: {},
  });

  const meta = getStudy(studyId)!;
  const extraOn = extraByStudy[studyId] ?? meta.extraDefaultOn;

  useProgressVersion();
  const progressBar = useRef<HTMLDivElement>(null);
  const autoDone = useRef(false);

  // Keep the URL in sync for shareable/bookmarkable links.
  useEffect(() => {
    window.history.replaceState(null, "", `/reader?date=${date}&id=${studyId}`);
  }, [date, studyId]);

  // Fetch content when date/study changes. Always request the extra material
  // (Steinsaltz/Targum) so the toggle is instant; the toggle only controls display.
  useEffect(() => {
    const key = `${date}:${studyId}`;
    let alive = true;
    autoDone.current = false;
    window.scrollTo(0, 0);
    if (progressBar.current) progressBar.current.style.width = "0%";

    const wantExtra = !!getStudy(studyId)!.extra;
    fetch(`/api/study?date=${date}&id=${studyId}&extra=${wantExtra ? 1 : 0}`)
      .then((r) => r.json())
      .then((c: StudyContent) => {
        if (alive) setLoaded({ key, data: c });
      })
      .catch(() => {
        if (!alive) return;
        const m = getStudy(studyId)!;
        setLoaded({
          key,
          data: { id: studyId, name: m.name, color: m.color, ref: null, heRef: null, segments: [] },
        });
      });
    return () => {
      alive = false;
    };
  }, [date, studyId]);

  const key = `${date}:${studyId}`;
  const loading = !loaded || loaded.key !== key;
  const content = loading ? null : loaded!.data;
  const done = isComplete(date, studyId);

  const expanded = expandedState.key === key ? expandedState.map : {};
  function toggleVerse(i: number) {
    setExpandedState((prev) => {
      const base = prev.key === key ? prev.map : {};
      return { key, map: { ...base, [i]: !base[i] } };
    });
  }

  // Scroll-progress bar + auto-complete on reaching the end.
  const onScroll = useCallback(() => {
    const doc = document.documentElement;
    const scrollable = doc.scrollHeight - window.innerHeight;
    const pct = scrollable > 0 ? Math.min(1, window.scrollY / scrollable) : 0;
    if (progressBar.current) progressBar.current.style.width = `${pct * 100}%`;
    if (!autoDone.current && scrollable > 60 && pct >= 0.98) {
      autoDone.current = true;
      setComplete(date, studyId, true);
    }
  }, [date, studyId]);

  useEffect(() => {
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [onScroll]);

  const title = content?.heRef ?? content?.ref ?? meta.name;
  const hasText = !!content && content.segments.length > 0;
  const showTargum = extraOn && content?.extra?.kind === "targum";
  const showSteinsaltzVerses = extraOn && content?.extra?.kind === "steinsaltz";

  return (
    <main style={{ "--accent": meta.color } as React.CSSProperties}>
      <div className="scroll-progress" ref={progressBar} />

      <div className="reader-head">
        <div className="reader-topline">
          <div className="date-nav">
            {/* RTL: right glyph = previous day, left glyph = next day */}
            <button aria-label="יום קודם" onClick={() => setDate((d) => addDays(d, -1))}>
              ›
            </button>
            <span>
              {hebrewWeekday(date)} · {hebrewDate(date)}
            </span>
            <button aria-label="יום הבא" onClick={() => setDate((d) => addDays(d, 1))}>
              ‹
            </button>
          </div>
        </div>
        <div className="reader-title">{title}</div>
        <div className="tabs">
          {STUDIES.map((s) => (
            <button
              key={s.id}
              className={`tab${s.id === studyId ? " on" : ""}`}
              style={{ "--accent": s.color } as React.CSSProperties}
              onClick={() => setStudyId(s.id)}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="spinner" />
      ) : !hasText ? (
        <div className="notice">
          אין לימוד זמין להצגה עבור יום זה.
          <br />
          נסה יום אחר או בדוק את החיבור לאינטרנט.
        </div>
      ) : (
        <>
          {meta.extra && content?.extra && (
            <div style={{ padding: "0 18px" }}>
              <button
                className={`extra-toggle${extraOn ? " on" : ""}`}
                onClick={() => setExtraByStudy((m) => ({ ...m, [studyId]: !extraOn }))}
              >
                {extraOn ? "✓ " : ""}
                {content.extra.label}
              </button>
              {showSteinsaltzVerses && (
                <div className="extra-hint">הקש על פסוק כדי לפתוח את הביאור</div>
              )}
            </div>
          )}

          <div className="reader-body">
            {showSteinsaltzVerses
              ? content!.segments.map((seg, i) => {
                  const perush = content!.extra!.segments[i];
                  const open = !!expanded[i];
                  return (
                    <div key={i} className={`pasuk${open ? " open" : ""}`}>
                      <p
                        className={`pasuk-text${perush ? " tappable" : ""}`}
                        onClick={perush ? () => toggleVerse(i) : undefined}
                      >
                        {seg.he}
                        {perush && <span className="pasuk-caret">﹀</span>}
                      </p>
                      {open && perush && (
                        <div className="steinsaltz">
                          <span className="lbl">{content!.extra!.label}</span>
                          <p style={{ margin: 0 }}>{perush.he}</p>
                        </div>
                      )}
                    </div>
                  );
                })
              : showTargum
                ? content!.segments.map((seg, i) => (
                    <div key={i} className="verse">
                      {seg.he}
                      {content!.extra!.segments[i] && (
                        <span className="targum">{content!.extra!.segments[i].he}</span>
                      )}
                    </div>
                  ))
                : content!.segments.map((seg, i) => (
                    <p key={i} className="verse">
                      {seg.he}
                    </p>
                  ))}
          </div>

          <button
            className={`done-btn${done ? " is-done" : ""}`}
            onClick={() => setComplete(date, studyId, !done)}
          >
            {done ? "✓ סומן כהושלם" : "סיימתי"}
          </button>
        </>
      )}
    </main>
  );
}

export default function ReaderPage() {
  return (
    <Suspense fallback={<div className="spinner" />}>
      <ReaderInner />
    </Suspense>
  );
}
