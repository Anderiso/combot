"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Concept, FunnelStage } from "@/lib/database.types";
import { videoFileName, videoStoragePath } from "@/lib/slug";
import { FUNNEL_STAGES, SLOT_LIMITS, STAGE_LABELS } from "@/lib/funnel";

const STAGES: FunnelStage[] = FUNNEL_STAGES;

function Collapsible({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium"
      >
        {title}
        <span className="text-zinc-500">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="border-t border-zinc-200 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:text-zinc-300">
          {children}
        </div>
      )}
    </div>
  );
}

export function ConceptDetail({ concept }: { concept: Concept }) {
  const router = useRouter();
  const [ideas, setIdeas] = useState<string | null>(null);
  const [remixError, setRemixError] = useState<string | null>(null);
  const [remixing, setRemixing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [funnelStage, setFunnelStage] = useState<FunnelStage>(
    concept.funnel_stage as FunnelStage
  );
  const [nextSlot, setNextSlot] = useState<number | null>(null);
  const [targetFull, setTargetFull] = useState(false);
  const [slotLoading, setSlotLoading] = useState(false);
  const [moving, setMoving] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [moveMessage, setMoveMessage] = useState<string | null>(null);
  const [title, setTitle] = useState(concept.title);
  const [savingTitle, setSavingTitle] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [titleMessage, setTitleMessage] = useState<string | null>(null);

  const stageChanged = funnelStage !== concept.funnel_stage;
  const titleChanged = title.trim() !== concept.title;

  useEffect(() => {
    setTitle(concept.title);
    setTitleMessage(null);
    setTitleError(null);
  }, [concept.title, concept.id]);

  useEffect(() => {
    setFunnelStage(concept.funnel_stage as FunnelStage);
    setMoveMessage(null);
    setMoveError(null);
  }, [concept.funnel_stage, concept.id, concept.number]);

  useEffect(() => {
    if (!stageChanged) {
      setNextSlot(null);
      setTargetFull(false);
      return;
    }

    let cancelled = false;

    async function loadNextSlot() {
      setSlotLoading(true);
      try {
        const res = await fetch(`/api/concepts/next-slot?funnel_stage=${funnelStage}`);
        const data = await res.json();

        if (cancelled) return;

        if (!res.ok) {
          throw new Error(data.error || "Could not load next slot.");
        }

        setNextSlot(data.next_number);
        setTargetFull(Boolean(data.full));
      } catch {
        if (!cancelled) {
          setNextSlot(null);
          setTargetFull(false);
        }
      } finally {
        if (!cancelled) {
          setSlotLoading(false);
        }
      }
    }

    void loadNextSlot();

    return () => {
      cancelled = true;
    };
  }, [funnelStage, stageChanged]);

  async function handleSaveTitle() {
    const trimmed = title.trim();
    if (!trimmed) {
      setTitleError("Title cannot be empty.");
      return;
    }

    if (!titleChanged) return;

    setSavingTitle(true);
    setTitleError(null);
    setTitleMessage(null);

    try {
      const res = await fetch(`/api/concepts/${concept.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Could not update title.");
      }

      setTitleMessage(data.message || "Title saved.");
      router.refresh();
    } catch (error) {
      setTitleError(error instanceof Error ? error.message : "Could not update title.");
    } finally {
      setSavingTitle(false);
    }
  }

  async function handleMoveStage() {
    if (!stageChanged || targetFull) return;

    setMoving(true);
    setMoveError(null);
    setMoveMessage(null);

    try {
      const res = await fetch(`/api/concepts/${concept.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ funnel_stage: funnelStage }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Could not move concept.");
      }

      setMoveMessage(data.message || `Moved to ${funnelStage}.`);
      router.refresh();
    } catch (error) {
      setMoveError(error instanceof Error ? error.message : "Could not move concept.");
    } finally {
      setMoving(false);
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      `Delete "${concept.title}" (${concept.funnel_stage} #${concept.number})? This frees that slot for a new upload.`
    );

    if (!confirmed) return;

    setDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch(`/api/concepts/${concept.id}`, { method: "DELETE" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Delete failed.");
      }

      router.push("/library");
      router.refresh();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Delete failed.");
    } finally {
      setDeleting(false);
    }
  }

  async function handleRemix() {
    setRemixing(true);
    setRemixError(null);
    setIdeas(null);

    try {
      const res = await fetch("/api/remix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conceptId: concept.id }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Remix failed.");
      }

      setIdeas(data.ideas);
    } catch (error) {
      setRemixError(error instanceof Error ? error.message : "Remix failed.");
    } finally {
      setRemixing(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
      <Link
        href="/library"
        className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
      >
        ← Back to library
      </Link>

      <div className="mt-6 space-y-6">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
            {concept.funnel_stage} · #{concept.number}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{concept.title}</h1>
        </div>

        <section className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
          <h2 className="mb-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Title
          </h2>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px] flex-1">
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500">
                Library name
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={savingTitle || moving || deleting || remixing}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
              />
            </div>
            <button
              type="button"
              onClick={handleSaveTitle}
              disabled={
                !titleChanged ||
                !title.trim() ||
                savingTitle ||
                moving ||
                deleting ||
                remixing
              }
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:bg-zinc-900"
            >
              {savingTitle ? "Saving…" : "Save title"}
            </button>
          </div>
          {titleChanged && title.trim() && (
            <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
              Video file will rename to{" "}
              <span className="font-mono">
                {videoStoragePath(concept.funnel_stage, concept.number, title.trim())}
              </span>
              .
            </p>
          )}
          {titleMessage && (
            <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">{titleMessage}</p>
          )}
          {titleError && (
            <p className="mt-2 text-xs text-red-700 dark:text-red-300">{titleError}</p>
          )}
        </section>

        <section className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
          <h2 className="mb-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Funnel stage
          </h2>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px] flex-1">
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500">
                Category
              </label>
              <select
                value={funnelStage}
                onChange={(e) => setFunnelStage(e.target.value as FunnelStage)}
                disabled={moving || deleting || remixing || savingTitle}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
              >
                {STAGES.map((stage) => (
                  <option key={stage} value={stage}>
                    {STAGE_LABELS[stage]} ({stage})
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={handleMoveStage}
              disabled={
                !stageChanged || moving || deleting || remixing || savingTitle || targetFull || slotLoading
              }
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:bg-zinc-900"
            >
              {moving ? "Moving…" : "Move to bucket"}
            </button>
          </div>
          {stageChanged && (
            <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
              {slotLoading
                ? "Checking next slot…"
                : targetFull
                  ? `${STAGE_LABELS[funnelStage]} is full (${SLOT_LIMITS[funnelStage]}/${SLOT_LIMITS[funnelStage]}).`
                  : nextSlot !== null
                    ? `Will move to ${funnelStage} slot #${nextSlot}. Slot ${concept.funnel_stage} #${concept.number} will be freed.`
                    : null}
            </p>
          )}
          {moveMessage && (
            <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">{moveMessage}</p>
          )}
          {moveError && (
            <p className="mt-2 text-xs text-red-700 dark:text-red-300">{moveError}</p>
          )}
        </section>

        <video
          src={concept.video_url}
          controls
          className="w-full rounded-xl border border-zinc-200 bg-black dark:border-zinc-800"
        />

        <div className="flex flex-wrap gap-3">
          <a
            href={concept.video_url}
            download={videoFileName(concept.title)}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Download video
          </a>
          <button
            type="button"
            onClick={handleRemix}
            disabled={remixing || deleting || savingTitle}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {remixing ? "Remixing…" : "Remix concept"}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting || remixing || savingTitle}
            className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>

        {deleteError && (
          <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
            {deleteError}
          </div>
        )}

        {concept.description && (
          <div>
            <h2 className="mb-2 text-sm font-medium">Description</h2>
            <p className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
              {concept.description}
            </p>
          </div>
        )}

        <Collapsible title="Transcript" defaultOpen={Boolean(concept.transcript)}>
          {concept.transcript ? (
            <p className="whitespace-pre-wrap">{concept.transcript}</p>
          ) : (
            <p className="text-zinc-500">No transcript available.</p>
          )}
        </Collapsible>

        {remixError && (
          <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
            {remixError}
          </div>
        )}

        {ideas && (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900/50">
            <h2 className="mb-3 text-sm font-medium">Remixed ideas</h2>
            <pre className="whitespace-pre-wrap font-sans text-sm text-zinc-700 dark:text-zinc-300">
              {ideas}
            </pre>
          </div>
        )}
      </div>
    </main>
  );
}
