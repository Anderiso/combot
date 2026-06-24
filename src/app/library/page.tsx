import { createServiceClient } from "@/lib/supabase/server";
import { LibraryBrowser } from "@/components/LibraryBrowser";
import type { ConceptTag, ConceptWithTag } from "@/lib/database.types";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const supabase = createServiceClient();

  const [{ data: concepts, error }, { data: tags, error: tagsError }] =
    await Promise.all([
      supabase
        .from("concepts")
        .select("*, tag:concept_tags(id, name)")
        .order("number"),
      supabase.from("concept_tags").select("*").order("name"),
    ]);

  if (error) {
    return (
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          Failed to load concepts: {error.message}
        </div>
      </main>
    );
  }

  if (tagsError) {
    return (
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          Failed to load tags: {tagsError.message}
        </div>
      </main>
    );
  }

  const normalizedConcepts = (concepts ?? []).map((concept) => ({
    ...concept,
    tag: Array.isArray(concept.tag) ? concept.tag[0] ?? null : concept.tag,
  })) as ConceptWithTag[];

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <LibraryBrowser
        initialConcepts={normalizedConcepts}
        initialTags={(tags ?? []) as ConceptTag[]}
      />
    </main>
  );
}
