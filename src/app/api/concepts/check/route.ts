import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import type { FunnelStage } from "@/lib/database.types";

const STAGES: FunnelStage[] = ["TOF", "MOF", "BOF"];

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const funnelStage = searchParams.get("funnel_stage");
  const number = searchParams.get("number");

  if (!funnelStage || !STAGES.includes(funnelStage as FunnelStage)) {
    return NextResponse.json(
      { error: "Invalid funnel_stage. Use TOF, MOF, or BOF." },
      { status: 400 }
    );
  }

  const parsedNumber = Number(number);
  if (!Number.isInteger(parsedNumber) || parsedNumber < 1 || parsedNumber > 100) {
    return NextResponse.json(
      { error: "Number must be an integer between 1 and 100." },
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
