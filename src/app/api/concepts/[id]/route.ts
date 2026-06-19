import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { findNextSlot, isFunnelStage } from "@/lib/funnel";
import { videoStoragePath } from "@/lib/slug";
import type { FunnelStage } from "@/lib/database.types";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let body: { funnel_stage?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const newStage = body.funnel_stage?.trim().toUpperCase();
  if (!newStage || !isFunnelStage(newStage)) {
    return NextResponse.json(
      { error: "Invalid funnel_stage. Use TOF, MOF, or BOF." },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

  const { data: concept, error: fetchError } = await supabase
    .from("concepts")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!concept) {
    return NextResponse.json({ error: "Concept not found." }, { status: 404 });
  }

  if (concept.funnel_stage === newStage) {
    return NextResponse.json({
      concept,
      message: `Already in ${newStage}.`,
    });
  }

  const { data: targetRows, error: slotError } = await supabase
    .from("concepts")
    .select("number")
    .eq("funnel_stage", newStage as FunnelStage)
    .order("number");

  if (slotError) {
    return NextResponse.json({ error: slotError.message }, { status: 500 });
  }

  const nextNumber = findNextSlot((targetRows ?? []).map((row) => row.number));
  if (nextNumber === null) {
    return NextResponse.json(
      { error: `${newStage} is full (100/100). Delete a concept to free a slot.` },
      { status: 409 }
    );
  }

  const newPath = videoStoragePath(newStage, nextNumber, concept.title);

  const { error: moveError } = await supabase.storage
    .from("videos")
    .move(concept.video_path, newPath);

  if (moveError) {
    return NextResponse.json(
      { error: `Failed to move video: ${moveError.message}` },
      { status: 500 }
    );
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("videos").getPublicUrl(newPath);

  const { data: updated, error: updateError } = await supabase
    .from("concepts")
    .update({
      funnel_stage: newStage,
      number: nextNumber,
      video_path: newPath,
      video_url: publicUrl,
    })
    .eq("id", id)
    .select()
    .single();

  if (updateError) {
    await supabase.storage.from("videos").move(newPath, concept.video_path);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    concept: updated,
    message: `Moved from ${concept.funnel_stage} #${concept.number} to ${newStage} #${nextNumber}.`,
  });
}

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
