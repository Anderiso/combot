import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { normalizeTagDescription, normalizeTagName } from "@/lib/tags";

export async function GET() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("concept_tags")
    .select("*")
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tags: data ?? [] });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = normalizeTagName(String(body.name ?? ""));
    const description = normalizeTagDescription(body.description);

    if (!name) {
      return NextResponse.json({ error: "Tag name is required." }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("concept_tags")
      .insert({ name, description })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: `Tag "${name}" already exists.` },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ tag: data });
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
}
