export function normalizeTagName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function normalizeTagDescription(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

export async function resolveTagId(
  tagId: string | null | undefined
): Promise<{ tagId: string | null } | { error: string }> {
  if (tagId === null || tagId === undefined || tagId === "") {
    return { tagId: null };
  }

  const { createServiceClient } = await import("@/lib/supabase/server");
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("concept_tags")
    .select("id")
    .eq("id", tagId)
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }

  if (!data) {
    return { error: "Tag not found." };
  }

  return { tagId: data.id };
}
