import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import type { Concept, FunnelStage } from "@/lib/database.types";

const STAGES: FunnelStage[] = ["TOF", "MOF", "BOF"];

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("concepts")
    .select("*")
    .order("number");

  const concepts = (data ?? []) as Concept[];

  const grouped = STAGES.map((stage) => ({
    stage,
    items: concepts.filter((c) => c.funnel_stage === stage),
  }));

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Library</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {concepts.length} concept{concepts.length === 1 ? "" : "s"} stored
          </p>
        </div>
        <Link
          href="/load"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Load new
        </Link>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          Failed to load concepts: {error.message}
        </div>
      )}

      {concepts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 px-6 py-12 text-center text-sm text-zinc-500 dark:border-zinc-700">
          No concepts yet.{" "}
          <Link href="/load" className="underline">
            Upload your first video
          </Link>
          .
        </div>
      ) : (
        <div className="space-y-10">
          {grouped.map(({ stage, items }) => (
            <section key={stage}>
              <h2 className="mb-4 text-lg font-medium">{stage}</h2>
              {items.length === 0 ? (
                <p className="text-sm text-zinc-500">No concepts in this stage.</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((concept) => (
                    <Link
                      key={concept.id}
                      href={`/library/${concept.id}`}
                      className="group overflow-hidden rounded-xl border border-zinc-200 bg-white transition hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
                    >
                      <div className="aspect-video bg-zinc-100 dark:bg-zinc-900">
                        <video
                          src={concept.video_url}
                          className="h-full w-full object-cover"
                          muted
                          preload="metadata"
                        />
                      </div>
                      <div className="p-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                          #{concept.number}
                        </p>
                        <h3 className="mt-1 font-medium group-hover:underline">
                          {concept.title}
                        </h3>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
