"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { ConceptTag, ConceptWithTag, FunnelStage } from "@/lib/database.types";
import { FUNNEL_STAGES } from "@/lib/funnel";
import { TagManagerPanel } from "@/components/TagManagerPanel";

const STAGES: FunnelStage[] = FUNNEL_STAGES;

type FilterValue = "all" | "untagged" | string;

type LibraryBrowserProps = {
  initialConcepts: ConceptWithTag[];
  initialTags: ConceptTag[];
};

export function LibraryBrowser({
  initialConcepts,
  initialTags,
}: LibraryBrowserProps) {
  const router = useRouter();
  const [tags, setTags] = useState(initialTags);
  const [filter, setFilter] = useState<FilterValue>("all");
  const [search, setSearch] = useState("");
  const [tagPanelOpen, setTagPanelOpen] = useState(false);

  useEffect(() => {
    setTags(initialTags);
  }, [initialTags]);

  const filteredConcepts = useMemo(() => {
    let results = initialConcepts;

    if (filter === "untagged") {
      results = results.filter((concept) => !concept.tag_id);
    } else if (filter !== "all") {
      results = results.filter((concept) => concept.tag_id === filter);
    }

    const query = search.trim().toLowerCase();
    if (query) {
      results = results.filter((concept) => {
        const titleMatch = concept.title.toLowerCase().includes(query);
        const tagMatch = concept.tag?.name.toLowerCase().includes(query) ?? false;
        return titleMatch || tagMatch;
      });
    }

    return results;
  }, [initialConcepts, filter, search]);

  const hasActiveFilters = filter !== "all" || search.trim().length > 0;

  const grouped = STAGES.map((stage) => ({
    stage,
    items: filteredConcepts.filter((concept) => concept.funnel_stage === stage),
  }));

  const visibleCount = filteredConcepts.length;
  const totalCount = initialConcepts.length;

  return (
    <>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Library</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {visibleCount === totalCount
              ? `${totalCount} concept${totalCount === 1 ? "" : "s"} stored`
              : `Showing ${visibleCount} of ${totalCount} concepts`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTagPanelOpen(true)}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Manage tags
          </button>
          <Link
            href="/load"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Load new
          </Link>
        </div>
      </div>

      {totalCount > 0 && (
        <div className="mb-6 flex flex-wrap items-end gap-4">
          <div className="min-w-[220px] flex-1">
            <label
              htmlFor="library-search"
              className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Search
            </label>
            <input
              id="library-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title or tag…"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </div>
          <div>
            <label
              htmlFor="library-tag-filter"
              className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Filter by tag
            </label>
            <select
              id="library-tag-filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
            >
              <option value="all">All concepts</option>
              <option value="untagged">Untagged</option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {totalCount === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 px-6 py-12 text-center text-sm text-zinc-500 dark:border-zinc-700">
          No concepts yet.{" "}
          <Link href="/load" className="underline">
            Upload your first video
          </Link>
          .
        </div>
      ) : visibleCount === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 px-6 py-12 text-center text-sm text-zinc-500 dark:border-zinc-700">
          {hasActiveFilters
            ? "No concepts match your search or tag filter."
            : "No concepts match this filter."}
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
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                            #{concept.number}
                          </p>
                          {concept.tag && (
                            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800 dark:bg-violet-950 dark:text-violet-200">
                              {concept.tag.name}
                            </span>
                          )}
                        </div>
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

      <TagManagerPanel
        open={tagPanelOpen}
        tags={tags}
        onClose={() => setTagPanelOpen(false)}
        onTagsChange={(newTags) => {
          setTags(newTags);
          router.refresh();
        }}
      />
    </>
  );
}
