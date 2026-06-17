"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Concept } from "@/lib/database.types";

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

        <video
          src={concept.video_url}
          controls
          className="w-full rounded-xl border border-zinc-200 bg-black dark:border-zinc-800"
        />

        <div className="flex flex-wrap gap-3">
          <a
            href={concept.video_url}
            download
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Download video
          </a>
          <button
            type="button"
            onClick={handleRemix}
            disabled={remixing || deleting}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {remixing ? "Remixing…" : "Remix concept"}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting || remixing}
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
