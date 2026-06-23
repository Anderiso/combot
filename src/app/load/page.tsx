"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase/client";
import {
  clearLoadSession,
  loadLoadSession,
  saveLoadSession,
} from "@/lib/load-persist";
import {
  LIBRARY_VIDEO_MAX_MB,
  libraryVideoSizeError,
  supabaseStorageSizeError,
} from "@/lib/upload-limits";
import { videoFileName, videoStoragePath } from "@/lib/slug";
import type { FunnelStage } from "@/lib/database.types";
import { FUNNEL_STAGES, SLOT_LIMITS, STAGE_LABELS } from "@/lib/funnel";
import { readApiJson } from "@/lib/api-response";
import { createTranscribeTempPath } from "@/lib/transcribe-temp";

export default function LoadPage() {
  const [hydrated, setHydrated] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [transcribeNote, setTranscribeNote] = useState<string | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [funnelStage, setFunnelStage] = useState<FunnelStage>("TMOF");
  const [nextSlot, setNextSlot] = useState<number | null>(null);
  const [stageFull, setStageFull] = useState(false);
  const [slotLoading, setSlotLoading] = useState(false);
  const [aiRecommendation, setAiRecommendation] = useState<{
    funnel_stage: FunnelStage;
    explanation: string;
  } | null>(null);
  const [classifying, setClassifying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [savedSummary, setSavedSummary] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const fileInputKey = useRef(0);

  const loadNextSlot = useCallback(async (stage: FunnelStage) => {
    setSlotLoading(true);
    try {
      const res = await fetch(`/api/concepts/next-slot?funnel_stage=${stage}`);
      const data = await readApiJson<{
        error?: string;
        next_number: number | null;
        full?: boolean;
      }>(res);

      if (!res.ok) {
        throw new Error(data.error || "Could not load next slot.");
      }

      setNextSlot(data.next_number);
      setStageFull(Boolean(data.full));
    } catch {
      setNextSlot(null);
      setStageFull(false);
    } finally {
      setSlotLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNextSlot(funnelStage);
  }, [funnelStage, loadNextSlot]);

  useEffect(() => {
    const saved = loadLoadSession();
    const hasSaved =
      saved.transcript.trim() ||
      saved.title.trim() ||
      saved.description.trim() ||
      saved.transcribeNote ||
      saved.aiRecommendation ||
      saved.fileName;

    if (hasSaved) {
      setTranscript(saved.transcript);
      setTranscribeNote(saved.transcribeNote);
      setTitle(saved.title);
      setDescription(saved.description);
      setFunnelStage(saved.funnelStage);
      setAiRecommendation(saved.aiRecommendation);
      setFileName(saved.fileName);
      setRestored(true);
    }

    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    saveLoadSession({
      transcript,
      transcribeNote,
      title,
      description,
      funnelStage,
      aiRecommendation,
      fileName,
    });
  }, [
    hydrated,
    transcript,
    transcribeNote,
    title,
    description,
    funnelStage,
    aiRecommendation,
    fileName,
  ]);

  function handleFileChange(selected: File | null) {
    setFile(selected);
    setFileName(selected?.name ?? null);
    setTranscript("");
    setTranscribeNote(null);
    setAiRecommendation(null);
    setError(null);
    setSavedId(null);
    setSavedSummary(null);
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
    setAiRecommendation(null);

    const tempPath = createTranscribeTempPath();
    const supabase = createBrowserClient();

    try {
      const { error: uploadError } = await supabase.storage
        .from("videos")
        .upload(tempPath, file, {
          contentType: "video/mp4",
          upsert: false,
        });

      if (uploadError) {
        const message = uploadError.message.includes("maximum allowed size")
          ? supabaseStorageSizeError(file)
          : `Upload failed: ${uploadError.message}`;
        throw new Error(message);
      }

      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storage_path: tempPath }),
      });
      const data = await readApiJson<{
        error?: string;
        transcript?: string;
        used_audio?: boolean;
        file_size_mb?: number;
      }>(res);

      if (!res.ok) {
        throw new Error(data.error || "Transcription failed.");
      }

      setTranscript(data.transcript || "");
      if (file) {
        setFileName(file.name);
      }

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
      await supabase.storage.from("videos").remove([tempPath]).catch(() => undefined);
      setTranscribing(false);
    }
  }

  async function handleClassify() {
    if (!transcript.trim()) {
      setError("Transcribe the video first so there is a script to analyze.");
      return;
    }

    setClassifying(true);
    setError(null);

    try {
      const res = await fetch("/api/classify-funnel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      const data = await readApiJson<{
        error?: string;
        funnel_stage: FunnelStage;
        explanation: string;
      }>(res);

      if (!res.ok) {
        throw new Error(data.error || "Could not get recommendation.");
      }

      setAiRecommendation({
        funnel_stage: data.funnel_stage,
        explanation: data.explanation,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Classification failed.");
    } finally {
      setClassifying(false);
    }
  }

  function applyRecommendation() {
    if (aiRecommendation) {
      setFunnelStage(aiRecommendation.funnel_stage);
    }
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSavedId(null);
    setSavedSummary(null);

    if (!file) {
      setError(
        fileName
          ? "Re-select your MP4 file — the video cannot be kept after you leave this page."
          : "Select an MP4 file."
      );
      return;
    }

    const sizeError = libraryVideoSizeError(file);
    if (sizeError) {
      setError(sizeError);
      return;
    }

    if (!transcript.trim()) {
      setError("Transcribe the video first and verify the script.");
      return;
    }

    if (!title.trim()) {
      setError("Title is required.");
      return;
    }

    if (stageFull || nextSlot === null) {
      setError(`${STAGE_LABELS[funnelStage]} is full. Delete a concept to free a slot.`);
      return;
    }

    setSaving(true);

    try {
      setSaveProgress(`Assigning ${funnelStage} slot #${nextSlot}…`);

      const storagePath = videoStoragePath(funnelStage, nextSlot, title);
      const supabase = createBrowserClient();

      setSaveProgress(`Uploading video to ${funnelStage} slot #${nextSlot}…`);

      const { error: uploadError } = await supabase.storage
        .from("videos")
        .upload(storagePath, file, {
          contentType: "video/mp4",
          upsert: false,
        });

      if (uploadError) {
        const message = uploadError.message.includes("maximum allowed size")
          ? supabaseStorageSizeError(file)
          : `Upload failed: ${uploadError.message}`;
        throw new Error(message);
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("videos").getPublicUrl(storagePath);

      setSaveProgress("Saving to library…");

      const saveRes = await fetch("/api/concepts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          funnel_stage: funnelStage,
          number: nextSlot,
          title: title.trim(),
          description: description.trim(),
          transcript: transcript.trim(),
          video_url: publicUrl,
          video_path: storagePath,
        }),
      });

      const saveData = await readApiJson<{ error?: string; concept?: { id: string } }>(
        saveRes
      );

      if (!saveRes.ok || !saveData.concept) {
        await supabase.storage.from("videos").remove([storagePath]);
        throw new Error(saveData.error || "Failed to save concept.");
      }

      setSavedId(saveData.concept.id);
      setSavedSummary(`${funnelStage} #${nextSlot} — ${title.trim()}`);
      setSaveProgress("");
      clearLoadSession();
      setFile(null);
      setFileName(null);
      setTranscript("");
      setTranscribeNote(null);
      setTitle("");
      setDescription("");
      setFunnelStage("TMOF");
      setAiRecommendation(null);
      setRestored(false);
      fileInputKey.current += 1;
      loadNextSlot("TMOF");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
      setSaveProgress("");
    } finally {
      setSaving(false);
    }
  }

  const isBusy = transcribing || classifying || saving;

  if (!hydrated) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <p className="text-sm text-zinc-500">Loading session…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Load concept</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Upload a video, transcribe and verify the script, set funnel stage, then save.
          Library videos must be {LIBRARY_VIDEO_MAX_MB} MB or smaller.
        </p>
        {restored && (transcript.trim() || title.trim() || fileName) && (
          <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
            Restored your last session.
            {fileName && !file && (
              <>
                {" "}
                Re-select <span className="font-medium">{fileName}</span> to save.
              </>
            )}
          </p>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Step 1: Video + transcribe */}
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            1. Video
          </h2>
          <input
            key={fileInputKey.current}
            type="file"
            accept="video/mp4"
            disabled={isBusy}
            onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-zinc-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-zinc-700 dark:file:bg-zinc-100 dark:file:text-zinc-900"
          />
          {fileName && !file && (
            <p className="text-xs text-zinc-500">
              Last file: <span className="font-medium">{fileName}</span> — re-upload to
              transcribe again or save.
            </p>
          )}
          {file && libraryVideoSizeError(file) && (
            <p className="text-xs text-amber-800 dark:text-amber-200">
              {libraryVideoSizeError(file)} You can still transcribe, but saving to the
              library will fail until the file is smaller.
            </p>
          )}
          <button
            type="button"
            onClick={handleTranscribe}
            disabled={!file || transcribing || saving}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            {transcribing ? "Transcribing…" : "Transcribe"}
          </button>
        </section>

        {/* Script — shown above title/description */}
        {(transcript || transcribing) && (
          <section className="space-y-2">
            <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Script
            </h2>
            {transcribeNote && (
              <p className="text-xs text-zinc-500">{transcribeNote}</p>
            )}
            <textarea
              rows={8}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              disabled={transcribing || saving}
              placeholder={transcribing ? "Transcribing…" : "Transcript will appear here…"}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
            />
            <p className="text-xs text-zinc-500">
              Edit the script if Whisper got anything wrong.
            </p>
          </section>
        )}

        {/* Step 2: Metadata */}
        <section className="space-y-4">
          <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            2. Details
          </h2>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Title</label>
            <input
              type="text"
              required
              disabled={saving}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
            />
            {title.trim() && nextSlot !== null && !stageFull && (
              <p className="mt-1.5 text-xs text-zinc-500">
                Video will save as{" "}
                <span className="font-mono font-medium text-zinc-700 dark:text-zinc-300">
                  {videoFileName(title.trim(), nextSlot)}
                </span>{" "}
                in {funnelStage} (from this title, not your upload filename).
              </p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Description (visual notes)
            </label>
            <textarea
              rows={4}
              disabled={saving}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notes on what the ad looks like…"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </div>
        </section>

        {/* Step 3: Funnel */}
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            3. Funnel stage
          </h2>

          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px] flex-1">
              <label className="mb-1.5 block text-sm font-medium">Your choice</label>
              <select
                disabled={saving}
                value={funnelStage}
                onChange={(e) => setFunnelStage(e.target.value as FunnelStage)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
              >
                {FUNNEL_STAGES.map((stage) => (
                  <option key={stage} value={stage}>
                    {STAGE_LABELS[stage]} ({stage})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleClassify}
              disabled={!transcript.trim() || classifying || saving}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              {classifying ? "Analyzing…" : "Get AI recommendation"}
            </button>
          </div>

          {slotLoading ? (
            <p className="text-sm text-zinc-500">Checking next slot…</p>
          ) : stageFull ? (
            <p className="text-sm text-amber-800 dark:text-amber-200">
              {STAGE_LABELS[funnelStage]} is full ({SLOT_LIMITS[funnelStage]}/{SLOT_LIMITS[funnelStage]}).
            </p>
          ) : (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Will save to{" "}
              <span className="font-medium">
                {funnelStage} slot #{nextSlot}
              </span>
              .
            </p>
          )}

          {aiRecommendation && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm dark:border-blue-900 dark:bg-blue-950/40">
              <p className="font-medium text-blue-900 dark:text-blue-100">
                AI recommends: {STAGE_LABELS[aiRecommendation.funnel_stage]} (
                {aiRecommendation.funnel_stage})
              </p>
              <p className="mt-2 text-blue-800 dark:text-blue-200">
                {aiRecommendation.explanation}
              </p>
              {aiRecommendation.funnel_stage !== funnelStage && (
                <button
                  type="button"
                  onClick={applyRecommendation}
                  className="mt-3 text-sm font-medium text-blue-900 underline dark:text-blue-100"
                >
                  Apply recommendation
                </button>
              )}
            </div>
          )}
        </section>

        {saveProgress && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{saveProgress}</p>
        )}

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </div>
        )}

        {savedId && savedSummary && (
          <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
            Saved as <span className="font-medium">{savedSummary}</span>.{" "}
            <Link href={`/library/${savedId}`} className="underline">
              View in library
            </Link>
          </div>
        )}

        <button
          type="submit"
          disabled={saving || !transcript.trim() || stageFull}
          className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {saving ? "Saving…" : "Save to library"}
        </button>
      </form>
    </main>
  );
}
