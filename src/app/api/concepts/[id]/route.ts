import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { findNextSlot, isFunnelStage, stageSlotLimit } from "@/lib/funnel";
import { videoStoragePath } from "@/lib/slug";
import { resolveTagId } from "@/lib/tags";
import type { FunnelStage } from "@/lib/database.types";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let body: { funnel_stage?: string; title?: string; tag_id?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const rawTitle = body.title?.trim();
  const rawStage = body.funnel_stage?.trim().toUpperCase();
  const hasTagUpdate = Object.prototype.hasOwnProperty.call(body, "tag_id");

  if (rawTitle === undefined && rawStage === undefined && !hasTagUpdate) {
    return NextResponse.json(
      { error: "Provide title, funnel_stage, and/or tag_id to update." },
      { status: 400 }
    );
  }

  if (rawTitle !== undefined && !rawTitle) {
    return NextResponse.json({ error: "Title cannot be empty." }, { status: 400 });
  }

  if (rawStage !== undefined && !isFunnelStage(rawStage)) {
    return NextResponse.json(
      { error: "Invalid funnel_stage. Use TMOF or BOF." },
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

  const targetTitle = rawTitle ?? concept.title;
  const targetStage = (rawStage ?? concept.funnel_stage) as FunnelStage;
  const stageChanging = rawStage !== undefined && targetStage !== concept.funnel_stage;
  const titleChanging = rawTitle !== undefined && targetTitle !== concept.title;

  let targetTagId = concept.tag_id;
  if (hasTagUpdate) {
    const resolvedTag = await resolveTagId(body.tag_id);
    if ("error" in resolvedTag) {
      return NextResponse.json({ error: resolvedTag.error }, { status: 400 });
    }
    targetTagId = resolvedTag.tagId;
  }

  const tagChanging = hasTagUpdate && targetTagId !== concept.tag_id;

  if (!stageChanging && !titleChanging && !tagChanging) {
    return NextResponse.json({
      concept,
      message: "No changes to save.",
    });
  }

  if (!stageChanging && !titleChanging && tagChanging) {
    const { data: updated, error: updateError } = await supabase
      .from("concepts")
      .update({ tag_id: targetTagId })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      concept: updated,
      message: targetTagId ? "Tag updated." : "Tag removed.",
    });
  }

  let targetNumber = concept.number;

  if (stageChanging) {
    const { data: targetRows, error: slotError } = await supabase
      .from("concepts")
      .select("number")
      .eq("funnel_stage", targetStage)
      .order("number");

    if (slotError) {
      return NextResponse.json({ error: slotError.message }, { status: 500 });
    }

    const max = stageSlotLimit(targetStage);
    const nextNumber = findNextSlot((targetRows ?? []).map((row) => row.number), max);
    if (nextNumber === null) {
      return NextResponse.json(
        { error: `${targetStage} is full (${max}/${max}). Delete a concept to free a slot.` },
        { status: 409 }
      );
    }

    targetNumber = nextNumber;
  }

  const newPath = videoStoragePath(targetStage, targetNumber, targetTitle);
  const pathChanging = newPath !== concept.video_path;

  if (pathChanging) {
    const { error: moveError } = await supabase.storage
      .from("videos")
      .move(concept.video_path, newPath);

    if (moveError) {
      return NextResponse.json(
        { error: `Failed to move video: ${moveError.message}` },
        { status: 500 }
      );
    }
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("videos").getPublicUrl(newPath);

  const { data: updated, error: updateError } = await supabase
    .from("concepts")
    .update({
      title: targetTitle,
      funnel_stage: targetStage,
      number: targetNumber,
      video_path: newPath,
      video_url: publicUrl,
      tag_id: targetTagId,
    })
    .eq("id", id)
    .select()
    .single();

  if (updateError) {
    if (pathChanging) {
      await supabase.storage.from("videos").move(newPath, concept.video_path);
    }
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const messages: string[] = [];
  if (titleChanging) {
    messages.push(`Title updated to "${targetTitle}".`);
  }
  if (stageChanging) {
    messages.push(
      `Moved from ${concept.funnel_stage} #${concept.number} to ${targetStage} #${targetNumber}.`
    );
  }
  if (tagChanging) {
    messages.push(targetTagId ? "Tag updated." : "Tag removed.");
  }

  return NextResponse.json({
    concept: updated,
    message: messages.join(" "),
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
