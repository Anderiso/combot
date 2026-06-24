"use client";

import { useCallback, useMemo, useState } from "react";
import type { Concept } from "@/lib/database.types";
import { GENERATE_COUNTS, STAGE_LABELS } from "@/lib/funnel";

type GenerateResult = {
  TMOF: Concept[];
  BOF: Concept | null;
};

function Collapsible({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium"
      >
        {title}
        <span className="text-zinc-500">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="border-t border-zinc-200 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-800 dark:text-zinc-300">
          {children}
        </div>
      )}
    </div>
  );
}

function ConceptCard({ concept }: { concept: Concept }) {
  return (
    <article className="flex flex-col rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          {concept.funnel_stage} · #{concept.number}
        </p>
        <h2 className="mt-1 font-medium">{concept.title}</h2>
      </div>

      <video
        src={concept.video_url}
        controls
        className="aspect-video w-full bg-black"
      />

      <div className="flex flex-1 flex-col gap-3 p-4">
        <a
          href={concept.video_url}
          download
          className="inline-flex w-fit rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Download video
        </a>

        {concept.description && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{concept.description}</p>
        )}

        <Collapsible title="Transcript">
          {concept.transcript ? (
            <p className="whitespace-pre-wrap">{concept.transcript}</p>
          ) : (
            <p className="text-zinc-500">No transcript.</p>
          )}
        </Collapsible>
      </div>
    </article>
  );
}

export default function HomePage() {
  const [concepts, setConcepts] = useState<GenerateResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/random");
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to generate concepts.");
      }

      setConcepts(data.concepts);
      setHasGenerated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate.");
    } finally {
      setLoading(false);
    }
  }, []);

  const warnings = useMemo(() => {
    if (!concepts) return [];

    const messages: string[] = [];

    if (concepts.TMOF.length === 0) {
      messages.push("No TMOF concepts in the library yet.");
    } else if (concepts.TMOF.length < GENERATE_COUNTS.TMOF) {
      messages.push(
        `Only ${concepts.TMOF.length} TMOF concept${concepts.TMOF.length === 1 ? "" : "s"} available (wanted ${GENERATE_COUNTS.TMOF}).`
      );
    }

    if (!concepts.BOF) {
      messages.push("No BOF concepts in the library yet.");
    }

    return messages;
  }, [concepts]);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Generate concepts</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Pull {GENERATE_COUNTS.TMOF} random TMOF concepts and {GENERATE_COUNTS.BOF} BOF
            concept.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={generate}
            disabled={loading}
            className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {loading ? "Generating…" : hasGenerated ? "Re-roll" : "Generate"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}

      {!hasGenerated ? (
        <div className="rounded-xl border border-dashed border-zinc-300 px-6 py-16 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-500">
            Hit Generate to pull {GENERATE_COUNTS.TMOF} TMOF and {GENERATE_COUNTS.BOF} BOF
            concept{GENERATE_COUNTS.BOF === 1 ? "" : "s"}.
          </p>
        </div>
      ) : (
        <>
          {warnings.length > 0 && (
            <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
              {warnings.join(" ")}
            </div>
          )}

          <div className="space-y-10">
            <section>
              <h2 className="mb-4 text-lg font-medium">
                {STAGE_LABELS.TMOF} (TMOF)
              </h2>
              {concepts?.TMOF.length ? (
                <div className="grid gap-6 lg:grid-cols-3">
                  {concepts.TMOF.map((concept) => (
                    <ConceptCard key={concept.id} concept={concept} />
                  ))}
                </div>
              ) : (
                <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed border-zinc-300 text-sm text-zinc-500 dark:border-zinc-700">
                  No TMOF concepts yet
                </div>
              )}
            </section>

            <section>
              <h2 className="mb-4 text-lg font-medium">
                {STAGE_LABELS.BOF} (BOF)
              </h2>
              {concepts?.BOF ? (
                <div className="grid gap-6 lg:grid-cols-3">
                  <ConceptCard concept={concepts.BOF} />
                </div>
              ) : (
                <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed border-zinc-300 text-sm text-zinc-500 dark:border-zinc-700">
                  No BOF concepts yet
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </main>
  );
}
