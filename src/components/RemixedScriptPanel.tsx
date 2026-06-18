"use client";

import { useEffect, useMemo, useRef } from "react";
import { getCaretOffsetFromPoint } from "@/lib/caret-from-point";
import { computeScriptDiff } from "@/lib/script-diff";

export const SCRIPT_BOX_CLASS =
  "min-h-[28rem] w-full rounded-xl border px-4 py-3 font-mono text-sm leading-relaxed";

export const SCRIPT_EDIT_CLASS =
  "resize-none overflow-hidden text-zinc-900 outline-none focus:ring-2 dark:text-zinc-100";

function focusTextareaAtCaret(el: HTMLTextAreaElement, caret: number | null) {
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;

  el.focus({ preventScroll: true });

  if (caret != null) {
    const pos = Math.min(Math.max(0, caret), el.value.length);
    el.setSelectionRange(pos, pos);
  }

  const restoreScroll = () => {
    window.scrollTo(scrollX, scrollY);
  };

  restoreScroll();
  requestAnimationFrame(() => {
    fitTextareaToContent(el);
    restoreScroll();
  });
}

function fitTextareaToContent(el: HTMLTextAreaElement) {
  const { selectionStart, selectionEnd } = el;
  el.style.overflow = "hidden";
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
  if (document.activeElement === el) {
    el.setSelectionRange(selectionStart, selectionEnd);
  }
}

type HighlightedScriptProps = {
  original: string;
  remixed: string;
  side: "original" | "remixed";
  onEditStart: (caretOffset: number | null) => void;
};

export function HighlightedScript({
  original,
  remixed,
  side,
  onEditStart,
}: HighlightedScriptProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const segments = useMemo(() => {
    const diff = computeScriptDiff(original, remixed);
    return side === "original" ? diff.original : diff.remixed;
  }, [original, remixed, side]);

  const isOriginal = side === "original";

  return (
    <div
      ref={containerRef}
      role="textbox"
      tabIndex={0}
      onMouseDown={(e) => {
        e.preventDefault();
        const offset = containerRef.current
          ? getCaretOffsetFromPoint(containerRef.current, e.clientX, e.clientY)
          : null;
        onEditStart(offset);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onEditStart(null);
        }
      }}
      className={`${SCRIPT_BOX_CLASS} flex-1 cursor-text ${
        isOriginal
          ? "border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-950"
          : "border-emerald-400/60 bg-emerald-50/40 dark:border-emerald-800 dark:bg-emerald-950/20"
      }`}
    >
      <div className="whitespace-pre-wrap">
        {segments.map((segment, index) => (
          <span
            key={`${index}-${segment.value.slice(0, 12)}`}
            className={
              segment.status === "unchanged"
                ? "text-emerald-800 dark:text-emerald-300"
                : isOriginal
                  ? "font-medium text-red-600 line-through decoration-red-500/80 dark:text-red-400 dark:decoration-red-400/80"
                  : "font-medium text-red-600 dark:text-red-400"
            }
          >
            {segment.value}
          </span>
        ))}
      </div>
    </div>
  );
}

type ScriptTextareaProps = {
  value: string;
  onChange: (value: string) => void;
  side: "original" | "remixed";
  disabled?: boolean;
  placeholder?: string;
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
  autoFocus?: boolean;
  initialCaret?: number | null;
};

export function ScriptTextarea({
  value,
  onChange,
  side,
  disabled,
  placeholder,
  inputRef,
  autoFocus,
  initialCaret,
}: ScriptTextareaProps) {
  const isOriginal = side === "original";
  const initialCaretAppliedRef = useRef(false);

  useEffect(() => {
    if (!autoFocus) {
      initialCaretAppliedRef.current = false;
    }
  }, [autoFocus]);

  // Apply click position once when entering edit — not on every keystroke.
  useEffect(() => {
    const el = inputRef?.current;
    if (!el || !autoFocus || initialCaretAppliedRef.current) return;

    focusTextareaAtCaret(el, initialCaret ?? null);
    initialCaretAppliedRef.current = true;
  }, [autoFocus, initialCaret, inputRef]);

  // Resize as content grows without resetting the caret.
  useEffect(() => {
    const el = inputRef?.current;
    if (!el) return;

    requestAnimationFrame(() => {
      fitTextareaToContent(el);
    });
  }, [value, inputRef]);

  return (
    <textarea
      ref={inputRef}
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
        fitTextareaToContent(e.target);
      }}
      disabled={disabled}
      placeholder={placeholder}
      className={`${SCRIPT_BOX_CLASS} flex-1 ${SCRIPT_EDIT_CLASS} ${
        isOriginal
          ? "border-zinc-300 bg-white focus:ring-zinc-500/20 dark:border-zinc-700 dark:bg-zinc-950"
          : "border-emerald-400/60 bg-white focus:ring-emerald-500/30 dark:border-emerald-800 dark:bg-zinc-950"
      }`}
    />
  );
}
