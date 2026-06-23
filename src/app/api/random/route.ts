import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { FUNNEL_STAGES } from "@/lib/funnel";
import type { FunnelStage } from "@/lib/database.types";

function pickRandom<T>(items: T[]): T | null {
  if (items.length === 0) return null;
  return items[Math.floor(Math.random() * items.length)];
}

export async function GET() {
  const supabase = createServiceClient();
  const { data, error } = await supabase.from("concepts").select("*");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const concepts = data ?? [];
  const result: Partial<Record<FunnelStage, (typeof concepts)[number]>> = {};

  for (const stage of FUNNEL_STAGES) {
    const stageConcepts = concepts.filter((c) => c.funnel_stage === stage);
    const picked = pickRandom(stageConcepts);
    if (picked) {
      result[stage] = picked;
    }
  }

  return NextResponse.json({ concepts: result });
}
