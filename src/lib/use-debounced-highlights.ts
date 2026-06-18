"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const HIGHLIGHT_DEBOUNCE_AFTER_CLICK_MS = 5000;
const HIGHLIGHT_DEBOUNCE_AFTER_EDIT_MS = 3000;

export function useDebouncedHighlights(hasRemix: boolean) {
  const [highlightsActive, setHighlightsActive] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const showHighlightsNow = useCallback(() => {
    clearTimer();
    setHighlightsActive(true);
  }, [clearTimer]);

  const enterEditMode = useCallback(() => {
    clearTimer();
    setHighlightsActive(false);
  }, [clearTimer]);

  const scheduleHighlights = useCallback(
    (delayMs: number) => {
      setHighlightsActive(false);
      clearTimer();
      timerRef.current = setTimeout(() => {
        setHighlightsActive(true);
        timerRef.current = null;
      }, delayMs);
    },
    [clearTimer]
  );

  const scheduleHighlightsAfterClick = useCallback(() => {
    scheduleHighlights(HIGHLIGHT_DEBOUNCE_AFTER_CLICK_MS);
  }, [scheduleHighlights]);

  const scheduleHighlightsAfterEdit = useCallback(() => {
    scheduleHighlights(HIGHLIGHT_DEBOUNCE_AFTER_EDIT_MS);
  }, [scheduleHighlights]);

  useEffect(() => {
    if (hasRemix) {
      showHighlightsNow();
    } else {
      enterEditMode();
    }
  }, [hasRemix, showHighlightsNow, enterEditMode]);

  useEffect(() => clearTimer, [clearTimer]);

  return {
    highlightsActive: hasRemix && highlightsActive,
    enterEditMode,
    scheduleHighlightsAfterClick,
    scheduleHighlightsAfterEdit,
    showHighlightsNow,
  };
}
