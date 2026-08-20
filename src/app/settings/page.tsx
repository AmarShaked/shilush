"use client";

import { STUDIES } from "@/lib/studies";
import {
  getSettings,
  setFontScale,
  setStudyEnabled,
  setFont,
  getTheme,
  setTheme,
  FONTS,
  FONT_MIN,
  FONT_MAX,
  FONT_STEP,
} from "@/lib/settings";
import { useSettingsVersion } from "@/lib/useSettings";
import { useHydrated } from "@/lib/useProgress";

export default function SettingsPage() {
  useSettingsVersion();
  const hydrated = useHydrated();
  const settings = getSettings();
  const theme = hydrated ? getTheme() : "light";
  const enabledCount = STUDIES.filter((s) => settings.studies[s.id]).length;

  const pct = Math.round(settings.fontScale * 100);

  return (
    <main className="page-pad">
      <div className="greeting" style={{ fontSize: 20, color: "var(--ink)", marginBottom: 4 }}>
        הגדרות
      </div>

      {/* Theme */}
      <div className="settings-group">
        <span className="label">מראה</span>
        <div className="setting-row">
          <div>
            <div className="row-title">ערכת נושא</div>
            <div className="row-sub">בהיר או כהה</div>
          </div>
          <div className="segmented">
            <button className={theme === "light" ? "on" : ""} onClick={() => setTheme("light")}>
              ☀︎ יום
            </button>
            <button className={theme === "dark" ? "on" : ""} onClick={() => setTheme("dark")}>
              ☾ לילה
            </button>
          </div>
        </div>
      </div>

      {/* Font size */}
      <div className="settings-group">
        <span className="label">גודל טקסט</span>
        <div className="setting-row">
          <div>
            <div className="row-title">גודל הטקסט בלימוד</div>
            <div className="row-sub">גודל האותיות במסך הקריאה</div>
          </div>
          <div className="font-stepper">
            <button
              aria-label="הקטן"
              disabled={settings.fontScale <= FONT_MIN + 0.001}
              onClick={() => setFontScale(settings.fontScale - FONT_STEP)}
            >
              −
            </button>
            <span className="val">{pct}%</span>
            <button
              aria-label="הגדל"
              disabled={settings.fontScale >= FONT_MAX - 0.001}
              onClick={() => setFontScale(settings.fontScale + FONT_STEP)}
            >
              +
            </button>
          </div>
        </div>
        <div className="font-preview">בְּרֵאשִׁית בָּרָא אֱלֹהִים אֵת הַשָּׁמַיִם וְאֵת הָאָרֶץ.</div>
      </div>

      {/* Font family */}
      <div className="settings-group">
        <span className="label">גופן</span>
        {FONTS.map((f) => (
          <button
            key={f.key}
            className={`setting-row font-option${settings.font === f.key ? " selected" : ""}`}
            onClick={() => setFont(f.key)}
            style={{ fontFamily: f.css }}
          >
            <div>
              <div className="row-title">{f.label}</div>
              <div className="row-sub" style={{ fontFamily: f.css, fontSize: 15 }}>
                אֵת הַשָּׁמַיִם וְאֵת הָאָרֶץ
              </div>
            </div>
            {settings.font === f.key && <span style={{ color: "var(--gold)", fontSize: 18 }}>✓</span>}
          </button>
        ))}
      </div>

      {/* Studies */}
      <div className="settings-group">
        <span className="label">לימודים יומיים</span>
        {STUDIES.map((s) => {
          const on = settings.studies[s.id];
          const lastOne = on && enabledCount === 1;
          return (
            <div className="setting-row" key={s.id}>
              <div>
                <div className="row-title" style={{ color: on ? "var(--ink)" : "var(--faint)" }}>
                  {s.name}
                </div>
                <div className="row-sub">{lastOne ? "חייב להישאר לימוד אחד לפחות" : on ? "פעיל" : "כבוי"}</div>
              </div>
              <button
                className={`switch${on ? " on" : ""}`}
                aria-label={on ? "כבה" : "הפעל"}
                disabled={lastOne}
                onClick={() => setStudyEnabled(s.id, !on)}
                style={lastOne ? { opacity: 0.6 } : undefined}
              />
            </div>
          );
        })}
      </div>

      <footer className="credit">
        נבנה על ידי <a href="mailto:shakedamar@gmail.com">עמר שקד</a>
      </footer>
    </main>
  );
}
