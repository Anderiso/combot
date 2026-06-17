import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { parseFunnelStage } from "@/lib/funnel";
import type { FunnelStage } from "@/lib/database.types";

const FUNNEL_PROMPT = `You are classifying ecommerce video ad scripts by funnel stage based on audience awareness.

## Definitions

**TOF (Top of funnel)** — The ad appeals to a completely unaware audience, OR they are problem-aware but they are NOT:
- solution-aware (they don't know solutions exist for their problem)
- product/brand-aware (they don't know about brands selling solutions)
- convinced the problem is real and solvable

Hooks, pain agitation, "did you know" education, broad curiosity. No hard sell.

**MOF (Middle of funnel)** — The audience is solution-aware: they know the problem is real AND that solutions exist. They may or may not be product-aware — they might have seen other brands but are now evaluating this one. Comparisons, demos, social proof, "here's how it works."

**BOF (Bottom of funnel)** — The audience is problem-aware, solution-aware, AND product-aware. They know they can buy solutions and know about brands. The ad is about why THIS brand — offers, sales, urgency, guarantees, "buy now because we're 30% off."

## Task

Read the ad transcript below. Respond with valid JSON only, no markdown fences:
{"funnel_stage":"TOF"|"MOF"|"BOF","explanation":"2-4 sentences explaining which awareness levels the script assumes and why you chose this stage."}`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const transcript = (body.transcript as string | undefined)?.trim();

    if (!transcript) {
      return NextResponse.json(
        { error: "Transcript is required. Transcribe the video first." },
        { status: 400 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY is not configured." },
        { status: 500 }
      );
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await anthropic.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: `${FUNNEL_PROMPT}

Transcript:
${transcript}`,
        },
      ],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    const raw = textBlock?.type === "text" ? textBlock.text.trim() : "";

    let parsed: { funnel_stage?: string; explanation?: string } | null = null;

    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch {
      parsed = null;
    }

    const stage = parsed?.funnel_stage
      ? parseFunnelStage(parsed.funnel_stage)
      : parseFunnelStage(raw);

    if (!stage) {
      return NextResponse.json(
        {
          error: "Could not parse funnel recommendation from model response.",
          raw,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      funnel_stage: stage as FunnelStage,
      explanation:
        parsed?.explanation?.trim() ||
        "No explanation provided by the model.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Classification failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
