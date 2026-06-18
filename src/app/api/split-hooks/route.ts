import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { splitHooks, type HookSplitError } from "@/lib/hook-split";

export async function POST(request: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY is not configured." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { script, tone } = body;

    if (!script?.trim()) {
      return NextResponse.json({ error: "script is required." }, { status: 400 });
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

    const result = await splitHooks({
      script: script.trim(),
      brandName,
      productDescription,
      targetAudience,
      tone: tone?.trim() || "conversational, direct, short-form video ad",
    });

    return NextResponse.json(result);
  } catch (error) {
    if (isHookSplitError(error)) {
      return NextResponse.json(error, { status: 500 });
    }

    const message =
      error instanceof Error ? error.message : "Hook split failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function isHookSplitError(error: unknown): error is HookSplitError {
  return (
    typeof error === "object" &&
    error !== null &&
    "phase" in error &&
    (error as HookSplitError).phase === "hook_split"
  );
}
