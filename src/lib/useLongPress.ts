"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** How long a press must be held before it counts as a long press. */
export const LONG_PRESS_MS = 450;

/** A drag/scroll further than this cancels the pending long press. */
const MOVE_TOLERANCE = 10;

export interface LongPressBindings {
  onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
  onPointerLeave: () => void;
  onContextMenu: (e: React.MouseEvent<HTMLElement>) => void;
  onClick: () => void;
}

/**
 * Press-and-hold on touch or mouse, with a plain tap falling through to
 * `onClick`. Call it once per screen and spread `bind(value)` onto each
 * element — the value identifies which one was pressed.
 *
 * `pressing` is the value currently being held (for a "holding" visual), and
 * is cleared the moment the long press fires or the press is cancelled.
 */
export function useLongPress<T>(opts: {
  onLongPress: (value: T) => void;
  onClick: (value: T) => void;
  holdMs?: number;
}): { pressing: T | null; bind: (value: T) => LongPressBindings } {
  const { onLongPress, onClick, holdMs = LONG_PRESS_MS } = opts;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  const [pressing, setPressing] = useState<T | null>(null);

  const cancel = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    origin.current = null;
    setPressing(null);
  }, []);

  useEffect(() => cancel, [cancel]); // drop a pending timer on unmount

  const bind = useCallback(
    (value: T): LongPressBindings => ({
      onPointerDown(e) {
        if (e.button !== 0) return; // primary button / touch only
        cancel();
        fired.current = false;
        origin.current = { x: e.clientX, y: e.clientY };
        setPressing(value);
        timer.current = setTimeout(() => {
          timer.current = null;
          origin.current = null;
          fired.current = true;
          setPressing(null);
          if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
            try {
              navigator.vibrate(12); // a nudge where the platform supports it
            } catch {}
          }
          onLongPress(value);
        }, holdMs);
      },
      onPointerMove(e) {
        const from = origin.current;
        if (!from) return;
        if (
          Math.abs(e.clientX - from.x) > MOVE_TOLERANCE ||
          Math.abs(e.clientY - from.y) > MOVE_TOLERANCE
        ) {
          cancel(); // the finger is scrolling, not holding
        }
      },
      onPointerUp: cancel,
      onPointerCancel: cancel,
      onPointerLeave: cancel,
      onContextMenu(e) {
        e.preventDefault(); // holding shouldn't open the platform menu
      },
      onClick() {
        if (fired.current) {
          fired.current = false;
          return; // the hold already handled this press
        }
        onClick(value);
      },
    }),
    [cancel, holdMs, onClick, onLongPress]
  );

  return { pressing, bind };
}
