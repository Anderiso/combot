import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { normalizeTagDescription, normalizeTagName } from "@/lib/tags";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let body: { name?: string; description?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const hasName = body.name !== undefined;
  const hasDescription = Object.prototype.hasOwnProperty.call(body, "description");

  if (!hasName && !hasDescription) {
    return NextResponse.json(
      { error: "Provide name and/or description to update." },
      { status: 400 }
    );
  }

  const updates: { name?: string; description?: string | null } = {};

  if (hasName) {
    const name = normalizeTagName(String(body.name));
    if (!name) {
      return NextResponse.json({ error: "Tag name is required." }, { status: 400 });
    }
    updates.name = name;
  }

  if (hasDescription) {
    updates.description = normalizeTagDescription(body.description);
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("concept_tags")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: `Tag "${updates.name}" already exists.` },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Tag not found." }, { status: 404 });
  }

  return NextResponse.json({ tag: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("concept_tags")
    .delete()
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Tag not found." }, { status: 404 });
  }

  return NextResponse.json({
    tag: data,
    message: `Deleted tag "${data.name}". Assigned entries are now untagged.`,
  });
}
