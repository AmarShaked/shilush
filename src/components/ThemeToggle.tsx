"use client";

import { useState } from "react";
import { useHydrated } from "@/lib/useProgress";

type Theme = "light" | "dark";

function currentTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return (document.documentElement.getAttribute("data-theme") as Theme) ?? "light";
}

export default function ThemeToggle() {
  const hydrated = useHydrated();
  const [override, setOverride] = useState<Theme | null>(null);
  // Before hydration we can't read the DOM, so assume light to match SSR.
  const theme: Theme = override ?? (hydrated ? currentTheme() : "light");

  function toggle() {
    const next: Theme = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("shilush:theme", next);
    } catch {}
    setOverride(next);
  }

  return (
    <button
      className="theme-btn"
      onClick={toggle}
      aria-label={theme === "dark" ? "מצב יום" : "מצב לילה"}
    >
      {theme === "dark" ? "☀︎" : "☾"}
    </button>
  );
}
