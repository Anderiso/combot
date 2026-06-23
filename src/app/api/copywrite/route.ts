import { NextRequest, NextResponse } from "next/server";
import { copywriteScript } from "@/lib/copywrite-script";
import { parseFunnelStage } from "@/lib/funnel";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY is not configured." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const funnelStage = parseFunnelStage(String(body.funnel_stage ?? ""));
    const notes = typeof body.notes === "string" ? body.notes.trim() : "";

    if (!funnelStage) {
      return NextResponse.json(
        { error: "funnel_stage is required (TMOF or BOF)." },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();
    const { data: profile, error: profileError } = await supabase
      .from("brand_profile")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    const brandName = profile?.brand_title?.trim();
    const productDescription = profile?.product_description?.trim();
    const targetAudience = profile?.target_audience?.trim();

    if (!brandName || !productDescription || !targetAudience) {
      return NextResponse.json(
        {
          error:
            "Brand profile is incomplete. Set brand title, product description, and target audience on the Brand page.",
        },
        { status: 400 }
      );
    }

    const result = await copywriteScript({
      funnelStage,
      brandName,
      productDescription,
      targetAudience,
      notes: notes || undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Copywriting failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
