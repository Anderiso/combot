import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
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
    const { conceptId } = body;

    if (!conceptId) {
      return NextResponse.json({ error: "conceptId is required." }, { status: 400 });
    }

    const supabase = createServiceClient();

    const [{ data: concept, error: conceptError }, { data: profile, error: profileError }] =
      await Promise.all([
        supabase.from("concepts").select("*").eq("id", conceptId).single(),
        supabase
          .from("brand_profile")
          .select("*")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

    if (conceptError || !concept) {
      return NextResponse.json({ error: "Concept not found." }, { status: 404 });
    }

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const prompt = `You are an ecommerce ad creative strategist.

Given a competitor ad concept, generate 4-5 new ad ideas that keep the SAME core concept but vary setting and execution. Tailor them to this brand:

Brand: ${profile?.brand_title || "(not set)"}
Product: ${profile?.product_description || "(not set)"}
Target audience: ${profile?.target_audience || "(not set)"}

Original concept title: ${concept.title}
Funnel stage: ${concept.funnel_stage}
Visual description: ${concept.description || "(none)"}
Transcript: ${concept.transcript || "(none)"}

Return a numbered list of concise ad ideas (1-2 sentences each).`;

    const message = await anthropic.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    const ideas = textBlock?.type === "text" ? textBlock.text : "";

    return NextResponse.json({ ideas });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Remix failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
