import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isFunnelStage, stageSlotLimit } from "@/lib/funnel";
import type { FunnelStage } from "@/lib/database.types";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const funnelStage = searchParams.get("funnel_stage");
  const number = searchParams.get("number");

  if (!funnelStage || !isFunnelStage(funnelStage)) {
    return NextResponse.json(
      { error: "Invalid funnel_stage. Use TMOF or BOF." },
      { status: 400 }
    );
  }

  const max = stageSlotLimit(funnelStage);
  const parsedNumber = Number(number);
  if (!Number.isInteger(parsedNumber) || parsedNumber < 1 || parsedNumber > max) {
    return NextResponse.json(
      { error: `Number must be an integer between 1 and ${max}.` },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("concepts")
    .select("id, title")
    .eq("funnel_stage", funnelStage)
    .eq("number", parsedNumber)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    available: !data,
    existing: data,
  });
}
