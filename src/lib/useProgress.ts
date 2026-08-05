"use client";

import { useSyncExternalStore } from "react";
import { subscribe, getVersion } from "./progressStore";

// Re-renders a component whenever progress changes. Components then read the
// specific values they need directly from progressStore.
export function useProgressVersion(): number {
  return useSyncExternalStore(subscribe, getVersion, () => 0);
}

const noopSubscribe = () => () => {};

// Returns false during SSR / first render, true once hydrated on the client.
// Lets components safely read localStorage-backed values without a hydration
// mismatch — and without calling setState inside an effect.
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}
