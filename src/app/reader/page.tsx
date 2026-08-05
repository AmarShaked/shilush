"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { STUDIES, getStudy, isStudyId } from "@/lib/studies";
import { todayISO, addDays, hebrewWeekday, hebrewDate, hebrewNumeral } from "@/lib/dates";
import { isComplete, setComplete } from "@/lib/progressStore";
import { getEnabledStudyIds } from "@/lib/settings";
import { useProgressVersion, useHydrated } from "@/lib/useProgress";
import { useSettingsVersion } from "@/lib/useSettings";
import type { Segment, StudyContent, StudyId } from "@/lib/types";

function VerseNum({ seg }: { seg: Segment }) {
  if (seg.num == null) return null;
  return <span className="pnum">{hebrewNumeral(seg.num, false)}</span>;
}

function ReaderInner() {
  const params = useSearchParams();
  const initialId = params.get("id") ?? "daf";
  const initialDate = params.get("date") ?? todayISO();

  const [date, setDate] = useState(initialDate);
  const [studyId, setStudyId] = useState<StudyId>(isStudyId(initialId) ? initialId : "daf");
  const [loaded, setLoaded] = useState<{ key: string; data: StudyContent } | null>(null);
  // Expanded Steinsaltz pesukim, keyed "sectionIndex:verseIndex", scoped to current day+study.
  const [expandedState, setExpandedState] = useState<{ key: string; map: Record<string, boolean> }>({
    key: "",
    map: {},
  });

  useProgressVersion();
  const settingsVersion = useSettingsVersion();
  const hydrated = useHydrated();
  // Only enabled studies are shown; if the URL points at a disabled one, fall
  // back to the first enabled study. Before hydration, assume all enabled (SSR).
  const enabledIds = useMemo(
    () => (hydrated ? getEnabledStudyIds() : STUDIES.map((s) => s.id)),
    // settingsVersion is the signal that the enabled set changed in localStorage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hydrated, settingsVersion]
  );
  const activeId = useMemo<StudyId>(
    () => (enabledIds.includes(studyId) ? studyId : enabledIds[0] ?? studyId),
    [enabledIds, studyId]
  );
  const meta = getStudy(activeId)!;

  const progressBar = useRef<HTMLDivElement>(null);
  const autoDone = useRef(false);

  useEffect(() => {
    window.history.replaceState(null, "", `/reader?date=${date}&id=${activeId}`);
  }, [date, activeId]);

  useEffect(() => {
    const key = `${date}:${activeId}`;
    let alive = true;
    autoDone.current = false;
    window.scrollTo(0, 0);
    if (progressBar.current) progressBar.current.style.width = "0%";

    const wantExtra = !!getStudy(activeId)!.extra;
    fetch(`/api/study?date=${date}&id=${activeId}&extra=${wantExtra ? 1 : 0}`)
      .then((r) => r.json())
      .then((c: StudyContent) => {
        if (alive) setLoaded({ key, data: c });
      })
      .catch(() => {
        if (!alive) return;
        const m = getStudy(activeId)!;
        setLoaded({
          key,
          data: { id: activeId, name: m.name, color: m.color, ref: null, heRef: null, sections: [] },
        });
      });
    return () => {
      alive = false;
    };
  }, [date, activeId]);

  const key = `${date}:${activeId}`;
  const loading = !loaded || loaded.key !== key;
  const content = loading ? null : loaded!.data;
  const done = isComplete(date, activeId);

  const expanded = expandedState.key === key ? expandedState.map : {};
  function toggleVerse(vk: string) {
    setExpandedState((prev) => {
      const base = prev.key === key ? prev.map : {};
      return { key, map: { ...base, [vk]: !base[vk] } };
    });
  }

  const onScroll = useCallback(() => {
    const doc = document.documentElement;
    const scrollable = doc.scrollHeight - window.innerHeight;
    const pct = scrollable > 0 ? Math.min(1, window.scrollY / scrollable) : 0;
    if (progressBar.current) progressBar.current.style.width = `${pct * 100}%`;
    if (!autoDone.current && scrollable > 60 && pct >= 0.98) {
      autoDone.current = true;
      setComplete(date, activeId, true);
    }
  }, [date, activeId]);

  useEffect(() => {
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [onScroll]);

  const sections = content?.sections ?? [];
  const hasText = sections.some((s) => s.segments.length > 0);
  const title = content?.heRef ?? content?.ref ?? meta.name;
  const isTargum = meta.extra === "targum";
  const isSteinsaltz = meta.extra === "steinsaltz";
  const showHeadings = meta.numbered || sections.length > 1;

  return (
    <main style={{ "--accent": meta.color } as React.CSSProperties}>
      <div className="scroll-progress" ref={progressBar} />

      <div className="reader-head">
        <div className="reader-topline">
          <div className="date-nav">
            {/* RTL: right button = previous day, left button = next day */}
            <button aria-label="יום קודם" onClick={() => setDate((d) => addDays(d, -1))}>
              ‹
            </button>
            <span>
              {hebrewWeekday(date)} · {hebrewDate(date)}
            </span>
            <button aria-label="יום הבא" onClick={() => setDate((d) => addDays(d, 1))}>
              ›
            </button>
          </div>
        </div>
        <div className="reader-title">{title}</div>
        <div className="tabs">
          {STUDIES.filter((s) => enabledIds.includes(s.id)).map((s) => (
            <button
              key={s.id}
              className={`tab${s.id === activeId ? " on" : ""}`}
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
          <div className="reader-body">
            {sections.map((sec, si) => (
              <section key={si}>
                {showHeadings && sec.heRef && <h2 className="chapter-heading">{sec.heRef}</h2>}

                {isSteinsaltz
                  ? sec.segments.map((seg, i) => {
                      const perush = sec.extra?.segments[i];
                      const vk = `${si}:${i}`;
                      const open = !!expanded[vk];
                      return (
                        <div key={i} className={`pasuk${open ? " open" : ""}`}>
                          <p
                            className={`pasuk-text${perush ? " tappable" : ""}`}
                            onClick={perush ? () => toggleVerse(vk) : undefined}
                          >
                            <VerseNum seg={seg} />
                            {seg.he}
                          </p>
                          {open && perush && (
                            <div className="steinsaltz">
                              <span className="lbl">{sec.extra!.label}</span>
                              <p style={{ margin: 0 }}>{perush.he}</p>
                            </div>
                          )}
                        </div>
                      );
                    })
                  : isTargum
                    ? sec.segments.map((seg, i) => (
                        <div key={i} className="smt-verse">
                          {/* Shnayim Mikra: read the pasuk twice, then Targum once. */}
                          <p className="verse">
                            <VerseNum seg={seg} />
                            {seg.he}
                          </p>
                          <p className="verse verse-repeat">{seg.he}</p>
                          {sec.extra?.segments[i] && (
                            <span className="targum">{sec.extra.segments[i].he}</span>
                          )}
                        </div>
                      ))
                    : sec.segments.map((seg, i) => (
                        <p key={i} className="verse">
                          <VerseNum seg={seg} />
                          {seg.he}
                        </p>
                      ))}
              </section>
            ))}
          </div>

          <button
            className={`done-btn${done ? " is-done" : ""}`}
            onClick={() => setComplete(date, activeId, !done)}
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
