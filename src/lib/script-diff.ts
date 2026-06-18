import { diffWordsWithSpace } from "diff";

export type RemixedDiffSegment = {
  value: string;
  status: "unchanged" | "changed";
};

export type OriginalDiffSegment = {
  value: string;
  status: "unchanged" | "removed";
};

export type ScriptDiffStats = {
  unchanged: number;
  changed: number;
  removed: number;
};

export type ScriptDiffResult = {
  original: OriginalDiffSegment[];
  remixed: RemixedDiffSegment[];
  stats: ScriptDiffStats;
};

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

const EMPTY_STATS: ScriptDiffStats = { unchanged: 0, changed: 0, removed: 0 };

/**
 * Word-level two-sided diff via LCS alignment (jsdiff).
 * Original: unchanged = kept in remix, removed = dropped from remix.
 * Remixed: unchanged = matches original, changed = added or swapped in.
 */
export function computeScriptDiff(
  original: string,
  remixed: string
): ScriptDiffResult {
  if (!remixed.trim()) {
    return { original: [], remixed: [], stats: EMPTY_STATS };
  }

  if (!original.trim()) {
    return {
      original: [],
      remixed: [{ value: remixed, status: "changed" }],
      stats: { unchanged: 0, changed: countWords(remixed), removed: 0 },
    };
  }

  const changes = diffWordsWithSpace(original, remixed);
  const originalSegments: OriginalDiffSegment[] = [];
  const remixedSegments: RemixedDiffSegment[] = [];
  const stats: ScriptDiffStats = { unchanged: 0, changed: 0, removed: 0 };

  for (const part of changes) {
    if (part.removed) {
      originalSegments.push({ value: part.value, status: "removed" });
      stats.removed += countWords(part.value);
    } else if (part.added) {
      remixedSegments.push({ value: part.value, status: "changed" });
      stats.changed += countWords(part.value);
    } else {
      originalSegments.push({ value: part.value, status: "unchanged" });
      remixedSegments.push({ value: part.value, status: "unchanged" });
      stats.unchanged += countWords(part.value);
    }
  }

  return { original: originalSegments, remixed: remixedSegments, stats };
}
