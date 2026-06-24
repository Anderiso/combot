import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { ConceptDetail } from "@/components/ConceptDetail";
import type { ConceptTag, ConceptWithTag } from "@/lib/database.types";

export const dynamic = "force-dynamic";

export default async function ConceptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createServiceClient();

  const [{ data, error }, { data: tags, error: tagsError }] = await Promise.all([
    supabase
      .from("concepts")
      .select("*, tag:concept_tags(id, name)")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("concept_tags").select("*").order("name"),
  ]);

  if (error || !data || tagsError) {
    notFound();
  }

  const concept = {
    ...data,
    tag: Array.isArray(data.tag) ? data.tag[0] ?? null : data.tag,
  } as ConceptWithTag;

  return (
    <ConceptDetail concept={concept} tags={(tags ?? []) as ConceptTag[]} />
  );
}
