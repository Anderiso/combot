import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { FUNNEL_STAGES, GENERATE_COUNTS, pickRandomItems } from "@/lib/funnel";
import type { Concept, FunnelStage } from "@/lib/database.types";

export async function GET() {
  const supabase = createServiceClient();
  const { data, error } = await supabase.from("concepts").select("*");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const concepts = (data ?? []) as Concept[];
  const result: {
    TMOF: Concept[];
    BOF: Concept | null;
  } = {
    TMOF: [],
    BOF: null,
  };

  for (const stage of FUNNEL_STAGES) {
    const stageConcepts = concepts.filter((c) => c.funnel_stage === stage);
    const count = GENERATE_COUNTS[stage as FunnelStage];
    const picked = pickRandomItems(stageConcepts, count);

    if (stage === "TMOF") {
      result.TMOF = picked;
    } else {
      result.BOF = picked[0] ?? null;
    }
  }

  return NextResponse.json({ concepts: result });
}
