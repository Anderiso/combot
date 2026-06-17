import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServiceClient();

  const { data: concept, error: fetchError } = await supabase
    .from("concepts")
    .select("id, video_path, funnel_stage, number, title")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!concept) {
    return NextResponse.json({ error: "Concept not found." }, { status: 404 });
  }

  const { error: storageError } = await supabase.storage
    .from("videos")
    .remove([concept.video_path]);

  if (storageError) {
    return NextResponse.json(
      { error: `Failed to delete video: ${storageError.message}` },
      { status: 500 }
    );
  }

  const { error: deleteError } = await supabase
    .from("concepts")
    .delete()
    .eq("id", id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({
    deleted: concept,
    message: `${concept.funnel_stage} #${concept.number} is now free.`,
  });
}
