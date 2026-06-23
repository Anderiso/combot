import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isFunnelStage, stageSlotLimit } from "@/lib/funnel";
import type { FunnelStage } from "@/lib/database.types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      funnel_stage,
      number,
      title,
      description,
      transcript,
      video_url,
      video_path,
    } = body;

    if (!isFunnelStage(funnel_stage)) {
      return NextResponse.json(
        { error: "Invalid funnel_stage." },
        { status: 400 }
      );
    }

    const max = stageSlotLimit(funnel_stage);
    if (!Number.isInteger(number) || number < 1 || number > max) {
      return NextResponse.json(
        { error: `Slot number must be between 1 and ${max} for ${funnel_stage}.` },
        { status: 400 }
      );
    }

    if (!title?.trim() || !video_url || !video_path) {
      return NextResponse.json(
        { error: "Missing required fields." },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("concepts")
      .insert({
        funnel_stage,
        number,
        title: title.trim(),
        description: description?.trim() || null,
        transcript: transcript || null,
        video_url,
        video_path,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          {
            error: `Slot ${funnel_stage} #${number} is already taken.`,
          },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ concept: data });
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
}

export async function GET() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("concepts")
    .select("*")
    .order("funnel_stage")
    .order("number");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ concepts: data });
}
