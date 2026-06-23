import Anthropic from "@anthropic-ai/sdk";
import type { FunnelStage } from "@/lib/database.types";
import { countWords, parseJsonObject, stripJsonFences } from "@/lib/script-rewrite";
import {
  COPYWRITING_PRINCIPLES,
  copywritingPolishInstructions,
} from "@/lib/copywriting-principles";

const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? "claude-sonnet-4-6";
const COPYWRITE_DRAFT_MAX_TOKENS = Number(
  process.env.COPYWRITE_DRAFT_MAX_TOKENS ?? "4096"
);
const COPYWRITE_POLISH_MAX_TOKENS = Number(
  process.env.COPYWRITE_POLISH_MAX_TOKENS ?? "4096"
);

const FUNNEL_GUIDANCE: Record<FunnelStage, string> = {
  TMOF: `Funnel: TMOF (top / middle of funnel).
Audience is unaware, problem-aware, or solution-aware — but not fully product-aware and ready to buy. Lead with hooks, pain, education, proof, demos, and social proof. Do not hard-sell. No price, no offer, no "buy now."`,
  BOF: `Funnel: BOF (bottom of funnel).
Audience is problem-aware, solution-aware, AND product-aware. They are ready to buy — convince them why THIS brand right NOW. Lean on offers, urgency, guarantees, risk reversal, and a clear call to action.`,
};

function buildCopywriteDraftPrompt(params: {
  funnelStage: FunnelStage;
  brandName: string;
  productDescription: string;
  targetAudience: string;
  notes?: string;
}): string {
  const notesBlock = params.notes?.trim()
    ? `\n== CREATOR NOTES ==\n${params.notes.trim()}\n`
    : "";

  return `You are an elite direct-response copywriter who specialises in short-form video ad scripts for ecommerce.

Write a spoken ad script from scratch for the brand below. The script should sound natural when read aloud — like a real creator talking to camera, not a brochure.

${FUNNEL_GUIDANCE[params.funnelStage]}

== BRAND ==
Name: ${params.brandName}
Product: ${params.productDescription}
Target audience: ${params.targetAudience}
${notesBlock}
== DRAFT GUIDANCE ==
- Write a complete script with a strong opening hook, a clear middle, and a closing line appropriate for this funnel stage.
- Aim for roughly 80–150 words unless the notes ask for something different.
- Do not include stage directions, scene labels, or markdown.

${COPYWRITING_PRINCIPLES}

== OUTPUT (strict JSON, no markdown fences) ==
{
  "draft_script": "the complete draft script as one continuous piece of spoken copy"
}

Return ONLY the JSON object.`;
}

function buildCopywritePolishPrompt(draftScript: string): string {
  return `${copywritingPolishInstructions()}

== DRAFT TO POLISH ==
${draftScript}

== OUTPUT (strict JSON, no markdown fences) ==
{
  "script": "the final polished script as one continuous piece of spoken copy"
}

Return ONLY the JSON object.`;
}

async function callClaudeForScriptField(
  client: Anthropic,
  prompt: string,
  field: "draft_script" | "script",
  maxTokens: number
): Promise<string> {
  const msg = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });

  if (msg.stop_reason === "max_tokens") {
    throw new Error("Claude response was cut off — please retry.");
  }

  const textBlock = msg.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text content.");
  }

  try {
    const parsed = parseJsonObject(textBlock.text);
    const script = String(parsed[field] ?? "").trim();
    if (script) {
      return script;
    }
  } catch {
    // Fall through to plain-text extraction below.
  }

  const plain = stripJsonFences(textBlock.text).trim();
  if (plain) {
    return plain;
  }

  throw new Error("Claude returned an empty script.");
}

export type CopywriteScriptInput = {
  funnelStage: FunnelStage;
  brandName: string;
  productDescription: string;
  targetAudience: string;
  notes?: string;
  client?: Anthropic;
};

export type CopywriteScriptResult = {
  script: string;
  word_count: number;
  funnel_stage: FunnelStage;
};

export async function copywriteScript(
  input: CopywriteScriptInput
): Promise<CopywriteScriptResult> {
  const client =
    input.client ??
    new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const draftScript = await callClaudeForScriptField(
    client,
    buildCopywriteDraftPrompt({
      funnelStage: input.funnelStage,
      brandName: input.brandName,
      productDescription: input.productDescription,
      targetAudience: input.targetAudience,
      notes: input.notes,
    }),
    "draft_script",
    COPYWRITE_DRAFT_MAX_TOKENS
  );

  const script = await callClaudeForScriptField(
    client,
    buildCopywritePolishPrompt(draftScript),
    "script",
    COPYWRITE_POLISH_MAX_TOKENS
  );

  return {
    script,
    word_count: countWords(script),
    funnel_stage: input.funnelStage,
  };
}
