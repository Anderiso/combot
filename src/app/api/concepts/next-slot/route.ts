import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { findNextSlot, isFunnelStage } from "@/lib/funnel";
import type { FunnelStage } from "@/lib/database.types";

export async function GET(request: NextRequest) {
  const funnelStage = request.nextUrl.searchParams.get("funnel_stage");

  if (!funnelStage || !isFunnelStage(funnelStage)) {
    return NextResponse.json(
      { error: "Invalid funnel_stage. Use TOF, MOF, or BOF." },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("concepts")
    .select("number")
    .eq("funnel_stage", funnelStage as FunnelStage)
    .order("number");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const nextNumber = findNextSlot((data ?? []).map((row) => row.number));

  if (nextNumber === null) {
    return NextResponse.json({
      funnel_stage: funnelStage,
      next_number: null,
      full: true,
    });
  }

  return NextResponse.json({
    funnel_stage: funnelStage,
    next_number: nextNumber,
    full: false,
  });
}
