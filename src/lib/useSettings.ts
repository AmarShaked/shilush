"use client";

import { useSyncExternalStore } from "react";
import { subscribeSettings, getSettingsVersion } from "./settings";

/** Re-renders a component whenever settings (font, studies, theme) change. */
export function useSettingsVersion(): number {
  return useSyncExternalStore(subscribeSettings, getSettingsVersion, () => 0);
}
