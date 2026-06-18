"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  clearRemixSession,
  loadRemixSession,
  saveRemixSession,
  type RemixMeta,
} from "@/lib/remix-persist";
import { addWorkOrderItem } from "@/lib/work-order-persist";
import { computeScriptDiff } from "@/lib/script-diff";
import { useDebouncedHighlights } from "@/lib/use-debounced-highlights";
import {
  HighlightedScript,
  ScriptTextarea,
} from "@/components/RemixedScriptPanel";

type BrandProfile = {
  brand_title: string;
  product_description: string;
  target_audience: string;
};

const DEFAULT_TONE = "conversational, direct, short-form video ad";

function PanelPlaceholder({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-[28rem] items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50/50 px-6 py-12 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/30 dark:text-zinc-400">
      {children}
    </div>
  );
}

export default function RemixPage() {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [remixedScript, setRemixedScript] = useState("");
  const [transcribeNote, setTranscribeNote] = useState<string | null>(null);
  const [remixMeta, setRemixMeta] = useState<RemixMeta | null>(null);
  const [scriptAttempts, setScriptAttempts] = useState<number | null>(null);
  const [scriptTrimmed, setScriptTrimmed] = useState(false);
  const [tone, setTone] = useState(DEFAULT_TONE);
  const [brand, setBrand] = useState<BrandProfile | null>(null);
  const [brandLoading, setBrandLoading] = useState(true);
  const [transcribing, setTranscribing] = useState(false);
  const [remixing, setRemixing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const [editFocus, setEditFocus] = useState<"original" | "remixed" | null>(null);
  const [editCaret, setEditCaret] = useState<number | null>(null);
  const fileInputKey = useRef(0);
  const originalTextareaRef = useRef<HTMLTextAreaElement>(null);
  const remixedTextareaRef = useRef<HTMLTextAreaElement>(null);

  const brandComplete = useMemo(
    () =>
      Boolean(
        brand?.brand_title?.trim() &&
          brand?.product_description?.trim() &&
          brand?.target_audience?.trim()
      ),
    [brand]
  );

  const wordCount = useMemo(
    () => (transcript.trim() ? transcript.trim().split(/\s+/).length : 0),
    [transcript]
  );

  const remixedWordCount = useMemo(
    () => (remixedScript.trim() ? remixedScript.trim().split(/\s+/).length : 0),
    [remixedScript]
  );

  const hasRemix = Boolean(remixedScript.trim());
  const hasTranscript = Boolean(transcript.trim());

  const { highlightsActive, enterEditMode, scheduleHighlightsAfterClick, scheduleHighlightsAfterEdit, showHighlightsNow } =
    useDebouncedHighlights(hasRemix);

  const diffStats = useMemo(() => {
    if (!hasRemix) return null;
    return computeScriptDiff(transcript, remixedScript).stats;
  }, [hasRemix, transcript, remixedScript]);

  useEffect(() => {
    if (highlightsActive) {
      setEditFocus(null);
      setEditCaret(null);
    }
  }, [highlightsActive]);

  function showHighlight(side: "original" | "remixed") {
    if (!hasRemix) return false;
    if (highlightsActive && editFocus === null) return true;
    return editFocus !== null && editFocus !== side;
  }

  function beginEdit(side: "original" | "remixed", caretOffset: number | null = null) {
    enterEditMode();
    setEditCaret(caretOffset);
    setEditFocus(side);
    scheduleHighlightsAfterClick();
  }

  function handleTranscriptChange(value: string) {
    setTranscript(value);
    if (hasRemix) {
      scheduleHighlightsAfterEdit();
    }
  }

  function handleRemixedChange(value: string) {
    setRemixedScript(value);
    scheduleHighlightsAfterEdit();
  }

  useEffect(() => {
    const saved = loadRemixSession();
    const hasSaved =
      saved.transcript.trim() ||
      saved.remixedScript.trim() ||
      saved.transcribeNote ||
      saved.fileName;

    if (hasSaved) {
      setTranscript(saved.transcript);
      setRemixedScript(saved.remixedScript);
      setTone(saved.tone || DEFAULT_TONE);
      setTranscribeNote(saved.transcribeNote);
      setRemixMeta(saved.remixMeta);
      setScriptAttempts(saved.scriptAttempts);
      setScriptTrimmed(saved.scriptTrimmed);
      setFileName(saved.fileName);
      setRestored(true);
    }

    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    saveRemixSession({
      transcript,
      remixedScript,
      tone,
      transcribeNote,
      remixMeta,
      scriptAttempts,
      scriptTrimmed,
      fileName,
    });
  }, [
    hydrated,
    transcript,
    remixedScript,
    tone,
    transcribeNote,
    remixMeta,
    scriptAttempts,
    scriptTrimmed,
    fileName,
  ]);

  useEffect(() => {
    async function loadBrand() {
      try {
        const res = await fetch("/api/brand");
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to load brand profile.");
        }
        if (data.profile) {
          setBrand({
            brand_title: data.profile.brand_title ?? "",
            product_description: data.profile.product_description ?? "",
            target_audience: data.profile.target_audience ?? "",
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load brand.");
      } finally {
        setBrandLoading(false);
      }
    }
    loadBrand();
  }, []);

  const revokeVideoUrl = useCallback(() => {
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }
  }, [videoUrl]);

  useEffect(() => {
    return () => revokeVideoUrl();
  }, [revokeVideoUrl]);

  function clearRemixOutput() {
    setRemixedScript("");
    setRemixMeta(null);
    setScriptAttempts(null);
    setScriptTrimmed(false);
  }

  function handleClearAll() {
    revokeVideoUrl();
    clearRemixSession();
    setFile(null);
    setVideoUrl(null);
    setFileName(null);
    setTranscript("");
    setRemixedScript("");
    setTranscribeNote(null);
    setRemixMeta(null);
    setScriptAttempts(null);
    setScriptTrimmed(false);
    setTone(DEFAULT_TONE);
    setError(null);
    setRestored(false);
    fileInputKey.current += 1;
  }

  function handleFileChange(selected: File | null) {
    revokeVideoUrl();
    setFile(selected);
    setVideoUrl(selected ? URL.createObjectURL(selected) : null);
    setFileName(selected?.name ?? null);
    setTranscript("");
    clearRemixOutput();
    setTranscribeNote(null);
    setError(null);
    setRestored(false);
  }

  async function handleTranscribe() {
    if (!file) {
      setError("Select an MP4 file first.");
      return;
    }

    setTranscribing(true);
    setError(null);
    setTranscribeNote(null);
    clearRemixOutput();

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/transcribe", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Transcription failed.");
      }

      setTranscript(data.transcript || "");
      setFileName(file.name);

      const sizeLabel = `${data.file_size_mb} MB`;
      if (data.used_audio) {
        setTranscribeNote(
          `File is ${sizeLabel} (over 24 MB). Audio was extracted before sending to Whisper.`
        );
      } else {
        setTranscribeNote(
          `File is ${sizeLabel}. Video was sent directly to Whisper.`
        );
      }

      if (!data.transcript) {
        setError("Transcription returned empty. Check the audio in your video.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transcription failed.");
    } finally {
      setTranscribing(false);
    }
  }

  async function handleRemix() {
    if (!transcript.trim()) {
      setError("Transcribe the video first so there is a script to remix.");
      return;
    }

    if (!brandComplete) {
      setError("Complete your brand profile before remixing.");
      return;
    }

    setRemixing(true);
    setError(null);
    clearRemixOutput();

    try {
      const res = await fetch("/api/rewrite-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: transcript.trim(), tone }),
      });
      const data = await res.json();

      if (!res.ok) {
        const detail =
          data.issues?.length > 0
            ? `${data.message || data.error}\n${data.issues.join("\n")}`
            : data.error || data.message || "Remix failed.";
        throw new Error(detail);
      }

      setRemixedScript(data.full_script || "");
      setRemixMeta(data.meta ?? null);
      setScriptAttempts(data.script_attempts ?? null);
      setScriptTrimmed(Boolean(data.script_trimmed));
      showHighlightsNow();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remix failed.");
    } finally {
      setRemixing(false);
    }
  }

  const isBusy = transcribing || remixing;
  const canAddToWorkOrder = hasRemix && Boolean(fileName?.trim());
  const hasSession =
    hasTranscript ||
    hasRemix ||
    Boolean(file) ||
    Boolean(fileName);

  function handleAddToWorkOrder() {
    if (!canAddToWorkOrder) {
      setError(
        fileName?.trim()
          ? "Remix a script first."
          : "Upload and transcribe a video so the reference filename is saved for your team."
      );
      return;
    }

    const result = addWorkOrderItem({
      script: remixedScript,
      videoFileName: fileName!.trim(),
    });

    if ("error" in result) {
      setError(result.error);
      return;
    }

    setError(null);
    router.push("/work-orders");
  }

  if (!hydrated) {
    return (
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <p className="text-sm text-zinc-500">Loading session…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Remix</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Upload, transcribe, then brand-swap the script.
          </p>
          {restored && hasSession && (
            <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
              Restored your last session.
            </p>
          )}
        </div>
        {hasSession && (
          <button
            type="button"
            onClick={handleClearAll}
            disabled={isBusy}
            className="shrink-0 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-200 dark:hover:bg-red-950/40"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Brand strip */}
      <section className="mb-6 rounded-xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1 text-sm">
            {brandLoading ? (
              <span className="text-zinc-500">Loading brand…</span>
            ) : brandComplete ? (
              <span>
                <span className="font-medium">{brand?.brand_title}</span>
                <span className="mx-2 text-zinc-400">·</span>
                <span className="text-zinc-600 dark:text-zinc-400">
                  {brand?.target_audience}
                </span>
              </span>
            ) : (
              <span className="text-amber-800 dark:text-amber-200">
                Brand profile incomplete —{" "}
                <Link href="/brand" className="underline">
                  set up first
                </Link>
              </span>
            )}
          </div>
          <Link
            href="/brand"
            className="shrink-0 text-xs font-medium text-zinc-600 underline dark:text-zinc-400"
          >
            Edit brand
          </Link>
        </div>
      </section>

      {/* Workspace — fixed zones, stable layout */}
      <div className="space-y-6">
        {/* Zone 1: Video — fixed size, always same footprint */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Video
          </h2>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="w-full shrink-0 sm:w-80">
              <div className="overflow-hidden rounded-xl border border-zinc-200 bg-black dark:border-zinc-700">
                <div className="relative aspect-video w-full">
                  {videoUrl ? (
                    <video
                      src={videoUrl}
                      controls
                      className="absolute inset-0 h-full w-full object-contain"
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center text-sm text-zinc-500">
                      <span>No video</span>
                      {fileName && (
                        <span className="text-xs text-zinc-600">
                          {fileName} — re-upload to preview
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <input
                key={fileInputKey.current}
                type="file"
                accept="video/mp4"
                disabled={isBusy}
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-zinc-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-zinc-700 dark:file:bg-zinc-100 dark:file:text-zinc-900"
              />

              <button
                type="button"
                onClick={handleTranscribe}
                disabled={!file || transcribing || remixing}
                className="w-fit rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                {transcribing ? "Transcribing…" : "Transcribe"}
              </button>

              {transcribeNote && (
                <p className="text-xs text-zinc-500">{transcribeNote}</p>
              )}
            </div>
          </div>
        </section>

        {/* Zone 2: Scripts — always two columns, content fills in place */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Scripts
            </h2>
            {hasRemix && (
              <div className="flex flex-wrap gap-2">
                {remixMeta && remixMeta.length_validation_enforced !== false && (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                    {remixMeta.total_word_min}–{remixMeta.total_word_max} words
                  </span>
                )}
                {diffStats && highlightsActive && (
                  <>
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                      {diffStats.unchanged} kept
                    </span>
                    {diffStats.removed > 0 && (
                      <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
                        {diffStats.removed} removed
                      </span>
                    )}
                    <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
                      {diffStats.changed} changed
                    </span>
                  </>
                )}
                {scriptAttempts !== null && (
                  <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                    {scriptAttempts} attempt{scriptAttempts === 1 ? "" : "s"}
                  </span>
                )}
                {scriptTrimmed && (
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                    Trimmed
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 items-stretch gap-5 md:grid-cols-2">
            {/* Left column */}
            <div className="flex flex-1 flex-col gap-2">
              <div className="flex h-8 shrink-0 items-center justify-between px-1">
                <h3 className="text-sm font-medium leading-none text-zinc-900 dark:text-zinc-100">
                  Original
                </h3>
                {wordCount > 0 && (
                  <span className="text-xs leading-none text-zinc-500">
                    {wordCount} words
                  </span>
                )}
              </div>
              {hasTranscript || transcribing ? (
                showHighlight("original") ? (
                  <HighlightedScript
                    side="original"
                    original={transcript}
                    remixed={remixedScript}
                    onEditStart={(caret) => beginEdit("original", caret)}
                  />
                ) : (
                  <ScriptTextarea
                    side="original"
                    value={transcript}
                    onChange={handleTranscriptChange}
                    disabled={transcribing || remixing}
                    placeholder={transcribing ? "Transcribing…" : undefined}
                    inputRef={originalTextareaRef}
                    autoFocus={editFocus === "original"}
                    initialCaret={editFocus === "original" ? editCaret : null}
                  />
                )
              ) : (
                <PanelPlaceholder>
                  Transcript will appear here after you transcribe.
                </PanelPlaceholder>
              )}
            </div>

            {/* Right column */}
            <div className="flex flex-1 flex-col gap-2">
              <div className="flex h-8 shrink-0 items-center justify-between gap-2 px-1">
                <h3 className="text-sm font-medium leading-none text-emerald-800 dark:text-emerald-200">
                  Remixed
                </h3>
                {remixedWordCount > 0 && (
                  <span className="shrink-0 text-xs leading-none text-emerald-700 dark:text-emerald-300">
                    {remixedWordCount} words
                  </span>
                )}
              </div>
              {remixing ? (
                <PanelPlaceholder>
                  <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
                  <span className="mt-3 block">Rewriting script…</span>
                </PanelPlaceholder>
              ) : hasRemix ? (
                showHighlight("remixed") ? (
                  <HighlightedScript
                    side="remixed"
                    original={transcript}
                    remixed={remixedScript}
                    onEditStart={(caret) => beginEdit("remixed", caret)}
                  />
                ) : (
                  <ScriptTextarea
                    side="remixed"
                    value={remixedScript}
                    onChange={handleRemixedChange}
                    inputRef={remixedTextareaRef}
                    autoFocus={editFocus === "remixed"}
                    initialCaret={editFocus === "remixed" ? editCaret : null}
                  />
                )
              ) : (
                <PanelPlaceholder>
                  {hasTranscript
                    ? "Click Remix below to generate your brand version."
                    : "Your remixed script will appear here."}
                </PanelPlaceholder>
              )}
            </div>
          </div>
        </section>

        {/* Zone 3: Actions — fixed bar, always in same spot */}
        <section className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="min-w-[12rem] flex-1">
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500">
                Tone / voice
              </label>
              <input
                type="text"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                disabled={remixing}
                placeholder="conversational, direct, TikTok-native"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400 dark:border-zinc-700 dark:bg-zinc-950"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleRemix}
                disabled={!hasTranscript || !brandComplete || remixing}
                className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {remixing ? "Remixing…" : hasRemix ? "Re-remix" : "Remix"}
              </button>

              {hasRemix && (
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(remixedScript)}
                  className="rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:bg-zinc-900"
                >
                  Copy remixed
                </button>
              )}

              {hasRemix && (
                <button
                  type="button"
                  onClick={handleAddToWorkOrder}
                  disabled={!canAddToWorkOrder || isBusy}
                  title={
                    fileName?.trim()
                      ? "Add this script to your work order batch"
                      : "Upload a video first so the filename is saved for your team"
                  }
                  className="rounded-lg border border-violet-300 bg-violet-50 px-4 py-2.5 text-sm font-medium text-violet-900 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-100 dark:hover:bg-violet-950/60"
                >
                  Add to work order batch
                </button>
              )}
            </div>
          </div>
        </section>

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm whitespace-pre-wrap text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </div>
        )}
      </div>
    </main>
  );
}
